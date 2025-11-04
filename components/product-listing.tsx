"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Zap, Search } from "lucide-react"
import Link from "next/link"
import { mockProducts } from "@/lib/mock-data"

export function ProductListing() {
  const [products, setProducts] = useState<any[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem("selectedProducts")
    if (stored) {
      try {
        setSelected(JSON.parse(stored))
      } catch (e) {
        console.error("Failed to parse stored products")
      }
    }
    // fetch products from API
    let mountedFlag = true
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (!mountedFlag) return
        const items = (data?.products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          category: p.category,
          image: p.image || '',
          rating: p._avg?.rating || (p.comments && p.comments.length ? Math.round(p.comments.reduce((s: any, c: any) => s + (c.rating || 0), 0) / p.comments.length * 10) / 10 : '-'),
          store: p.owner?.name || 'Store',
          deliveryDays: 3,
          description: p.description || '',
          reviews: p.comments || [],
        }))
        // merge mock products that aren't already present (keeps demo items)
        const fetchedIds = new Set(items.map((it: any) => it.id))
        const extras = mockProducts.filter((m) => !fetchedIds.has(m.id))
        setProducts([...items, ...extras])
      })
      .catch((e) => console.error('Failed to load products', e))

    const onUpdated = () => {
      fetch('/api/products')
        .then((r) => r.json())
        .then((data) => {
          const items = (data?.products || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            category: p.category,
            image: p.image || '',
            rating: p._avg?.rating || (p.comments && p.comments.length ? Math.round(p.comments.reduce((s: any, c: any) => s + (c.rating || 0), 0) / p.comments.length * 10) / 10 : '-'),
            store: p.owner?.name || 'Store',
            deliveryDays: 3,
            description: p.description || '',
            reviews: p.comments || [],
          }))
          const fetchedIds = new Set(items.map((it: any) => it.id))
          const extras = mockProducts.filter((m) => !fetchedIds.has(m.id))
          setProducts([...items, ...extras])
        })
        .catch((e) => console.error('Failed to refresh products', e))
    }

    window.addEventListener('suqwise-product-updated', onUpdated)
    return () => {
      mountedFlag = false
      window.removeEventListener('suqwise-product-updated', onUpdated)
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("selectedProducts", JSON.stringify(selected))
    }
  }, [selected, mounted])

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const toggleProduct = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  if (!mounted) return <div className="h-screen" />

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Bar */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 text-sm"
            />
          </div>
        </div>

        {selected.length > 0 && (
          <Link href="/compare">
            <Button className="w-full md:w-auto gap-2">
              <Zap className="h-4 w-4" />
              Compare ({selected.length})
            </Button>
          </Link>
        )}
      </div>

      {/* Products Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="group relative">
            <Card className="h-full flex flex-col transition-all hover:shadow-lg hover:border-primary/50">
              {/* Selection Button - Top Right */}
              <button
                onClick={() => toggleProduct(product.id)}
                className={`absolute -top-3 -right-3 h-10 w-10 rounded-full shadow-md transition-all flex items-center justify-center z-10 ${
                  selected.includes(product.id)
                    ? "bg-primary text-primary-foreground scale-110"
                    : "bg-white border-2 border-primary hover:bg-primary/10"
                }`}
              >
                <Zap className="h-5 w-5" />
              </button>

              <CardHeader className="flex-shrink-0">
                <Link
                  href={`/product/${product.id}`}
                  className="block cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="aspect-square bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image} alt={product.name} className="object-cover w-full h-full" />
                    ) : (
                      <div className="text-5xl">{product.name?.charAt(0)}</div>
                    )}
                  </div>
                  <CardTitle className="text-lg hover:text-primary transition-colors">{product.name}</CardTitle>
                </Link>
                <CardDescription>{product.category}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col gap-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-semibold text-accent">${product.price}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rating</span>
                    <span className="font-semibold">{product.rating}★</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Store</span>
                    <span className="font-semibold">{product.store}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="font-semibold">{product.deliveryDays}d</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No products found. Try adjusting your search.</p>
        </div>
      )}
    </div>
  )
}
