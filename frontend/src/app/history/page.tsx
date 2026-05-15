'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { postHistoryApi, PostHistoryEntry } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  History, RefreshCw, Copy, CheckCheck, Image, ChevronDown, ChevronUp,
  Send, AlertCircle, CheckCircle, Clock, Globe, RotateCcw, X,
} from 'lucide-react';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'telegram') return <Send size={13} />;
  return <Globe size={13} />;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className="btn-ghost btn-sm" onClick={handle} title="Copy rewritten text" style={{ gap: 4 }}>
      {copied ? <CheckCheck size={13} style={{ color: 'var(--color-primary)' }} /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function RepostModal({ entry, onClose }: { entry: PostHistoryEntry; onClose: () => void }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(entry.channelResults.map((r) => `${r.provider}:${r.accountId}`)),
  );
  const [posting, setPosting] = useState(false);
  const [results, setResults] = useState<{ provider: string; accountId: string; success: boolean; error?: string }[] | null>(null);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handlePost = async () => {
    const channels = entry.channelResults
      .filter((r) => selected.has(`${r.provider}:${r.accountId}`))
      .map(({ provider, accountId }) => ({ provider, accountId }));
    if (!channels.length) return;
    setPosting(true);
    try {
      const { channelResults } = await postHistoryApi.repost(entry._id, channels);
      setResults(channelResults);
      const succeeded = channelResults.filter((r) => r.success).length;
      const failed = channelResults.filter((r) => !r.success).length;
      if (succeeded > 0) toast(`Posted to ${succeeded} channel${succeeded > 1 ? 's' : ''}`, 'success');
      if (failed > 0) toast(`${failed} channel${failed > 1 ? 's' : ''} failed`, 'error');
    } catch (err: any) {
      toast(err.message || 'Repost failed', 'error');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 360, padding: 24, position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="btn-ghost btn-sm"
          onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 12 }}
        >
          <X size={14} />
        </button>

        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Post Again</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--color-muted)' }}>
          Select which channels to repost to.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {entry.channelResults.map((ch) => {
            const key = `${ch.provider}:${ch.accountId}`;
            const result = results?.find((r) => r.provider === ch.provider && r.accountId === ch.accountId);
            return (
              <label
                key={key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid var(--color-border)',
                  background: selected.has(key) ? 'var(--color-surface-soft)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(key)}
                  onChange={() => toggle(key)}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <ProviderIcon provider={ch.provider} />
                <span style={{ fontSize: 13, flex: 1 }}>{ch.provider}</span>
                <span style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'monospace' }}>
                  {ch.accountId.slice(0, 8)}…
                </span>
                {result && (
                  result.success
                    ? <CheckCircle size={13} style={{ color: '#008a05' }} />
                    : <AlertCircle size={13} style={{ color: '#c13515' }} title={result.error} />
                )}
              </label>
            );
          })}
        </div>

        {results && results.some((r) => !r.success) && (
          <div style={{ marginBottom: 12 }}>
            {results.filter((r) => !r.success).map((r, i) => (
              <p key={i} style={{ fontSize: 11, color: '#c13515', margin: '2px 0' }}>
                {r.provider}: {r.error}
              </p>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary btn-sm"
            onClick={handlePost}
            disabled={posting || selected.size === 0}
          >
            {posting ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <RotateCcw size={13} />}
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryCard({ entry }: { entry: PostHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [reposting, setReposting] = useState(false);
  const succeeded = entry.channelResults.filter(r => r.success).length;
  const failed = entry.channelResults.filter(r => !r.success).length;

  return (
    <>
    {reposting && <RepostModal entry={entry} onClose={() => setReposting(false)} />}
    <div className="card" style={{ marginBottom: 12, padding: '16px 20px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        {/* Image thumbnail */}
        {entry.imageUrl ? (
          <a href={entry.imageUrl} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
            <img
              src={entry.imageUrl}
              alt="post visual"
              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border)' }}
            />
          </a>
        ) : (
          <div style={{
            width: 72, height: 72, borderRadius: 8, background: 'var(--color-surface-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            border: '1px solid var(--color-border)',
          }}>
            <Image size={22} style={{ color: 'var(--color-muted)' }} />
          </div>
        )}

        {/* Text + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: '0 0 8px', fontSize: 14, lineHeight: 1.55, color: 'var(--color-ink)',
            display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 3,
            WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden',
          }}>
            {entry.rewrittenText}
          </p>

          {/* Channel pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {entry.channelResults.map((ch, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, padding: '2px 8px', borderRadius: 99,
                background: ch.success ? '#e6f4e6' : '#fff0f1',
                color: ch.success ? '#008a05' : '#c13515',
                fontWeight: 500,
              }}>
                <ProviderIcon provider={ch.provider} />
                {ch.provider}
                {ch.success ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
              </span>
            ))}
          </div>

          {/* Footer meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> {timeAgo(entry.postedAt)}
            </span>
            {succeeded > 0 && (
              <span style={{ fontSize: 11, color: '#008a05' }}>{succeeded} posted</span>
            )}
            {failed > 0 && (
              <span style={{ fontSize: 11, color: '#c13515' }}>{failed} failed</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <CopyButton text={entry.rewrittenText} />
          <button
            className="btn-ghost btn-sm"
            onClick={() => setReposting(true)}
            title="Post again to specific channels"
            style={{ gap: 4 }}
          >
            <RotateCcw size={13} /> Post Again
          </button>
          <button
            className="btn-ghost btn-sm"
            onClick={() => setExpanded(e => !e)}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Less' : 'More'}
          </button>
        </div>
      </div>

      {/* Expanded: original text + failed channel errors */}
      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Original text
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.55, margin: 0 }}>
            {entry.originalText}
          </p>

          {entry.channelResults.some(r => !r.success && r.error) && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Errors
              </p>
              {entry.channelResults.filter(r => !r.success && r.error).map((r, i) => (
                <p key={i} style={{ fontSize: 12, color: '#c13515', margin: '2px 0' }}>
                  {r.provider}: {r.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<PostHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await postHistoryApi.getAll(100);
      setEntries(data);
    } catch (err: any) {
      toast(err.message || 'Failed to load history', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return (
    <div className="fade-in">
      <div className="topbar">
        <div>
          <h1 className="page-title">Post History</h1>
          <p className="page-subtitle">Browse past posts — copy the rewritten text or image to repost on any channel.</p>
        </div>
        <button className="btn-ghost btn-sm" onClick={fetchHistory}>
          <RefreshCw size={14} />
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <span className="spinner" />
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="empty-state">
          <History size={40} style={{ color: 'var(--color-muted)', marginBottom: 12 }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>No posts yet</h3>
          <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 13 }}>
            History is saved automatically after each successful content-flow run.
          </p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <>
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--color-muted)' }}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </div>
          {entries.map(entry => (
            <HistoryCard key={entry._id} entry={entry} />
          ))}
        </>
      )}
    </div>
  );
}
