import type { Metadata } from "next"
import { Caveat, Inter, Manrope } from "next/font/google"
import "./globals.css"
import { PrivacyNotice } from "@/components/privacy-notice"
import { ThemeProvider } from "@/components/theme-provider"

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Ticket Tout",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${manrope.variable} ${inter.variable} ${caveat.variable} antialiased`}
      >
        <ThemeProvider>
          <a
            href="#contenu-principal"
            className="fixed left-4 top-4 z-[200] -translate-y-24 rounded-lg bg-background px-4 py-3 font-bold shadow-lg transition-transform focus:translate-y-0"
          >
            Aller au contenu principal
          </a>
          <PrivacyNotice />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}