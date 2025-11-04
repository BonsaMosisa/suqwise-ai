"use client"

import { useState, createContext, useEffect } from "react"
import Link from "next/link"
import { ShoppingCart, Zap, Menu, X } from "lucide-react"
import { type Language, translations } from "@/lib/translations"

export const LanguageContext = createContext<{
  language: Language
  setLanguage: (lang: Language) => void
}>({
  language: "en",
  setLanguage: () => {},
})

export function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [language, setLanguage] = useState<Language>("en")
  const [mounted, setMounted] = useState(false)
  const t = translations[language]

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem("language") as Language | null
    if (stored && stored in translations) {
      setLanguage(stored)
    }
  }, [])

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem("language", lang)
  }

  if (!mounted) return null

  const languages: Array<{ code: Language; name: string }> = [
    { code: "en", name: "English" },
    { code: "am", name: "አማርኛ" },
    { code: "om", name: "Afaan Oromo" },
  ]

  return (
    <header className="sticky top-0 z-50 border-b bg-card shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground hidden sm:inline">
              SUQWise<span className="text-primary">AI</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden gap-8 md:flex">
            <Link href="/" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              {t.header.products}
            </Link>
            <Link
              href="/compare"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              {t.header.compare}
            </Link>
          </nav>

          {/* Language Selector & Mobile Menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as Language)}
              className="rounded-md border bg-background px-2 py-1 text-sm"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 rounded-md hover:bg-accent"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden border-t py-4 flex flex-col gap-2">
            <Link href="/" className="px-4 py-2 rounded-md hover:bg-accent">
              {t.header.products}
            </Link>
            <Link href="/compare" className="px-4 py-2 rounded-md hover:bg-accent flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              {t.header.compare}
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
