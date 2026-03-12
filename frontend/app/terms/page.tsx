import Link from 'next/link'
import { Shield } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <nav className="border-b border-[#111] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white">SecurityScan</span>
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-10">Last updated: March 2025</p>

        <div className="prose prose-invert max-w-none space-y-8 text-gray-400 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By using SecurityScan ("Service"), you agree to these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Permitted Use & Authorization Requirement</h2>
            <p>You may only scan domains that you own or have explicit written permission to scan. You must check the consent box before each scan confirming this authorization. Scanning domains without permission is a violation of these terms and may be illegal under the Computer Fraud and Abuse Act (CFAA) and equivalent laws in other jurisdictions.</p>
            <p className="mt-2">SecurityScan performs only passive, non-intrusive checks. No exploitation, brute force, or active attacks are performed.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Prohibited Activities</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Scanning domains you don't own or lack permission to scan</li>
              <li>Attempting to circumvent rate limits or scan quotas</li>
              <li>Using the Service to target critical infrastructure</li>
              <li>Reverse engineering or attempting to extract scanner logic</li>
              <li>Reselling or redistributing scan results without attribution</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Subscriptions & Billing</h2>
            <p>Paid plans (Pro, Agency) are billed monthly. You may cancel at any time via the billing portal. No refunds are provided for partial months. Plan limits are enforced server-side.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Disclaimer of Warranties</h2>
            <p>The Service is provided "as is" without warranties of any kind. Scan results are informational only and do not constitute a security guarantee. False positives and false negatives may occur.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, SecurityScan shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms, without prior notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Contact</h2>
            <p>For questions about these terms, contact us at <span className="text-indigo-400">legal@securityscan.io</span>.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#222] flex gap-4 text-sm">
          <Link href="/privacy" className="text-indigo-400 hover:underline">Privacy Policy</Link>
          <Link href="/" className="text-gray-500 hover:text-gray-300">← Home</Link>
        </div>
      </div>
    </div>
  )
}
