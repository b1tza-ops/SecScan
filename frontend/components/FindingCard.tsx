'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, AlertTriangle, Info, AlertCircle, ShieldAlert, Sparkles, Loader2 } from 'lucide-react'
import { severityColor } from '@/lib/utils'
import { api } from '@/lib/api'

interface Finding {
  title: string
  description: string
  severity: string
  fix_recommendation: string
  fix_example?: string
  owasp_category?: string
  cve?: string
  category?: string
}

interface AiAdvice {
  summary: string
  steps: string[]
  code_example: string | null
  references: string[]
  estimated_effort: string
}

const SeverityIcon = ({ severity }: { severity: string }) => {
  if (severity === 'critical') return <ShieldAlert className="w-4 h-4 text-red-400" />
  if (severity === 'high') return <AlertCircle className="w-4 h-4 text-orange-400" />
  if (severity === 'medium') return <AlertTriangle className="w-4 h-4 text-yellow-400" />
  return <Info className="w-4 h-4 text-blue-400" />
}

const effortColor = (effort: string) => {
  if (effort === 'low') return 'text-green-400'
  if (effort === 'medium') return 'text-yellow-400'
  return 'text-red-400'
}

export function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false)
  const [aiAdvice, setAiAdvice] = useState<AiAdvice | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  async function loadAiFix(e: React.MouseEvent) {
    e.stopPropagation()
    if (aiAdvice) { setOpen(true); return }
    setAiLoading(true)
    setAiError(null)
    setOpen(true)
    try {
      const res = await api.getAiFix({
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        category: finding.owasp_category || finding.category,
      })
      setAiAdvice(res.advice)
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'AI service unavailable')
    } finally {
      setAiLoading(false)
    }
  }

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
        {finding.owasp_category && (
          <span className="hidden lg:inline text-xs text-gray-600 truncate max-w-[220px]">{finding.owasp_category}</span>
        )}
        <button
          onClick={loadAiFix}
          title="Get AI fix advice"
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-2 py-1 rounded-lg transition-colors shrink-0"
        >
          <Sparkles className="w-3 h-3" />
          AI Fix
        </button>
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
              {(finding.owasp_category || finding.cve) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {finding.owasp_category && (
                    <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded-full">
                      {finding.owasp_category}
                    </span>
                  )}
                  {finding.cve && /^CVE-\d{4}-\d+$/.test(finding.cve) && (
                    <a
                      href={`https://nvd.nist.gov/vuln/detail/${finding.cve}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-full hover:bg-red-500/20 transition-colors"
                    >
                      {finding.cve} ↗
                    </a>
                  )}
                </div>
              )}

              {/* AI Fix Panel */}
              {(aiLoading || aiAdvice || aiError) && (
                <div className="mt-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-indigo-400">AI Fix Advisor</span>
                  </div>
                  {aiLoading && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing vulnerability...
                    </div>
                  )}
                  {aiError && <p className="text-sm text-red-400">{aiError}</p>}
                  {aiAdvice && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-300">{aiAdvice.summary}</p>
                      {aiAdvice.steps?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 mb-2">Steps to fix</p>
                          <ol className="space-y-1">
                            {aiAdvice.steps.map((step, i) => (
                              <li key={i} className="text-sm text-gray-400 flex gap-2">
                                <span className="text-indigo-400 font-semibold shrink-0">{i + 1}.</span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {aiAdvice.code_example && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 mb-1">Code example</p>
                          <pre className="text-xs bg-[#0a0a0a] rounded-lg p-3 text-green-400 overflow-x-auto border border-[#222]">
                            {aiAdvice.code_example}
                          </pre>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {aiAdvice.estimated_effort && (
                          <span className="text-xs text-gray-500">
                            Effort: <span className={effortColor(aiAdvice.estimated_effort)}>{aiAdvice.estimated_effort}</span>
                          </span>
                        )}
                        {aiAdvice.references?.map((ref, i) => (
                          <a
                            key={i}
                            href={ref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:underline truncate max-w-[200px]"
                          >
                            {new URL(ref).hostname} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
