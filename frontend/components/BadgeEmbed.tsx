'use client'
import { useState } from 'react'
import { Copy, Check, Code } from 'lucide-react'

interface BadgeEmbedProps {
  domain: string
  score: number
}

export function BadgeEmbed({ domain, score }: BadgeEmbedProps) {
  const [copied, setCopied] = useState<'md' | 'html' | null>(null)
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  const badgeUrl = `${baseUrl}/api/badge/${domain}`
  const scanUrl = typeof window !== 'undefined' ? window.location.href : ''

  const mdCode = `[![SecurityScan Score](${badgeUrl})](${scanUrl})`
  const htmlCode = `<a href="${scanUrl}"><img src="${badgeUrl}" alt="SecurityScan: ${score}/100" /></a>`

  const copy = (type: 'md' | 'html', text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Code className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">Embed Security Badge</h3>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <p className="text-xs text-gray-500 flex-1">Add this badge to your README or website to show your score.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={badgeUrl} alt={`SecurityScan: ${score}/100`} className="h-5 flex-shrink-0" />
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-400">Markdown</span>
            <button
              onClick={() => copy('md', mdCode)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
            >
              {copied === 'md' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copied === 'md' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="text-xs bg-[#0a0a0a] border border-[#222] rounded-lg p-3 text-green-400 overflow-x-auto whitespace-pre-wrap break-all">{mdCode}</pre>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-400">HTML</span>
            <button
              onClick={() => copy('html', htmlCode)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
            >
              {copied === 'html' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copied === 'html' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="text-xs bg-[#0a0a0a] border border-[#222] rounded-lg p-3 text-green-400 overflow-x-auto whitespace-pre-wrap break-all">{htmlCode}</pre>
        </div>
      </div>
    </div>
  )
}
