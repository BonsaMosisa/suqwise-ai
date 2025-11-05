import { NextResponse } from "next/server"
import { callOpenRouter, callOpenAI } from "@/lib/openrouter"

// Try to extract a JSON block from free-form assistant text. Handles fenced code blocks
// like ```json { ... } ``` as well as extracting the first {...}..} substring.
function extractJSONFromText(text: string | undefined): string | null {
  if (!text || typeof text !== "string") return null
  // fenced ```json blocks
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced && fenced[1]) return fenced[1].trim()

  // try to find a top-level JSON object by locating the first { and the last }
  const first = text.indexOf("{")
  const last = text.lastIndexOf("}")
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1)
  }
  return null
}

function buildStructuredInstruction(preferences: any) {
  // Preferences can include minPrice, maxPrice, minRating, preferDelivery, preferReliability, inStockOnly
  const parts: string[] = []
  if (!preferences) return ""
  if (preferences.minRating) parts.push(`Only consider products with rating >= ${preferences.minRating}.`)
  if (preferences.maxPrice) parts.push(`Prefer products priced <= ${preferences.maxPrice}.`)
  if (preferences.inStockOnly) parts.push(`Exclude products that are out of stock.`)
  if (preferences.preferDelivery) parts.push(`Prioritize faster delivery time.`)
  if (preferences.preferReliability) parts.push(`Prioritize seller reliability.`)
  return parts.join(" ")
}

function buildPrompt(products: any[], userMessages: any[] = [], preferences?: any, mode?: string) {
  // We instruct the model to output only JSON following this schema:
  // { reply: string, analysis: { table: [{ name, price, rating, deliveryDays, reliability, inStock, seller, reviews, score, pros, cons }], verdict: string, recommendation: { productId, seller, reason }, reasoning: string } }
  const prefInstructions = buildStructuredInstruction(preferences)
  const productLines = products
    .map((p: any, i: number) => {
      const specs =
        p.specs && Object.keys(p.specs || {}).length
          ? `Specifications: ${Object.entries(p.specs || {})
              .map(([k, v]) => `${k}: ${v}`)
              .join("; ")}`
          : ""

      // Collect a small set of recent reviews to send to the model (limit length and count)
      let reviewsText = ""
      if (Array.isArray(p.comments) && p.comments.length > 0) {
        const maxReviews = 6
        reviewsText = p.comments
          .slice(0, maxReviews)
          .map((c: any) => {
            const txt = (c.text || c.comment || "").toString().replace(/\s+/g, " ").trim()
            const short = txt.length > 280 ? txt.slice(0, 277) + "..." : txt
            const rating = c.rating ?? ""
            const author = (c.author && (c.author.name || c.author)) || (c.authorName || "")
            return `- [${rating}] ${short} ${author ? `(by ${author})` : ""}`
          })
          .join("\n")
      }

      const seller = (p.owner && (p.owner.name || p.owner)) || p.ownerName || p.seller || p.store || ""

      return `Product ${i + 1}: ${p.name}\n- id: ${p.id}\n- price: ${p.price}\n- rating: ${p.rating}\n- deliveryDays: ${p.deliveryDays ?? 3}\n- reliability: ${p.reliability ?? 95}\n- inStock: ${p.inStock ? "true" : "false"}\n${specs}\n- description: ${p.description || ""}\n- about: ${p.about || ""}\n- seller: ${seller}\n- reviews:\n${reviewsText}`
    })
    .join("\n\n")

  // Request a stable JSON envelope when appropriate, but be conversational and follow-up aware.
  const systemBase = `You are an expert product comparison assistant. You MUST follow these rules in order of priority:

- If this is the very first analysis request for the provided product set (there is no prior conversation history), produce a full, detailed comparison: return a JSON envelope with a long "analysis.table" comparing the products (name, price, rating, deliveryDays, reliability, inStock, seller, reviews, score, pros, cons), a clear "verdict", a single-item "recommendation" and a concise "reply" summarizing the recommendation. The table should be machine-readable and complete.

- For any subsequent user messages (follow-ups) you MUST treat them as conversational: read the conversation history, pay attention to the most recent user query, and reply directly to that query in plain conversational text (1-3 short paragraphs). Only include an updated "analysis" (table) if the user explicitly asked to re-run or change the comparison (for example: "recompute ranking giving more weight to delivery" or "show me only pros and cons"). Do NOT repeat the entire original table on every follow-up unless requested.

- Always return a JSON envelope when feasible with this shape: { "reply": string, "analysis": { table: [...], verdict: string, recommendation: { productId: <id>, seller: <seller name>, reason: string }, reasoning: string } } . If you cannot produce the structured fields exactly, still return the best possible JSON you can (for example, { analysis: { raw: "..." }, reply: "..." }).

- When reasoning about recommendations, reference evidence from the product fields and recent reviews you were given (seller, ratings, review snippets). If you cite user reviews, include short quoted snippets or counts.

- DO NOT output any non-JSON prose outside the JSON envelope unless the user explicitly asked for a narrative-only reply. If you must include prose for readability inside the reply field, keep it short.

Examples:
- Initial request (no history): return full analysis.table + reply summarizing the top recommendation.
- Follow-up: user asks "Which seller has the fastest delivery?": reply with the answer and a short justification; only include an updated table if the user asked to re-run the comparison.

  Always respect the user's stated preferences when present. ${prefInstructions}`
  // If a caller explicitly provided a mode flag, prefer that for deciding initial vs follow-up behavior.
  const system = mode === "followup" ?
    // followup mode: be conversational and only include a table if explicitly requested
    systemBase.replace('- If this is the very first analysis request for the provided product set (there is no prior conversation history), produce a full, detailed comparison: return a JSON envelope with a long "analysis.table" comparing the products (name, price, rating, deliveryDays, reliability, inStock, seller, reviews, score, pros, cons), a clear "verdict", a single-item "recommendation" and a concise "reply" summarizing the recommendation. The table should be machine-readable and complete.','- This is a follow-up request: treat the latest user message as the primary query and respond conversationally in 1-3 short paragraphs. Only include an updated analysis.table if the user explicitly asks to re-run or change the comparison.' ) : systemBase

  // Extra instruction: prefer identifying products by their seller/store name when possible
  // and analyze the provided reviews for each product. Include a `seller` field and a `reviews` array (short strings) in each table row.

  const messages = [
    { role: "system", content: system },
    { role: "user", content: `Here are the products:\n\n${productLines}` },
  ]

  // append prior conversation messages (if any) to provide context
  if (Array.isArray(userMessages) && userMessages.length > 0) {
    userMessages.forEach((m: any) =>
      messages.push({ role: m.role === "ai" ? "assistant" : "user", content: m.content }),
    )
  }

  return messages
}

