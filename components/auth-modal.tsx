"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"

export function AuthModal() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"login" | "register">("login")
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"buyer" | "seller">("buyer")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const url = mode === "login" ? "/api/auth/login" : "/api/auth/register"
      const body: any = { email, password }
      if (mode === "register") {
        body.name = name
        body.role = role
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Auth failed")

      // save token and user
      if (data.token) localStorage.setItem("suqwise_token", data.token)
      if (data.user) localStorage.setItem("suqwise_user", JSON.stringify(data.user))

      // notify other components
      window.dispatchEvent(new Event("suqwise-auth"))
      setOpen(false)

      // redirect seller to dashboard
      try {
        if (data.user?.role === 'seller') router.push('/owner/dashboard')
        else router.push('/')
      } catch (e) {
        /* ignore */
      }
    } catch (err: any) {
      setError(err?.message || "Request failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost">Login / Register</Button>
      </DialogTrigger>
    <DialogContent className="bg-yellow-200">
        <DialogHeader>
          <DialogTitle>{mode === "login" ? "Login" : "Register"}</DialogTitle>
          <DialogDescription>
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-3">
          {mode === "register" && (
            <div>
              <label className="text-sm">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
          )}

          <div>
            <label className="text-sm">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          <div>
            <label className="text-sm">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </div>

          {mode === "register" && (
            <div>
              <label className="text-sm">Account type</label>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setRole("buyer")} className={`px-3 py-1 rounded ${role === "buyer" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  Buyer
                </button>
                <button type="button" onClick={() => setRole("seller")} className={`px-3 py-1 rounded ${role === "seller" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  Seller
                </button>
              </div>
            </div>
          )}

          {error && <div className="text-sm text-red-500">{error}</div>}

          <DialogFooter>
            <div className="flex gap-2 w-full">
              <Button type="submit" disabled={loading} className="w-full">
                {mode === "login" ? (loading ? "Signing in..." : "Sign in") : loading ? "Creating..." : "Create account"}
              </Button>
            </div>
          </DialogFooter>
        </form>

        <div className="mt-4 text-sm text-center">
          {mode === "login" ? (
            <>
              Don't have an account?{' '}
              <button className="text-primary" onClick={() => setMode("register")}>Create one</button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button className="text-primary" onClick={() => setMode("login")}>Sign in</button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AuthModal
