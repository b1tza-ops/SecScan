'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { Shield, Trophy, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { scoreColor } from '@/lib/utils'

interface LeaderboardEntry {
  domain: string
  security_score: number
  critical_count: number
  warning_count: number
  completed_at: string
}

interface LeaderboardData {
  best: LeaderboardEntry[]
  worst: LeaderboardEntry[]
  total: number
}

function ScoreBadge({ score }: { score: number }) {
  const bg =
    score >= 80 ? 'bg-green-400/10 border-green-400/20' :
    score >= 60 ? 'bg-yellow-400/10 border-yellow-400/20' :
    score >= 40 ? 'bg-orange-400/10 border-orange-400/20' :
    'bg-red-400/10 border-red-400/20'
  return (
    <span className={`text-sm font-bold border px-2 py-0.5 rounded-lg ${scoreColor(score)} ${bg}`}>
      {score}/100
    </span>
  )
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getLeaderboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Nav */}
      <nav className="border-b border-[#111] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white">SecurityScan</span>
        </Link>
        <Link href="/auth/register" className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors">
          Scan Your Domain
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <h1 className="text-3xl font-bold text-white">Security Leaderboard</h1>
            </div>
            <p className="text-gray-400">
              {data?.total ? `${data.total.toLocaleString()} domains scanned` : 'Public security scores for scanned domains'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Best scores */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <h2 className="text-sm font-semibold text-white">Most Secure</h2>
              </div>
              <div className="space-y-2">
                {data?.best.map((entry, i) => (
                  <motion.div
                    key={entry.domain}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 p-4 bg-[#111] border border-[#222] rounded-xl hover:border-green-400/20 transition-colors"
                  >
                    <span className="text-xs text-gray-600 w-5 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-mono truncate">{entry.domain}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{new Date(entry.completed_at).toLocaleDateString()}</p>
                    </div>
                    <ScoreBadge score={entry.security_score} />
                  </motion.div>
                ))}
                {(!data?.best.length) && (
                  <p className="text-gray-600 text-sm text-center py-8">No data yet</p>
                )}
              </div>
            </div>

            {/* Worst scores */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <h2 className="text-sm font-semibold text-white">Needs Attention</h2>
              </div>
              <div className="space-y-2">
                {data?.worst.map((entry, i) => (
                  <motion.div
                    key={entry.domain}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 p-4 bg-[#111] border border-[#222] rounded-xl hover:border-red-400/20 transition-colors"
                  >
                    <span className="text-xs text-gray-600 w-5 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-mono truncate">{entry.domain}</p>
                      {entry.critical_count > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                          <span className="text-xs text-red-400">{entry.critical_count} critical</span>
                        </div>
                      )}
                    </div>
                    <ScoreBadge score={entry.security_score} />
                  </motion.div>
                ))}
                {(!data?.worst.length) && (
                  <p className="text-gray-600 text-sm text-center py-8">No data yet</p>
                )}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center p-8 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl">
            <h3 className="text-white font-semibold mb-2">See where your domain ranks</h3>
            <p className="text-gray-400 text-sm mb-4">Run a free security scan and find out how secure your site is.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors text-sm"
            >
              <Shield className="w-4 h-4" />
              Scan Your Domain Free
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
