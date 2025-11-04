import { NextResponse } from 'next/server'
import { callOpenRouter, callOpenAI } from '@/lib/openrouter'

function buildStructuredInstruction(preferences: any) {
  // Preferences can include minPrice, maxPrice, minRating, preferDelivery, preferReliability, inStockOnly
  const parts: string[] = []
  if (!preferences) return ''
  if (preferences.minRating) parts.push(`Only consider products with rating >= ${preferences.minRating}.`)
  if (preferences.maxPrice) parts.push(`Prefer products priced <= ${preferences.maxPrice}.`)
  if (preferences.inStockOnly) parts.push(`Exclude products that are out of stock.`)
  if (preferences.preferDelivery) parts.push(`Prioritize faster delivery time.`)
  if (preferences.preferReliability) parts.push(`Prioritize seller reliability.`)
  return parts.join(' ')
}

function buildPrompt(products: any[], userMessages: any[] = [], preferences?: any) {
  // We instruct the model to output only JSON following this schema:
  // { table: [{ id, name, price, rating, deliveryDays, reliability, inStock, score, pros, cons }], verdict: string, recommendation: { productId, reason }, reasoning: string }
  const prefInstructions = buildStructuredInstruction(preferences)
  const productLines = products
    .map((p: any, i: number) => {
      const specs = p.specs && Object.keys(p.specs || {}).length ? `Specifications: ${Object.entries(p.specs || {}).map(([k, v]) => `${k}: ${v}`).join('; ')}` : ''
      return `Product ${i + 1}: ${p.name}\n- id: ${p.id}\n- price: ${p.price}\n- rating: ${p.rating}\n- deliveryDays: ${p.deliveryDays ?? 3}\n- reliability: ${p.reliability ?? 95}\n- inStock: ${p.inStock ? 'true' : 'false'}\n${specs}\n- description: ${p.description || ''}`
    })
    .join('\n\n')

  const system = `You are an assistant that compares products. Output ONE valid JSON object only (no markdown, no explanation) with the following keys: table (array of products with fields id,name,price,rating,deliveryDays,reliability,inStock,score,pros,cons), verdict (short string), recommendation (object { productId, reason }), and reasoning (detailed string). ${prefInstructions}`

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: `Here are the products:\n\n${productLines}` },
  ]

  // append prior conversation messages (if any) to provide context
  if (Array.isArray(userMessages) && userMessages.length > 0) {
    userMessages.forEach((m: any) => messages.push({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }))
  }

  return messages
}

