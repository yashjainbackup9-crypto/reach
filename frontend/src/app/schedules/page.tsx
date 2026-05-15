'use client';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  schedulesApi, telegramApi, contentApi, accountsApi,
  ContentFlowSchedule, TelegramBot, Tone, Account,
} from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  Send, Sparkles,
  Plus, Trash2, RefreshCw, Play, Pencil, X,
  Clock, CheckCircle, Circle, Calendar, AlarmClock,
  ChevronRight, ToggleLeft, ToggleRight,
  Bot, ChevronDown, ChevronUp, Lock, Image,
  MessageCircle, Briefcase,
} from 'lucide-react';
import { FacebookIcon } from '../accounts/page';

// Inline Instagram SVG (not in this lucide-react version)
const InstagramIcon = ({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const IG_GRADIENT = 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)';

// ─── Cron helpers ──────────────────────────────────────────────────────────

function timeToCron(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${m} ${h} * * *`;
}

function cronToTimeInput(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length >= 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    return `${parseInt(parts[1]).toString().padStart(2, '0')}:${parseInt(parts[0]).toString().padStart(2, '0')}`;
  }
  return '09:00';
}

function humanCron(cron: string): string {
  try {
    const [h, m] = cronToTimeInput(cron).split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  } catch {
    return cron;
  }
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

// ─── AI provider options ───────────────────────────────────────────────────

const AI_PROVIDERS = [
  { value: '', label: 'System default' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'gemini', label: 'Google (Gemini)' },
];

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-3-flash-preview',
};

// ─── Form types ────────────────────────────────────────────────────────────

interface AiConfigForm {
  provider: string;
  model: string;
  apiKey: string;
  maxTokens: string;
}

interface ChannelRef {
  provider: string;
  accountId: string;
}

interface ImageConfigForm {
  enabled: boolean;
  customPrompt: string;
  size: string;
  quality: string;
  style: string;
  apiKey: string;
}

interface FormState {
  name: string;
  selectedChannels: ChannelRef[];
  toneId: string;
  times: string[];
  showAiConfig: boolean;
  aiConfig: AiConfigForm;
  showImageConfig: boolean;
  imageConfig: ImageConfigForm;
}

const EMPTY_AI: AiConfigForm = { provider: '', model: '', apiKey: '', maxTokens: '' };
const EMPTY_IMG: ImageConfigForm = { enabled: false, customPrompt: '', size: '1024x1024', quality: 'auto', style: 'vivid', apiKey: '' };

const EMPTY_FORM: FormState = {
  name: '',
  selectedChannels: [],
  toneId: '',
  times: ['09:00'],
  showAiConfig: false,
  aiConfig: EMPTY_AI,
  showImageConfig: false,
  imageConfig: EMPTY_IMG,
};

// ─── Page ─────────────────────────────────────────────────────────────────

export default function SchedulesPage() {
  const { toast } = useToast();

  const [schedules, setSchedules] = useState<ContentFlowSchedule[]>([]);
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [tones, setTones] = useState<Tone[]>([]);
  const [linkedInAccounts, setLinkedInAccounts] = useState<Account[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<Account[]>([]);
  const [facebookAccounts, setFacebookAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  const [isExpanded, setIsExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const scheduleListRef = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sched, b, t, liAccounts, igAccounts, fbAccounts] = await Promise.all([
        schedulesApi.contentFlow.getAll(),
        telegramApi.getBots(),
        contentApi.getTones(),
        accountsApi.linkedin.getAccounts().catch(() => [] as Account[]),
        accountsApi.instagram.getAccounts().catch(() => [] as Account[]),
        accountsApi.facebook.getAccounts().catch(() => [] as Account[]),
      ]);
      setSchedules(sched);
      setBots(b);
      setTones(t);
      setLinkedInAccounts(liAccounts);
      setInstagramAccounts(igAccounts);
      setFacebookAccounts(fbAccounts);
    } catch (err: any) {
      toast(err.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAppClick = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next) {
      setTimeout(() => scheduleListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (schedule: ContentFlowSchedule) => {
    setEditingId(schedule._id);
    const tId = schedule.toneId
      ? (typeof schedule.toneId === 'object' ? (schedule.toneId as any)._id : schedule.toneId)
      : '';
    const ai = schedule.aiConfig;
    const img = schedule.imageConfig;
    setForm({
      ...EMPTY_FORM,
      name: schedule.name,
      selectedChannels: schedule.channels,
      toneId: tId,
      times: schedule.times.map(cronToTimeInput),
      showAiConfig: !!(ai?.provider || ai?.model),
      aiConfig: {
        provider: ai?.provider ?? '',
        model: ai?.model ?? '',
        apiKey: '',
        maxTokens: ai?.maxTokens?.toString() ?? '',
      },
      showImageConfig: !!(img?.enabled),
      imageConfig: {
        enabled: img?.enabled ?? false,
        customPrompt: img?.customPrompt ?? '',
        size: img?.size ?? '1024x1024',
        quality: img?.quality ?? 'auto',
        style: img?.style ?? 'vivid',
        apiKey: '',
      },
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const buildAiConfig = () => {
    const { provider, model, apiKey, maxTokens } = form.aiConfig;
    if (!provider && !model && !apiKey && !maxTokens) return undefined;
    return {
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
      ...(apiKey ? { apiKey } : {}),
      ...(maxTokens ? { maxTokens: parseInt(maxTokens, 10) } : {}),
    };
  };

  const buildImageConfig = () => {
    const { enabled, customPrompt, size, quality, style, apiKey } = form.imageConfig;
    if (!enabled) return undefined;
    return {
      enabled,
      ...(customPrompt.trim() ? { customPrompt: customPrompt.trim() } : {}),
      ...(size ? { size } : {}),
      ...(quality ? { quality } : {}),
      ...(style ? { style } : {}),
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    if (form.times.length === 0) { toast('Add at least one post time', 'error'); return; }
    if (form.selectedChannels.length === 0) { toast('Select at least one channel', 'error'); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        channels: form.selectedChannels,
        ...(form.toneId ? { toneId: form.toneId } : {}),
        times: form.times.map(timeToCron),
        aiConfig: buildAiConfig(),
        imageConfig: buildImageConfig(),
      };
      if (editingId) {
        await schedulesApi.contentFlow.update(editingId, payload);
        toast('Schedule updated', 'success');
      } else {
        await schedulesApi.contentFlow.create(payload);
        toast('Schedule created', 'success');
      }
      closeModal();
      await fetchAll();
    } catch (err: any) {
      toast(err.message || 'Failed to save schedule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (schedule: ContentFlowSchedule) => {
    setTogglingId(schedule._id);
    try {
      await schedulesApi.contentFlow.update(schedule._id, { isActive: !schedule.isActive });
      setSchedules(prev => prev.map(s => s._id === schedule._id ? { ...s, isActive: !s.isActive } : s));
      toast(schedule.isActive ? 'Schedule paused' : 'Schedule activated', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update schedule', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleRun = async (schedule: ContentFlowSchedule) => {
    setRunningId(schedule._id);
    try {
      const result = await schedulesApi.contentFlow.run(schedule._id);
      toast(result.posted ? `"${schedule.name}" posted successfully` : `"${schedule.name}" ran — queue may be empty`, 'success');
      await fetchAll();
    } catch (err: any) {
      toast(err.message || 'Failed to run schedule', 'error');
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (schedule: ContentFlowSchedule) => {
    if (!confirm(`Delete schedule "${schedule.name}"? This cannot be undone.`)) return;
    setDeletingId(schedule._id);
    try {
      await schedulesApi.contentFlow.delete(schedule._id);
      setSchedules(prev => prev.filter(s => s._id !== schedule._id));
      toast('Schedule deleted', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to delete schedule', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const addTime = () => setForm(f => ({ ...f, times: [...f.times, '12:00'] }));
  const removeTime = (i: number) => setForm(f => ({ ...f, times: f.times.filter((_, idx) => idx !== i) }));
  const updateTime = (i: number, v: string) => setForm(f => ({ ...f, times: f.times.map((t, idx) => idx === i ? v : t) }));

  const toggleChannel = (provider: string, accountId: string) => {
    setForm(f => {
      const exists = f.selectedChannels.some(c => c.provider === provider && c.accountId === accountId);
      return {
        ...f,
        selectedChannels: exists
          ? f.selectedChannels.filter(c => !(c.provider === provider && c.accountId === accountId))
          : [...f.selectedChannels, { provider, accountId }],
      };
    });
  };

  const isChannelSelected = (provider: string, accountId: string) =>
    form.selectedChannels.some(c => c.provider === provider && c.accountId === accountId);

  const resolveToneLabel = (toneId?: string | { _id: string; name: string } | null): string | null => {
    if (!toneId) return null;
    if (typeof toneId === 'object') return toneId.name;
    const tone = tones.find(t => t._id === toneId);
    return tone?.name ?? null;
  };

  const resolveAiLabel = (aiConfig?: { provider?: string; model?: string } | null): string | null => {
    if (!aiConfig) return null;
    const parts = [aiConfig.provider, aiConfig.model].filter(Boolean);
    return parts.length ? parts.join(' / ') : null;
  };

  const resolveChannelSummary = (channels: { provider: string; accountId: string }[]): string => {
    if (!channels.length) return 'No channels';
    const tgCount = channels.filter(c => c.provider === 'telegram').length;
    const liCount = channels.filter(c => c.provider === 'linkedin').length;
    const igCount = channels.filter(c => c.provider === 'instagram').length;
    const fbCount = channels.filter(c => c.provider === 'facebook').length;
    const parts: string[] = [];
    if (tgCount) parts.push(`${tgCount} Telegram`);
    if (liCount) parts.push(`${liCount} LinkedIn`);
    if (igCount) parts.push(`${igCount} Instagram`);
    if (fbCount) parts.push(`${fbCount} Facebook`);
    const others = channels.filter(c => !['telegram', 'linkedin', 'instagram', 'facebook'].includes(c.provider));
    if (others.length) parts.push(`${others.length} other`);
    return parts.join(', ');
  };

  const activeCount = schedules.filter(s => s.isActive).length;

  // ─── Schedule card ─────────────────────────────────────────────────────

  const renderScheduleCard = (schedule: ContentFlowSchedule) => {
    const toneLabel = resolveToneLabel(schedule.toneId);
    const aiLabel = resolveAiLabel(schedule.aiConfig);
    const imageEnabled = schedule.imageConfig?.enabled;

    return (
      <div
        key={schedule._id}
        className="card-hover"
        style={{ display: 'flex', alignItems: 'center', gap: 14 }}
        role="listitem"
        aria-label={`${schedule.name}, ${schedule.isActive ? 'active' : 'paused'}`}
      >
        {/* Toggle */}
        <button
          onClick={() => handleToggle(schedule)}
          disabled={togglingId === schedule._id}
          aria-label={schedule.isActive ? `Pause "${schedule.name}"` : `Activate "${schedule.name}"`}
          aria-pressed={schedule.isActive}
          style={{ flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: schedule.isActive ? 'var(--color-primary)' : 'var(--color-hairline)', lineHeight: 0 }}
        >
          {togglingId === schedule._id
            ? <div className="spinner" style={{ width: 22, height: 22 }} role="status" aria-label="Updating…" />
            : schedule.isActive ? <ToggleRight size={28} aria-hidden /> : <ToggleLeft size={28} aria-hidden />
          }
        </button>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink)' }}>{schedule.name}</span>
            <span className={`badge ${schedule.isActive ? 'badge-success' : 'badge-muted'}`} aria-hidden>
              {schedule.isActive ? <><CheckCircle size={10} /> Active</> : <><Circle size={10} /> Paused</>}
            </span>
            {toneLabel && (
              <span className="badge badge-primary" aria-label={`Tone: ${toneLabel}`}>
                <Sparkles size={10} aria-hidden /> {toneLabel}
              </span>
            )}
            {aiLabel && (
              <span className="badge badge-muted" aria-label={`AI: ${aiLabel}`}>
                <Bot size={10} aria-hidden /> {aiLabel}
              </span>
            )}
            {imageEnabled && (
              <span className="badge badge-primary" aria-label="Image generation enabled">
                <Image size={10} aria-hidden /> AI Image
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--color-muted)' }}>
              <Send size={12} aria-hidden />
              {resolveChannelSummary(schedule.channels)}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--color-muted)' }}>
              <Clock size={12} aria-hidden />
              <span aria-label={`Post times: ${schedule.times.map(humanCron).join(', ')} daily`}>
                {schedule.times.map(humanCron).join(', ')} daily
              </span>
            </span>
            {schedule.lastRunAt && (
              <time dateTime={schedule.lastRunAt} style={{ fontSize: 12, color: 'var(--color-muted-soft)' }} title={new Date(schedule.lastRunAt).toLocaleString()}>
                Last run {timeAgo(schedule.lastRunAt)}
              </time>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn-ghost btn-sm" onClick={() => handleRun(schedule)} disabled={runningId === schedule._id} aria-label={`Run "${schedule.name}" now`} title="Run now">
            {runningId === schedule._id ? <div className="spinner" style={{ width: 14, height: 14 }} role="status" aria-label="Running…" /> : <Play size={14} aria-hidden />}
          </button>
          <button className="btn-ghost btn-sm" onClick={() => openEdit(schedule)} aria-label={`Edit "${schedule.name}"`} title="Edit">
            <Pencil size={14} aria-hidden />
          </button>
          <button className="btn-danger btn-sm" onClick={() => handleDelete(schedule)} disabled={deletingId === schedule._id} aria-label={`Delete "${schedule.name}"`} title="Delete">
            {deletingId === schedule._id ? <div className="spinner" style={{ width: 14, height: 14 }} role="status" aria-label="Deleting…" /> : <Trash2 size={14} aria-hidden />}
          </button>
        </div>
      </div>
    );
  };

  const hasNoChannels = bots.length === 0 && linkedInAccounts.length === 0 && instagramAccounts.length === 0 && facebookAccounts.length === 0;

  return (
    <div className="fade-in">
      {/* ── Header ── */}
      <div className="topbar">
        <div>
          <h1 className="page-title">Schedules</h1>
          <p className="page-subtitle">Configure automated posting flows for your content queue.</p>
        </div>
        <button className="btn-ghost btn-sm" onClick={fetchAll} aria-label="Refresh schedules" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── App grid ── */}
      <section aria-label="Available schedule flows">
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted-soft)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
          Available Flows
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14, marginBottom: 36 }}>
          <button
            onClick={handleAppClick}
            aria-pressed={isExpanded}
            aria-label={`Content Flow${isExpanded ? ' — hide schedules' : ' — view schedules'}`}
            style={{
              textAlign: 'left',
              background: 'var(--color-canvas)',
              border: `2px solid ${isExpanded ? 'var(--color-primary)' : 'var(--color-hairline-soft)'}`,
              borderRadius: 'var(--r-md)',
              padding: 20,
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxShadow: isExpanded ? `0 0 0 4px var(--color-primary-soft)` : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--color-surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Send size={24} color="var(--color-primary)" />
              </div>
              {schedules.length > 0 && (
                <span className="badge badge-success" aria-label={`${activeCount} active of ${schedules.length} schedules`}>
                  <CheckCircle size={10} aria-hidden /> {activeCount}/{schedules.length} active
                </span>
              )}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 5 }}>Content Flow</div>
              <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.55 }}>Post queued content to multiple channels — Telegram bots, LinkedIn, Facebook and Instagram accounts — on a schedule.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: isExpanded ? 'var(--color-primary)' : 'var(--color-muted)' }}>
              {isExpanded ? 'Hide schedules' : 'Configure'}
              <ChevronRight size={14} aria-hidden style={{ transition: 'transform 0.15s ease', transform: isExpanded ? 'rotate(90deg)' : 'none' }} />
            </div>
          </button>
        </div>
      </section>

      {/* ── Schedule list ── */}
      {isExpanded && (
        <section ref={scheduleListRef} aria-label="Content Flow schedule list" className="fade-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--color-surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={17} color="var(--color-primary)" aria-hidden />
              </div>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-ink)' }}>Content Flow</h2>
                <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                  {schedules.length === 0 ? 'No schedules' : `${schedules.length} schedule${schedules.length !== 1 ? 's' : ''} · ${activeCount} active`}
                </p>
              </div>
            </div>
            <button className="btn-primary btn-sm" onClick={openCreate} aria-label="Create new Content Flow schedule">
              <Plus size={14} aria-hidden /> New Schedule
            </button>
          </div>

          {loading ? (
            <div className="empty-state" style={{ paddingTop: 60 }}>
              <div className="spinner" style={{ width: 32, height: 32 }} role="status" aria-label="Loading schedules" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '56px 32px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <Calendar size={28} color="var(--color-primary)" aria-hidden />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No schedules yet</h3>
              <p style={{ fontSize: 14, color: 'var(--color-muted)', maxWidth: 380, margin: '0 auto 24px', lineHeight: 1.6 }}>
                {hasNoChannels
                  ? 'Connect a Telegram bot or social account first, then create a schedule to post automatically.'
                  : 'Create a Content Flow schedule to automatically post from your queue to your channels.'}
              </p>
              {hasNoChannels ? (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a href="/telegram" className="btn-secondary" style={{ textDecoration: 'none' }}>Add Telegram Bot</a>
                  <a href="/accounts" className="btn-secondary" style={{ textDecoration: 'none' }}>Connect Accounts</a>
                </div>
              ) : (
                <button className="btn-primary" onClick={openCreate}>
                  <Plus size={16} aria-hidden /> Create your first schedule
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} role="list" aria-label="Content Flow Schedules">
              {schedules.map(renderScheduleCard)}
            </div>
          )}
        </section>
      )}

      {/* ── Create / Edit modal ── */}
      {showModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="modal" style={{ maxWidth: 540, width: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--color-surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={18} color="var(--color-primary)" aria-hidden />
                </div>
                <h2 id="schedule-modal-title" style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-ink)' }}>
                  {editingId ? 'Edit Schedule' : 'New Content Flow Schedule'}
                </h2>
              </div>
              <button className="btn-ghost btn-sm" onClick={closeModal} aria-label="Close dialog" style={{ padding: '6px 8px' }}>
                <X size={18} aria-hidden />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="sched-name">Schedule Name</label>
                <input id="sched-name" className="input" placeholder="e.g. Morning Post, Evening Digest" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus aria-required="true" />
              </div>

              {/* Channel Selection */}
              <div className="form-group">
                <label className="form-label">Channels</label>
                <p style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                  Select which Telegram bots, LinkedIn, Facebook, and Instagram accounts to post to. Content will be posted to all selected channels simultaneously.
                </p>

                {/* Telegram Bots */}
                {bots.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <MessageCircle size={13} color="#0088cc" aria-hidden />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Telegram Bots</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {bots.map(bot => {
                        const selected = isChannelSelected('telegram', bot._id);
                        return (
                          <label key={bot._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${selected ? '#0088cc' : 'var(--color-hairline)'}`, borderRadius: 'var(--r-sm)', cursor: 'pointer', background: selected ? '#e8f4fd' : 'var(--color-canvas)', transition: 'all 0.12s ease' }}>
                            <input type="checkbox" checked={selected} onChange={() => toggleChannel('telegram', bot._id)} style={{ width: 16, height: 16, accentColor: '#0088cc' }} />
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-ink)' }}>{bot.botName}</span>
                            <span style={{ fontSize: 12, color: 'var(--color-muted)', marginLeft: 'auto' }}>@{bot.botUsername}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* LinkedIn Accounts */}
                {linkedInAccounts.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Briefcase size={13} color="#0077b5" aria-hidden />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LinkedIn Accounts</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {linkedInAccounts.map(acc => {
                        const selected = isChannelSelected('linkedin', acc._id);
                        return (
                          <label key={acc._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${selected ? '#0077b5' : 'var(--color-hairline)'}`, borderRadius: 'var(--r-sm)', cursor: 'pointer', background: selected ? '#e8f0f8' : 'var(--color-canvas)', transition: 'all 0.12s ease' }}>
                            <input type="checkbox" checked={selected} onChange={() => toggleChannel('linkedin', acc._id)} style={{ width: 16, height: 16, accentColor: '#0077b5' }} />
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-ink)' }}>{acc.profileName}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Instagram Accounts */}
                {instagramAccounts.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <InstagramIcon size={13} color="#E1306C" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instagram Accounts</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {instagramAccounts.map(acc => {
                        const selected = isChannelSelected('instagram', acc._id);
                        return (
                          <label key={acc._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${selected ? '#E1306C' : 'var(--color-hairline)'}`, borderRadius: 'var(--r-sm)', cursor: 'pointer', background: selected ? '#fce4ec' : 'var(--color-canvas)', transition: 'all 0.12s ease' }}>
                            <input type="checkbox" checked={selected} onChange={() => toggleChannel('instagram', acc._id)} style={{ width: 16, height: 16, accentColor: '#E1306C' }} />
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: IG_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <InstagramIcon size={14} color="#fff" />
                            </div>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-ink)' }}>{acc.profileName}</span>
                              {acc.username && <span style={{ fontSize: 12, color: 'var(--color-muted)', marginLeft: 6 }}>@{acc.username}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {(acc.supportedPostTypes || ['text', 'image', 'reel']).map(t => (
                                <span key={t} style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 10, background: '#fce4ec', color: '#c2185b', textTransform: 'capitalize' }}>{t}</span>
                              ))}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Facebook Accounts */}
                {facebookAccounts.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <FacebookIcon size={13} color="#1877f2" aria-hidden />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Facebook Pages</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {facebookAccounts.map(acc => {
                        const selected = isChannelSelected('facebook', acc._id);
                        return (
                          <label key={acc._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${selected ? '#1877f2' : 'var(--color-hairline)'}`, borderRadius: 'var(--r-sm)', cursor: 'pointer', background: selected ? '#e7f3ff' : 'var(--color-canvas)', transition: 'all 0.12s ease' }}>
                            <input type="checkbox" checked={selected} onChange={() => toggleChannel('facebook', acc._id)} style={{ width: 16, height: 16, accentColor: '#1877f2' }} />
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <FacebookIcon size={14} color="#fff" />
                            </div>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-ink)' }}>{acc.profileName}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {(acc.supportedPostTypes || ['text', 'image', 'video']).map(t => (
                                <span key={t} style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 10, background: '#e7f3ff', color: '#1877f2', textTransform: 'capitalize' }}>{t}</span>
                              ))}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {hasNoChannels && (
                  <p style={{ fontSize: 14, color: 'var(--color-error)', padding: '4px 0' }} role="alert">
                    No channels available.{' '}
                    <a href="/telegram" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>Add a Telegram bot</a>
                    {' or '}
                    <a href="/accounts" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>connect social accounts</a>.
                  </p>
                )}
              </div>

              {/* Brand tone */}
              <div className="form-group">
                <label className="form-label" htmlFor="sched-tone">
                  Brand Tone <span style={{ fontWeight: 400, color: 'var(--color-muted-soft)' }}>(optional)</span>
                </label>
                <select id="sched-tone" className="select" value={form.toneId} onChange={e => setForm(f => ({ ...f, toneId: e.target.value }))}>
                  <option value="">No tone — post as-is</option>
                  {tones.map(tone => <option key={tone._id} value={tone._id}>{tone.name}</option>)}
                </select>
              </div>

              {/* Post times */}
              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend className="form-label" style={{ marginBottom: 10, display: 'block' }}>
                  Post Times <span style={{ fontWeight: 400, color: 'var(--color-muted-soft)' }}>(runs daily at these times)</span>
                </legend>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.times.map((time, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <AlarmClock size={16} aria-hidden style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', pointerEvents: 'none' }} />
                        <input type="time" className="input" value={time} onChange={e => updateTime(i, e.target.value)} required aria-required="true" aria-label={`Post time ${i + 1}`} style={{ paddingLeft: 44 }} />
                      </div>
                      {form.times.length > 1 && (
                        <button type="button" className="btn-danger btn-sm" onClick={() => removeTime(i)} aria-label={`Remove time slot ${i + 1}`} style={{ padding: '8px 10px', flexShrink: 0 }}>
                          <X size={14} aria-hidden />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-ghost btn-sm" onClick={addTime} aria-label="Add another post time" style={{ alignSelf: 'flex-start', color: 'var(--color-primary)', marginTop: 2 }}>
                    <Plus size={14} aria-hidden /> Add another time
                  </button>
                </div>
              </fieldset>

              {/* AI Config — collapsible */}
              <div style={{ borderTop: '1px solid var(--color-hairline-soft)', paddingTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, showAiConfig: !f.showAiConfig }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%' }}
                  aria-expanded={form.showAiConfig}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--color-surface-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot size={14} color="var(--color-muted)" aria-hidden />
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--color-muted)', textAlign: 'left' }}>
                    AI Settings <span style={{ fontWeight: 400 }}>(model, provider, API key)</span>
                  </span>
                  {form.showAiConfig ? <ChevronUp size={16} color="var(--color-muted)" aria-hidden /> : <ChevronDown size={16} color="var(--color-muted)" aria-hidden />}
                </button>

                {form.showAiConfig && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16, padding: '16px', background: 'var(--color-surface-soft)', borderRadius: 'var(--r-sm)' }}>
                    <p style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                      These override the system defaults for tone rewriting on this schedule. Leave blank to use the system-configured provider and model.
                    </p>

                    <div className="form-group">
                      <label className="form-label" htmlFor="ai-provider">AI Provider</label>
                      <select
                        id="ai-provider"
                        className="select"
                        value={form.aiConfig.provider}
                        onChange={e => {
                          const provider = e.target.value;
                          setForm(f => ({
                            ...f,
                            aiConfig: {
                              ...f.aiConfig,
                              provider,
                              model: provider ? (DEFAULT_MODELS[provider] ?? '') : '',
                            },
                          }));
                        }}
                      >
                        {AI_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="ai-model">Model</label>
                      <input
                        id="ai-model"
                        className="input"
                        placeholder={form.aiConfig.provider ? DEFAULT_MODELS[form.aiConfig.provider] ?? 'e.g. claude-sonnet-4-6' : 'Provider default'}
                        value={form.aiConfig.model}
                        onChange={e => setForm(f => ({ ...f, aiConfig: { ...f.aiConfig, model: e.target.value } }))}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="ai-key" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Lock size={12} aria-hidden /> API Key
                        {editingId && <span style={{ fontWeight: 400, color: 'var(--color-muted-soft)' }}>(leave blank to keep existing)</span>}
                      </label>
                      <input
                        id="ai-key"
                        className="input"
                        type="password"
                        placeholder="sk-ant-... / sk-... / AI..."
                        value={form.aiConfig.apiKey}
                        onChange={e => setForm(f => ({ ...f, aiConfig: { ...f.aiConfig, apiKey: e.target.value } }))}
                        autoComplete="new-password"
                      />
                      <span style={{ fontSize: 11, color: 'var(--color-muted-soft)', marginTop: 2 }}>Stored encrypted — never exposed via the API</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="ai-tokens">Max Tokens</label>
                      <input
                        id="ai-tokens"
                        className="input"
                        type="number"
                        min={1}
                        max={128000}
                        placeholder="1024"
                        value={form.aiConfig.maxTokens}
                        onChange={e => setForm(f => ({ ...f, aiConfig: { ...f.aiConfig, maxTokens: e.target.value } }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Image Generation Config — collapsible */}
              <div style={{ borderTop: '1px solid var(--color-hairline-soft)', paddingTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, showImageConfig: !f.showImageConfig }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%' }}
                  aria-expanded={form.showImageConfig}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--color-surface-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Image size={14} color="var(--color-muted)" aria-hidden />
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--color-muted)', textAlign: 'left' }}>
                    AI Image Generation <span style={{ fontWeight: 400 }}>(gpt-image-1, per-post)</span>
                  </span>
                  {form.imageConfig.enabled && <span className="badge badge-primary" style={{ marginRight: 6, fontSize: 10 }}>On</span>}
                  {form.showImageConfig ? <ChevronUp size={16} color="var(--color-muted)" aria-hidden /> : <ChevronDown size={16} color="var(--color-muted)" aria-hidden />}
                </button>

                {form.showImageConfig && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16, padding: '16px', background: 'var(--color-surface-soft)', borderRadius: 'var(--r-sm)' }}>
                    <p style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                      When enabled, an AI image is generated for each post using the post caption as the prompt. The image is sent alongside the text on Telegram.
                    </p>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.imageConfig.enabled}
                        onChange={e => setForm(f => ({ ...f, imageConfig: { ...f.imageConfig, enabled: e.target.checked } }))}
                        style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>Enable image generation</span>
                    </label>

                    {form.imageConfig.enabled && (
                      <>
                        <div className="form-group">
                          <label className="form-label">Custom context / style prompt <span style={{ fontWeight: 400, color: 'var(--color-muted-soft)' }}>(optional)</span></label>
                          <textarea
                            className="textarea" rows={2}
                            placeholder="e.g. Minimalist design, soft pastel colours, no text in image…"
                            value={form.imageConfig.customPrompt}
                            onChange={e => setForm(f => ({ ...f, imageConfig: { ...f.imageConfig, customPrompt: e.target.value } }))}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div className="form-group">
                            <label className="form-label">Size</label>
                            <select className="select" value={form.imageConfig.size} onChange={e => setForm(f => ({ ...f, imageConfig: { ...f.imageConfig, size: e.target.value } }))}>
                              <option value="1024x1024">1024×1024 Square</option>
                              <option value="1024x1536">1024×1536 Portrait</option>
                              <option value="1536x1024">1536×1024 Landscape</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Quality</label>
                            <select className="select" value={form.imageConfig.quality} onChange={e => setForm(f => ({ ...f, imageConfig: { ...f.imageConfig, quality: e.target.value } }))}>
                              <option value="auto">Auto</option>
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Style</label>
                          <select className="select" value={form.imageConfig.style} onChange={e => setForm(f => ({ ...f, imageConfig: { ...f.imageConfig, style: e.target.value } }))}>
                            <option value="vivid">Vivid</option>
                            <option value="natural">Natural</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Lock size={12} aria-hidden /> OpenAI API Key
                            {editingId && <span style={{ fontWeight: 400, color: 'var(--color-muted-soft)' }}>(leave blank to keep existing)</span>}
                          </label>
                          <input
                            className="input" type="password"
                            placeholder="sk-… (uses env default if blank)"
                            value={form.imageConfig.apiKey}
                            onChange={e => setForm(f => ({ ...f, imageConfig: { ...f.imageConfig, apiKey: e.target.value } }))}
                            autoComplete="new-password"
                          />
                          <span style={{ fontSize: 11, color: 'var(--color-muted-soft)', marginTop: 2 }}>Stored encrypted — separate from the text AI key</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 6 }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving || hasNoChannels}
                  style={{ flex: 1 }}
                >
                  {saving
                    ? <><div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} role="status" aria-label="Saving…" /> Saving…</>
                    : editingId ? 'Save Changes' : 'Create Schedule'
                  }
                </button>
                <button type="button" className="btn-secondary" onClick={closeModal} style={{ flex: 1 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
