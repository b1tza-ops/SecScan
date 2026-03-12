'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ScoreGauge } from '@/components/ScoreGauge'
import { FindingCard } from '@/components/FindingCard'
import { api } from '@/lib/api'
import { Shield, AlertTriangle, Info, Download, RefreshCw, CheckCircle, Share2, XCircle, Sparkles, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { BadgeEmbed } from '@/components/BadgeEmbed'
import { OWASPSummary } from '@/components/OWASPSummary'

interface Finding {
  title: string
  description: string
  severity: string
  fix_recommendation: string
  fix_example?: string
  owasp_category?: string
  category?: string
  cve?: string
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

interface AiSummary {
  overall_assessment: string
  top_risks: string[]
  quick_wins: string[]
  priority_level: string
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

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low' | 'info'

const POLL_MAX = 100 // ~5 minutes at 3s interval

export default function ScanPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<{ scan: ScanData; modules: ScanModule[]; vulnerabilities: Vulnerability[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [pollCount, setPollCount] = useState(0)
  const [timedOut, setTimedOut] = useState(false)
  const [filter, setFilter] = useState<SeverityFilter>('all')
  const [rescanning, setRescanning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)

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
    let timeout: NodeJS.Timeout
    let count = 0
    const poll = async () => {
      const status = await fetchScan()
      count++
      setPollCount(count)
      if ((status === 'pending' || status === 'running') && count < POLL_MAX) {
        timeout = setTimeout(poll, 3000)
      } else if (count >= POLL_MAX) {
        setTimedOut(true)
      }
    }
    poll()
    return () => clearTimeout(timeout)
  }, [fetchScan])

  async function handleRescan() {
    setRescanning(true)
    try {
      const res = await api.rescan(id)
      window.location.href = `/scan/${res.scan.id}`
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Rescan failed')
      setRescanning(false)
    }
  }

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.href).catch(() => {
      prompt('Copy this link:', window.location.href)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function loadAiSummary() {
    setAiSummaryLoading(true)
    try {
      const res = await api.getAiSummary(id)
      setAiSummary(res.summary)
    } catch {
      // silently fail
    } finally {
      setAiSummaryLoading(false)
    }
  }

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

  if (!data) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400 font-semibold">Scan not found.</p>
        <Link href="/" className="mt-4 inline-block text-indigo-400 text-sm hover:underline">← Back to home</Link>
      </div>
    </div>
  )

  const { scan, modules, vulnerabilities } = data
  const isRunning = scan.status === 'pending' || scan.status === 'running'
  const isFailed = scan.status === 'failed'

  const criticals = vulnerabilities.filter((v) => v.severity === 'critical' || v.severity === 'high')
  const warnings = vulnerabilities.filter((v) => v.severity === 'medium')
  const infos = vulnerabilities.filter((v) => v.severity === 'low' || v.severity === 'info')

  const filteredVulns = filter === 'all'
    ? vulnerabilities
    : vulnerabilities.filter((v) => v.severity === filter)

  const priorityColor: Record<string, string> = {
    critical: 'text-red-400 border-red-400/20 bg-red-400/5',
    high: 'text-orange-400 border-orange-400/20 bg-orange-400/5',
    medium: 'text-yellow-400 border-yellow-400/20 bg-yellow-400/5',
    low: 'text-blue-400 border-blue-400/20 bg-blue-400/5',
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <Link href="/" className="flex items-center gap-2 text-indigo-400 mb-4 text-sm hover:underline">
              <Shield className="w-4 h-4" /> SecurityScan
            </Link>
            <h1 className="text-2xl font-bold text-white">{scan.domain}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {scan.status === 'completed'
                ? `Completed · ${new Date(scan.completed_at).toLocaleString()}`
                : `Status: ${scan.status}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isRunning && (
              <div className="flex items-center gap-2 text-indigo-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm">Scanning...</span>
              </div>
            )}
            {(scan.status === 'completed' || isFailed) && (
              <button
                onClick={handleRescan}
                disabled={rescanning}
                className="flex items-center gap-2 text-sm bg-[#1a1a1a] border border-[#333] text-gray-300 hover:text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {rescanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Re-scan
              </button>
            )}
          </div>
        </div>

        {/* Timeout warning */}
        {timedOut && isRunning && (
          <div className="mb-6 p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-yellow-400 text-sm">
            Scan is taking longer than expected. It may still be running in the background — refresh the page to check.
          </div>
        )}

        {/* Failed state */}
        {isFailed && (
          <div className="bg-[#111] border border-red-400/20 rounded-2xl p-12 text-center mb-8">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">Scan failed</p>
            <p className="text-gray-500 text-sm mb-6">The scan encountered an error. This can happen if the domain is unreachable or times out.</p>
            <button
              onClick={handleRescan}
              disabled={rescanning}
              className="flex items-center gap-2 mx-auto bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors text-sm disabled:opacity-50"
            >
              {rescanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Try Again
            </button>
          </div>
        )}

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
            {pollCount > 10 && (
              <p className="text-gray-600 text-xs mt-2">Still working... ({Math.round(pollCount * 3)}s elapsed)</p>
            )}
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

        {/* AI Executive Summary */}
        {!isRunning && scan.status === 'completed' && (
          <div className="mb-8">
            {!aiSummary && !aiSummaryLoading && (
              <button
                onClick={loadAiSummary}
                className="flex items-center gap-2 text-sm bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/20 px-4 py-2 rounded-lg transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Generate AI Executive Summary
              </button>
            )}
            {aiSummaryLoading && (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating AI summary...
              </div>
            )}
            {aiSummary && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-semibold text-indigo-400">AI Executive Summary</span>
                  {aiSummary.priority_level && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${priorityColor[aiSummary.priority_level] || 'text-gray-400 border-gray-400/20'}`}>
                      {aiSummary.priority_level} priority
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-300 mb-4">{aiSummary.overall_assessment}</p>
                <div className="grid md:grid-cols-2 gap-4">
                  {aiSummary.top_risks?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-400 mb-2">Top risks</p>
                      <ul className="space-y-1">
                        {aiSummary.top_risks.map((r, i) => (
                          <li key={i} className="text-sm text-gray-400 flex gap-2"><span className="text-red-400">•</span>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiSummary.quick_wins?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-400 mb-2">Quick wins</p>
                      <ul className="space-y-1">
                        {aiSummary.quick_wins.map((w, i) => (
                          <li key={i} className="text-sm text-gray-400 flex gap-2"><span className="text-green-400">✓</span>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Findings */}
        {!isRunning && vulnerabilities.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-white">All Findings</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="text-sm flex items-center gap-2 bg-[#1a1a1a] border border-[#333] text-gray-300 hover:text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Share'}
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

            {/* Severity filter tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {([
                { key: 'all', label: `All (${vulnerabilities.length})` },
                { key: 'critical', label: `Critical (${vulnerabilities.filter(v => v.severity === 'critical').length})` },
                { key: 'high', label: `High (${vulnerabilities.filter(v => v.severity === 'high').length})` },
                { key: 'medium', label: `Medium (${warnings.length})` },
                { key: 'low', label: `Low (${vulnerabilities.filter(v => v.severity === 'low').length})` },
                { key: 'info', label: `Info (${vulnerabilities.filter(v => v.severity === 'info').length})` },
              ] as { key: SeverityFilter; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    filter === key
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-[#111] border-[#222] text-gray-400 hover:text-white hover:border-[#333]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredVulns.map((v) => (
                <FindingCard key={v.id} finding={v} />
              ))}
              {filteredVulns.length === 0 && (
                <p className="text-center text-gray-500 py-8 text-sm">No {filter} findings.</p>
              )}
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
