"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, ShoppingCart, Zap, User, Menu, X } from "lucide-react"
import { type Language, translations } from "@/lib/translations"
import AuthModal from "./auth-modal"

interface NavigationProps {
  language: Language
  onLanguageChange: (lang: Language) => void
}

export function Navigation({ language, onLanguageChange }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null)
  const pathname = usePathname()
  const t = translations[language]
  // translations typings are strict; cast to any to allow optional/legacy keys
  const th = t as any

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem("suqwise_user")
      if (raw) setUser(JSON.parse(raw))
    } catch (e) {
      setUser(null)
    }

    const onAuth = (e: Event) => {
      try {
        const raw = localStorage.getItem("suqwise_user")
        setUser(raw ? JSON.parse(raw) : null)
      } catch (err) {
        setUser(null)
      }
    }

    window.addEventListener("suqwise-auth", onAuth as EventListener)
    return () => window.removeEventListener("suqwise-auth", onAuth as EventListener)
  }, [])

  if (!mounted) return null

  const languages: Array<{ code: Language; name: string }> = [
    { code: "en", name: "English" },
    { code: "am", name: "አማርኛ" },
    { code: "om", name: "Afaan Oromo" },
  ]

  const navItems = [
    { href: "/", icon: Home, label: th.header?.products || "Home" },
    { href: "/search", icon: Search, label: th.header?.search || "Search" },
    { href: "/cart", icon: ShoppingCart, label: th.header?.cart || "Cart" },
    { href: "/compare", icon: Zap, label: th.header?.compare || "Compare" },
    { href: "/profile", icon: User, label: th.header?.profile || "Profile" },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b bg-card shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-primary-foreground">SQ</span>
              </div>
              <span className="hidden sm:inline text-xl font-bold text-foreground">SUQWISE</span>
              <span className="text-sm sm:hidden font-bold text-foreground">SUQWISE</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden gap-8 lg:flex">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                      isActive(item.href) ? "text-primary font-bold" : "text-foreground hover:text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Language Selector & Mobile Menu */}
            <div className="flex items-center gap-2 sm:gap-4">
              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as Language)}
                className="rounded-md border bg-background px-2 py-1 text-sm"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>

              {/* Auth / User */}
              <div className="hidden md:flex items-center gap-2">
                {user ? (
                  <div className="flex items-center gap-2">
                    <Link
                      href={user.role === "seller" ? "/owner/dashboard" : "/profile"}
                      className="text-sm font-medium text-foreground hover:text-primary"
                    >
                      {user.name}
                    </Link>
                    <button
                      onClick={() => {
                        localStorage.removeItem("suqwise_token")
                        localStorage.removeItem("suqwise_user")
                        window.dispatchEvent(new Event("suqwise-auth"))
                      }}
                      className="text-sm text-red-500"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Link href="/auth/login" className="text-sm font-medium text-foreground hover:text-primary">
                      Login
                    </Link>
                    <Link href="/auth/register" className="text-sm font-medium text-foreground hover:text-primary">
                      Register
                    </Link>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden p-2 rounded-md hover:bg-muted"
                aria-label="Toggle menu"
              >
                {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isOpen && (
            <div className="lg:hidden border-t py-4 flex flex-col gap-2">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                      isActive(item.href) ? "bg-primary text-primary-foreground font-bold" : "hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </header>

      {/* Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-black shadow-lg md:hidden">
        <div className="flex items-center justify-around h-20">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-20 gap-1 transition-colors ${
                  isActive(item.href)
                    ? "text-yellow-400 border-t-2 border-yellow-400 font-bold"
                    : "text-gray-400 hover:text-yellow-400"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
