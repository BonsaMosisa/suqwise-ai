"use client"

import { useState, useEffect } from "react"
import type React from "react"
import { Analytics } from "@vercel/analytics/next"
import { Navigation } from "@/components/navigation"
import type { Language } from "@/lib/translations"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem("language") as Language | null
    if (stored) {
      setLanguage(stored)
    }
  }, [])

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem("language", lang)
  }

  if (!mounted) {
    return <></> // Render nothing until client-side hydration is complete
  }

  return (
    <>
      <Navigation language={language} onLanguageChange={handleLanguageChange} />
      {children}
      <Analytics />
    </>
  )
}
