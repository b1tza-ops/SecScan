'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Search, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const PRIVATE_IP_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1|\[::1\])/i
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/i

function validateDomain(input: string): string | null {
  const clean = input.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim().toLowerCase()
  if (!clean) return 'Please enter a domain'
  if (PRIVATE_IP_RE.test(clean)) return 'Cannot scan private or internal addresses'
  if (!DOMAIN_RE.test(clean)) return 'Please enter a valid domain (e.g., example.com)'
  return null
}

export function ScanForm() {
  const [domain, setDomain] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const domainError = validateDomain(domain)
    if (domainError) return setError(domainError)
    if (!consent) return setError('You must confirm you have permission to scan this domain')

    setLoading(true)
    try {
      const { scan } = await api.createScan(domain.trim(), consent)
      toast.success('Scan started!')
      router.push(`/scan/${scan.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start scan'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleScan} className="w-full max-w-2xl">
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            className="w-full pl-12 pr-4 py-4 bg-[#111] border border-[#333] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors text-lg"
          />
        </div>
        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Shield className="w-5 h-5" />
          )}
          {loading ? 'Scanning...' : 'Scan Now'}
        </motion.button>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
        />
        <span className="text-sm text-gray-400">
          I confirm I own or have permission to scan this domain. I agree to the{' '}
          <a href="/terms" className="text-indigo-400 hover:underline">Terms of Service</a>.
        </span>
      </label>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 flex items-center gap-2 text-red-400 text-sm"
        >
          <AlertCircle className="w-4 h-4" />
          {error}
        </motion.div>
      )}
    </form>
  )
}
