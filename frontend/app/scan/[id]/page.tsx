'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ScoreGauge } from '@/components/ScoreGauge'
import { FindingCard } from '@/components/FindingCard'
import { api } from '@/lib/api'
import { Shield, AlertTriangle, Info, Download, RefreshCw, CheckCircle, Share2 } from 'lucide-react'
import Link from 'next/link'
import { BadgeEmbed } from '@/components/BadgeEmbed'
import { OWASPSummary } from '@/components/OWASPSummary'

interface Finding {
  title: string
  description: string
  severity: string
  fix_recommendation: string
  fix_example?: string
}

interface ScanModule {
  module: string
  findings: Finding[]
}

interface Vulnerability extends Finding {
  id: string
}

interface ScanData {
  id: string
  domain: string
  status: string
  security_score: number
  completed_at: string
  owasp_summary?: Record<string, number>
}

const MODULE_LABELS: Record<string, string> = {
  ssl: 'SSL/TLS',
  headers: 'Security Headers',
  dns: 'DNS Security',
  cms: 'CMS Detection',
  js_libraries: 'JS Libraries',
  ports: 'Open Ports',
  cookies: 'Cookie Security',
  robots: 'robots.txt',
  https_redirect: 'HTTPS Redirect',
  exposed_files: 'Exposed Files',
  subdomain_takeover: 'Subdomain Takeover',
  security_txt: 'security.txt',
}

export default function ScanPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<{ scan: ScanData; modules: ScanModule[]; vulnerabilities: Vulnerability[] } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchScan = useCallback(async () => {
    try {
      const result = await api.getScan(id)
      setData(result)
      return result.scan.status
    } catch {
      return 'error'
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    let interval: NodeJS.Timeout
    const poll = async () => {
      const status = await fetchScan()
      if (status === 'pending' || status === 'running') {
        interval = setTimeout(poll, 3000)
      }
    }
    poll()
    return () => clearTimeout(interval)
  }, [fetchScan])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading scan...</p>
        </div>
      </div>
    )
  }

  if (!data) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-red-400">Scan not found.</div>

  const { scan, modules, vulnerabilities } = data
  const isRunning = scan.status === 'pending' || scan.status === 'running'

  const criticals = vulnerabilities.filter((v) => v.severity === 'critical' || v.severity === 'high')
  const warnings = vulnerabilities.filter((v) => v.severity === 'medium')
  const infos = vulnerabilities.filter((v) => v.severity === 'low' || v.severity === 'info')

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="flex items-center gap-2 text-indigo-400 mb-4 text-sm hover:underline">
              <Shield className="w-4 h-4" /> SecurityScan
            </Link>
            <h1 className="text-2xl font-bold text-white">{scan.domain}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {scan.status === 'completed' ? `Completed · ${new Date(scan.completed_at).toLocaleString()}` : `Status: ${scan.status}`}
            </p>
          </div>
          {isRunning && (
            <div className="flex items-center gap-2 text-indigo-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-sm">Scanning...</span>
            </div>
          )}
        </div>

        {/* Overview */}
        {!isRunning && scan.status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
          >
            <div className="md:col-span-1 bg-[#111] border border-[#222] rounded-2xl p-6 flex flex-col items-center justify-center">
              <ScoreGauge score={scan.security_score} />
            </div>
            <div className="md:col-span-3 grid grid-cols-3 gap-4">
              {[
                { label: 'Critical & High', count: criticals.length, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', icon: AlertTriangle },
                { label: 'Warnings', count: warnings.length, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', icon: AlertTriangle },
                { label: 'Info', count: infos.length, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: Info },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border p-6 ${item.bg}`}>
                  <item.icon className={`w-6 h-6 ${item.color} mb-2`} />
                  <p className={`text-3xl font-bold ${item.color}`}>{item.count}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {isRunning && (
          <div className="bg-[#111] border border-[#222] rounded-2xl p-12 text-center mb-8">
            <div className="w-16 h-16 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">Scanning {scan.domain}...</p>
            <p className="text-gray-500 text-sm">Running security checks. This usually takes 20–60 seconds.</p>
          </div>
        )}

        {/* Module Results */}
        {!isRunning && modules.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Module Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {modules.map((mod) => {
                const hasCritical = mod.findings.some((f) => f.severity === 'critical' || f.severity === 'high')
                const hasMedium = mod.findings.some((f) => f.severity === 'medium')
                return (
                  <div
                    key={mod.module}
                    className={`p-4 rounded-xl border text-center ${
                      hasCritical ? 'border-red-400/30 bg-red-400/5' :
                      hasMedium ? 'border-yellow-400/30 bg-yellow-400/5' :
                      'border-green-400/30 bg-green-400/5'
                    }`}
                  >
                    {hasCritical ? (
                      <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                    ) : hasMedium ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
                    )}
                    <p className="text-xs text-gray-300 font-medium">{MODULE_LABELS[mod.module] || mod.module}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{mod.findings.length} finding{mod.findings.length !== 1 ? 's' : ''}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* OWASP Summary */}
        {!isRunning && scan.status === 'completed' && scan.owasp_summary && Object.keys(scan.owasp_summary).length > 0 && (
          <OWASPSummary owaspSummary={scan.owasp_summary} />
        )}

        {/* Findings */}
        {!isRunning && vulnerabilities.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-white">All Findings</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="text-sm flex items-center gap-2 bg-[#1a1a1a] border border-[#333] text-gray-300 hover:text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/pdf/${scan.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm flex items-center gap-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 px-4 py-2 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" /> PDF Report
                </a>
              </div>
            </div>
            <div className="space-y-3">
              {vulnerabilities.map((v) => (
                <FindingCard key={v.id} finding={v} />
              ))}
            </div>
          </div>
        )}

        {!isRunning && scan.status === 'completed' && vulnerabilities.length === 0 && (
          <div className="text-center py-16 text-green-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-4" />
            <p className="text-xl font-semibold">No issues found!</p>
            <p className="text-gray-500 text-sm mt-2">Your site passed all security checks.</p>
          </div>
        )}

        {/* Badge Embed */}
        {!isRunning && scan.status === 'completed' && (
          <div className="mt-8">
            <BadgeEmbed domain={scan.domain} score={scan.security_score} />
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-600">
          <Link href="/auth/register" className="text-indigo-400 hover:underline">Create a free account</Link> to save reports, set up monitoring, and export PDF reports.
        </div>
      </div>
    </div>
  )
}
