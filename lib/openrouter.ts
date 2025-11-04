const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY
// Optional site metadata that OpenRouter accepts for ranking / diagnostics
const OPENROUTER_REFERER = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000'
const OPENROUTER_TITLE = process.env.NEXT_PUBLIC_SITE_TITLE || 'SuqWise'

type Message = { role: string; content: string }

async function timeoutFetch(input: RequestInfo, init: RequestInit = {}, ms = 10000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    const resp = await fetch(input, { ...init, signal: controller.signal })
    return resp
  } finally {
    clearTimeout(id)
  }
}

export async function callOpenRouter(messages: Message[], model = 'openai/gpt-oss-20b:free') {
  if (!OPENROUTER_KEY) throw new Error('OPENROUTER_API_KEY not configured')
  // try twice with a short delay, but return structured error info instead of throwing
  let lastErr: any = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // use the public openrouter.ai endpoint and include optional referer/title headers
      const resp = await timeoutFetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          'HTTP-Referer': OPENROUTER_REFERER,
          'X-Title': OPENROUTER_TITLE,
        },
        body: JSON.stringify({ model, messages, max_tokens: 1200 }),
      }, 10000)

      if (!resp) {
        lastErr = new Error('No response from OpenRouter')
        if (attempt < 2) await new Promise((r) => setTimeout(r, 500))
        continue
      }

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        return { error: `OpenRouter error: ${resp.status} ${resp.statusText} - ${txt}` }
      }

      const json = await resp.json()
      const assistant = json?.choices?.[0]?.message?.content || json?.choices?.[0]?.message || JSON.stringify(json)
      return { raw: assistant, meta: json }
    } catch (err: any) {
      // network/DNS errors (ENOTFOUND) or aborts
      lastErr = err
      // if abort or network, wait briefly then retry
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500))
    }
  }

  // return structured error info rather than throwing to let caller decide next steps
  return { error: lastErr?.message || String(lastErr), code: lastErr?.code || lastErr?.errno || 'UNKNOWN' }
}

// Optional: fallback to OpenAI if configured
export async function callOpenAI(messages: Message[], model = 'gpt-4o-mini') {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not configured')

  const resp = await timeoutFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model, messages, max_tokens: 1200 }),
  }, 10000)

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`OpenAI error: ${resp.status} ${resp.statusText} - ${txt}`)
  }
  const json = await resp.json()
  const assistant = json?.choices?.[0]?.message?.content || json?.choices?.[0]?.message || JSON.stringify(json)
  return { raw: assistant, meta: json }
}

export default { callOpenRouter, callOpenAI }
