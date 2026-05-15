'use client';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { contentApi, telegramApi, accountsApi, queuesApi, Tone, QueueItem } from '@/lib/api';
import { Wand2, Bot, Users, ListOrdered, TrendingUp, CheckCircle, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Stats { tones: number; bots: number; accounts: number; queueItems: number; queueReady: number; queueFailed: number; }

const STATUS: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Pending',    color: '#f5a623' },
  processing: { label: 'Processing', color: '#4a90e2' },
  ready:      { label: 'Ready',      color: '#008a05' },
  posted:     { label: 'Posted',     color: '#929292' },
  failed:     { label: 'Failed',     color: '#ff385c' },
};

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentQueue, setRecentQueue] = useState<QueueItem[]>([]);
  const [tones, setTones] = useState<Tone[]>([]);
  const [loading, setLoading] = useState(true);
  const firstName = (user as any)?.profile?.firstName || user?.username || 'there';

  useEffect(() => {
    Promise.allSettled([
      contentApi.getTones(),
      telegramApi.getBots(),
      accountsApi.getAll(),
      queuesApi.getQueue(),
    ]).then(([t, b, a, q]) => {
      const td = t.status === 'fulfilled' ? t.value : [];
      const bd = b.status === 'fulfilled' ? b.value : [];
      const ad = a.status === 'fulfilled' ? a.value : [];
      const qd = q.status === 'fulfilled' ? q.value.items : [];
      setTones(td.slice(0, 3));
      setRecentQueue(qd.slice(-5).reverse());
      setStats({ tones: td.length, bots: bd.length, accounts: ad.length, queueItems: qd.length, queueReady: qd.filter((i: QueueItem) => i.status === 'ready').length, queueFailed: qd.filter((i: QueueItem) => i.status === 'failed').length });
      setLoading(false);
    });
  }, []);

  const statCards = [
    { label: 'Brand Tones',     value: stats?.tones,      icon: Wand2,       href: '/content',  color: '#ff385c', bg: '#fff0f1' },
    { label: 'Telegram Bots',   value: stats?.bots,       icon: Bot,         href: '/telegram', color: '#0088cc', bg: '#e8f4fd' },
    { label: 'Linked Accounts', value: stats?.accounts,   icon: Users,       href: '/accounts', color: '#0a66c2', bg: '#e8f1fb' },
    { label: 'Queue Items',     value: stats?.queueItems, icon: ListOrdered, href: '/queue',    color: '#7b5ea7', bg: '#f0ebf8' },
  ];

  return (
    <div className="fade-in">
      <div className="topbar">
        <div>
          <h1 className="page-title">Good {getGreeting()}, {firstName} 👋</h1>
          <p className="page-subtitle">Here&apos;s what&apos;s happening in your workspace today.</p>
        </div>
        <Link href="/content" className="btn-primary btn-sm"><Wand2 size={14} /> New Tone</Link>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 32 }}>
        {statCards.map(({ label, value, icon: Icon, href, color, bg }) => (
          <Link key={label} href={href} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color={color} />
                </div>
                <ArrowRight size={14} color="var(--color-muted-soft)" />
              </div>
              <div className="stat-value">{loading ? <div className="spinner" style={{ width: 22, height: 22 }} /> : (value ?? 0)}</div>
              <div className="stat-label">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Queue health bar */}
      {stats && stats.queueItems > 0 && (
        <div className="card" style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} color="var(--color-primary)" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Queue health</span>
          </div>
          <div style={{ display: 'flex', gap: 20, flex: 1 }}>
            {[{ label: 'Ready', count: stats.queueReady, color: '#008a05' }, { label: 'Failed', count: stats.queueFailed, color: '#ff385c' }, { label: 'Total', count: stats.queueItems, color: 'var(--color-muted)' }].map(({ label, count, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color }}>{count}</span>
                <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{label}</span>
              </div>
            ))}
          </div>
          <Link href="/queue" className="btn-ghost btn-sm">View all <ArrowRight size={13} /></Link>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 32 }}>
        {/* Recent Queue */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Recent Queue</h2>
            <Link href="/queue" className="btn-ghost btn-sm">View all</Link>
          </div>
          {loading ? <div className="empty-state"><div className="spinner" /></div>
            : recentQueue.length === 0 ? (
              <div className="empty-state"><ListOrdered size={32} /><p style={{ fontSize: 14 }}>No queue items yet</p></div>
            ) : (
              <div>
                {recentQueue.map((item) => {
                  const s = STATUS[item.status] || STATUS.pending;
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-hairline-soft)' }}>
                      <div className={`status-dot ${item.status}`} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.caption || item.text || item.url || item.id}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{item.type || 'item'} · {new Date(item.addedAt).toLocaleDateString()}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.color + '18', padding: '3px 8px', borderRadius: 'var(--r-full)', flexShrink: 0 }}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Brand Tones */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Brand Tones</h2>
            <Link href="/content" className="btn-ghost btn-sm">Manage</Link>
          </div>
          {loading ? <div className="empty-state"><div className="spinner" /></div>
            : tones.length === 0 ? (
              <div className="empty-state"><Wand2 size={32} /><p style={{ fontSize: 14 }}>No tones yet</p><Link href="/content" className="btn-ghost btn-sm">Generate first tone →</Link></div>
            ) : (
              <div>
                {tones.map((tone) => (
                  <div key={tone._id} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-hairline-soft)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff0f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wand2 size={12} color="var(--color-primary)" />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{tone.name}</span>
                      {tone.source && <span className="badge badge-muted" style={{ fontSize: 10 }}>{tone.source}</span>}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{tone.tone}</p>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[{ label: 'Generate brand tone', href: '/content', icon: Wand2, color: '#ff385c' }, { label: 'Connect LinkedIn', href: '/accounts', icon: Users, color: '#0a66c2' }, { label: 'Register Telegram bot', href: '/telegram', icon: Bot, color: '#0088cc' }, { label: 'Add to queue', href: '/queue', icon: ListOrdered, color: '#7b5ea7' }].map(({ label, href, icon: Icon, color }) => (
            <Link key={label} href={href}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', border: '1px solid var(--color-hairline)', borderRadius: 'var(--r-md)', cursor: 'pointer', transition: 'all 0.15s ease' }}>
                <Icon size={16} color={color} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