export async function POST(req: Request) {
  try {
    const { products = [], query = '', messages = [], preferences = {} } = await req.json()
    // Build messages for the LLM including any conversation history
    const llmMessages = buildPrompt(products, messages, preferences)
    // Append the immediate user query (if any) so the model responds directly to it
    if (query && typeof query === 'string' && query.trim().length > 0) {
      llmMessages.push({ role: 'user', content: query })
    }

    // If OPENROUTER_API_KEY is configured, forward to OpenRouter (user can enable it)
    let openRouterNote: string | undefined = undefined
    // Try OpenRouter via helper service (encapsulates retry/timeout)
    if (process.env.OPENROUTER_API_KEY) {
      try {
        // Request the OpenRouter model using the correct model identifier
        const resp = await callOpenRouter(llmMessages, 'openai/gpt-oss-20b:free')

        // If helper returned a structured error object instead of throwing, handle it here.
        if (resp?.error) {
          console.error('OpenRouter returned error object', resp)
          openRouterNote = `OpenRouter error: ${resp.error}`

          // Try OpenAI fallback if configured
          if (process.env.OPENAI_API_KEY) {
            try {
              const resp2 = await callOpenAI(llmMessages as any, 'gpt-4o-mini')
              const assistant2 = resp2?.raw
              try {
                const parsed2 = typeof assistant2 === 'string' ? JSON.parse(assistant2) : assistant2
                return NextResponse.json({ analysis: parsed2, source: 'openai', meta: resp2?.meta })
              } catch (e2) {
                return NextResponse.json({ analysis: { raw: assistant2 }, source: 'openai', parseError: String(e2), meta: resp2?.meta })
              }
            } catch (openaiErr: any) {
              console.error('OpenAI fallback error', openaiErr)
              openRouterNote += `; OpenAI fallback error: ${openaiErr?.message || String(openaiErr)}`
            }
          }

          // continue to local fallback (below) with note attached
        }

        const assistant = resp?.raw

        // Normalize assistant into either a structured analysis object or a raw text field
        const makeRaw = (val: any) => ({ raw: typeof val === 'string' ? val : JSON.stringify(val), meta: resp?.meta })

        // If assistant is a string, attempt to parse JSON. If it parses to an object with expected keys,
        // return it as structured analysis. Otherwise return as raw text (so client shows conversational reply).
        if (typeof assistant === 'string') {
          try {
            let parsed: any = JSON.parse(assistant)
            // If parsed is an array where the first element is the structured analysis, unwrap it
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] && typeof parsed[0] === 'object') {
              // parsed may be [{ analysis... }] or [{ table... }]
              parsed = parsed[0]
            }

            // If the model returned an envelope like { analysis: {...}, reply: '...' }
            let parsedAnalysis = parsed?.analysis || parsed
            // ensure parsedAnalysis is an object
            if (parsedAnalysis && typeof parsedAnalysis === 'object' && (parsedAnalysis.verdict || parsedAnalysis.table || parsedAnalysis.recommendation)) {
              // conversational reply preference: use parsed.reply if provided, otherwise synthesize from verdict/recommendation
              const reply = parsed?.reply || parsedAnalysis.verdict || (parsedAnalysis.recommendation ? String(parsedAnalysis.recommendation.reason) : undefined)
              return NextResponse.json({ analysis: parsedAnalysis, reply, source: 'openrouter', meta: resp?.meta })
            }

            // Not a recognized structured analysis — return raw text so client can display conversational reply
            return NextResponse.json({ analysis: { raw: assistant }, reply: assistant, source: 'openrouter', meta: resp?.meta })
          } catch (e) {
            // not JSON — return raw text so client shows the assistant reply conversationally
            return NextResponse.json({ analysis: { raw: assistant }, reply: assistant, source: 'openrouter', parseError: String(e), meta: resp?.meta })
          }
        }

        // If assistant is already an object/array (sometimes API returns parsed shapes), handle accordingly
        if (Array.isArray(assistant)) {
          // Many times an array like [{source: 'openrouter'}] is unhelpful — return it as raw text + meta
          return NextResponse.json({ analysis: { raw: JSON.stringify(assistant) }, source: 'openrouter', meta: resp?.meta })
        }

        if (assistant && typeof assistant === 'object') {
          // If it looks like the structured analysis, return it. If it's an envelope {analysis, reply}, handle that too.
          const maybeAnalysis = assistant.analysis || assistant
          if (maybeAnalysis && (maybeAnalysis.verdict || maybeAnalysis.table || maybeAnalysis.recommendation)) {
            const reply = assistant.reply || maybeAnalysis.verdict || (maybeAnalysis.recommendation ? String(maybeAnalysis.recommendation.reason) : undefined)
            return NextResponse.json({ analysis: maybeAnalysis, reply, source: 'openrouter', meta: resp?.meta })
          }
          return NextResponse.json({ analysis: { raw: JSON.stringify(assistant) }, reply: JSON.stringify(assistant), source: 'openrouter', meta: resp?.meta })
        }
      } catch (err: any) {
        console.error('OpenRouter helper error', err)
        openRouterNote = `OpenRouter error: ${err?.message || String(err)}`
        // if user configured OpenAI key, try that as a fallback
        if (process.env.OPENAI_API_KEY) {
          try {
            const resp2 = await callOpenAI(llmMessages as any, 'gpt-4o-mini')
            const assistant2 = resp2?.raw
            try {
              const parsed2 = typeof assistant2 === 'string' ? JSON.parse(assistant2) : assistant2
              return NextResponse.json({ analysis: parsed2, source: 'openai' })
            } catch (e2) {
              return NextResponse.json({ analysis: { raw: assistant2 }, source: 'openai', parseError: String(e2), meta: resp2?.meta })
            }
          } catch (openaiErr: any) {
            console.error('OpenAI fallback error', openaiErr)
            openRouterNote += `; OpenAI fallback error: ${openaiErr?.message || String(openaiErr)}`
          }
        }
      }
    }

    // Local fallback: generate a structured JSON analysis
    const table = products.map((p: any) => {
      const score = (p.rating || 0) * 2 - (p.price || 0) / 100 + ((p.inStock ? 1 : 0) * 10) + ((p.reliability || 90) / 10)
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        rating: p.rating,
        deliveryDays: p.deliveryDays ?? 3,
        reliability: p.reliability ?? 95,
        inStock: !!p.inStock,
        score: Math.round(score * 10) / 10,
        pros: [],
        cons: [],
      }
    })

    // simple heuristics for pros/cons
    table.forEach((t: any) => {
      if (t.price < Math.min(...table.map((x: any) => x.price))) t.pros.push('Lowest price')
      if (t.rating >= Math.max(...table.map((x: any) => x.rating))) t.pros.push('Top rated')
      if (t.deliveryDays <= Math.min(...table.map((x: any) => x.deliveryDays))) t.pros.push('Fast delivery')
      if (!t.inStock) t.cons.push('Out of stock')
      if (t.reliability < 80) t.cons.push('Lower seller reliability')
    })

    // pick recommendation as highest score
    const sorted = [...table].sort((a: any, b: any) => b.score - a.score)
    const recommendation = sorted[0] ? { productId: sorted[0].id, reason: `Highest combined score (${sorted[0].score})` } : null

    const analysisObj: any = {
      table,
      verdict: recommendation ? `Recommended: ${sorted[0].name}` : 'No clear recommendation',
      recommendation,
      reasoning: `Local heuristics used: rating, price, deliveryDays, reliability. Preferences: ${JSON.stringify(preferences || {})}`,
    }

    if (openRouterNote) analysisObj.note = openRouterNote

    return NextResponse.json({ analysis: analysisObj, source: 'local' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to analyze' }, { status: 500 })
  }
}
 
