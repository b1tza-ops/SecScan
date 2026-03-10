import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'SecurityScan — Instant Website Security Audit',
  description: 'Scan your website and discover vulnerabilities, misconfigurations and security risks in seconds. Free website security audit tool.',
  keywords: 'website security audit, website vulnerability scanner, free security scan, website health check',
  openGraph: {
    title: 'SecurityScan — Instant Website Security Audit',
    description: 'Scan your website for vulnerabilities, misconfigurations and security risks.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1a1a1a', color: '#f4f4f5', border: '1px solid #222' },
          }}
        />
      </body>
    </html>
  )
}
