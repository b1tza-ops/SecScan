'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  if (!password) return { level: 0, label: '', color: '' }
  if (password.length < 8) return { level: 1, label: 'Too short', color: 'bg-red-500' }
  const checks = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z0-9]/.test(password),
    password.length >= 12,
  ]
  const score = checks.filter(Boolean).length
  if (score <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' }
  if (score === 3) return { level: 2, label: 'Fair', color: 'bg-yellow-500' }
  if (score === 4) return { level: 3, label: 'Good', color: 'bg-blue-500' }
  return { level: 4, label: 'Strong', color: 'bg-green-500' }
}

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '' })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function update(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.register(form)
      toast.success('Account created! Check your email to verify.')
      router.push('/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const strength = getPasswordStrength(form.password)

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Shield className="w-6 h-6 text-indigo-400" />
            <span className="font-semibold text-white text-lg">SecurityScan</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-gray-400 mt-2 text-sm">Free plan · No credit card required</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#111] border border-[#222] rounded-2xl p-8 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={update('full_name')}
              required
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={update('email')}
              required
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              required
              minLength={8}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="8+ characters"
            />
            {form.password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                        i <= strength.level ? strength.color : 'bg-[#333]'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs ${
                  strength.level === 1 ? 'text-red-400' :
                  strength.level === 2 ? 'text-yellow-400' :
                  strength.level === 3 ? 'text-blue-400' : 'text-green-400'
                }`}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-indigo-400 hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
