"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function OwnerUploadPage() {
  const [title, setTitle] = useState("")
  const [price, setPrice] = useState("")
  const [description, setDescription] = useState("")
  const [about, setAbout] = useState("")
  const [image, setImage] = useState("")
  const [display, setDisplay] = useState("")
  const [processor, setProcessor] = useState("")
  const [camera, setCamera] = useState("")
  const [battery, setBattery] = useState("")
  const [ram, setRam] = useState("")
  const [storage, setStorage] = useState("")
  const [category, setCategory] = useState("general")
  const [stock, setStock] = useState("")
  const [deliveryDays, setDeliveryDays] = useState(3)
  const [inStock, setInStock] = useState(true)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const token = localStorage.getItem('suqwise_token')
    if (!token) return alert('Please login as seller')
    setLoading(true)
    try {
      const specs = {
        display: display || undefined,
        processor: processor || undefined,
        camera: camera || undefined,
        battery: battery || undefined,
        ram: ram || undefined,
        storage: storage || undefined,
      }
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: title, description, about, price: Number(price), category, image, specs, stock: Number(stock || 0), inStock, deliveryDays: Number(deliveryDays) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Upload failed')
      alert('Uploaded')
      // notify listings to refresh
      try {
        window.dispatchEvent(new Event('suqwise-product-updated'))
      } catch (e) {
        /* ignore */
      }
      router.push('/owner/dashboard')
    } catch (err: any) {
      alert(err?.message || 'Upload error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Upload product</h1>
      <form onSubmit={submit} className="grid gap-3">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <Input placeholder="Image URL" value={image} onChange={(e) => setImage(e.target.value)} />
        <Input placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
  <Input placeholder="About (for AI analysis)" value={about} onChange={(e) => setAbout(e.target.value)} />

        <h3 className="text-sm font-medium">Specifications</h3>
  <Input placeholder={'Display (e.g. 6.7")'} value={display} onChange={(e) => setDisplay(e.target.value)} />
        <Input placeholder="Processor" value={processor} onChange={(e) => setProcessor(e.target.value)} />
        <Input placeholder="Camera" value={camera} onChange={(e) => setCamera(e.target.value)} />
        <Input placeholder="Battery" value={battery} onChange={(e) => setBattery(e.target.value)} />
        <Input placeholder="RAM" value={ram} onChange={(e) => setRam(e.target.value)} />
        <Input placeholder="Storage" value={storage} onChange={(e) => setStorage(e.target.value)} />

        <div className="flex gap-2">
          <Input placeholder="Stock (quantity)" value={stock} onChange={(e) => setStock(e.target.value)} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} /> In stock
          </label>
        </div>

        <div className="flex gap-2">
          <Input type="number" placeholder="Delivery days (e.g. 3)" value={String(deliveryDays)} onChange={(e) => setDeliveryDays(Number(e.target.value || 0))} />
        </div>

        <Button type="submit" disabled={loading}>{loading ? 'Uploading...' : 'Upload'}</Button>
      </form>
    </main>
  )
}
