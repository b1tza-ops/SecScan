import Link from 'next/link'
import { Shield } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <nav className="border-b border-[#111] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white">SecurityScan</span>
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-10">Last updated: March 2025</p>

        <div className="prose prose-invert max-w-none space-y-8 text-gray-400 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. What We Collect</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-gray-300">Account data:</strong> Email, hashed password, name (required for registration)</li>
              <li><strong className="text-gray-300">Scan data:</strong> Domain names you submit, scan results, security scores</li>
              <li><strong className="text-gray-300">Usage data:</strong> IP address (for rate limiting), timestamps of requests</li>
              <li><strong className="text-gray-300">Payment data:</strong> Handled entirely by Stripe — we never see your card number</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and improve the scanning service</li>
              <li>To send transactional emails (verification, password reset, monitoring alerts)</li>
              <li>To enforce plan limits and rate limiting</li>
              <li>To display aggregate statistics on the public leaderboard (domain + score only, no user information)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Data Sharing</h2>
            <p>We do not sell your personal data. We share data only with:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong className="text-gray-300">Stripe:</strong> Payment processing</li>
              <li><strong className="text-gray-300">OpenAI:</strong> Anonymized finding data for AI fix recommendations (no personal data sent)</li>
              <li><strong className="text-gray-300">SMTP provider:</strong> Email delivery</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Retention</h2>
            <p>Scan results are retained for 12 months. Account data is retained until you delete your account. Anonymous scan tracking data (IP + count) is deleted after 7 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Your Rights (GDPR)</h2>
            <p>If you are in the EU/EEA, you have the right to access, correct, export, or delete your personal data. Contact us at <span className="text-indigo-400">privacy@securityscan.io</span> to exercise these rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Cookies</h2>
            <p>We use one httpOnly cookie to store your authentication token. No tracking or advertising cookies are used.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Security</h2>
            <p>Passwords are hashed with bcrypt (12 rounds). JWT tokens are stored in httpOnly cookies. All connections use TLS in production.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Contact</h2>
            <p>Privacy questions: <span className="text-indigo-400">privacy@securityscan.io</span></p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#222] flex gap-4 text-sm">
          <Link href="/terms" className="text-indigo-400 hover:underline">Terms of Service</Link>
          <Link href="/" className="text-gray-500 hover:text-gray-300">← Home</Link>
        </div>
      </div>
    </div>
  )
}
