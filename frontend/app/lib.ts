/* ── Shared API types ──────────────────────────────────────── */

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001/api';

export interface JwtPayload {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    agencyId: string;
    roles: string[];
  };
}

export interface PipelineStage {
  id: string;
  name: string;
  slug: string;
  order: number;
  probability: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  stages: PipelineStage[];
  _count?: { deals: number };
}

export interface DealClient {
  id: string;
  name: string;
  company?: string;
}

export interface DealOwner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Deal {
  id: string;
  title: string;
  description?: string;
  serviceCategory: string;
  expectedValue: string | number;
  currency: string;
  state: 'ACTIVE' | 'WON' | 'LOST' | 'ARCHIVED';
  expectedCloseDate: string;
  notes?: string;
  tags: string[];
  source?: string;
  wonAt?: string;
  lostAt?: string;
  lostReason?: string;
  lostNote?: string;
  handedOffAt?: string;
  createdAt: string;
  client: DealClient;
  owner: DealOwner;
  pipeline: { id: string; name: string };
  stage: PipelineStage;
  stageHistory?: StageHistory[];
  followUps?: FollowUp[];
  intelligence?: { calculatedProbability: number; isStalled: boolean; stalledReason?: string };
}

export interface StageHistory {
  id: string;
  fromStageId?: string;
  toStageId: string;
  note?: string;
  createdAt: string;
  fromStage?: { id: string; name: string };
  toStage: { id: string; name: string };
  movedBy: { id: string; firstName: string; lastName: string };
}

export interface FollowUp {
  id: string;
  dealId: string;
  scheduledAt: string;
  completedAt?: string;
  rescheduledAt?: string;
  note: string;
  status: 'UPCOMING' | 'OVERDUE' | 'COMPLETED' | 'RESCHEDULED';
  createdAt: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  deal?: { id: string; title: string; client: DealClient };
}

export interface DealListResponse {
  deals: Deal[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function formatCurrency(value: string | number, currency = 'USD'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ── API helpers ──────────────────────────────────────────── */

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.message || body?.data?.message || `HTTP ${res.status}`;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
  }
  const json = await res.json();
  // Unwrap our ResponseInterceptor envelope
  return (json?.data !== undefined ? json.data : json) as T;
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<JwtPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { firstName: string; lastName: string; email: string; password: string }) =>
    apiFetch<JwtPayload>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPipelines: () => apiFetch<Pipeline[]>('/pipelines'),
  getPipeline: (id: string) => apiFetch<Pipeline>(`/pipelines/${id}`),
  createPipeline: (data: { name: string; description?: string }) =>
    apiFetch<Pipeline>('/pipelines', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePipelineStages: (pipelineId: string, stages: unknown[]) =>
    apiFetch<Pipeline>(`/pipelines/${pipelineId}/stages`, {
      method: 'PATCH',
      body: JSON.stringify({ stages }),
    }),

  getDeals: (params: Record<string, string | number>) => {
    const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return apiFetch<DealListResponse>(`/deals?${q}`);
  },

  getDeal: (id: string) => apiFetch<Deal>(`/deals/${id}`),

  createDeal: (data: Record<string, unknown>) =>
    apiFetch<Deal>('/deals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDeal: (id: string, data: Record<string, unknown>) =>
    apiFetch<Deal>(`/deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  moveDealStage: (id: string, stageId: string, note?: string) =>
    apiFetch<Deal>(`/deals/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stageId, note }),
    }),

  markWon: (id: string) =>
    apiFetch<Deal>(`/deals/${id}/won`, { method: 'PATCH' }),

  markLost: (id: string, lostReason: string, lostNote?: string) =>
    apiFetch<Deal>(`/deals/${id}/lost`, {
      method: 'PATCH',
      body: JSON.stringify({ lostReason, lostNote }),
    }),

  archiveDeal: (id: string) =>
    apiFetch<Deal>(`/deals/${id}`, { method: 'DELETE' }),

  getFollowUps: (status?: string) => {
    const q = status ? `?status=${status}` : '';
    return apiFetch<FollowUp[]>(`/follow-ups${q}`);
  },

  getDealFollowUps: (dealId: string) =>
    apiFetch<FollowUp[]>(`/deals/${dealId}/follow-ups`),

  createFollowUp: (dealId: string, scheduledAt: string, note: string) =>
    apiFetch<FollowUp>(`/deals/${dealId}/follow-ups`, {
      method: 'POST',
      body: JSON.stringify({ scheduledAt, note }),
    }),

  updateFollowUp: (id: string, data: Record<string, string>) =>
    apiFetch<FollowUp>(`/follow-ups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getStalledDeals: () =>
    apiFetch<Deal[]>('/sales/stalled'),

  detectStalledDeals: (thresholdDays = 7) =>
    apiFetch<{ count: number }>('/sales/stalled/detect', {
      method: 'POST',
      body: JSON.stringify({ thresholdDays }),
    }),

  initiateHandoff: (dealId: string) =>
    apiFetch<Record<string, unknown>>(`/deals/${dealId}/project-handoff`, { method: 'POST' }),

  getDashboard: () => apiFetch<Record<string, unknown>>('/sales/dashboard'),

  getUsers: () =>
    apiFetch<
      Array<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        isActive: boolean;
        createdAt: string;
        roles: string[];
      }>
    >('/auth/users'),
};
