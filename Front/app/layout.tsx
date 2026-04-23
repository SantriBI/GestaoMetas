import React from "react"
import type { Metadata } from 'next'
import { Space_Grotesk, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from "@/components/ui/sonner"
import { NotificationProvider } from "@/components/notifications/NotificationContext"
import { NotificationToast } from "@/components/notifications/NotificationToast"
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
  icons: {
    icon: [{ url: '/logo%20sip%202.0.svg', type: 'image/svg+xml' }],
    shortcut: '/logo%20sip%202.0.svg',
    apple: '/logo%20sip%202.0.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body suppressHydrationWarning className={`${spaceGrotesk.className} antialiased`}>
        <NotificationProvider>
          {children}
          <NotificationToast />
          <Toaster position="top-right" richColors />
          <Analytics />
        </NotificationProvider>
      </body>
    </html>
  )
}

