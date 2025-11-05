"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Send, Sparkles, Copy, Check } from "lucide-react"

interface Product {
  id: number
  name: string
  price: number
  rating: number
  store: string
  category: string
  deliveryDays: number
  reliability: number
  inStock: boolean
}

interface Message {
  id: string
  type: "user" | "ai"
  content: string
  timestamp: Date
  analysisData?: any
}

export function AIComparisonChat({
  products,
  onBack,
  preferences,
}: { products: Product[]; onBack: () => void; preferences?: any }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    let mounted = true
    const fetchInitial = async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products, query: "", messages: [], preferences: preferences || {}, mode: "initial" }),
        })
        const raw = await res.text()
        let data: any = {}
        try {
          data = JSON.parse(raw)
        } catch (e) {
          data = { raw }
        }

        if (!mounted) return

        if (!res.ok) {
          const errMsg = data?.error || data?.message || `Server returned ${res.status}`
          setMessages([
            { id: Date.now().toString(), type: "ai", content: `Error from server: ${errMsg}`, timestamp: new Date() },
          ])
        } else {
          const { reply: extractedReply, analysis: extractedAnalysis } = extractReplyAndAnalysis(data)
          const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content:
              extractedReply ||
              (extractedAnalysis
                ? formatAnalysisToText(normalizeAnalysis(extractedAnalysis))
                : String(data?.raw ?? JSON.stringify(data))),
            timestamp: new Date(),
            analysisData: extractedAnalysis ? normalizeAnalysis(extractedAnalysis) : undefined,
          }
          setMessages([aiMsg])
        }
      } catch (error) {
        console.error("Initial analysis error:", error)
        setMessages([
          { id: Date.now().toString(), type: "ai", content: generateInitialAnalysis(products), timestamp: new Date() },
        ])
      } finally {
        setLoading(false)
      }
    }
    fetchInitial()
    return () => {
      mounted = false
    }
  }, [])

  function extractReplyAndAnalysis(data: any) {
    if (!data) return { reply: undefined, analysis: undefined }
    let reply = data.reply
    let analysis = data.analysis

    if (typeof reply === "string") {
      const t = reply.trim()
      if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
        try {
          const p = JSON.parse(reply)
          if (p) {
            if (p.analysis) analysis = p.analysis
            if (p.reply) reply = p.reply
            if (!reply && (p.verdict || p.table || p.recommendation)) {
              analysis = p
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }

    if (analysis && typeof analysis === "object" && analysis.raw && typeof analysis.raw === "string") {
      const raw = analysis.raw.trim()
      if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
        try {
          const p = JSON.parse(analysis.raw)
          if (p) analysis = p
        } catch (e) {
          // ignore
        }
      }
    }

    if (!analysis && reply && typeof reply === "object" && (reply.verdict || reply.table || reply.recommendation)) {
      analysis = reply as any
      reply = undefined
    }

    return { reply, analysis }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    }

    const historyToSend = [...messages, userMessage]
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: input,
          products,
          messages: historyToSend.map((m) => ({ role: m.type === "ai" ? "ai" : "user", content: m.content })),
          preferences: preferences || {},
          mode: "followup",
        }),
      })

      const raw = await response.text()
      let data: any = {}
      try {
        data = JSON.parse(raw)
      } catch (e) {
        data = { raw }
      }

      if (!response.ok) {
        const errMsg = data?.error || data?.message || `Server returned ${response.status}`
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: `Error from server: ${errMsg}`,
            timestamp: new Date(),
          },
        ])
      } else {
        const { reply: extractedReply, analysis: extractedAnalysis } = extractReplyAndAnalysis(data)

        if (extractedReply) {
          const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: extractedReply,
            timestamp: new Date(),
          }
          if (extractedAnalysis) {
            const parsed = normalizeAnalysis(extractedAnalysis)
            if (parsed) aiMsg.analysisData = parsed
          }
          setMessages((prev) => [...prev, aiMsg])
        } else if (extractedAnalysis) {
          const parsed = normalizeAnalysis(extractedAnalysis)
          const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: parsed ? formatAnalysisToText(parsed) : String(extractedAnalysis.raw ?? JSON.stringify(data)),
            timestamp: new Date(),
            analysisData: parsed ?? undefined,
          }
          setMessages((prev) => [...prev, aiMsg])
        } else if (data?.raw) {
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + 1).toString(), type: "ai", content: String(data.raw), timestamp: new Date() },
          ])
        } else {
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + 1).toString(), type: "ai", content: JSON.stringify(data), timestamp: new Date() },
          ])
        }
      }
    } catch (error) {
      console.error("Error calling API:", error)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "ai",
          content: generateAIResponse(input, products),
          timestamp: new Date(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 pb-24">
        {messages.map((message) => (
          <div key={message.id} className="w-full animate-in fade-in-50 duration-300 flex justify-center">
            <div className={`w-full max-w-2xl ${message.type === "user" ? "flex justify-end" : "flex justify-start"}`}>
              <div
                className={`rounded-lg px-4 py-3 ${
                  message.type === "user"
                    ? "bg-yellow-300 text-gray-900 max-w-xs"
                    : "bg-gray-100 dark:bg-gray-800 text-foreground max-w-full"
                }`}
              >
                {message.analysisData ? (
                  renderStructuredAnalysis(message.analysisData)
                ) : (
                  <div className="text-sm leading-relaxed wrap-break-word">{renderMarkdown(message.content)}</div>
                )}

                {message.type === "ai" && (
                  <button
                    onClick={() => copyToClipboard(message.content, message.id)}
                    className="mt-3 opacity-60 hover:opacity-100 transition-opacity p-1.5 hover:bg-muted rounded-lg text-xs text-muted-foreground hover:text-foreground"
                    title="Copy message"
                  >
                    {copied === message.id ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="w-full flex justify-center">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 max-w-2xl">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4 animate-spin" />
                <p className="text-sm">Analyzing products...</p>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

  <div className="fixed bottom-14 sm:bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 z-50">
        <div className="max-w-2xl mx-auto w-full px-4 py-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Ask anything about these products..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
              disabled={loading}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              size="icon"
              className="rounded-xl shrink-0 h-12 w-12 bg-primary hover:bg-primary/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 px-1">
            Press Enter to send • Ask about prices, ratings, delivery, or recommendations
          </p>
        </div>
      </div>
    </div>
  )
}

// ---- Helpers ----

function normalizeAnalysis(analysis: any) {
  if (!analysis) return null
  if (typeof analysis === "string") {
    try {
      const p = JSON.parse(analysis)
      return unwrapAnalysis(p)
    } catch (e) {
      return null
    }
  }
  if (analysis.raw && typeof analysis.raw === "string") {
    try {
      const p = JSON.parse(analysis.raw)
      return unwrapAnalysis(p)
    } catch (e) {
      return null
    }
  }
  return unwrapAnalysis(analysis)
}

function unwrapAnalysis(p: any) {
  if (!p) return null
  if (Array.isArray(p) && p.length > 0 && typeof p[0] === "object") return p[0]
  if (typeof p === "object") return p
  return null
}

function formatAnalysisToText(analysis: any): string {
  if (!analysis) return ""
  let text = ""
  if (analysis.verdict) text += `${analysis.verdict}\n\n`
  if (analysis.recommendation?.reason) text += `Reason: ${analysis.recommendation.reason}\n\n`
  if (analysis.reasoning) text += `Analysis: ${analysis.reasoning}\n`
  return text.trim()
}

function renderStructuredAnalysis(analysis: any) {
  return (
    <div className="space-y-3 text-foreground text-sm">
      {analysis.verdict && (
        <div className="font-medium">
          <p>💡 {analysis.verdict}</p>
        </div>
      )}

      {analysis.recommendation && (
        <div className="text-foreground/90">
          <p>{String(analysis.recommendation.reason || analysis.recommendation)}</p>
        </div>
      )}

      {analysis.reasoning && (
        <div className="text-foreground/80 text-xs">
          <p>{String(analysis.reasoning)}</p>
        </div>
      )}

      {Array.isArray(analysis.table) && analysis.table.length > 0 && (
        <div className="mt-4 -mx-4">{renderAnalysisTable(analysis.table)}</div>
      )}
    </div>
  )
}

function renderAnalysisTable(table: any[]) {
  if (!Array.isArray(table) || table.length === 0) return null

  const headers = Object.keys(table[0])

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-muted/30">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">
                {capitalize(header.replace(/([A-Z])/g, " $1").trim())}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((row: any, idx: number) => (
            <tr key={idx} className="border-b border-border hover:bg-muted/50 transition-colors last:border-b-0">
              {headers.map((header) => (
                <td key={header} className="px-3 py-2 whitespace-nowrap text-foreground">
                  {formatTableCell(row[header])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatTableCell(value: any): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") {
    if (value < 10 && value.toString().includes(".")) return value.toFixed(1)
    if (value <= 100 && value > 1) return value.toFixed(0)
    return value.toString()
  }
  return String(value)
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function renderMarkdown(text: string) {
  if (!text) return null
  const lines = text.split(/\r?\n/)
  const tableStart = lines.findIndex((l) => /^\s*\|.*\|\s*$/.test(l))
  if (tableStart !== -1) {
    let end = tableStart
    while (end + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[end + 1])) end++
    const tableLines = lines.slice(tableStart, end + 1)
    try {
      const { headers, rows } = parseMarkdownTable(tableLines.join("\n"))
      const before = lines.slice(0, tableStart).join("\n")
      return (
        <div className="space-y-3">
          {before && <div className="leading-relaxed">{simpleInlineMarkdown(before)}</div>}
          <div className="overflow-x-auto rounded-lg border border-border -mx-4">
            {renderParsedMarkdownTable(headers, rows)}
          </div>
          {end + 1 < lines.length && (
            <div className="leading-relaxed">{simpleInlineMarkdown(lines.slice(end + 1).join("\n"))}</div>
          )}
        </div>
      )
    } catch (e) {
      return <div className="leading-relaxed">{simpleInlineMarkdown(text)}</div>
    }
  }
  return <div className="leading-relaxed">{simpleInlineMarkdown(text)}</div>
}

function simpleInlineMarkdown(text: string) {
  const boldRe = /\*\*(.+?)\*\*/g
  const italicRe = /\*(.+?)\*/g
  const parts: (string | React.ReactNode)[] = []
  let idx = 0
  let keyCounter = 0
  let m
  while ((m = boldRe.exec(text)) !== null) {
    if (m.index > idx) parts.push(text.slice(idx, m.index))
    parts.push(
      <strong key={`b-${keyCounter++}`} className="font-semibold text-foreground">
        {m[1]}
      </strong>,
    )
    idx = m.index + m[0].length
  }
  if (idx < text.length) parts.push(text.slice(idx))
  const final = parts.map((p, i) => {
    if (typeof p !== "string") return p
    const segments: (string | React.ReactNode)[] = []
    let jdx = 0
    let mm
    while ((mm = italicRe.exec(p)) !== null) {
      if (mm.index > jdx) segments.push(p.slice(jdx, mm.index))
      segments.push(
        <em key={`i-${keyCounter++}`} className="italic text-foreground/90">
          {mm[1]}
        </em>,
      )
      jdx = mm.index + mm[0].length
    }
    if (jdx < p.length) segments.push(p.slice(jdx))
    return <span key={`s-${keyCounter++}`}>{segments}</span>
  })
  return <>{final}</>
}

function parseMarkdownTable(md: string) {
  const lines = md.split(/\r?\n/).map((l) => l.trim())
  if (lines.length < 2) throw new Error("not a table")
  const headerLine = lines[0]
  const sepLine = lines[1]
  if (!/^\|/.test(headerLine) || !/^[|:\-\s]+$/.test(sepLine.replace(/\|/g, ""))) throw new Error("not a table")
  const headers = headerLine
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
  const rows = lines.slice(2).map((ln) =>
    ln
      .split("|")
      .map((s) => s.trim())
      .filter((v) => v !== ""),
  )
  return { headers, rows }
}

function renderParsedMarkdownTable(headers: string[], rows: string[][]) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-muted/50 border-b border-border">
          {headers.map((h) => (
            <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors last:border-b-0">
            {r.map((cell, j) => (
              <td key={j} className="px-3 py-2 whitespace-nowrap">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function generateInitialAnalysis(products: Product[]): string {
  if (!products || products.length === 0) return "No products available for comparison."
  const cheapest = products.reduce((a, b) => (a.price < b.price ? a : b))
  const bestRated = products.reduce((a, b) => (a.rating > b.rating ? a : b))
  const fastest = products.reduce((a, b) => (a.deliveryDays < b.deliveryDays ? a : b))
  const mostReliable = products.reduce((a, b) => (a.reliability > b.reliability ? a : b))
  return `I've analyzed the ${products.length} products you provided. Here's a quick summary:

**Best Value:** ${cheapest.name} - $${cheapest.price}
**Top Rated:** ${bestRated.name} - ${bestRated.rating}★
**Fastest Delivery:** ${fastest.name} - ${fastest.deliveryDays} days
**Most Reliable:** ${mostReliable.name} - ${mostReliable.reliability}% reliability

You can ask me about specific products, compare features, or get personalized recommendations based on your needs. What would you like to know?`
}

function generateAIResponse(query: string, products: Product[]): string {
  const lowerQuery = query.toLowerCase()
  if (lowerQuery.includes("price") || lowerQuery.includes("cheap") || lowerQuery.includes("cost")) {
    const sorted = [...products].sort((a, b) => a.price - b.price)
    return `Here are the products sorted by price (lowest to highest):

${sorted.map((p, i) => `${i + 1}. **${p.name}** - $${p.price}`).join("\n")}

The best value appears to be **${sorted[0].name}** at $${sorted[0].price}.`
  }
  if (lowerQuery.includes("rating") || lowerQuery.includes("review")) {
    const sorted = [...products].sort((a, b) => b.rating - a.rating)
    return `Here are the products sorted by rating (highest to lowest):

${sorted.map((p, i) => `${i + 1}. **${p.name}** - ${p.rating}★`).join("\n")}

**${sorted[0].name}** has the highest rating at ${sorted[0].rating}★.`
  }
  if (lowerQuery.includes("delivery") || lowerQuery.includes("shipping") || lowerQuery.includes("fast")) {
    const sorted = [...products].sort((a, b) => a.deliveryDays - b.deliveryDays)
    return `Here are the products sorted by delivery speed (fastest first):

${sorted.map((p, i) => `${i + 1}. **${p.name}** - ${p.deliveryDays} days`).join("\n")}

**${sorted[0].name}** offers the fastest delivery in ${sorted[0].deliveryDays} days.`
  }
  return `I can help you compare these products based on price, ratings, delivery speed, reliability, or specific features. You can also ask for recommendations based on what's most important to you - whether it's budget, quality, speed, or reliability. What specific aspect would you like me to focus on?`
}
