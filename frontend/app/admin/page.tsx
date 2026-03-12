'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { Shield, Users, Scan, TrendingUp, Crown, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { scoreColor } from '@/lib/utils'

interface Stats {
  users: { total: number; free: number; pro: number; agency: number }
  scans: { total: number; by_status: Record<string, number>; today: number }
  top_domains: Array<{ domain: string; scan_count: string; best_score: number }>
}

interface User {
  id: string
  email: string
  full_name: string
  plan: string
  is_admin: boolean
  email_verified: boolean
  created_at: string
}

interface AdminScan {
  id: string
  domain: string
  status: string
  security_score: number | null
  email: string | null
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [scans, setScans] = useState<AdminScan[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'scans'>('overview')
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, usersRes, scansRes] = await Promise.all([
          api.getAdminStats(),
          api.getAdminUsers(),
          api.getAdminScans(),
        ])
        setStats(statsRes)
        setUsers(usersRes.users)
        setScans(scansRes.scans)
      } catch {
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  async function changePlan(userId: string, plan: string) {
    setUpdatingPlan(userId)
    try {
      await api.adminUpdateUserPlan(userId, plan)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan } : u))
    } catch {
      // silent fail
    } finally {
      setUpdatingPlan(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle className="w-3 h-3 text-green-400" />
    if (status === 'running' || status === 'pending') return <Clock className="w-3 h-3 text-indigo-400" />
    if (status === 'failed') return <XCircle className="w-3 h-3 text-red-400" />
    return <AlertTriangle className="w-3 h-3 text-yellow-400" />
  }

  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      free: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
      pro: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
      agency: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    }
    return <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${colors[plan] || colors.free}`}>{plan}</span>
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <nav className="border-b border-[#111] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white">SecurityScan</span>
          <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full ml-2">Admin</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Crown className="w-6 h-6 text-yellow-400" />
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-[#111] border border-[#222] rounded-xl p-1 w-fit">
          {(['overview', 'users', 'scans'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && stats && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Users', value: stats.users.total, icon: Users, color: 'text-blue-400' },
                { label: 'Paid Users', value: stats.users.pro + stats.users.agency, icon: Crown, color: 'text-yellow-400' },
                { label: 'Total Scans', value: stats.scans.total, icon: Scan, color: 'text-indigo-400' },
                { label: "Today's Scans", value: stats.scans.today, icon: TrendingUp, color: 'text-green-400' },
              ].map((item) => (
                <div key={item.label} className="bg-[#111] border border-[#222] rounded-2xl p-5">
                  <item.icon className={`w-5 h-5 ${item.color} mb-3`} />
                  <p className="text-2xl font-bold text-white">{item.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* User plan breakdown */}
              <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-white mb-4">Users by Plan</h2>
                {[
                  { plan: 'Free', count: stats.users.free, color: 'bg-gray-500' },
                  { plan: 'Pro', count: stats.users.pro, color: 'bg-indigo-500' },
                  { plan: 'Agency', count: stats.users.agency, color: 'bg-yellow-500' },
                ].map(({ plan, count, color }) => (
                  <div key={plan} className="flex items-center gap-3 mb-3">
                    <span className="text-sm text-gray-400 w-16">{plan}</span>
                    <div className="flex-1 bg-[#222] rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full transition-all`}
                        style={{ width: `${stats.users.total ? (count / stats.users.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm text-white w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>

              {/* Scan status breakdown */}
              <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-white mb-4">Scans by Status</h2>
                {Object.entries(stats.scans.by_status).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between py-1.5 border-b border-[#222] last:border-0">
                    <div className="flex items-center gap-2">
                      {statusIcon(status)}
                      <span className="text-sm text-gray-400 capitalize">{status}</span>
                    </div>
                    <span className="text-sm text-white font-medium">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Top domains */}
              {stats.top_domains.length > 0 && (
                <div className="bg-[#111] border border-[#222] rounded-2xl p-6 md:col-span-2">
                  <h2 className="text-sm font-semibold text-white mb-4">Most Scanned Domains</h2>
                  <div className="space-y-2">
                    {stats.top_domains.map((d) => (
                      <div key={d.domain} className="flex items-center gap-4 p-3 bg-[#0a0a0a] rounded-xl">
                        <span className="text-sm text-white font-mono flex-1">{d.domain}</span>
                        <span className="text-xs text-gray-500">{d.scan_count} scans</span>
                        {d.best_score !== null && (
                          <span className={`text-sm font-bold ${scoreColor(d.best_score)}`}>{d.best_score}/100</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Users table */}
        {activeTab === 'users' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#222] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Users ({users.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#222]">
                      {['Name', 'Email', 'Plan', 'Verified', 'Joined', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                        <td className="px-4 py-3 text-sm text-white">{user.full_name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-400 font-mono">{user.email}</td>
                        <td className="px-4 py-3">{planBadge(user.plan)}</td>
                        <td className="px-4 py-3">
                          {user.email_verified
                            ? <CheckCircle className="w-4 h-4 text-green-400" />
                            : <XCircle className="w-4 h-4 text-gray-600" />}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <select
                            value={user.plan}
                            disabled={updatingPlan === user.id}
                            onChange={(e) => changePlan(user.id, e.target.value)}
                            className="text-xs bg-[#0a0a0a] border border-[#333] text-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                          >
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="agency">Agency</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Scans table */}
        {activeTab === 'scans' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#222]">
                <h2 className="text-sm font-semibold text-white">Recent Scans ({scans.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#222]">
                      {['Domain', 'Status', 'Score', 'User', 'Date'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scans.map((scan) => (
                      <tr key={scan.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/scan/${scan.id}`} className="text-sm text-indigo-400 hover:underline font-mono">
                            {scan.domain}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {statusIcon(scan.status)}
                            <span className="text-xs text-gray-400 capitalize">{scan.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {scan.security_score !== null
                            ? <span className={`text-sm font-bold ${scoreColor(scan.security_score)}`}>{scan.security_score}</span>
                            : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{scan.email || 'anonymous'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{new Date(scan.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
