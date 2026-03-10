'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, AlertTriangle, Info, AlertCircle, ShieldAlert } from 'lucide-react'
import { severityColor } from '@/lib/utils'

interface Finding {
  title: string
  description: string
  severity: string
  fix_recommendation: string
  fix_example?: string
}

const SeverityIcon = ({ severity }: { severity: string }) => {
  if (severity === 'critical') return <ShieldAlert className="w-4 h-4 text-red-400" />
  if (severity === 'high') return <AlertCircle className="w-4 h-4 text-orange-400" />
  if (severity === 'medium') return <AlertTriangle className="w-4 h-4 text-yellow-400" />
  return <Info className="w-4 h-4 text-blue-400" />
}

export function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-[#222] rounded-xl overflow-hidden bg-[#111]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#1a1a1a] transition-colors"
      >
        <SeverityIcon severity={finding.severity} />
        <span className="flex-1 text-sm font-medium text-white">{finding.title}</span>
        <span className={`text-xs px-2 py-1 rounded-full border capitalize ${severityColor(finding.severity)}`}>
          {finding.severity}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 border-t border-[#222] pt-4 space-y-3">
              <p className="text-sm text-gray-400">{finding.description}</p>
              {finding.fix_recommendation && (
                <div>
                  <p className="text-xs font-semibold text-gray-300 mb-1">Fix</p>
                  <p className="text-sm text-gray-400">{finding.fix_recommendation}</p>
                </div>
              )}
              {finding.fix_example && (
                <div>
                  <p className="text-xs font-semibold text-gray-300 mb-1">Example</p>
                  <pre className="text-xs bg-[#0a0a0a] rounded-lg p-3 text-green-400 overflow-x-auto border border-[#222]">
                    {finding.fix_example}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
