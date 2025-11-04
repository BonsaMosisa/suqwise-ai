"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import router from "next/router"

export default function RegisterPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"buyer" | "seller">("buyer")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || data?.message || 'Registration failed')
      if (data.token) localStorage.setItem('suqwise_token', data.token)
      if (data.user) localStorage.setItem('suqwise_user', JSON.stringify(data.user))
      window.dispatchEvent(new Event('suqwise-auth'))
      if (data.user?.role === 'seller') router.push('/owner/dashboard')
      else router.push('/')
    } catch (err: any) {
      setError(err?.message || 'Registration error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-yellow-500 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Create account</h1>
        <form onSubmit={submit} className="grid gap-3">
          <div>
            <label className="text-sm">Full name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label className="text-sm">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-sm">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </div>
          <div>
            <label className="text-sm">Account type</label>
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => setRole('buyer')} className={`px-3 py-1 rounded ${role === 'buyer' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                Buyer
              </button>
              <button type="button" onClick={() => setRole('seller')} className={`px-3 py-1 rounded ${role === 'seller' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                Seller
              </button>
            </div>
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</Button>
        </form>
      </div>
    </div>
  )
}
