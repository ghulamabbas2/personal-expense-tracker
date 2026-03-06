"use client"

import { HeroUIProvider } from "@heroui/react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { SessionProvider } from "next-auth/react"
import { useRouter } from "next/navigation"

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <SessionProvider>
      <HeroUIProvider navigate={router.push}>
        <NextThemesProvider attribute="class" defaultTheme="light">
          {children}
        </NextThemesProvider>
      </HeroUIProvider>
    </SessionProvider>
  )
}
