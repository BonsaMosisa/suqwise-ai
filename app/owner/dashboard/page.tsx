"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid } from 'recharts'

export default function OwnerDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<any[]>([])
  const [insights, setInsights] = useState<any>(null)
  const [aiInsights, setAiInsights] = useState<any>(null)
  const [trends, setTrends] = useState<any>(null)
  const [title, setTitle] = useState("")
  const [price, setPrice] = useState("")
  const [description, setDescription] = useState("")
  const [image, setImage] = useState("")
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("suqwise_token")
    if (!token) {
      router.push('/')
      return
    }

    fetch('/api/owner/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) return
        setProducts(data.products || [])
        // derive simple insights: top commented products and category distribution
        const byComments = [...(data.products || [])].sort((a: any, b: any) => (b._count?.comments || 0) - (a._count?.comments || 0))
        const categories: Record<string, number> = {}
        ;(data.products || []).forEach((p: any) => {
          categories[p.category] = (categories[p.category] || 0) + 1
        })
        const pie = Object.entries(categories).map(([name, value]) => ({ name, value }))
        setInsights({ top: byComments.slice(0, 5), pie })
  // request AI insights based on current products
        try {
          const probe = async () => {
            const resp = await fetch('/api/compare', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ products: data.products || [], query: 'Identify top on-demand products and restock recommendations. Return a JSON envelope with reply and analysis.table', messages: [], preferences: {} }),
            })
            const txt = await resp.text()
            let parsed: any = {}
            try { parsed = JSON.parse(txt) } catch (e) { parsed = { raw: txt } }
            setAiInsights(parsed)
          }
          probe()
        } catch (e) {
          // ignore
        }
        // fetch trending metrics from server-side computed data
        try {
          ;(async () => {
            const tResp = await fetch('/api/trends', { headers: { Authorization: `Bearer ${token}` } })
            if (tResp.ok) {
              const tdata = await tResp.json()
              setTrends(tdata)
            }
          })()
        } catch (e) {
          /* ignore */
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    const token = localStorage.getItem("suqwise_token")
    if (!token) return alert('Please login as seller')
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: title, description, price: parseFloat(price || '0'), category: 'general', image }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'Upload failed')
      // refresh
      setProducts((p) => [data.product, ...p])
        try {
          window.dispatchEvent(new Event('suqwise-product-updated'))
        } catch (e) {
          /* ignore */
        }
      setTitle('')
      setPrice('')
      setDescription('')
      setImage('')
      alert('Product uploaded')
    } catch (err: any) {
      alert(err?.message || 'Upload error')
    }
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <aside className="md:col-span-1 bg-card border rounded p-4 h-fit sticky top-6">
          <h2 className="font-bold mb-4">Seller</h2>
          <nav className="flex flex-col gap-2">
            <Link href="/owner/dashboard" className="px-3 py-2 rounded hover:bg-muted">Dashboard</Link>
            <Link href="/owner/upload" className="px-3 py-2 rounded hover:bg-muted">Upload</Link>
            <Link href="/owner/dashboard?tab=analytics" className="px-3 py-2 rounded hover:bg-muted">Analytics</Link>
            <Link href="/compare" className="px-3 py-2 rounded hover:bg-muted">Compare</Link>
          </nav>
          <div className="mt-6">
            <h3 className="text-sm font-medium">Quick actions</h3>
            <div className="mt-2 flex flex-col gap-2">
              <Link href="/owner/upload"><Button>Create product</Button></Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <section className="md:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Seller Dashboard</h1>
            <div className="text-sm text-muted-foreground">Products: {products.length}</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* AI Insights panel */}
            <div className="col-span-2 border rounded p-4">
              <h3 className="font-semibold mb-2">AI On-demand Insights</h3>
              {aiInsights ? (
                <div>
                  {aiInsights.reply && <div className="mb-3 whitespace-pre-wrap">{aiInsights.reply}</div>}
                  {/* Render table only when it's a non-empty array to avoid runtime errors */}
                  {aiInsights.analysis && Array.isArray(aiInsights.analysis.table) && aiInsights.analysis.table.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            {Object.keys(aiInsights.analysis.table[0]).map((k: string) => (
                              <th key={k} className="px-2 py-1 text-left font-semibold">{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {aiInsights.analysis.table.map((row: any, i: number) => (
                            <tr key={i} className="border-b">
                              {Object.keys(aiInsights.analysis.table[0]).map((k: string) => (
                                <td key={k} className="px-2 py-1">{String(row[k] ?? '')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : aiInsights.analysis ? (
                    <div className="text-sm text-muted-foreground">No table data available from AI.</div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">AI insights loading...</div>
              )}
            </div>

            {/* Small stat cards */}
            <div className="space-y-4">
              <div className="border rounded p-3">
                <div className="text-sm text-muted-foreground">Top requested</div>
                <div className="font-semibold">{insights?.top?.[0]?.name || '—'}</div>
              </div>
              <div className="border rounded p-3">
                <div className="text-sm text-muted-foreground">Top category</div>
                <div className="font-semibold">{insights?.pie?.[0]?.name || '—'}</div>
              </div>
            </div>
          </div>

          {/* Trending / Charts area */}
          <div className="border rounded p-4">
            <h3 className="font-semibold mb-3">Trending demand (last 30 days)</h3>
            {trends ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={trends.aggregated} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" hide />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <h4 className="text-sm text-muted-foreground mb-2">Top trending</h4>
                  <ul className="space-y-2">
                    {trends.topTrending && trends.topTrending.length ? (
                      trends.topTrending.map((t: any) => (
                        <li key={t.id} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{t.name}</div>
                            <div className="text-xs text-muted-foreground">{t.last7} new signals · {t.total30} in 30d</div>
                          </div>
                          <div className={`text-sm font-semibold ${t.growthPercent > 0 ? 'text-green-600' : t.growthPercent < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {t.growthPercent}%
                          </div>
                        </li>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">No trending products yet.</div>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Loading trending data…</div>
            )}
          </div>

          {/* Charts area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded p-4">
              <h3 className="font-medium mb-2">Category distribution</h3>
              {insights?.pie?.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={insights.pie} dataKey="value" nameKey="name" outerRadius={80} fill="#8884d8">
                      {insights.pie.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={["#f59e0b", "#f97316", "#fde68a", "#f43f5e"][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-muted-foreground">No category data</div>
              )}
            </div>

            <div className="border rounded p-4">
              <h3 className="font-medium mb-2">Engagement by product</h3>
              {products.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={products.map((p: any) => ({ name: p.name, comments: p._count?.comments || 0 }))}>
                    <XAxis dataKey="name" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="comments" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-muted-foreground">No products</div>
              )}
            </div>
          </div>

          {/* Upload & product list */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Upload Product</h2>
            <Link href="/owner/upload">
              <Button>Go to Upload page</Button>
            </Link>
          </div>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-2">Upload Product</h2>
            <form onSubmit={upload} className="grid gap-2">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
              <Input placeholder="Image URL" value={image} onChange={(e) => setImage(e.target.value)} />
              <Input placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Button type="submit">Upload</Button>
            </form>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Your Products</h2>
            {products.length ? (
              <ul className="grid gap-3">
                {products.map((p: any) => (
                  <li key={p.id} className="border rounded p-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-muted-foreground">Price: ${p.price}</div>
                    <div className="text-sm text-muted-foreground">Comments: {p._count?.comments || 0}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">You have no products yet.</div>
            )}
          </section>
        </section>
      </div>
    </main>
  )
}
