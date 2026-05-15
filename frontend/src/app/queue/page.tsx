'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { queuesApi, QueueItem } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { ListOrdered, Plus, Trash2, RefreshCw, RotateCcw, Link, FileText, CheckCircle, Clock, AlertCircle, Loader, Send, ExternalLink, Image } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: '#b85c00', bg: '#fff8e6', icon: <Clock size={12} /> },
  processing: { label: 'Processing', color: '#1a6fbd', bg: '#e8f0fb', icon: <Loader size={12} /> },
  ready: { label: 'Ready', color: '#008a05', bg: '#e6f4e6', icon: <CheckCircle size={12} /> },
  posted: { label: 'Posted', color: '#929292', bg: '#f2f2f2', icon: <Send size={12} /> },
  failed: { label: 'Failed', color: '#c13515', bg: '#fff0f1', icon: <AlertCircle size={12} /> },
};

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchQueue = useCallback(async () => {
    try {
      const data = await queuesApi.getQueue();
      setItems(data.items || []);
    } catch { toast('Failed to load queue', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const handleRemove = async (index: number) => {
    if (!confirm('Remove this item from the queue?')) return;
    try {
      await queuesApi.removeItem(index);
      toast('Item removed', 'success');
      await fetchQueue();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const handleReprocess = async (index: number) => {
    try {
      await queuesApi.reprocessItem(index);
      toast('Reprocessing started', 'success');
      setTimeout(fetchQueue, 2000);
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);
  const counts = {
    all: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    processing: items.filter(i => i.status === 'processing').length,
    ready: items.filter(i => i.status === 'ready').length,
    posted: items.filter(i => i.status === 'posted').length,
    failed: items.filter(i => i.status === 'failed').length,
  };

  return (
    <div className="fade-in">
      <div className="topbar">
        <div>
          <h1 className="page-title">Content Queue</h1>
          <p className="page-subtitle">Review, reprocess, and manage your automated content pipeline.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost btn-sm" onClick={fetchQueue}><RefreshCw size={14} /></button>
          <button className="btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}>
            <Plus size={14} /> {showAdd ? 'Cancel' : 'Add Item'}
          </button>
        </div>
      </div>

      {showAdd && <AddItemForm onAdded={() => { setShowAdd(false); fetchQueue(); }} />}

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[['all', 'All'], ['pending', 'Pending'], ['processing', 'Processing'], ['ready', 'Ready'], ['posted', 'Posted'], ['failed', 'Failed']].map(([key, label]) => {
          const s = STATUS_CONFIG[key];
          const count = counts[key as keyof typeof counts] ?? 0;
          return (
            <button key={key} onClick={() => setFilter(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 'var(--r-full)',
                border: `1px solid ${filter === key ? (s?.color || 'var(--color-ink)') : 'var(--color-hairline)'}`,
                background: filter === key ? (s?.bg || 'var(--color-surface-strong)') : 'var(--color-canvas)',
                color: filter === key ? (s?.color || 'var(--color-ink)') : 'var(--color-muted)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              }}>
              {s?.icon}
              {label}
              <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 2 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="empty-state" style={{ paddingTop: 80 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-surface-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <ListOrdered size={32} color="var(--color-muted-soft)" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{filter === 'all' ? 'Queue is empty' : `No ${filter} items`}</h2>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 28 }}>
            {filter === 'all' ? 'Add Instagram links or text to start processing content.' : `No items with status "${filter}" found.`}
          </p>
          {filter === 'all' && <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add first item</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((item, idx) => {
            const realIndex = items.findIndex(i => i.id === item.id);
            const s = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
            const isExpanded = expanded === item.id;
            return (
              <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}
                  onClick={() => setExpanded(isExpanded ? null : item.id)}>
                  <div style={{ flexShrink: 0 }}>
                    {item.type === 'instagram_link' ? <Link size={18} color="#e1306c" /> : <FileText size={18} color="var(--color-muted)" />}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.caption || item.text || item.url || item.id}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                      {item.source && <span style={{ marginRight: 8 }}>via {item.source}</span>}
                      {new Date(item.addedAt).toLocaleString()}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, padding: '4px 10px', borderRadius: 'var(--r-full)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {s.icon} {s.label}
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {item.status === 'failed' && (
                      <button className="btn-ghost btn-sm" onClick={e => { e.stopPropagation(); handleReprocess(realIndex); }} title="Reprocess">
                        <RotateCcw size={14} />
                      </button>
                    )}
                    <button className="btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleRemove(realIndex); }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="fade-in" style={{ borderTop: '1px solid var(--color-hairline-soft)', padding: '16px 20px', background: 'var(--color-surface-soft)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {item.url && (
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source URL</p>
                          <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#0a66c2', display: 'flex', alignItems: 'center', gap: 4, wordBreak: 'break-all' }}>
                            {item.url.slice(0, 60)}{item.url.length > 60 ? '…' : ''} <ExternalLink size={11} />
                          </a>
                        </div>
                      )}
                      {item.metadata?.author && (
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Author</p>
                          <p style={{ fontSize: 13 }}>@{item.metadata.author}</p>
                        </div>
                      )}
                      {item.caption && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Caption</p>
                          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-body)' }}>{item.caption}</p>
                        </div>
                      )}
                      {item.text && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Text</p>
                          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-body)' }}>{item.text}</p>
                        </div>
                      )}
                      {item.error && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-error)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Error</p>
                          <p style={{ fontSize: 13, color: 'var(--color-error)', background: '#fff0f1', padding: '8px 12px', borderRadius: 'var(--r-xs)' }}>{item.error}</p>
                        </div>
                      )}
                      {item.mediaUrls && item.mediaUrls.length > 0 && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Image size={12} /> Media ({item.mediaUrls.length})
                          </p>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {item.mediaUrls.slice(0, 4).map((url, i) => (
                              <img key={i} src={url} alt={`media-${i}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--r-xs)', border: '1px solid var(--color-hairline)' }} />
                            ))}
                          </div>
                        </div>
                      )}
                      {item.processedAt && (
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Processed at</p>
                          <p style={{ fontSize: 13 }}>{new Date(item.processedAt).toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                    {item.status === 'failed' && (
                      <button className="btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => handleReprocess(realIndex)}>
                        <RotateCcw size={14} /> Reprocess
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddItemForm({ onAdded }: { onAdded: () => void }) {
  const [type, setType] = useState<'instagram_link' | 'text'>('instagram_link');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await queuesApi.addItem({ type, url: type === 'instagram_link' ? url : undefined, text: type === 'text' ? text : undefined });
      toast('Item added to queue!', 'success');
      onAdded();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="card fade-in" style={{ marginBottom: 28, maxWidth: 560 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Add Queue Item</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {([['instagram_link', 'Instagram Link', Link], ['text', 'Text Content', FileText]] as [typeof type, string, any][]).map(([val, lbl, Icon]) => (
            <button key={val} type="button" onClick={() => setType(val)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 'var(--r-sm)', border: `2px solid ${type === val ? 'var(--color-primary)' : 'var(--color-hairline)'}`, background: type === val ? '#fff0f1' : 'var(--color-canvas)', color: type === val ? 'var(--color-primary)' : 'var(--color-muted)', fontWeight: 500, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' }}>
              <Icon size={16} />{lbl}
            </button>
          ))}
        </div>
        {type === 'instagram_link' ? (
          <div className="form-group">
            <label className="form-label">Instagram post URL</label>
            <input className="input" placeholder="https://www.instagram.com/p/abc123/" value={url} onChange={e => setUrl(e.target.value)} required />
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">Content</label>
            <textarea className="textarea" placeholder="Enter your content text…" value={text} onChange={e => setText(e.target.value)} required rows={4} />
          </div>
        )}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} /> Adding…</> : <><Plus size={16} /> Add to Queue</>}
        </button>
      </form>
    </div>
  );
}
