"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'

export default function OwnerDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<any[]>([])
  const [insights, setInsights] = useState<any>(null)
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
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Seller Dashboard</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Demand Insights</h2>
        {insights?.top?.length ? (
          <ol className="list-decimal list-inside">
            {insights.top.map((p: any) => (
              <li key={p.id} className="mb-2">
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-muted-foreground">Comments: {p._count?.comments || 0}</div>
              </li>
            ))}
              </ol>
        ) : (
          <div className="text-sm text-muted-foreground">No insights yet</div>
        )}
      </section>

          {/* Charts */}
          <section className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded p-3">
              <h3 className="font-medium mb-2">Category distribution</h3>
              {insights?.pie?.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={insights.pie} dataKey="value" nameKey="name" outerRadius={70} fill="#8884d8">
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

            <div className="border rounded p-3">
              <h3 className="font-medium mb-2">Engagement by product</h3>
              {products.length ? (
                <ResponsiveContainer width="100%" height={200}>
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
          </section>

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
    </main>
  )
}
