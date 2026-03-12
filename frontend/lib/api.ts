const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const api = {
  // Auth
  register: (body: object) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: object) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  me: () => apiFetch('/auth/me'),
  forgotPassword: (email: string) => apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) => apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  verifyEmail: (token: string) => apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`),

  // Scans
  createScan: (domain: string, consent: boolean) =>
    apiFetch('/scan', { method: 'POST', body: JSON.stringify({ domain, consent: String(consent) }) }),
  getScan: (id: string) => apiFetch(`/scan/${id}`),
  getUserScans: () => apiFetch('/scan'),
  rescan: (id: string) => apiFetch(`/scan/${id}/rescan`, { method: 'POST' }),

  // User
  getProfile: () => apiFetch('/user/profile'),
  getDomains: () => apiFetch('/user/domains'),
  regenerateApiKey: () => apiFetch('/user/regenerate-api-key', { method: 'POST' }),

  // Subscriptions
  createCheckout: (plan: string) => apiFetch('/subscription/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  openPortal: () => apiFetch('/subscription/portal', { method: 'POST' }),

  // Admin
  getAdminStats: () => apiFetch('/admin/stats'),
  getAdminUsers: () => apiFetch('/admin/users'),
  getAdminScans: () => apiFetch('/admin/scans'),

  // History & badges
  getDomainHistory: (domain: string) => apiFetch(`/scan/history/${domain}`),
  getBadgeUrl: (domain: string) => `${API_URL}/api/badge/${domain}`,
  getPdfUrl: (scanId: string) => `${API_URL}/api/pdf/${scanId}`,

  // Webhooks & monitoring
  setDomainWebhook: (domainId: string, webhookUrl: string | null) =>
    apiFetch(`/user/domains/${domainId}/webhook`, { method: 'POST', body: JSON.stringify({ webhook_url: webhookUrl }) }),
  setDomainMonitoring: (domainId: string, enabled: boolean, interval: string) =>
    apiFetch(`/user/domains/${domainId}/monitor`, { method: 'POST', body: JSON.stringify({ enabled, interval }) }),
  updateNotifications: (email_alerts: boolean) =>
    apiFetch('/user/notifications', { method: 'PATCH', body: JSON.stringify({ email_alerts }) }),

  // AI
  getAiFix: (finding: { title: string; description: string; severity: string; category?: string }) =>
    apiFetch('/ai/fix', { method: 'POST', body: JSON.stringify(finding) }),
  getAiSummary: (scanId: string) =>
    apiFetch('/ai/summary', { method: 'POST', body: JSON.stringify({ scanId }) }),

  // Leaderboard
  getLeaderboard: () => apiFetch('/leaderboard'),

  // Admin
  adminUpdateUserPlan: (userId: string, plan: string) =>
    apiFetch(`/admin/users/${userId}/plan`, { method: 'PATCH', body: JSON.stringify({ plan }) }),
}
