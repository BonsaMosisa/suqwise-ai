"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Zap, TrendingUp, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { mockProducts } from "@/lib/mock-data"

export default function Home() {
  const [featured, setFeatured] = useState(mockProducts.slice(0, 8))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <div className="h-screen" />

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-primary/80 py-12 md:py-20 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">Smart Product Comparison</h1>
            <p className="text-lg text-primary-foreground/90 mb-8">
              Compare prices across stores, find the best deals, and make informed decisions with AI-powered insights.
            </p>
            <div className="flex gap-4">
              <Link href="/search">
                <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  Start Shopping
                </Button>
              </Link>
              <Link href="/compare">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Compare Products
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Featured Products</h2>
          <p className="text-muted-foreground">Explore our most popular items</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {featured.map((product) => (
            <Card key={product.id} className="h-full flex flex-col hover:shadow-lg transition-shadow">
              <CardHeader className="flex-shrink-0">
                <Link
                  href={`/product/${product.id}`}
                  className="block cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="aspect-square bg-primary/10 rounded-lg mb-4 flex items-center justify-center">
                    <div className="text-4xl font-bold text-primary/30">{product.name.charAt(0)}</div>
                  </div>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                </Link>
                <CardDescription>{product.category}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col gap-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-semibold text-primary">${product.price}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rating</span>
                    <span className="font-semibold">{product.rating}★</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Store</span>
                    <span className="font-semibold">{product.store}</span>
                  </div>
                </div>
                <Link href={`/search?q=${product.name}`} className="mt-auto">
                  <Button className="w-full bg-transparent" variant="outline">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    View Options
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Info Section */}
      <section className="bg-accent text-accent-foreground py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <TrendingUp className="h-8 w-8 mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Best Prices</h3>
              <p>Find the lowest prices across all major stores</p>
            </div>
            <div>
              <Zap className="h-8 w-8 mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">AI Powered</h3>
              <p>Get intelligent comparisons and recommendations</p>
            </div>
            <div>
              <ShoppingCart className="h-8 w-8 mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Easy Compare</h3>
              <p>Compare products side-by-side instantly</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
