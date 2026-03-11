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

  // Scans
  createScan: (domain: string, consent: boolean) =>
    apiFetch('/scan', { method: 'POST', body: JSON.stringify({ domain, consent: String(consent) }) }),
  getScan: (id: string) => apiFetch(`/scan/${id}`),
  getUserScans: () => apiFetch('/scan'),

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

  // Webhooks
  setDomainWebhook: (domainId: string, webhookUrl: string | null) =>
    apiFetch(`/user/domains/${domainId}/webhook`, { method: 'POST', body: JSON.stringify({ webhook_url: webhookUrl }) }),
}