export async function POST(req: Request) {
  try {
  const { products = [], query = "", messages = [], preferences = {}, mode } = await req.json()
    // Helper: normalize analysis.table rows to include productId and disambiguated names.
    function normalizeAnalysisTable(analysis: any, productsList: any[]) {
      if (!analysis || !Array.isArray(analysis.table)) return analysis
      const tbl = analysis.table.map((row: any, idx: number) => {
        const copy = { ...row }
        // Try to ensure numeric fields
        if (copy.price !== undefined) copy.price = Number(copy.price)
        if (copy.rating !== undefined) copy.rating = Number(copy.rating)
        if (copy.deliveryDays !== undefined) copy.deliveryDays = Number(copy.deliveryDays)

        // Attach productId if missing by best-effort matching. Prefer seller/store match first.
        if (!copy.productId && productsList && productsList.length > 0) {
          const sellerKey = (copy.seller || copy.store || copy.vendor || copy.owner || '').toString().trim().toLowerCase()
          let matched: any = null
          if (sellerKey) {
            matched = productsList.find((p: any) => {
              const ownerName = ((p.owner && (p.owner.name || p.owner)) || p.ownerName || '').toString().trim().toLowerCase()
              return ownerName && ownerName === sellerKey
            })
          }

          // fallback to name+price matching
          if (!matched) {
            const name = (copy.name || '').toString().trim().toLowerCase()
            const price = copy.price
            matched = productsList.find((p: any) => (p.name || '').toString().trim().toLowerCase() === name && (price === undefined || Number(p.price) === Number(price)))
          }
          if (!matched && copy.price !== undefined) {
            matched = productsList.find((p: any) => Number(p.price) === Number(copy.price))
          }
          if (!matched && (copy.name || '')) {
            const name = (copy.name || '').toString().trim().toLowerCase()
            matched = productsList.find((p: any) => (p.name || '').toString().trim().toLowerCase().includes(name) || name.includes((p.name || '').toString().trim().toLowerCase()))
          }
          if (matched) copy.productId = matched.id
        }

        // Ensure name includes seller/store and a visible display id for clarity
        if (copy.productId) {
          const displayId = `#${copy.productId}`
          const sellerLabel = copy.seller ? ` (by ${copy.seller})` : ''
          // avoid duplicating seller label
          if (!(copy.name || '').toString().includes(sellerLabel.trim())) copy.name = `${copy.name}${sellerLabel}`
          // append display id if not already present
          if (!(copy.name || '').toString().includes(displayId)) copy.name = `${copy.name} ${displayId}`
          copy.displayId = displayId
        }
        return copy
      })
      return { ...analysis, table: tbl }
    }

    // Finalize responses so any returned analysis is normalized consistently.
    const replaceIdsInReply = (reply: string, productsList: any[]) => {
      if (!reply || !Array.isArray(productsList)) return reply
      let out = String(reply)
      productsList.forEach((p: any) => {
        const seller = (p.owner && (p.owner.name || p.owner)) || p.ownerName || p.seller || p.store || ''
        const sellerLabel = seller ? `by ${seller}` : ''
        const displayId = `#${p.id}`
        const labelWithId = seller ? `${sellerLabel} (${displayId})` : displayId

        // replace occurrences like (id 4)
        out = out.replace(new RegExp(`\\(id\\s*${p.id}\\)`, 'g'), `(${labelWithId})`)
        // id: 4 or id 4
        out = out.replace(new RegExp(`id[:\\s]*${p.id}`, 'g'), labelWithId)
        // product 4 or product #4 (case-insensitive)
        out = out.replace(new RegExp(`product\\s+#?\\s*${p.id}`, 'gi'), labelWithId)
        // standalone #4
        out = out.replace(new RegExp(`#${p.id}\\b`, 'g'), displayId)
      })
      return out
    }

    const finalize = (payload: any) => {
      if (payload && payload.analysis) payload.analysis = normalizeAnalysisTable(payload.analysis, products)
      if (payload && typeof payload.reply === 'string') payload.reply = replaceIdsInReply(payload.reply, products)
      return NextResponse.json(payload)
    }
    // Build messages for the LLM including any conversation history
  const llmMessages = buildPrompt(products, messages, preferences, mode)
    // Append the immediate user query (if any) so the model responds directly to it
    if (query && typeof query === "string" && query.trim().length > 0) {
      llmMessages.push({ role: "user", content: query })
    }

    // If OPENROUTER_API_KEY is configured, forward to OpenRouter (user can enable it)
    let openRouterNote: string | undefined = undefined
    // Try OpenRouter via helper service (encapsulates retry/timeout)
    if (process.env.OPENROUTER_API_KEY) {
      try {
        // Request the OpenRouter model using the correct model identifier
        const resp = await callOpenRouter(llmMessages, "openai/gpt-oss-20b:free")

        // If helper returned a structured error object instead of throwing, handle it here.
        if (resp?.error) {
          console.error("OpenRouter returned error object", resp)
          openRouterNote = `OpenRouter error: ${resp.error}`

          // Try OpenAI fallback if configured
          if (process.env.OPENAI_API_KEY) {
              try {
                const resp2 = await callOpenAI(llmMessages as any, "gpt-4o-mini")
                const assistant2 = resp2?.raw
                try {
                  const parsed2 = typeof assistant2 === "string" ? JSON.parse(assistant2) : assistant2
                  return finalize({ analysis: parsed2, source: "openai", meta: resp2?.meta })
                } catch (e2) {
                  return finalize({
                    analysis: { raw: assistant2 },
                    source: "openai",
                    parseError: String(e2),
                    meta: resp2?.meta,
                  })
                }
            } catch (openaiErr: any) {
              console.error("OpenAI fallback error", openaiErr)
              openRouterNote += `; OpenAI fallback error: ${openaiErr?.message || String(openaiErr)}`
            }
          }

          // continue to local fallback (below) with note attached
        }

        const assistant = resp?.raw

        // Normalize assistant into either a structured analysis object or a raw text field
        const makeRaw = (val: any) => ({ raw: typeof val === "string" ? val : JSON.stringify(val), meta: resp?.meta })

        // If assistant is a string, attempt to parse it as the requested JSON envelope
        if (typeof assistant === "string") {
          try {
            // If assistant wrapped the JSON in prose or fenced code, try to extract the JSON block first
            const candidate = extractJSONFromText(assistant) || assistant
            let parsed: any = JSON.parse(candidate)
            // If parsed is an array where the first element is the envelope, unwrap it
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] && typeof parsed[0] === "object")
              parsed = parsed[0]

            // Expecting an envelope { reply, analysis }
            if (parsed && typeof parsed === "object" && (parsed.reply || parsed.analysis)) {
              const reply =
                parsed.reply ||
                (parsed.analysis && (parsed.analysis.verdict || parsed.analysis.recommendation?.reason)) ||
                ""
              const analysis = parsed.analysis || (parsed.reply && null)
              // If analysis looks like the structured object (has verdict/table/recommendation) keep it
              if (
                analysis &&
                typeof analysis === "object" &&
                (analysis.verdict || analysis.table || analysis.recommendation)
              ) {
                return finalize({ analysis, reply, source: "openrouter", meta: resp?.meta })
              }
              // If analysis missing but parsed itself looks like the full analysis, return accordingly
              if (!analysis && parsed && (parsed.verdict || parsed.table || parsed.recommendation)) {
                return finalize({
                  analysis: parsed,
                  reply: reply || parsed.verdict || "",
                  source: "openrouter",
                  meta: resp?.meta,
                })
              }

              // Fallback: return parsed.reply and parsed.analysis (which may be null)
              return finalize({
                analysis: analysis ? analysis : { raw: JSON.stringify(parsed.analysis ?? parsed) },
                reply: String(reply),
                source: "openrouter",
                meta: resp?.meta,
              })
            }

            // If not the envelope, but a raw analysis object, return as analysis with synthesized reply
            if (parsed && typeof parsed === "object" && (parsed.verdict || parsed.table || parsed.recommendation)) {
              const reply = parsed.verdict || (parsed.recommendation ? String(parsed.recommendation.reason) : "")
              return finalize({ analysis: parsed, reply, source: "openrouter", meta: resp?.meta })
            }

            // Not JSON in the expected envelope shape — return raw assistant text as reply so client shows conversational reply
            return finalize({
              analysis: { raw: assistant },
              reply: assistant,
              source: "openrouter",
              meta: resp?.meta,
            })
          } catch (e) {
            // not JSON — return raw text so client shows the assistant reply conversationally
            return finalize({
              analysis: { raw: assistant },
              reply: assistant,
              source: "openrouter",
              parseError: String(e),
              meta: resp?.meta,
            })
          }
        }

        // If assistant is already an object/array (sometimes API returns parsed shapes), handle accordingly
        if (Array.isArray(assistant)) {
          // Many times an array like [{source: 'openrouter'}] is unhelpful — return it as raw text + meta
          return finalize({ analysis: { raw: JSON.stringify(assistant) }, source: "openrouter", meta: resp?.meta })
        }

        if (assistant && typeof assistant === "object") {
          // If it looks like the structured analysis, return it. If it's an envelope {analysis, reply}, handle that too.
          const maybeAnalysis = assistant.analysis || assistant
          if (maybeAnalysis && (maybeAnalysis.verdict || maybeAnalysis.table || maybeAnalysis.recommendation)) {
            const reply =
              assistant.reply ||
              maybeAnalysis.verdict ||
              (maybeAnalysis.recommendation ? String(maybeAnalysis.recommendation.reason) : undefined)
            return finalize({ analysis: maybeAnalysis, reply, source: "openrouter", meta: resp?.meta })
          }
          return finalize({
            analysis: { raw: JSON.stringify(assistant) },
            reply: JSON.stringify(assistant),
            source: "openrouter",
            meta: resp?.meta,
          })
        }
      } catch (err: any) {
        console.error("OpenRouter helper error", err)
        openRouterNote = `OpenRouter error: ${err?.message || String(err)}`
        // if user configured OpenAI key, try that as a fallback
        if (process.env.OPENAI_API_KEY) {
          try {
            const resp2 = await callOpenAI(llmMessages as any, "gpt-4o-mini")
            const assistant2 = resp2?.raw
            try {
              const parsed2 = typeof assistant2 === "string" ? JSON.parse(assistant2) : assistant2
              return finalize({ analysis: parsed2, source: "openai", meta: resp2?.meta })
            } catch (e2) {
              return finalize({
                analysis: { raw: assistant2 },
                source: "openai",
                parseError: String(e2),
                meta: resp2?.meta,
              })
            }
          } catch (openaiErr: any) {
            console.error("OpenAI fallback error", openaiErr)
            openRouterNote += `; OpenAI fallback error: ${openaiErr?.message || String(openaiErr)}`
          }
        }
      }
    }

    // Local fallback: generate a structured JSON analysis
    const table = products.map((p: any) => {
      const score = (p.rating || 0) * 2 - (p.price || 0) / 100 + (p.inStock ? 1 : 0) * 10 + (p.reliability || 90) / 10
      // include seller and short sampled reviews for the local fallback
      const seller = (p.owner && (p.owner.name || p.owner)) || p.ownerName || ''
      let reviews = [] as string[]
      if (Array.isArray(p.comments) && p.comments.length > 0) {
        reviews = p.comments.slice(0, 6).map((c: any) => {
          const txt = (c.text || c.comment || '').toString().replace(/\s+/g, ' ').trim()
          return `${c.rating ? `[${c.rating}] ` : ''}${txt.length > 200 ? txt.slice(0, 197) + '...' : txt}`
        })
      }
      const displayId = `#${p.id}`
      const displayName = `${p.name}${seller ? ` (by ${seller})` : ''} ${displayId}`
      return {
        name: displayName,
        price: p.price,
        rating: p.rating,
        deliveryDays: p.deliveryDays ?? 3,
        reliability: p.reliability ?? 95,
        inStock: !!p.inStock,
        seller,
        reviews,
        score: Math.round(score * 10) / 10,
        pros: [],
        cons: [],
        productId: p.id,
        displayId,
      }
    })

    // simple heuristics for pros/cons
    table.forEach((t: any) => {
      if (t.price < Math.min(...table.map((x: any) => x.price))) t.pros.push("Lowest price")
      if (t.rating >= Math.max(...table.map((x: any) => x.rating))) t.pros.push("Top rated")
      if (t.deliveryDays <= Math.min(...table.map((x: any) => x.deliveryDays))) t.pros.push("Fast delivery")
      if (!t.inStock) t.cons.push("Out of stock")
      if (t.reliability < 80) t.cons.push("Lower seller reliability")
    })

    // pick recommendation as highest score
    const sorted = [...table].sort((a: any, b: any) => b.score - a.score)
    const recommendation = sorted[0]
      ? {
          productId: sorted[0].productId ?? null,
          seller: sorted[0].seller || null,
          reason: `Highest combined score (${sorted[0].score})`,
        }
      : null

    const analysisObj: any = {
      table,
      verdict: recommendation ? `Recommended: ${sorted[0].name}` : "No clear recommendation",
      recommendation,
      reasoning: `Comparison based on rating, price, deliveryDays, and reliability. User preferences: ${JSON.stringify(preferences || {})}`,
    }

    if (openRouterNote) analysisObj.note = openRouterNote

    const reply = sorted[0]
      ? `Based on the comparison analysis, I recommend **${sorted[0].name}** with the highest combined score of ${sorted[0].score}. It offers the best balance of the factors you care about.`
      : "Here is the detailed comparison of your selected products:"

  return finalize({ analysis: analysisObj, reply, source: "local" })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed to analyze" }, { status: 500 })
  }
}
