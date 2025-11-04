"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Zap, X, Sparkles } from "lucide-react"
import { AIComparisonChat } from "./ai-comparison-chat"
import Link from "next/link"

export function CompareInterface() {
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [showAI, setShowAI] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [preferences, setPreferences] = useState<any>({
    minRating: 0,
    maxPrice: undefined,
    inStockOnly: false,
    preferDelivery: false,
    preferReliability: false,
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem("selectedProducts")
    if (stored) {
      try {
        const ids = JSON.parse(stored)
        setSelectedProducts(ids)
        // fetch product details for each selected id
        if (Array.isArray(ids) && ids.length > 0) {
          Promise.allSettled(ids.map((id: number) => fetch(`/api/products/${id}`).then((r) => r.json())))
            .then((results) => {
              const fetched = results
                .map((r: any, i: number) => {
                  if (r.status !== 'fulfilled' || !r.value?.product) return null
                  const p = r.value.product
                  return {
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    rating: p._avg?.rating || (p.comments && p.comments.length ? Math.round(p.comments.reduce((s: any, c: any) => s + (c.rating || 0), 0) / p.comments.length * 10) / 10 : 0),
                    store: p.owner?.name || 'Store',
                    category: p.category,
                    deliveryDays: p.deliveryDays ?? 3,
                    reliability: p.reliability ?? 95,
                    inStock: p.inStock ?? true,
                    specs: p.specs || {},
                    description: p.description || '',
                  }
                })
                .filter(Boolean)
              setProducts(fetched)
            })
            .catch((e) => console.error('Failed to load selected products', e))
        }
      } catch (e) {
        console.error("Failed to parse stored products")
      }
    }
  }, [])

  // products state already contains only selected products (loaded from API)
  // apply user preferences to filter/sort the products shown in the table and sent to AI
  const applyPreferences = (list: any[]) => {
    let out = [...list]
    if (preferences.inStockOnly) out = out.filter((p) => p.inStock)
    if (preferences.minRating) out = out.filter((p) => (p.rating ?? 0) >= preferences.minRating)
    if (preferences.maxPrice) out = out.filter((p) => (p.price ?? Infinity) <= Number(preferences.maxPrice))
    // simple sort: if user prefers delivery or reliability, sort accordingly
    if (preferences.preferDelivery) out.sort((a, b) => (a.deliveryDays ?? 0) - (b.deliveryDays ?? 0))
    if (preferences.preferReliability) out.sort((a, b) => (b.reliability ?? 0) - (a.reliability ?? 0))
    return out
  }

  const compareProducts = applyPreferences(products)

  const removeProduct = (id: number) => {
    const newSelected = selectedProducts.filter((p) => p !== id)
    setSelectedProducts(newSelected)
    localStorage.setItem("selectedProducts", JSON.stringify(newSelected))
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  if (!mounted) return <div className="h-screen" />

  if (compareProducts.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="space-y-4">
          <Zap className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-2xl font-bold">No Products Selected</h2>
          <p className="text-muted-foreground">Select products from the listing page to compare them</p>
          <Link href="/">
            <Button>Browse Products</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (showAI) {
    return <AIComparisonChat products={compareProducts} onBack={() => setShowAI(false)} preferences={preferences} />
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Compare Products</h1>
            <p className="text-muted-foreground">Side-by-side comparison of {compareProducts.length} products</p>
          </div>
          <Link href="/">
            <Button variant="outline">Back to Products</Button>
          </Link>
        </div>

        {/* Preferences */}
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="flex gap-2 items-center">
            <label className="text-sm">Min rating:</label>
            <select
              value={preferences.minRating}
              onChange={(e) => setPreferences((p: any) => ({ ...p, minRating: Number(e.target.value) }))}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value={0}>Any</option>
              <option value={3}>3★</option>
              <option value={4}>4★</option>
              <option value={4.5}>4.5★</option>
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-sm">Max price:</label>
            <input
              type="number"
              placeholder="No limit"
              value={preferences.maxPrice ?? ''}
              onChange={(e) => setPreferences((p: any) => ({ ...p, maxPrice: e.target.value ? Number(e.target.value) : undefined }))}
              className="rounded border px-2 py-1 text-sm w-28"
            />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-sm">In-stock only</label>
            <input type="checkbox" checked={preferences.inStockOnly} onChange={(e) => setPreferences((p: any) => ({ ...p, inStockOnly: e.target.checked }))} />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-sm">Prefer delivery</label>
            <input type="checkbox" checked={preferences.preferDelivery} onChange={(e) => setPreferences((p: any) => ({ ...p, preferDelivery: e.target.checked }))} />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-sm">Prefer reliability</label>
            <input type="checkbox" checked={preferences.preferReliability} onChange={(e) => setPreferences((p: any) => ({ ...p, preferReliability: e.target.checked }))} />
          </div>
        </div>

        {/* AI Button */}
        <Button
          onClick={() => setShowAI(true)}
          size="lg"
          className="w-full gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
        >
          <Sparkles className="h-5 w-5" />
          Compare With SUQWise AI
        </Button>

        {/* Comparison Table */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted">
                <th className="px-4 py-3 text-left font-semibold">Feature</th>
                {compareProducts.map((product) => (
                  <th key={product.id} className="px-4 py-3 text-center font-semibold min-w-[180px]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-left">
                        <p className="font-semibold text-base">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.store}</p>
                      </div>
                      <button
                        onClick={() => removeProduct(product.id)}
                        className="rounded-md hover:bg-background p-1 flex-shrink-0"
                        title="Remove product"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b hover:bg-muted/50">
                <td className="px-4 py-3 font-medium">Price</td>
                {compareProducts.map((product) => (
                  <td key={product.id} className="px-4 py-3 text-center">
                    <span className="text-lg font-bold text-accent">${product.price}</span>
                  </td>
                ))}
              </tr>
              <tr className="border-b hover:bg-muted/50">
                <td className="px-4 py-3 font-medium">Rating</td>
                {compareProducts.map((product) => (
                  <td key={product.id} className="px-4 py-3 text-center">
                    <span className="font-semibold">{product.rating}★</span>
                  </td>
                ))}
              </tr>
              <tr className="border-b hover:bg-muted/50">
                <td className="px-4 py-3 font-medium">Delivery Time</td>
                {compareProducts.map((product) => (
                  <td key={product.id} className="px-4 py-3 text-center">
                    <span>
                      {product.deliveryDays} day{product.deliveryDays > 1 ? "s" : ""}
                    </span>
                  </td>
                ))}
              </tr>
              <tr className="border-b hover:bg-muted/50">
                <td className="px-4 py-3 font-medium">Seller Reliability</td>
                {compareProducts.map((product) => (
                  <td key={product.id} className="px-4 py-3 text-center">
                    <span className="inline-block rounded-full bg-primary/20 px-2 py-1 text-xs font-semibold text-primary">
                      {product.reliability}%
                    </span>
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-muted/50">
                <td className="px-4 py-3 font-medium">Stock Status</td>
                {compareProducts.map((product) => (
                  <td key={product.id} className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                        product.inStock
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {product.inStock ? "✓ In Stock" : "✗ Out of Stock"}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile View Alternative */}
        <div className="md:hidden space-y-4">
          <p className="text-sm text-muted-foreground">Scroll the table horizontally to see all products →</p>
        </div>
      </div>
    </div>
  )
}
