"use client"

import React, { useState, useRef, useEffect } from "react"
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      content: `I've analyzed ${products.length} products for you. Here's my initial comparison:\n\n${generateInitialAnalysis(products)}\n\nWhat would you like to know more about?`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
          messages: messages.map((m) => ({ role: m.type === "ai" ? "ai" : "user", content: m.content })),
          preferences: preferences || {},
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
          { id: (Date.now() + 1).toString(), type: "ai", content: `Error from server: ${errMsg}`, timestamp: new Date() },
        ])
      } else {
        const reply = data?.reply
        const analysis = data?.analysis

        if (reply && typeof reply === "string") {
          const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: reply,
            timestamp: new Date(),
          }

          if (analysis) {
            const parsed = normalizeAnalysis(analysis)
            if (parsed) aiMsg.analysisData = parsed
          }

          setMessages((prev) => [...prev, aiMsg])
        } else if (analysis) {
          const parsed = normalizeAnalysis(analysis)
          const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: parsed ? formatAnalysisToText(parsed) : String(analysis.raw ?? JSON.stringify(data)),
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
        { id: (Date.now() + 1).toString(), type: "ai", content: generateAIResponse(input, products), timestamp: new Date() },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === "user" ? "justify-end" : "justify-start"} animate-in fade-in-50 duration-300`}
          >
            <div className={`flex gap-3 max-w-full ${message.type === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  message.type === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {message.type === "user" ? "U" : "AI"}
              </div>

              <div className={`group flex flex-col max-w-xs sm:max-w-md lg:max-w-2xl relative`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm break-words ${
                    message.type === "user" ? "bg-primary text-primary-foreground rounded-br-none" : "bg-muted text-foreground rounded-bl-none"
                  }`}
                >
                  {message.analysisData ? (
                    renderStructuredAnalysis(message.analysisData)
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">{renderMarkdown(message.content)}</div>
                  )}
                </div>

                {message.type === "ai" && (
                  <button
                    onClick={() => copyToClipboard(message.content, message.id)}
                    className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded text-xs"
                    title="Copy message"
                  >
                    {copied === message.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-in fade-in-50 duration-300">
            <div className="flex gap-3">
              <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold bg-muted text-muted-foreground">AI</div>
              <div className="bg-muted text-foreground rounded-2xl rounded-bl-none px-4 py-3">
                <div className="flex gap-2 items-center">
                  <Sparkles className="h-4 w-4 animate-spin" />
                  <p className="text-sm">Analyzing...</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-border px-4 sm:px-6 lg:px-8 py-3 sm:py-4 bg-background">
        <div className="flex gap-2 max-w-full">
          <input
            type="text"
            placeholder="Ask anything about these products..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
            disabled={loading}
            className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon" className="rounded-full shrink-0 h-10 w-10">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 px-4">Press Enter to send</p>
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
    <div className="mt-1">
      <h3 className="font-semibold text-sm mb-2">{analysis.verdict || "Recommendation"}</h3>
      {analysis.recommendation && <p className="text-xs sm:text-sm text-muted-foreground mb-2">💡 {String(analysis.recommendation.reason)}</p>}
      {analysis.reasoning && <p className="text-xs sm:text-sm text-muted-foreground mb-3">{String(analysis.reasoning)}</p>}
      {Array.isArray(analysis.table) && analysis.table.length > 0 && (
        <div className="mt-2">{renderAnalysisTable(analysis.table)}</div>
      )}
    </div>
  )
}

function renderAnalysisTable(table: any[]) {
  if (!Array.isArray(table) || table.length === 0) return null
  return (
    <div className="overflow-x-auto mt-3 rounded-lg border border-border">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            {Object.keys(table[0]).map((k) => (
              <th key={k} className="px-3 sm:px-4 py-2.5 text-left font-semibold">{capitalize(k)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((row: any, idx: number) => (
            <tr key={idx} className="border-b border-border hover:bg-muted/30 transition-colors last:border-b-0">
              {Object.keys(table[0]).map((k) => (
                <td key={k} className="px-3 sm:px-4 py-2.5">{String(row[k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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
        <div>
          {before && <div className="mb-2 whitespace-pre-wrap">{simpleInlineMarkdown(before)}</div>}
          <div className="overflow-x-auto rounded-lg border border-border">{renderParsedMarkdownTable(headers, rows)}</div>
          {end + 1 < lines.length && <div className="mt-2 whitespace-pre-wrap">{simpleInlineMarkdown(lines.slice(end + 1).join("\n"))}</div>}
        </div>
      )
    } catch (e) {
      return <div className="whitespace-pre-wrap">{simpleInlineMarkdown(text)}</div>
    }
  }
  return <div>{simpleInlineMarkdown(text)}</div>
}

function simpleInlineMarkdown(text: string) {
  const boldRe = /\*\*(.+?)\*\*/g
  const italicRe = /\*(.+?)\*/g
  const parts: (string | React.ReactNode)[] = []
  let idx = 0
  let m
  while ((m = boldRe.exec(text)) !== null) {
    if (m.index > idx) parts.push(text.slice(idx, m.index))
    parts.push(<strong key={idx}>{m[1]}</strong>)
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
      segments.push(<em key={`${i}-${jdx}`}>{mm[1]}</em>)
      jdx = mm.index + mm[0].length
    }
    if (jdx < p.length) segments.push(p.slice(jdx))
    return <span key={i}>{segments}</span>
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
      .filter((v) => v !== "")
  )
  return { headers, rows }
}

function renderParsedMarkdownTable(headers: string[], rows: string[][]) {
  return (
    <table className="w-full text-xs sm:text-sm">
      <thead>
        <tr className="bg-muted/50 border-b border-border">
          {headers.map((h) => (
            <th key={h} className="px-3 sm:px-4 py-2.5 text-left font-semibold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors last:border-b-0">
            {r.map((cell, j) => (
              <td key={j} className="px-3 sm:px-4 py-2.5">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function generateInitialAnalysis(products: Product[]): string {
  if (!products || products.length === 0) return "No products"
  const cheapest = products.reduce((a, b) => (a.price < b.price ? a : b))
  const bestRated = products.reduce((a, b) => (a.rating > b.rating ? a : b))
  const fastest = products.reduce((a, b) => (a.deliveryDays < b.deliveryDays ? a : b))
  const mostReliable = products.reduce((a, b) => (a.reliability > b.reliability ? a : b))
  return `📊 **Initial Comparison Summary**\n\n🏆 Best Value: ${cheapest.name} - $${cheapest.price}\n⭐ Top Rated: ${bestRated.name} - ${bestRated.rating}★\n🚀 Fastest: ${fastest.name} - ${fastest.deliveryDays}d\n🛡️ Most Reliable: ${mostReliable.name} - ${mostReliable.reliability}%`
}

function generateAIResponse(query: string, products: Product[]): string {
  const lowerQuery = query.toLowerCase()
  if (lowerQuery.includes("price") || lowerQuery.includes("cheap") || lowerQuery.includes("cost")) {
    const sorted = [...products].sort((a, b) => a.price - b.price)
    return `💰 Price ranking:\n${sorted.map((p, i) => `${i + 1}. ${p.name} - $${p.price}`).join("\n")}`
  }
  return `I can compare price, rating, delivery and reliability. Try asking about price, rating, or recommendation.`
}
