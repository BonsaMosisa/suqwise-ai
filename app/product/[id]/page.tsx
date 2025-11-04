"use client"

import { useState, useEffect } from "react"
import { mockProducts } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, ShoppingCart, Zap, Star } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useRouter } from "next/navigation"

export default function ProductDetailsPage() {
  const params = useParams()
  const productId = Number(params?.id ?? 0)
  const [product, setProduct] = useState<any | null>(null)
  const [mounted, setMounted] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [cartItems, setCartItems] = useState<{ id: number; quantity: number }[]>([])
  const [user, setUser] = useState<any | null>(null)
  const [commentText, setCommentText] = useState("")
  const [commentRating, setCommentRating] = useState<number>(5)
  const [posting, setPosting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    // try to fetch from API first; fall back to mockProducts
    let cancelled = false
    fetch(`/api/products/${productId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data?.product) {
          const p = data.product
          setProduct({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            category: p.category,
            image: p.image || '',
            store: p.owner?.name || 'Store',
            rating: p._avg?.rating || (p.comments && p.comments.length ? Math.round(p.comments.reduce((s: any, c: any) => s + (c.rating || 0), 0) / p.comments.length * 10) / 10 : '-'),
            inStock: p.inStock ?? true,
            stock: p.stock ?? 0,
            specs: p.specs || {},
            reviews: (p.comments || []).map((c: any) => ({
              author: c.author?.name || `User ${c.authorId}`,
              date: c.createdAt,
              rating: c.rating,
              text: c.text,
            })),
            reliability: 95,
            deliveryDays: 3,
          })
        } else {
          const found = mockProducts.find((p) => p.id === productId)
          setProduct(found || null)
        }
      })
      .catch((e) => {
        console.error('Failed to fetch product', e)
        const found = mockProducts.find((p) => p.id === productId)
        setProduct(found || null)
      })

  const stored = typeof window !== "undefined" ? localStorage.getItem("selectedProducts") : null
    if (stored) {
      try {
        setSelected(JSON.parse(stored))
      } catch (e) {
        console.error("Failed to parse stored products")
      }
    }

    const storedCart = typeof window !== "undefined" ? localStorage.getItem("cart") : null
    if (storedCart) {
      try {
        const parsed = JSON.parse(storedCart)
        // normalize older object-map format to array format if necessary
        if (Array.isArray(parsed)) {
          setCartItems(parsed)
        } else if (parsed && typeof parsed === "object") {
          const arr = Object.entries(parsed).map(([key, val]) => ({ id: Number(key), quantity: Number(val) }))
          setCartItems(arr)
        }
      } catch (e) {
        console.error("Failed to parse cart")
      }
    }

    // load current user from localStorage (if any)
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('suqwise_user') : null
      if (raw) setUser(JSON.parse(raw))
    } catch (e) {
      /* ignore */
    }
  }, [productId])

  useEffect(() => {
    if (mounted) localStorage.setItem("selectedProducts", JSON.stringify(selected))
  }, [selected, mounted])

  const toggleProduct = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))

  const addToCart = (id: number) => {
    setCartItems((prev) => {
      const existing = prev.find((it) => it.id === id)
      let next
      if (existing) {
        next = prev.map((it) => (it.id === id ? { ...it, quantity: it.quantity + 1 } : it))
      } else {
        next = [...prev, { id, quantity: 1 }]
      }
      try {
        localStorage.setItem("cart", JSON.stringify(next))
      } catch (e) {
        console.error("Failed to write cart to localStorage", e)
      }
      return next
    })
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Product not found</p>
          <Link href="/">
            <Button>Back</Button>
          </Link>
        </div>
      </div>
    )
  }

  const similarProducts = mockProducts.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4)

  return (
    <main className="min-h-screen bg-background pb-32 md:pb-8 pt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Products
        </Link>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Card className="sticky top-28 md:top-24">
              <CardContent className="pt-6">
                <div className="relative aspect-square bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-lg flex items-center justify-center mb-6 overflow-hidden">
                  {product.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image} alt={product.name} className="object-cover w-full h-full" />
                  ) : (
                    <div className="text-9xl">{product.name?.charAt(0) || 'P'}</div>
                  )}
                </div>
                <Button onClick={() => addToCart(product.id)} className="w-full gap-2 mb-2 bg-yellow-400 text-black hover:bg-yellow-500">
                  <ShoppingCart className="h-4 w-4" /> Add to Cart
                </Button>
                <Button variant="outline" className="w-full bg-transparent border-yellow-400 text-black hover:bg-yellow-50">Buy Now</Button>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-3xl mb-2">{product.name}</CardTitle>
                    <CardDescription className="text-lg">{product.store}</CardDescription>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-yellow-600">${product.price}</span>
                    <div className="flex items-center gap-1 bg-yellow-100 px-3 py-1 rounded-full">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold text-black">{product.rating}</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery Time</span>
                      <span className="font-semibold">{product.deliveryDays} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Seller Reliability</span>
                      <span className="font-semibold">{product.reliability}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stock Status</span>
                      <span className={`font-semibold ${product.inStock ? "text-green-600" : "text-red-600"}`}>{product.inStock ? "In Stock" : "Out of Stock"}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-muted-foreground">{product.description}</p>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Specifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {product.specs && Object.entries(product.specs).length > 0 ? (
                    Object.entries(product.specs).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm border-b pb-2 last:border-0">
                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                        <span className="font-semibold">{String(value)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No specifications available.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-6">Customer Reviews ({product.reviews ? product.reviews.length : 0})</h2>
          {/* Review form for authenticated buyers */}
          {user && user.role === 'buyer' ? (
            <div className="mb-6 p-4 border rounded-md">
              <p className="text-sm text-muted-foreground mb-2">Write a review as <strong>{user.name}</strong></p>
              <div className="flex gap-2 items-center mb-2">
                <label className="text-sm">Rating</label>
                <select value={String(commentRating)} onChange={(e) => setCommentRating(Number(e.target.value))} className="rounded-md border px-2 py-1">
                  {[5,4,3,2,1].map((r) => <option key={r} value={r}>{r} ★</option>)}
                </select>
              </div>
              <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write your review..." className="w-full border rounded-md p-2 mb-2" rows={3} />
              <div className="flex gap-2">
                <button disabled={posting} onClick={async () => {
                  if (!user) return router.push('/auth/login')
                  if (!commentText.trim()) return alert('Please write a comment')
                  setPosting(true)
                  try {
                    const token = localStorage.getItem('suqwise_token')
                    const res = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ productId: product.id, text: commentText, rating: commentRating }) })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data?.error || 'Failed')
                    // refresh product from API so we get author names and new comment
                    const ref = await fetch(`/api/products/${product.id}`)
                    const refData = await ref.json()
                    if (ref.ok && refData?.product) {
                      const p = refData.product
                      setProduct({
                        id: p.id,
                        name: p.name,
                        description: p.description,
                        price: p.price,
                        category: p.category,
                        image: p.image || '',
                        store: p.owner?.name || 'Store',
                        rating: p._avg?.rating || (p.comments && p.comments.length ? Math.round(p.comments.reduce((s: any, c: any) => s + (c.rating || 0), 0) / p.comments.length * 10) / 10 : '-'),
                        inStock: p.inStock ?? true,
                        stock: p.stock ?? 0,
                        specs: p.specs || {},
                        reviews: (p.comments || []).map((c: any) => ({
                          author: c.author?.name || `User ${c.authorId}`,
                          date: c.createdAt,
                          rating: c.rating,
                          text: c.text,
                        })),
                        reliability: 95,
                        deliveryDays: 3,
                      })
                    }
                    setCommentText('')
                    setCommentRating(5)
                    try { window.dispatchEvent(new Event('suqwise-product-updated')) } catch(e){ }
                  } catch (err: any) {
                    alert(err?.message || 'Failed to post review')
                  } finally { setPosting(false) }
                }} className="px-4 py-2 bg-yellow-400 text-black rounded-md disabled:opacity-50">{posting ? 'Posting...' : 'Post Review'}</button>
                <button onClick={() => { setCommentText(''); setCommentRating(5) }} className="px-4 py-2 border rounded-md">Clear</button>
              </div>
            </div>
          ) : (
            <div className="mb-6 text-sm text-muted-foreground">Please <Link href="/auth/login" className="underline">login as a buyer</Link> to write a review.</div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {(product.reviews || []).map((review: any, index: number) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold">{review.author}</p>
                      <p className="text-xs text-muted-foreground">{new Date(review.date).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < (review.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{review.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {similarProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Similar Products</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {similarProducts.map((similar) => (
                <Card key={similar.id} className="hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader>
                    <Link href={`/product/${similar.id}`} className="block">
                      <div className="aspect-square bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                        {similar.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={similar.image} alt={similar.name} className="object-cover w-full h-full" />
                        ) : (
                          <div className="text-4xl">{similar.name.charAt(0)}</div>
                        )}
                      </div>
                      <CardTitle className="text-lg hover:text-yellow-600">{similar.name}</CardTitle>
                    </Link>
                    <CardDescription>{similar.store}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-bold text-yellow-600">${similar.price}</span>
                      <span className="text-sm">{similar.rating}★</span>
                    </div>
                    <Link href={`/product/${similar.id}`}>
                      <Button variant="outline" className="w-full bg-yellow-50 border-yellow-400 text-black hover:bg-yellow-100">View Details</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

      </div>

      <footer className="mt-12 border-t bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} SuqWise. All rights reserved.</p>
          <div className="flex gap-4 mt-3 md:mt-0">
            <Link href="/" className="text-sm hover:underline">Home</Link>
            <Link href="/search" className="text-sm hover:underline">Search</Link>
            <Link href="/compare" className="text-sm hover:underline">Compare</Link>
            <Link href="/profile" className="text-sm hover:underline">Profile</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
 
