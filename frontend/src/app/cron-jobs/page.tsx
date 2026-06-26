'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  cronJobsApi, serviceApiKeysApi,
  CronJobEntry, CronJobDetail, CronJobLog, ServiceApiKeyEntry,
} from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  Plus, Trash2, Play, Pause, RotateCw, Clock, CheckCircle, XCircle, AlertTriangle,
  Eye, X, Key, Copy, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const TIMEZONES = [
  'UTC', 'Asia/Kolkata', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo',
  'Australia/Sydney',
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: '#e6f9e6', text: '#008a05' },
  paused: { bg: '#fff3cd', text: '#856404' },
  completed: { bg: '#e2e3e5', text: '#383d41' },
  failed: { bg: '#f8d7da', text: '#c13515' },
};

interface HeaderPair { key: string; value: string }

interface FormState {
  name: string;
  description: string;
  baseUrl: string;
  endpoint: string;
  method: string;
  headers: HeaderPair[];
  body: string;
  cronExpression: string;
  timezone: string;
  maxRetries: string;
  sourceReferenceId: string;
}

const EMPTY_FORM: FormState = {
  name: '', description: '', baseUrl: '', endpoint: '', method: 'POST',
  headers: [{ key: '', value: '' }], body: '', cronExpression: '',
  timezone: 'UTC', maxRetries: '3', sourceReferenceId: '',
};

function humanCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let time = '';
  if (hour !== '*' && min !== '*') {
    const h = parseInt(hour);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    time = `${h12}:${min.padStart(2, '0')} ${period}`;
  } else {
    time = `${min} ${hour}`;
  }

  if (dom === '*' && mon === '*' && dow === '*') return `Daily at ${time}`;
  if (dom === '*' && mon === '*' && dow !== '*') {
    const days = dow.split(',').map(d => dayNames[parseInt(d)] || d).join(', ');
    return `${days} at ${time}`;
  }
  if (dom !== '*' && mon === '*') return `${dom} of every month at ${time}`;
  if (mon !== '*' && dom !== '*') return `${monthNames[parseInt(mon)] || mon} ${dom} at ${time}`;
  return cron;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return 'overdue';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  return `in ${Math.floor(hrs / 24)}d`;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = {
  page: { padding: 'var(--sp-lg) var(--sp-xl)', maxWidth: 1100, margin: '0 auto' } as const,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)' } as const,
  title: { fontSize: 22, fontWeight: 700, color: 'var(--color-ink)' } as const,
  subtitle: { fontSize: 13, color: 'var(--color-muted)', marginTop: 2 } as const,
  btn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 } as const,
  btnPrimary: { background: 'var(--color-primary)', color: '#fff' } as const,
  btnGhost: { background: 'transparent', color: 'var(--color-ink)', border: '1px solid var(--color-hairline)' } as const,
  btnDanger: { background: 'var(--color-error)', color: '#fff' } as const,
  btnSm: { padding: '4px 10px', fontSize: 12 } as const,
  card: { background: 'var(--color-surface-card)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-card)', padding: 'var(--sp-lg)', marginBottom: 'var(--sp-base)' } as const,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--sp-base)' } as const,
  badge: { display: 'inline-block', padding: '2px 10px', borderRadius: 'var(--r-full)', fontSize: 11, fontWeight: 600 } as const,
  label: { fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 4, display: 'block' } as const,
  input: { width: '100%', padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--color-hairline)', fontSize: 14, color: 'var(--color-ink)', background: 'var(--color-canvas)' } as const,
  select: { width: '100%', padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--color-hairline)', fontSize: 14, color: 'var(--color-ink)', background: 'var(--color-canvas)' } as const,
  textarea: { width: '100%', padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--color-hairline)', fontSize: 13, fontFamily: 'monospace', color: 'var(--color-ink)', background: 'var(--color-canvas)', minHeight: 80 } as const,
  modal: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: 'var(--color-canvas)', borderRadius: 'var(--r-md)', padding: 'var(--sp-lg)', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: 'var(--shadow-card)' },
  row: { display: 'flex', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' } as const,
  flex1: { flex: 1 } as const,
  mt: { marginTop: 'var(--sp-md)' } as const,
  section: { marginTop: 'var(--sp-xl)', marginBottom: 'var(--sp-base)' } as const,
  divider: { borderTop: '1px solid var(--color-hairline)', margin: 'var(--sp-xl) 0' } as const,
  logRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-hairline-soft)', fontSize: 13 } as const,
  mono: { fontFamily: 'monospace', fontSize: 12, color: 'var(--color-muted)' } as const,
};

