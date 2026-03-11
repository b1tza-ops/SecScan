interface OWASPSummaryProps {
  owaspSummary: Record<string, number>
}

const OWASP_STYLES: Record<string, string> = {
  'A01:2021 Broken Access Control': 'text-red-400 bg-red-400/10 border-red-400/20',
  'A02:2021 Cryptographic Failures': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  'A03:2021 Injection': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  'A04:2021 Insecure Design': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  'A05:2021 Security Misconfiguration': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  'A06:2021 Vulnerable and Outdated Components': 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  'A07:2021 Identification and Authentication Failures': 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
}

export function OWASPSummary({ owaspSummary }: OWASPSummaryProps) {
  const entries = Object.entries(owaspSummary).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-1">OWASP Top 10 Mapping</h2>
      <p className="text-sm text-gray-500 mb-4">Findings mapped to OWASP Top 10 2021 categories</p>
      <div className="flex flex-wrap gap-2">
        {entries.map(([category, count]) => {
          const colorClass = OWASP_STYLES[category] || 'text-gray-400 bg-gray-400/10 border-gray-400/20'
          return (
            <div
              key={category}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${colorClass}`}
            >
              <span>{category}</span>
              <span className="font-bold bg-white/10 px-1.5 py-0.5 rounded-full">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
