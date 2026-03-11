'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { Shield, Plus, Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { scoreColor } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Scan {
  id: string
  domain: string
  status: string
  security_score: number | null
  critical_count: number
  warning_count: number
  created_at: string
}

interface User {
  email: string
  full_name: string
  plan: string
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'completed') return <CheckCircle className="w-4 h-4 text-green-400" />
  if (status === 'running' || status === 'pending') return <Clock className="w-4 h-4 text-indigo-400 animate-spin" />
  if (status === 'failed') return <XCircle className="w-4 h-4 text-red-400" />
  return <AlertTriangle className="w-4 h-4 text-yellow-400" />
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [history, setHistory] = useState<Array<{ created_at: string; security_score: number }>>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      try {
        const [userRes, scansRes] = await Promise.all([api.me(), api.getUserScans()])
        setUser(userRes.user)
        setScans(scansRes.scans)
        const recentDomain = scansRes.scans?.find((s: Scan) => s.status === 'completed')?.domain
        if (recentDomain) {
          try {
            const histRes = await api.getDomainHistory(recentDomain)
            setHistory(histRes.history || [])
          } catch {}
        }
      } catch {
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <nav className="border-b border-[#111] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white">SecurityScan</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.email}</span>
          <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded-full capitalize">{user?.plan}</span>
          <button onClick={() => api.logout().then(() => router.push('/'))} className="text-sm text-gray-500 hover:text-white transition-colors">Logout</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Welcome back, {user?.full_name}</p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> New Scan
          </Link>
        </div>

        {scans.length === 0 ? (
          <div className="text-center py-20 bg-[#111] border border-[#222] rounded-2xl">
            <Shield className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 font-semibold">No scans yet</p>
            <p className="text-gray-600 text-sm mt-2">Run your first security scan to get started.</p>
            <Link href="/" className="mt-4 inline-block text-sm text-indigo-400 hover:underline">Start scanning →</Link>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {scans.map((scan) => (
              <Link
                key={scan.id}
                href={`/scan/${scan.id}`}
                className="flex items-center gap-4 p-5 bg-[#111] border border-[#222] rounded-xl hover:border-indigo-500/30 transition-colors group"
              >
                <StatusIcon status={scan.status} />
                <div className="flex-1">
                  <p className="font-semibold text-white group-hover:text-indigo-400 transition-colors">{scan.domain}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{new Date(scan.created_at).toLocaleString()}</p>
                </div>
                {scan.security_score !== null && (
                  <div className="text-right">
                    <span className={`text-xl font-bold ${scoreColor(scan.security_score)}`}>{scan.security_score}</span>
                    <span className="text-gray-600 text-sm">/100</span>
                  </div>
                )}
                {scan.critical_count > 0 && (
                  <span className="text-xs bg-red-400/10 text-red-400 border border-red-400/20 px-2 py-1 rounded-full">{scan.critical_count} critical</span>
                )}
                {scan.warning_count > 0 && (
                  <span className="text-xs bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-2 py-1 rounded-full">{scan.warning_count} warnings</span>
                )}
              </Link>
            ))}
          </motion.div>
        )}

        {/* Score History Chart */}
        {history.length >= 2 && (
          <div className="mt-8 bg-[#111] border border-[#222] rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white mb-1">Score History</h2>
            <p className="text-xs text-gray-500 mb-4">{history[0]?.domain || 'Recent domain'} — last {history.length} scans</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={[...history].reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  dataKey="created_at"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString()}
                />
                <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8, color: '#fff', fontSize: 12 }}
                  labelFormatter={(v) => new Date(v).toLocaleString()}
                  formatter={(v: number) => [`${v}/100`, 'Score']}
                />
                <Line
                  type="monotone"
                  dataKey="security_score"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {user?.plan === 'free' && (
          <div className="mt-8 p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Upgrade to Pro</p>
              <p className="text-sm text-gray-400 mt-1">Unlock unlimited scans, PDF reports, and monitoring.</p>
            </div>
            <button
              onClick={() => api.createCheckout('pro').then((r: {url: string}) => window.location.href = r.url)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors text-sm"
            >
              Upgrade $9/mo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
