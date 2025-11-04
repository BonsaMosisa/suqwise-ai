"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Send, Sparkles, Copy, Check } from "lucide-react"

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
  analysisData?: any // add parsed analysis data to message
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
          products: products,
          messages: messages.map((m) => ({ role: m.type === "ai" ? "ai" : "user", content: m.content })),
          preferences: preferences || {},
        }),
      })

      const data: any = await response.json().catch(async () => {
        const txt = await response.text().catch(() => "Unable to read response")
        return { raw: txt }
      })

      if (!response.ok) {
        const errMsg = data?.error || data?.message || `Server returned ${response.status}`
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          type: "ai",
          content: `Error from server: ${errMsg}`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, aiResponse])
      } else {
        const analysis = data?.analysis
        const source = data?.source

        if (source === "local") {
          const fallbackText =
            "AI currently unavailable; showing a minimal offline fallback. Try again later or check your network/provider keys."
          const serverNote = data?.analysis?.note || data?.note || null
          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: serverNote ? `${fallbackText}\n\nReason: ${serverNote}` : fallbackText,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, aiResponse])
        } else if (analysis && typeof analysis === "object" && !analysis.raw) {
          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: formatAnalysisToText(analysis),
            timestamp: new Date(),
            analysisData: analysis,
          }
          setMessages((prev) => [...prev, aiResponse])
        } else if (analysis && analysis.raw) {
          let parsedRaw: any = null
          try {
            parsedRaw = JSON.parse(analysis.raw)
            if (Array.isArray(parsedRaw) && parsedRaw.length > 0 && parsedRaw[0] && typeof parsedRaw[0] === "object")
              parsedRaw = parsedRaw[0]
          } catch (e) {
            parsedRaw = null
          }

          if (
            parsedRaw &&
            typeof parsedRaw === "object" &&
            (parsedRaw.verdict || parsedRaw.table || parsedRaw.recommendation)
          ) {
            const aiResponse: Message = {
              id: (Date.now() + 1).toString(),
              type: "ai",
              content: formatAnalysisToText(parsedRaw),
              timestamp: new Date(),
              analysisData: parsedRaw,
            }
            setMessages((prev) => [...prev, aiResponse])
          } else {
            const aiResponse: Message = {
              id: (Date.now() + 1).toString(),
              type: "ai",
              content: analysis.raw || JSON.stringify(data),
              timestamp: new Date(),
            }
            setMessages((prev) => [...prev, aiResponse])
          }
        } else if (data?.raw) {
          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: data.raw,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, aiResponse])
        } else {
          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: JSON.stringify(data),
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, aiResponse])
        }
      }
    } catch (error) {
      console.error("Error calling API:", error)
      const fallbackResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: generateAIResponse(input, products),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, fallbackResponse])
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const renderMarkdownText = (text: string) => {
    const parts: any[] = []
    let lastIndex = 0

    // regex to find **bold**, *italic*, and emojis
    const regex = /\*\*(.+?)\*\*|\*(.+?)\*|([😀-🙏🌀-🗿🚀-🛿])/gu
    let match

    while ((match = regex.exec(text)) !== null) {
      // text before match
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: text.slice(lastIndex, match.index) })
      }

      if (match[1]) {
        // bold
        parts.push({ type: "bold", content: match[1] })
      } else if (match[2]) {
        // italic
        parts.push({ type: "italic", content: match[2] })
      }

      lastIndex = regex.lastIndex
    }

    // remaining text
    if (lastIndex < text.length) {
      parts.push({ type: "text", content: text.slice(lastIndex) })
    }

    return (
      <>
        {parts.map((part, i) => {
          if (part.type === "bold") return <strong key={i}>{part.content}</strong>
          if (part.type === "italic") return <em key={i}>{part.content}</em>
          return <span key={i}>{part.content}</span>
        })}
      </>
    )
  }

  const renderAnalysisTable = (table: any[]) => {
    if (!Array.isArray(table) || table.length === 0) return null

    return (
      <div className="overflow-x-auto mt-3 rounded-lg border border-border">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-3 sm:px-4 py-2.5 text-left font-semibold">Product</th>
              <th className="px-3 sm:px-4 py-2.5 text-right font-semibold">Price</th>
              <th className="px-3 sm:px-4 py-2.5 text-right font-semibold hidden sm:table-cell">Rating</th>
              <th className="px-3 sm:px-4 py-2.5 text-right font-semibold hidden md:table-cell">Delivery</th>
              <th className="px-3 sm:px-4 py-2.5 text-right font-semibold hidden lg:table-cell">Reliability</th>
              <th className="px-3 sm:px-4 py-2.5 text-center font-semibold">Stock</th>
            </tr>
          </thead>
          <tbody>
            {table.map((p: any, idx: number) => (
              <tr
                key={p.id || idx}
                className="border-b border-border hover:bg-muted/30 transition-colors last:border-b-0"
              >
                <td className="px-3 sm:px-4 py-2.5 font-medium">{p.name}</td>
                <td className="px-3 sm:px-4 py-2.5 text-right">${p.price}</td>
                <td className="px-3 sm:px-4 py-2.5 text-right hidden sm:table-cell">⭐ {p.rating}</td>
                <td className="px-3 sm:px-4 py-2.5 text-right hidden md:table-cell">{p.deliveryDays}d</td>
                <td className="px-3 sm:px-4 py-2.5 text-right hidden lg:table-cell">{p.reliability}%</td>
                <td className="px-3 sm:px-4 py-2.5 text-center">{p.inStock ? "✓" : "✗"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderStructuredAnalysis = (data: Message) => {
    if (!data.analysisData) return null

    const analysis = data.analysisData
    const recommendedId = analysis?.recommendation?.productId

    return (
      <div>
        <div className="mb-4">
          <h4 className="text-sm font-semibold mb-1">💡 Recommendation</h4>
          <p className="text-sm leading-relaxed">{renderMarkdownText(analysis.verdict || "")}</p>
        </div>

        {analysis.recommendation && (
          <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>Why?</strong> {analysis.recommendation.reason}
            </p>
          </div>
        )}

        {Array.isArray(analysis.table) && analysis.table.length > 0 && renderAnalysisTable(analysis.table)}

        {analysis.reasoning && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs sm:text-sm text-muted-foreground">
              <strong>Reasoning:</strong> {renderMarkdownText(analysis.reasoning)}
            </p>
          </div>
        )}

        {analysis.pros && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400">✓ Pros</p>
            <p className="text-xs text-muted-foreground">{renderMarkdownText(analysis.pros)}</p>
          </div>
        )}

        {analysis.cons && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400">✗ Cons</p>
            <p className="text-xs text-muted-foreground">{renderMarkdownText(analysis.cons)}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm hover:text-primary transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="text-xs sm:text-sm text-muted-foreground">
          Analyzing {products.length} product{products.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === "user" ? "justify-end" : "justify-start"} animate-in fade-in-50 duration-300`}
          >
            <div className={`flex gap-3 max-w-full ${message.type === "user" ? "flex-row-reverse" : ""}`}>
              {/* Avatar */}
              <div
                className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  message.type === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {message.type === "user" ? "U" : "AI"}
              </div>

              {/* Message Bubble */}
              <div className={`group flex flex-col max-w-xs sm:max-w-md lg:max-w-2xl relative`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm break-words ${
                    message.type === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-muted text-foreground rounded-bl-none"
                  }`}
                >
                  {message.analysisData ? (
                    renderStructuredAnalysis(message)
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{renderMarkdownText(message.content)}</p>
                  )}
                </div>

                {/* Copy Button */}
                {message.type === "ai" && (
                  <button
                    onClick={() => copyToClipboard(message.content, message.id)}
                    className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded text-xs"
                    title="Copy message"
                  >
                    {copied === message.id ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-start animate-in fade-in-50 duration-300">
            <div className="flex gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold bg-muted text-muted-foreground">
                AI
              </div>
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

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-border px-4 sm:px-6 lg:px-8 py-3 sm:py-4 bg-background">
        <div className="flex gap-2 max-w-full">
          <input
            type="text"
            placeholder="Ask anything about these products..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !loading && handleSend()}
            disabled={loading}
            className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            size="icon"
            className="rounded-full flex-shrink-0 h-10 w-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 px-4">Press Enter to send</p>
      </div>
    </div>
  )
}

function formatAnalysisToText(analysis: any): string {
  if (!analysis) return ""
  let text = ""

  if (analysis.verdict) text += `${analysis.verdict}\n\n`
  if (analysis.recommendation?.reason) text += `Reason: ${analysis.recommendation.reason}\n\n`
  if (analysis.reasoning) text += `Analysis: ${analysis.reasoning}\n`

  return text.trim()
}

function generateInitialAnalysis(products: Product[]): string {
  const cheapest = products.reduce((a, b) => (a.price < b.price ? a : b))
  const bestRated = products.reduce((a, b) => (a.rating > b.rating ? a : b))
  const fastest = products.reduce((a, b) => (a.deliveryDays < b.deliveryDays ? a : b))
  const mostReliable = products.reduce((a, b) => (a.reliability > b.reliability ? a : b))

  return `📊 **Initial Comparison Summary**\n\n🏆 Best Value: ${cheapest.name} - $${cheapest.price}\n⭐ Top Rated: ${bestRated.name} - ${bestRated.rating}★\n🚀 Fastest: ${fastest.name} - ${fastest.deliveryDays}d\n🛡️ Most Reliable: ${mostReliable.name} - ${mostReliable.reliability}%`
}

function generateAIResponse(query: string, products: Product[]): string {
  const lowerQuery = query.toLowerCase()

  if (
    lowerQuery.includes("price") ||
    lowerQuery.includes("cheap") ||
    lowerQuery.includes("cost") ||
    lowerQuery.includes("expensive")
  ) {
    const sorted = [...products].sort((a, b) => a.price - b.price)
    const cheapest = sorted[0]
    const expensive = sorted[sorted.length - 1]
    return `💰 **Price Comparison**\n\n${sorted.map((p, i) => `${i + 1}. ${p.name} - $${p.price}`).join("\n")}\n\nCheapest: $${cheapest.price} | Most Expensive: $${expensive.price} | Range: $${expensive.price - cheapest.price}`
  }

  if (
    lowerQuery.includes("rating") ||
    lowerQuery.includes("quality") ||
    lowerQuery.includes("best") ||
    lowerQuery.includes("reviews")
  ) {
    const sorted = [...products].sort((a, b) => b.rating - a.rating)
    return `⭐ **Quality & Ratings**\n\n${sorted.map((p, i) => `${i + 1}. ${p.name} - ${p.rating}★`).join("\n")}\n\nTop product: ${sorted[0].name} with ${sorted[0].rating} stars`
  }

  if (
    lowerQuery.includes("delivery") ||
    lowerQuery.includes("fast") ||
    lowerQuery.includes("speed") ||
    lowerQuery.includes("shipping")
  ) {
    const sorted = [...products].sort((a, b) => a.deliveryDays - b.deliveryDays)
    return `🚚 **Delivery Speed**\n\n${sorted.map((p, i) => `${i + 1}. ${p.name} - ${p.deliveryDays}d`).join("\n")}\n\nFastest: ${sorted[0].name} in ${sorted[0].deliveryDays} day(s)`
  }

  if (
    lowerQuery.includes("recommendation") ||
    lowerQuery.includes("which") ||
    lowerQuery.includes("should") ||
    lowerQuery.includes("suggest")
  ) {
    const valueScore = products.map((p) => ({
      ...p,
      score: (p.rating / p.price) * (100 / p.deliveryDays),
    }))
    const best = valueScore.reduce((a, b) => (a.score > b.score ? a : b))
    return `✨ **Top Recommendation**\n\n${best.name}\n💰 $${best.price} | ⭐ ${best.rating}★ | 🚚 ${best.deliveryDays}d | 🛡️ ${best.reliability}%\n\nBest overall value considering price, quality, and delivery`
  }

  if (lowerQuery.includes("reliability") || lowerQuery.includes("trustworthy") || lowerQuery.includes("seller")) {
    const sorted = [...products].sort((a, b) => b.reliability - a.reliability)
    return `🛡️ **Seller Reliability**\n\n${sorted.map((p, i) => `${i + 1}. ${p.name} - ${p.reliability}%`).join("\n")}\n\nMost reliable: ${sorted[0].name} at ${sorted[0].reliability}%`
  }

  return `Hello! I can help compare these ${products.length} products. Try asking about:\n\n• 💰 Price comparisons\n• ⭐ Quality & ratings\n• 🚚 Delivery times\n• 🛡️ Seller reliability\n• ✨ Recommendations\n\nWhat would you like to know?`
}
