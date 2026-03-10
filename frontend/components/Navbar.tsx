'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'

export function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-[#222] bg-[#0a0a0a]/80 backdrop-blur-xl"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-400" />
          <span className="font-semibold text-white">SecurityScan</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</Link>
          <Link href="/auth/login" className="text-sm text-gray-400 hover:text-white transition-colors">Login</Link>
          <Link href="/auth/register" className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors">
            Get Started
          </Link>
        </div>
      </div>
    </motion.nav>
  )
}
