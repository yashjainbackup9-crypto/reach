'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { telegramApi, TelegramBot } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Bot, Plus, Trash2, RefreshCw, CheckCircle, ExternalLink, Key, Info } from 'lucide-react';

export default function TelegramPage() {
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [token, setToken] = useState('');
  const [registering, setRegistering] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBots = useCallback(async () => {
    try { setBots(await telegramApi.getBots()); }
    catch { toast('Failed to load bots', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    try {
      await telegramApi.registerBot({ botToken: token });
      toast('Bot registered successfully!', 'success');
      setToken(''); setShowForm(false);
      await fetchBots();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setRegistering(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete bot @${name}?`)) return;
    setDeleting(id);
    try {
      await telegramApi.deleteBot(id);
      toast('Bot deleted', 'success');
      await fetchBots();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setDeleting(null); }
  };

  return (
    <div className="fade-in">
      <div className="topbar">
        <div>
          <h1 className="page-title">Telegram Bots</h1>
          <p className="page-subtitle">Register and manage Telegram bots for automated content ingestion.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost btn-sm" onClick={fetchBots}><RefreshCw size={14} /></button>
          <button className="btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>
            <Plus size={14} /> {showForm ? 'Cancel' : 'Register Bot'}
          </button>
        </div>
      </div>

      {/* Register form */}
      {showForm && (
        <div className="card fade-in" style={{ marginBottom: 28, maxWidth: 520 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Register a Telegram Bot</h2>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 20 }}>
            Get a bot token from <a href="https://t.me/botfather" target="_blank" rel="noreferrer" style={{ color: '#0088cc', display: 'inline-flex', alignItems: 'center', gap: 3 }}>@BotFather <ExternalLink size={12} /></a> and paste it below.
          </p>
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Bot Token</label>
              <div style={{ position: 'relative' }}>
                <Key size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                <input
                  className="input"
                  placeholder="123456:ABCdefGHIjklMNOpqrsTUVwxyz"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  required
                  style={{ paddingLeft: 40 }}
                />
              </div>
            </div>
            <div style={{ background: '#e8f4fd', border: '1px solid #bcd4f0', borderRadius: 'var(--r-sm)', padding: '10px 14px', fontSize: 13, color: '#1a4a80', display: 'flex', gap: 8 }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              A webhook will be automatically registered. Make sure your server is publicly accessible via <code>TELEGRAM_WEBHOOK_BASE_URL</code>.
            </div>
            <button className="btn-primary" type="submit" disabled={registering}>
              {registering ? <><div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} /> Registering…</> : <><Bot size={16} /> Register Bot</>}
            </button>
          </form>
        </div>
      )}

      {/* Bots list */}
      {loading ? (
        <div className="empty-state" style={{ paddingTop: 80 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : bots.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#e8f4fd', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Bot size={32} color="#0088cc" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No bots registered</h2>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 28, maxWidth: 380, margin: '0 auto 28px' }}>
            Register a Telegram bot to start ingesting Instagram links and automating your content queue.
          </p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Register your first bot
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bots.map((bot) => (
            <div key={bot._id} className="card-hover" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#e8f4fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={24} color="#0088cc" />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{bot.botName}</span>
                  <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>@{bot.botUsername}</span>
                  {bot.isActive !== false && (
                    <span className="badge badge-success"><CheckCircle size={10} /> Active</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: 'monospace', background: 'var(--color-surface-strong)', padding: '2px 8px', borderRadius: 'var(--r-xs)' }}>
                    {bot.botToken.slice(0, 8)}…{bot.botToken.slice(-6)}
                  </span>
                  {bot.createdAt && (
                    <span style={{ fontSize: 12, color: 'var(--color-muted-soft)' }}>
                      · Registered {new Date(bot.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <a
                href={`https://t.me/${bot.botUsername}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost btn-sm"
                style={{ flexShrink: 0 }}
              >
                <ExternalLink size={13} /> Open
              </a>
              <button
                className="btn-danger btn-sm"
                onClick={() => handleDelete(bot._id, bot.botUsername)}
                disabled={deleting === bot._id}
                style={{ flexShrink: 0 }}
              >
                {deleting === bot._id ? <div className="spinner" style={{ width: 13, height: 13 }} /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="card" style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>How it works</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {[
            { step: '1', title: 'Register a bot', desc: 'Create a bot via @BotFather on Telegram and paste the token here.' },
            { step: '2', title: 'Users send Instagram links', desc: 'When users message your bot with Instagram post URLs, they\'re automatically queued.' },
            { step: '3', title: 'Content is scraped', desc: 'The system scrapes the Instagram post and extracts captions and media.' },
            { step: '4', title: 'Queue processes it', desc: 'Items appear in your Content Queue, ready for review and rewriting with your brand tone.' },
          ].map(({ step, title, desc }) => (
            <div key={step} style={{ display: 'flex', gap: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{step}</div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{title}</p>
                <p style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
