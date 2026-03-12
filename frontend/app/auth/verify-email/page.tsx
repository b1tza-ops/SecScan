'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Missing verification token.')
      setStatus('error')
      return
    }
    api.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Verification failed')
        setStatus('error')
      })
  }, [token])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Shield className="w-6 h-6 text-indigo-400" />
          <span className="text-white font-semibold text-lg">SecurityScan</span>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-2xl p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
              <p className="text-white font-semibold">Verifying your email...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Email verified!</h2>
              <p className="text-gray-400 text-sm mb-6">Your account is fully activated. You can now log in.</p>
              <Link href="/auth/login" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors inline-block">
                Go to login
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Verification failed</h2>
              <p className="text-red-400 text-sm mb-6">{error}</p>
              <Link href="/auth/login" className="text-indigo-400 text-sm hover:underline">← Back to login</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
