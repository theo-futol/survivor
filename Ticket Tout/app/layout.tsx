import type { Metadata } from "next"
import localFont from "next/font/local"
import { Spectral } from "next/font/google"

import "./globals.css"

const marianne = localFont({
  src: [
    {
      path: "../fonts/Marianne-Thin.woff2",
      weight: "100",
      style: "normal",
    },
    {
      path: "../fonts/Marianne-Thin_Italic.woff2",
      weight: "100",
      style: "italic",
    },
    {
      path: "../fonts/Marianne-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../fonts/Marianne-Light_Italic.woff2",
      weight: "300",
      style: "italic",
    },
    {
      path: "../fonts/Marianne-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/Marianne-Regular_Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../fonts/Marianne-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/Marianne-Medium_Italic.woff2",
      weight: "500",
      style: "italic",
    },
    {
      path: "../fonts/Marianne-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../fonts/Marianne-Bold_Italic.woff2",
      weight: "700",
      style: "italic",
    },
    {
      path: "../fonts/Marianne-ExtraBold.woff2",
      weight: "800",
      style: "normal",
    },
    {
      path: "../fonts/Marianne-ExtraBold_Italic.woff2",
      weight: "800",
      style: "italic",
    },
  ],
  variable: "--font-marianne",
  display: "swap",
})

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
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
    <html lang="fr">
      <body
        className={`${marianne.variable} ${spectral.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}