export default function CronJobsPage() {
  const { toast } = useToast();

  const [jobs, setJobs] = useState<CronJobEntry[]>([]);
  const [apiKeys, setApiKeys] = useState<ServiceApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [detailJob, setDetailJob] = useState<CronJobDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const [showKeys, setShowKeys] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeySecret, setNewKeySecret] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const [j, k] = await Promise.all([cronJobsApi.getAll(), serviceApiKeysApi.getAll()]);
      setJobs(j);
      setApiKeys(k);
    } catch (err: any) {
      toast(err.message || 'Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // ── Job CRUD ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (job: CronJobEntry) => {
    setEditingId(job._id);
    setForm({
      name: job.name,
      description: job.description || '',
      baseUrl: job.baseUrl,
      endpoint: job.endpoint,
      method: job.method,
      headers: [{ key: '', value: '' }],
      body: job.body ? JSON.stringify(job.body, null, 2) : '',
      cronExpression: job.cronExpression,
      timezone: job.timezone,
      maxRetries: String(job.maxRetries),
      sourceReferenceId: job.sourceReferenceId || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.baseUrl || !form.endpoint || !form.cronExpression) {
      toast('Fill all required fields', 'error');
      return;
    }
    setSaving(true);
    try {
      const headers: Record<string, string> = {};
      form.headers.forEach(h => { if (h.key.trim()) headers[h.key.trim()] = h.value; });

      let body: Record<string, any> | undefined;
      if (form.body.trim()) {
        try { body = JSON.parse(form.body); } catch {
          toast('Invalid JSON in body', 'error');
          setSaving(false);
          return;
        }
      }

      const payload = {
        name: form.name,
        description: form.description || undefined,
        baseUrl: form.baseUrl,
        endpoint: form.endpoint,
        method: form.method,
        headers: Object.keys(headers).length ? headers : undefined,
        body,
        cronExpression: form.cronExpression,
        timezone: form.timezone,
        maxRetries: parseInt(form.maxRetries) || 3,
        sourceReferenceId: form.sourceReferenceId || undefined,
      };

      if (editingId) {
        await cronJobsApi.update(editingId, payload);
        toast('Job updated', 'success');
      } else {
        await cronJobsApi.create(payload);
        toast('Job created', 'success');
      }
      setShowModal(false);
      fetchJobs();
    } catch (err: any) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this cron job?')) return;
    setActionId(id);
    try {
      await cronJobsApi.delete(id);
      toast('Job deleted', 'success');
      fetchJobs();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleToggle = async (job: CronJobEntry) => {
    setActionId(job._id);
    try {
      if (job.status === 'active') {
        await cronJobsApi.pause(job._id);
        toast('Job paused', 'success');
      } else {
        await cronJobsApi.resume(job._id);
        toast('Job resumed', 'success');
      }
      fetchJobs();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleTrigger = async (id: string) => {
    setActionId(id);
    try {
      const result = await cronJobsApi.trigger(id);
      toast(result.success ? `Triggered OK (${result.duration}ms)` : `Trigger failed: ${result.statusCode}`, result.success ? 'success' : 'error');
      fetchJobs();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setActionId(null);
    }
  };

  const openDetail = async (id: string) => {
    try {
      const detail = await cronJobsApi.getOne(id);
      setDetailJob(detail);
      setShowDetail(true);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  // ── API Keys ────────────────────────────────────────────────────────────

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) { toast('Service name required', 'error'); return; }
    setKeyLoading(true);
    try {
      const result = await serviceApiKeysApi.create({
        serviceName: newKeyName.trim(),
        webhookSecret: newKeySecret.trim() || undefined,
      });
      setCreatedKey(result.apiKey);
      setNewKeyName('');
      setNewKeySecret('');
      fetchJobs();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setKeyLoading(false);
    }
  };

  const handleDeactivateKey = async (id: string) => {
    try {
      await serviceApiKeysApi.deactivate(id);
      toast('Key deactivated', 'success');
      fetchJobs();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleRegenerateKey = async (id: string) => {
    if (!confirm('Regenerate this key? Old key will stop working.')) return;
    try {
      const result = await serviceApiKeysApi.regenerate(id);
      setCreatedKey(result.apiKey);
      fetchJobs();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const addHeaderRow = () => setForm(f => ({ ...f, headers: [...f.headers, { key: '', value: '' }] }));
  const updateHeader = (i: number, field: 'key' | 'value', val: string) =>
    setForm(f => ({ ...f, headers: f.headers.map((h, j) => j === i ? { ...h, [field]: val } : h) }));
  const removeHeader = (i: number) =>
    setForm(f => ({ ...f, headers: f.headers.filter((_, j) => j !== i) }));

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.title}>Cron Jobs</div>
          <div style={S.subtitle}>Schedule HTTP calls to any service on a cron timer</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setShowKeys(!showKeys)}>
            <Key size={14} /> API Keys {showKeys ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button style={{ ...S.btn, ...S.btnPrimary }} onClick={openCreate}>
            <Plus size={14} /> New Job
          </button>
        </div>
      </div>

      {/* API Keys Section */}
      {showKeys && (
        <div style={{ ...S.card, marginBottom: 'var(--sp-lg)' }}>
          <div style={{ ...S.label, fontSize: 15, marginBottom: 12 }}>Service API Keys</div>

          {createdKey && (
            <div style={{ background: '#e6f9e6', borderRadius: 'var(--r-sm)', padding: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={14} color="#008a05" />
              <span style={{ fontSize: 13 }}>Copy this key — it won't be shown again:</span>
              <code style={{ ...S.mono, flex: 1, userSelect: 'all', wordBreak: 'break-all' }}>{createdKey}</code>
              <button style={{ ...S.btn, ...S.btnSm, ...S.btnGhost }} onClick={() => { navigator.clipboard.writeText(createdKey); toast('Copied', 'success'); }}>
                <Copy size={12} />
              </button>
              <button style={{ ...S.btn, ...S.btnSm, ...S.btnGhost }} onClick={() => setCreatedKey(null)}>
                <X size={12} />
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input style={{ ...S.input, flex: 1 }} placeholder="Service name (e.g. tracktok)" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
            <input style={{ ...S.input, flex: 1 }} placeholder="Webhook secret (optional)" value={newKeySecret} onChange={e => setNewKeySecret(e.target.value)} />
            <button style={{ ...S.btn, ...S.btnPrimary }} onClick={handleCreateKey} disabled={keyLoading}>
              {keyLoading ? 'Creating…' : 'Create Key'}
            </button>
          </div>

          {apiKeys.length > 0 && (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-hairline)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 0', color: 'var(--color-muted)' }}>Service</th>
                  <th style={{ padding: '6px 0', color: 'var(--color-muted)' }}>Status</th>
                  <th style={{ padding: '6px 0', color: 'var(--color-muted)' }}>Created</th>
                  <th style={{ padding: '6px 0', color: 'var(--color-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map(k => (
                  <tr key={k._id} style={{ borderBottom: '1px solid var(--color-hairline-soft)' }}>
                    <td style={{ padding: '8px 0', fontWeight: 600 }}>{k.serviceName}</td>
                    <td style={{ padding: '8px 0' }}>
                      <span style={{ ...S.badge, background: k.isActive ? '#e6f9e6' : '#f8d7da', color: k.isActive ? '#008a05' : '#c13515' }}>
                        {k.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 0', color: 'var(--color-muted)' }}>{k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '8px 0', display: 'flex', gap: 6 }}>
                      <button style={{ ...S.btn, ...S.btnSm, ...S.btnGhost }} onClick={() => handleRegenerateKey(k._id)} title="Regenerate">
                        <RefreshCw size={12} />
                      </button>
                      {k.isActive && (
                        <button style={{ ...S.btn, ...S.btnSm, ...S.btnDanger }} onClick={() => handleDeactivateKey(k._id)} title="Deactivate">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Jobs Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 40 }}>Loading…</div>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-muted)' }}>
          <Clock size={40} strokeWidth={1.5} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No cron jobs yet</div>
          <div style={{ fontSize: 13 }}>Create one to schedule HTTP calls on a timer</div>
        </div>
      ) : (
        <div style={S.grid}>
          {jobs.map(job => {
            const sc = STATUS_COLORS[job.status] || STATUS_COLORS.active;
            const isLoading = actionId === job._id;
            return (
              <div key={job._id} style={S.card}>
                {/* Card header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>{job.name}</div>
                    {job.description && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{job.description}</div>}
                  </div>
                  <span style={{ ...S.badge, background: sc.bg, color: sc.text }}>{job.status}</span>
                </div>

                {/* Details */}
                <div style={{ fontSize: 13, color: 'var(--color-body)', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    <span style={{ ...S.badge, background: 'var(--color-surface-strong)', color: 'var(--color-ink)', fontWeight: 700, fontSize: 10 }}>{job.method}</span>
                    <span style={S.mono}>{job.baseUrl}{job.endpoint}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} color="var(--color-muted)" /> {humanCron(job.cronExpression)}
                    </span>
                    {job.sourceService && (
                      <span style={{ ...S.badge, background: 'var(--color-surface-strong)', color: 'var(--color-muted)' }}>{job.sourceService}</span>
                    )}
                  </div>
                </div>

                {/* Execution info */}
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {job.lastExecutedAt && (
                    <span>Last run: {timeAgo(job.lastExecutedAt)} {job.lastResult && (job.lastResult.success ? <CheckCircle size={11} color="#008a05" style={{ marginLeft: 2, verticalAlign: -1 }} /> : <XCircle size={11} color="#c13515" style={{ marginLeft: 2, verticalAlign: -1 }} />)}</span>
                  )}
                  {job.nextFireAt && <span>Next: {timeUntil(job.nextFireAt)}</span>}
                  {job.retryCount > 0 && <span style={{ color: 'var(--color-error)' }}>Retries: {job.retryCount}/{job.maxRetries}</span>}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button style={{ ...S.btn, ...S.btnSm, ...S.btnGhost }} onClick={() => handleToggle(job)} disabled={isLoading}>
                    {job.status === 'active' ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Resume</>}
                  </button>
                  <button style={{ ...S.btn, ...S.btnSm, ...S.btnGhost }} onClick={() => handleTrigger(job._id)} disabled={isLoading}>
                    <RotateCw size={12} /> Trigger
                  </button>
                  <button style={{ ...S.btn, ...S.btnSm, ...S.btnGhost }} onClick={() => openDetail(job._id)}>
                    <Eye size={12} /> Logs
                  </button>
                  <button style={{ ...S.btn, ...S.btnSm, ...S.btnGhost }} onClick={() => openEdit(job)}>Edit</button>
                  <button style={{ ...S.btn, ...S.btnSm, ...S.btnDanger }} onClick={() => handleDelete(job._id)} disabled={isLoading}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={S.modal} onClick={() => setShowModal(false)}>
          <div style={S.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{editingId ? 'Edit' : 'Create'} Cron Job</div>
              <button style={{ ...S.btn, ...S.btnGhost, padding: 4 }} onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            {/* Name + Description */}
            <div style={S.row}>
              <div style={S.flex1}>
                <label style={S.label}>Name *</label>
                <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Weekly reminder email" />
              </div>
            </div>
            <div style={{ marginBottom: 'var(--sp-md)' }}>
              <label style={S.label}>Description</label>
              <input style={S.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
            </div>

            {/* URL + Method */}
            <div style={S.row}>
              <div style={{ flex: 2 }}>
                <label style={S.label}>Base URL *</label>
                <input style={S.input} value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder="https://tracktok.app" />
              </div>
              <div style={S.flex1}>
                <label style={S.label}>Method</label>
                <select style={S.select} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                  {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 'var(--sp-md)' }}>
              <label style={S.label}>Endpoint *</label>
              <input style={S.input} value={form.endpoint} onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))} placeholder="/api/cron/execute" />
            </div>

            {/* Headers */}
            <div style={{ marginBottom: 'var(--sp-md)' }}>
              <label style={S.label}>Headers</label>
              {form.headers.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <input style={{ ...S.input, flex: 1 }} placeholder="Key" value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)} />
                  <input style={{ ...S.input, flex: 2 }} placeholder="Value" value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)} />
                  <button style={{ ...S.btn, ...S.btnSm, ...S.btnGhost }} onClick={() => removeHeader(i)}><X size={12} /></button>
                </div>
              ))}
              <button style={{ ...S.btn, ...S.btnSm, ...S.btnGhost, marginTop: 4 }} onClick={addHeaderRow}><Plus size={12} /> Add Header</button>
            </div>

            {/* Body */}
            <div style={{ marginBottom: 'var(--sp-md)' }}>
              <label style={S.label}>Body (JSON)</label>
              <textarea style={S.textarea} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder='{"action": "send-reminder", "id": "abc123"}' />
            </div>

            {/* Cron + Timezone */}
            <div style={S.row}>
              <div style={{ flex: 2 }}>
                <label style={S.label}>Cron Expression *</label>
                <input style={S.input} value={form.cronExpression} onChange={e => setForm(f => ({ ...f, cronExpression: e.target.value }))} placeholder="0 9 * * 1" />
                {form.cronExpression && <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{humanCron(form.cronExpression)}</div>}
              </div>
              <div style={S.flex1}>
                <label style={S.label}>Timezone</label>
                <select style={S.select} value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>

            {/* Retries + Source Ref */}
            <div style={S.row}>
              <div style={S.flex1}>
                <label style={S.label}>Max Retries</label>
                <input style={S.input} type="number" value={form.maxRetries} onChange={e => setForm(f => ({ ...f, maxRetries: e.target.value }))} />
              </div>
              <div style={S.flex1}>
                <label style={S.label}>Source Reference ID</label>
                <input style={S.input} value={form.sourceReferenceId} onChange={e => setForm(f => ({ ...f, sourceReferenceId: e.target.value }))} placeholder="Optional" />
              </div>
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'var(--sp-lg)' }}>
              <button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setShowModal(false)}>Cancel</button>
              <button style={{ ...S.btn, ...S.btnPrimary }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Update Job' : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail/Logs Modal */}
      {showDetail && detailJob && (
        <div style={S.modal} onClick={() => setShowDetail(false)}>
          <div style={{ ...S.modalContent, maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-lg)' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{detailJob.name}</div>
                <div style={S.mono}>{detailJob.method} {detailJob.baseUrl}{detailJob.endpoint}</div>
              </div>
              <button style={{ ...S.btn, ...S.btnGhost, padding: 4 }} onClick={() => setShowDetail(false)}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', fontSize: 13 }}>
              <span><strong>Cron:</strong> {detailJob.cronExpression} ({humanCron(detailJob.cronExpression)})</span>
              <span><strong>TZ:</strong> {detailJob.timezone}</span>
              <span><strong>Status:</strong> {detailJob.status}</span>
              <span><strong>Source:</strong> {detailJob.sourceService}</span>
            </div>

            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Execution Logs</div>
            {detailJob.recentLogs.length === 0 ? (
              <div style={{ color: 'var(--color-muted)', fontSize: 13, padding: 16 }}>No executions yet</div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {detailJob.recentLogs.map(log => (
                  <div key={log._id} style={S.logRow}>
                    {log.status === 'success' ? <CheckCircle size={14} color="#008a05" /> : log.status === 'failed' ? <XCircle size={14} color="#c13515" /> : <AlertTriangle size={14} color="#856404" />}
                    <span style={{ fontWeight: 600, width: 55 }}>{log.statusCode || '—'}</span>
                    <span style={{ flex: 1, color: log.errorMessage ? 'var(--color-error)' : 'var(--color-body)' }}>
                      {log.errorMessage || 'OK'}
                    </span>
                    <span style={S.mono}>{log.duration}ms</span>
                    <span style={{ ...S.mono, width: 80, textAlign: 'right' }}>{timeAgo(log.executedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
