import React from "react"
import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from "@/components/ui/sonner"
import { NotificationProvider } from "@/components/notifications/NotificationContext"
import { NotificationToast } from "@/components/notifications/NotificationToast"
import { ThemeProvider } from "@/components/theme-provider"
import './globals.css'

const spaceGrotesk = Space_Grotesk({ 
  subsets: ["latin"],
  variable: '--font-space-grotesk'
});
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'SIP - Gestão de Metas',
  description: 'Sistema de Performance de Vendedores',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/logo%20sip%202.0.svg', type: 'image/svg+xml' }],
    shortcut: '/logo%20sip%202.0.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SIP',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0c0f18',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${spaceGrotesk.className} antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
          <NotificationProvider>
            {children}
            <NotificationToast />
            <Toaster position="top-right" richColors />
            <Analytics />
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

