import { Navbar } from '@/components/Navbar'
import { ScanForm } from '@/components/ScanForm'
import { Shield, Zap, FileText, Bell, Lock, Globe } from 'lucide-react'

const features = [
  { icon: Lock, title: 'SSL/TLS Analysis', description: 'Certificate validity, expiry, and cipher strength checks.' },
  { icon: Shield, title: 'Security Headers', description: 'CSP, HSTS, X-Frame-Options, and more.' },
  { icon: Globe, title: 'DNS Security', description: 'SPF, DKIM, DMARC and DNSSEC validation.' },
  { icon: Zap, title: 'JS Library Audit', description: 'Detect vulnerable JavaScript libraries with CVE references.' },
  { icon: FileText, title: 'PDF Reports', description: 'Export professional audit reports for clients.' },
  { icon: Bell, title: 'Monitoring', description: 'Daily or weekly scans with vulnerability alerts.' },
]

const pricing = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    features: ['3 scans per month', 'Security score', 'Issue breakdown', 'Basic recommendations'],
    cta: 'Start Free',
    href: '/auth/register',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$9',
    period: '/month',
    features: ['Unlimited scans', 'PDF reports', 'Monitoring & alerts', 'Priority support'],
    cta: 'Start Pro',
    href: '/auth/register?plan=pro',
    highlighted: true,
  },
  {
    name: 'Agency',
    price: '$29',
    period: '/month',
    features: ['Everything in Pro', 'Multi-domain scanning', 'White-label reports', 'API access'],
    cta: 'Start Agency',
    href: '/auth/register?plan=agency',
    highlighted: false,
  },
]

const testimonials = [
  { name: 'Alex M.', role: 'CTO, SaaSCo', text: 'Found 4 critical headers missing on our production app in under 30 seconds. Invaluable.' },
  { name: 'Sara K.', role: 'Freelance Developer', text: "I send SecurityScan reports to every client. It's become part of my standard handoff." },
  { name: 'Raj P.', role: 'Security Engineer', text: 'The DNS checks alone saved us from an email spoofing attack. DMARC was set to p=none.' },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-8">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-indigo-400">Non-intrusive security auditing</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Instant Website<br />
            <span className="gradient-text">Security Audit</span>
          </h1>

          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Scan your website and discover vulnerabilities, misconfigurations and security risks in seconds.
          </p>

          <div className="flex justify-center">
            <ScanForm />
          </div>

          <p className="mt-6 text-sm text-gray-600">No account required · Free scan · Results in &lt;60 seconds</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-[#111]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">Everything you need to secure your site</h2>
          <p className="text-gray-400 text-center mb-12">14 security checks. One report. Zero false positives.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 bg-[#111] border border-[#222] rounded-xl hover:border-indigo-500/30 transition-colors">
                <f.icon className="w-8 h-8 text-indigo-400 mb-4" />
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 border-t border-[#111]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">Simple pricing</h2>
          <p className="text-gray-400 text-center mb-12">Start free. Upgrade when you need more.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`p-8 rounded-2xl border ${plan.highlighted ? 'bg-indigo-600/10 border-indigo-500/40 glow' : 'bg-[#111] border-[#222]'}`}
              >
                <p className="text-sm text-gray-400 mb-2">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-400">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.href}
                  className={`block text-center py-3 rounded-xl font-semibold transition-colors ${
                    plan.highlighted ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-[#1a1a1a] hover:bg-[#222] text-white border border-[#333]'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 border-t border-[#111]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Trusted by developers & security teams</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="p-6 bg-[#111] border border-[#222] rounded-xl">
                <p className="text-gray-300 text-sm mb-4">"{t.text}"</p>
                <div>
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-gray-500 text-xs">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-[#111]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Scan your website now</h2>
          <p className="text-gray-400 mb-8">Free, instant, no account required.</p>
          <div className="flex justify-center">
            <ScanForm />
          </div>
        </div>
      </section>

      <footer className="py-10 px-6 border-t border-[#111] text-center text-gray-600 text-sm">
        <p>© 2025 SecurityScan. Non-intrusive security auditing only.</p>
        <p className="mt-2">
          <a href="/terms" className="hover:text-gray-400 mr-4">Terms</a>
          <a href="/privacy" className="hover:text-gray-400">Privacy</a>
        </p>
      </footer>
    </main>
  )
}
