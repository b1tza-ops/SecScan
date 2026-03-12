'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { Shield, Key, Bell, Eye, EyeOff, Copy, Check, RefreshCw, Globe, Webhook } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface User {
  id: string
  email: string
  full_name: string
  plan: string
  api_key: string
  email_alerts: boolean
}

interface Domain {
  id: string
  domain: string
  monitoring_enabled: boolean
  monitoring_interval: string
  webhook_url: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [savingNotifs, setSavingNotifs] = useState(false)
  const [webhookInputs, setWebhookInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      try {
        const [userRes, domainsRes] = await Promise.all([api.me(), api.getDomains()])
        setUser(userRes.user)
        setDomains(domainsRes.domains || [])
        const inputs: Record<string, string> = {}
        domainsRes.domains?.forEach((d: Domain) => { inputs[d.id] = d.webhook_url || '' })
        setWebhookInputs(inputs)
      } catch {
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  async function copyApiKey() {
    if (!user?.api_key) return
    await navigator.clipboard.writeText(user.api_key).catch(() => {})
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  async function regenerateKey() {
    setRegenerating(true)
    try {
      const res = await api.regenerateApiKey()
      setUser(u => u ? { ...u, api_key: res.api_key } : u)
      toast.success('API key regenerated')
    } catch {
      toast.error('Failed to regenerate key')
    } finally {
      setRegenerating(false)
    }
  }

  async function toggleEmailAlerts() {
    if (!user) return
    setSavingNotifs(true)
    try {
      await api.updateNotifications(!user.email_alerts)
      setUser(u => u ? { ...u, email_alerts: !u.email_alerts } : u)
      toast.success('Notification preference saved')
    } catch {
      toast.error('Failed to save preference')
    } finally {
      setSavingNotifs(false)
    }
  }

  async function saveWebhook(domainId: string) {
    try {
      await api.setDomainWebhook(domainId, webhookInputs[domainId] || null)
      toast.success('Webhook saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save webhook')
    }
  }

  async function toggleMonitoring(domain: Domain) {
    try {
      await api.setDomainMonitoring(domain.id, !domain.monitoring_enabled, domain.monitoring_interval)
      setDomains(prev => prev.map(d => d.id === domain.id ? { ...d, monitoring_enabled: !d.monitoring_enabled } : d))
      toast.success(`Monitoring ${domain.monitoring_enabled ? 'disabled' : 'enabled'}`)
    } catch {
      toast.error('Failed to update monitoring')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  const isPro = user?.plan === 'pro' || user?.plan === 'agency'

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <nav className="border-b border-[#111] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white">SecurityScan</span>
        </Link>
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">← Dashboard</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

        <div className="space-y-6">
          {/* Account Info */}
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" /> Account
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Name</span>
                <span className="text-sm text-white">{user?.full_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Email</span>
                <span className="text-sm text-white">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Plan</span>
                <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded-full capitalize">{user?.plan}</span>
              </div>
            </div>
            {!isPro && (
              <button
                onClick={() => api.createCheckout('pro').then((r: {url: string}) => window.location.href = r.url)}
                className="mt-4 w-full text-sm bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 py-2 rounded-xl transition-colors"
              >
                Upgrade to Pro →
              </button>
            )}
          </div>

          {/* API Key */}
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" /> API Key
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {user?.plan === 'agency' ? 'Use as Bearer token for API access.' : 'API key access requires Agency plan.'}
            </p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  readOnly
                  value={user?.api_key || ''}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-gray-300 font-mono pr-10"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={copyApiKey}
                className="px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-xl text-gray-400 hover:text-white transition-colors"
                title="Copy"
              >
                {copiedKey ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={regenerateKey}
                disabled={regenerating}
                className="px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-xl text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                title="Regenerate"
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Email Notifications */}
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-400" /> Notifications
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Monitoring email alerts</p>
                <p className="text-xs text-gray-500 mt-0.5">Receive emails when scheduled scans complete</p>
              </div>
              <button
                onClick={toggleEmailAlerts}
                disabled={savingNotifs}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                  user?.email_alerts ? 'bg-indigo-600' : 'bg-[#333]'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  user?.email_alerts ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Domain Monitoring */}
          {domains.length > 0 && (
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400" /> Domain Monitoring
              </h2>
              <div className="space-y-4">
                {domains.map((domain) => (
                  <div key={domain.id} className="p-4 bg-[#0a0a0a] rounded-xl border border-[#222]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-white font-mono">{domain.domain}</span>
                      <div className="flex items-center gap-3">
                        {domain.monitoring_enabled && (
                          <select
                            value={domain.monitoring_interval}
                            onChange={async (e) => {
                              await api.setDomainMonitoring(domain.id, true, e.target.value)
                              setDomains(prev => prev.map(d => d.id === domain.id ? { ...d, monitoring_interval: e.target.value } : d))
                            }}
                            className="text-xs bg-[#111] border border-[#333] text-gray-300 rounded-lg px-2 py-1"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                          </select>
                        )}
                        <button
                          onClick={() => toggleMonitoring(domain)}
                          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                            domain.monitoring_enabled ? 'bg-indigo-600' : 'bg-[#333]'
                          }`}
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            domain.monitoring_enabled ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>
                    </div>
                    {isPro && (
                      <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-2">
                          <Webhook className="w-3 h-3 text-gray-600 shrink-0" />
                          <input
                            type="url"
                            value={webhookInputs[domain.id] || ''}
                            onChange={(e) => setWebhookInputs(prev => ({ ...prev, [domain.id]: e.target.value }))}
                            placeholder="https://hooks.slack.com/..."
                            className="flex-1 text-xs bg-[#111] border border-[#333] rounded-lg px-3 py-1.5 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <button
                          onClick={() => saveWebhook(domain.id)}
                          className="text-xs bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div className="bg-[#111] border border-red-400/10 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-red-400 mb-3">Danger Zone</h2>
            <p className="text-xs text-gray-500 mb-3">Permanently delete your account and all associated data.</p>
            <button className="text-xs text-red-400 border border-red-400/20 hover:bg-red-400/10 px-4 py-2 rounded-lg transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
