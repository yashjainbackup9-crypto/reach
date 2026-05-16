'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  campaignsApi, accountsApi,
  Campaign, CampaignStats, PlatformPost, Account,
} from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  Plus, RefreshCw, Trash2, Pencil, X, Megaphone,
  ChevronDown, ChevronUp, Play, ToggleLeft, ToggleRight,
  Search, ExternalLink, Tag, BarChart2, CheckCircle, XCircle,
} from 'lucide-react';

// ─── SVG icons ────────────────────────────────────────────────────────────

const InstagramIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const FacebookIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function PlatformBadge({ platform }: { platform: 'instagram' | 'facebook' }) {
  if (platform === 'instagram') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#c13515', background: '#fff0ed', borderRadius: 6, padding: '2px 8px' }}>
        <InstagramIcon size={12} color="#c13515" /> Instagram
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#1877f2', background: '#eef4ff', borderRadius: 6, padding: '2px 8px' }}>
      <FacebookIcon size={12} color="#1877f2" /> Facebook
    </span>
  );
}

// ─── Step 1: Pick platform + account ─────────────────────────────────────

function StepPickAccount({
  accounts,
  onSelect,
}: {
  accounts: Account[];
  onSelect: (platform: 'instagram' | 'facebook', account: Account) => void;
}) {
  const igAccounts = accounts.filter(a => a.platform === 'instagram');
  const fbAccounts = accounts.filter(a => a.platform === 'facebook');

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 16 }}>
        Choose the account whose posts you want to run a campaign on.
      </p>
      {igAccounts.length === 0 && fbAccounts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-muted)', fontSize: 13 }}>
          No Instagram or Facebook accounts connected. Go to Accounts to connect one.
        </div>
      )}
      {igAccounts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instagram</div>
          {igAccounts.map(acc => (
            <button
              key={acc._id}
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6, gap: 10 }}
              onClick={() => onSelect('instagram', acc)}
            >
              <InstagramIcon size={15} color="#c13515" />
              <span style={{ fontWeight: 600 }}>{acc.profileName}</span>
              {acc.username && <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>@{acc.username}</span>}
            </button>
          ))}
        </div>
      )}
      {fbAccounts.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Facebook</div>
          {fbAccounts.map(acc => (
            <button
              key={acc._id}
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6, gap: 10 }}
              onClick={() => onSelect('facebook', acc)}
            >
              <FacebookIcon size={15} color="#1877f2" />
              <span style={{ fontWeight: 600 }}>{acc.profileName}</span>
              {acc.username && <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>@{acc.username}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Pick post ────────────────────────────────────────────────────

function StepPickPost({
  platform,
  account,
  onSelect,
  onBack,
}: {
  platform: 'instagram' | 'facebook';
  account: Account;
  onSelect: (post: PlatformPost) => void;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [posts, setPosts] = useState<PlatformPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = platform === 'instagram'
        ? await campaignsApi.posts.listInstagram(account._id)
        : await campaignsApi.posts.listFacebook(account._id);
      setPosts(res.posts);
    } catch (e: any) {
      toast(e.message || 'Failed to load posts', 'error');
    } finally {
      setLoading(false);
    }
  }, [platform, account._id, toast]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleSearch = async () => {
    if (!query.trim()) { loadPosts(); return; }
    setSearching(true);
    try {
      const res = await campaignsApi.posts.search(platform, account._id, query.trim());
      setPosts(res.posts);
    } catch (e: any) {
      toast(e.message || 'Search failed', 'error');
    } finally {
      setSearching(false);
    }
  };

  const caption = (p: PlatformPost) => p.caption || p.message || '(no caption)';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={onBack}>← Back</button>
        <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          Recent posts from <strong>{account.profileName}</strong>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Search posts by keyword…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className="btn-secondary" onClick={handleSearch} disabled={searching}>
          {searching ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
        </button>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-muted)', fontSize: 13 }}>Loading posts…</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-muted)', fontSize: 13 }}>No posts found.</div>
      ) : (
        <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {posts.map(post => (
            <button
              key={post.id}
              className="card-hover"
              style={{ textAlign: 'left', padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, cursor: 'pointer', width: '100%' }}
              onClick={() => onSelect(post)}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {caption(post)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                {post.mediaType && <span style={{ marginRight: 8 }}>{post.mediaType}</span>}
                {post.timestamp && <span>{new Date(post.timestamp).toLocaleDateString()}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Campaign details form ────────────────────────────────────────

function StepCampaignForm({
  platform,
  account,
  post,
  onBack,
  onCreated,
}: {
  platform: 'instagram' | 'facebook';
  account: Account;
  post: PlatformPost;
  onBack: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [keywords, setKeywords] = useState('');
  const [publicReply, setPublicReply] = useState("Hey @{username}, we've sent you a DM! 📩");
  const [dmTemplate, setDmTemplate] = useState("Hey, here are the details you requested related to {keyword}.");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const kwList = keywords.split(',').map(k => k.trim()).filter(Boolean);
      await campaignsApi.create({
        platform,
        accountId: account._id,
        platformAccountId: (account as any).platformAccountId || account._id,
        postId: post.id,
        postCaption: post.caption || post.message,
        postPermalink: post.permalink,
        keywords: kwList.length > 0 ? kwList : undefined,
        publicReplyTemplate: publicReply,
        dmTemplate,
      });
      toast('Campaign created!', 'success');
      onCreated();
    } catch (e: any) {
      toast(e.message || 'Failed to create campaign', 'error');
    } finally {
      setSaving(false);
    }
  };

  const caption = post.caption || post.message || '(no caption)';

  return (
    <form onSubmit={handleSubmit}>
      <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12, marginBottom: 16 }} onClick={onBack}>← Back</button>

      <div className="card" style={{ padding: '10px 14px', marginBottom: 16, background: 'var(--color-surface-alt)', borderRadius: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>Selected post</div>
        <div style={{ fontSize: 13, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{caption}</div>
        {post.permalink && (
          <a href={post.permalink} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            View post <ExternalLink size={10} />
          </a>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Keywords <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(comma-separated, optional)</span></label>
        <input className="input" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. details, info, price" />
        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>When a comment contains any of these words, the bot auto-replies.</div>
      </div>

      <div className="form-group">
        <label className="form-label">Public reply template</label>
        <input className="input" value={publicReply} onChange={e => setPublicReply(e.target.value)} placeholder="Hey @{username}, we've sent you a DM!" />
        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>Use <code>{"@{username}"}</code> for the commenter's handle.</div>
      </div>

      <div className="form-group">
        <label className="form-label">DM template</label>
        <textarea className="textarea" value={dmTemplate} onChange={e => setDmTemplate(e.target.value)} rows={3} placeholder="Hey, here are the details…" />
        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>Use <code>{"$keyword"}</code> for the matched keyword.</div>
      </div>

      <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={saving}>
        {saving ? 'Creating…' : 'Create Campaign'}
      </button>
    </form>
  );
}

// ─── Create campaign modal ────────────────────────────────────────────────

function CreateCampaignModal({ accounts, onClose, onCreated }: {
  accounts: Account[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<'account' | 'post' | 'form'>('account');
  const [platform, setPlatform] = useState<'instagram' | 'facebook'>('instagram');
  const [account, setAccount] = useState<Account | null>(null);
  const [post, setPost] = useState<PlatformPost | null>(null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>New Campaign</h2>
          <button className="btn-ghost" style={{ padding: 4 }} onClick={onClose}><X size={18} /></button>
        </div>

        {step === 'account' && (
          <StepPickAccount
            accounts={accounts}
            onSelect={(p, a) => { setPlatform(p); setAccount(a); setStep('post'); }}
          />
        )}
        {step === 'post' && account && (
          <StepPickPost
            platform={platform}
            account={account}
            onSelect={p => { setPost(p); setStep('form'); }}
            onBack={() => setStep('account')}
          />
        )}
        {step === 'form' && account && post && (
          <StepCampaignForm
            platform={platform}
            account={account}
            post={post}
            onBack={() => setStep('post')}
            onCreated={() => { onClose(); onCreated(); }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Edit campaign modal ──────────────────────────────────────────────────

function EditCampaignModal({ campaign, onClose, onSaved }: {
  campaign: Campaign;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [keywords, setKeywords] = useState(campaign.keywords.join(', '));
  const [publicReply, setPublicReply] = useState(campaign.publicReplyTemplate);
  const [dmTemplate, setDmTemplate] = useState(campaign.dmTemplate);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const kwList = keywords.split(',').map(k => k.trim()).filter(Boolean);
      await campaignsApi.update(campaign._id, {
        keywords: kwList,
        publicReplyTemplate: publicReply,
        dmTemplate,
      });
      toast('Campaign updated', 'success');
      onSaved();
      onClose();
    } catch (e: any) {
      toast(e.message || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Edit Campaign</h2>
          <button className="btn-ghost" style={{ padding: 4 }} onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Keywords <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}>(comma-separated)</span></label>
            <input className="input" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="details, info, price" />
          </div>
          <div className="form-group">
            <label className="form-label">Public reply template</label>
            <input className="input" value={publicReply} onChange={e => setPublicReply(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">DM template</label>
            <textarea className="textarea" value={dmTemplate} onChange={e => setDmTemplate(e.target.value)} rows={3} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Poll results modal ───────────────────────────────────────────────────

function PollResultsModal({ results, triggered, onClose }: {
  results: { commentId: string; matchedKeyword?: string; replySent: boolean; dmSent: boolean; replyError?: string; dmError?: string }[];
  triggered: number;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Poll Results</h2>
          <button className="btn-ghost" style={{ padding: 4 }} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 16 }}>
          {triggered} comment{triggered !== 1 ? 's' : ''} processed.
        </div>
        {results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: 'var(--color-muted)' }}>No matching comments found.</div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((r, i) => (
              <div key={i} className="card" style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Comment {r.commentId}</div>
                {r.matchedKeyword && <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 6 }}>Keyword: <code>{r.matchedKeyword}</code></div>}
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: r.replySent ? '#008a05' : '#c13515' }}>
                    {r.replySent ? <CheckCircle size={12} /> : <XCircle size={12} />} Public reply
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: r.dmSent ? '#008a05' : '#c13515' }}>
                    {r.dmSent ? <CheckCircle size={12} /> : <XCircle size={12} />} DM
                  </span>
                </div>
                {(r.replyError || r.dmError) && (
                  <div style={{ fontSize: 11, color: '#c13515', marginTop: 4 }}>{r.replyError || r.dmError}</div>
                )}
              </div>
            ))}
          </div>
        )}
        <button className="btn-secondary" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ─── Campaign card ────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  onRefresh,
}: {
  campaign: Campaign;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [polling, setPolling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pollResults, setPollResults] = useState<{ triggered: number; results: any[] } | null>(null);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const s = await campaignsApi.getStats(campaign._id);
      setStats(s);
    } catch {
      /* ignore */
    } finally {
      setLoadingStats(false);
    }
  }, [campaign._id]);

  useEffect(() => {
    if (expanded && !stats) loadStats();
  }, [expanded, stats, loadStats]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await campaignsApi.update(campaign._id, { isActive: !campaign.isActive });
      onRefresh();
    } catch (e: any) {
      toast(e.message || 'Failed to toggle', 'error');
    } finally {
      setToggling(false);
    }
  };

  const handlePoll = async () => {
    setPolling(true);
    try {
      const res = await campaignsApi.poll(campaign._id);
      setPollResults(res);
    } catch (e: any) {
      toast(e.message || 'Poll failed', 'error');
    } finally {
      setPolling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await campaignsApi.delete(campaign._id);
      toast('Campaign deleted', 'success');
      onRefresh();
    } catch (e: any) {
      toast(e.message || 'Failed to delete', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const caption = campaign.postCaption || `Post ID: ${campaign.postId}`;

  return (
    <>
      <div className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${campaign.isActive ? '#008a05' : 'var(--color-border)'}` }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <PlatformBadge platform={campaign.platform} />
              <span className={`badge ${campaign.isActive ? 'badge-success' : ''}`} style={!campaign.isActive ? { background: '#f0f0f0', color: '#666' } : {}}>
                {campaign.isActive ? 'Active' : 'Paused'}
              </span>
              {campaign.totalTriggered > 0 && (
                <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <BarChart2 size={11} /> {campaign.totalTriggered} triggered
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340 }}>
              {caption}
            </div>
            {campaign.keywords.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                <Tag size={11} style={{ color: 'var(--color-muted)' }} />
                {campaign.keywords.slice(0, 5).map(k => (
                  <span key={k} style={{ fontSize: 11, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 6px', color: 'var(--color-ink)' }}>{k}</span>
                ))}
                {campaign.keywords.length > 5 && <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>+{campaign.keywords.length - 5}</span>}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
              Created {timeAgo(campaign.createdAt)}
              {campaign.postPermalink && (
                <a href={campaign.postPermalink} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  View post <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button className="btn-ghost" style={{ padding: 6 }} title={campaign.isActive ? 'Pause' : 'Activate'} onClick={handleToggle} disabled={toggling}>
              {campaign.isActive ? <ToggleRight size={18} style={{ color: '#008a05' }} /> : <ToggleLeft size={18} />}
            </button>
            <button className="btn-ghost" style={{ padding: 6 }} title="Run poll now" onClick={handlePoll} disabled={polling}>
              {polling ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={15} />}
            </button>
            <button className="btn-ghost" style={{ padding: 6 }} title="Edit" onClick={() => setEditing(true)}>
              <Pencil size={15} />
            </button>
            <button className="btn-ghost" style={{ padding: 6 }} title="Delete" onClick={handleDelete} disabled={deleting}>
              <Trash2 size={15} style={{ color: '#c13515' }} />
            </button>
            <button className="btn-ghost" style={{ padding: 6 }} onClick={() => setExpanded(v => !v)}>
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Expanded stats */}
        {expanded && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
            {loadingStats ? (
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Loading stats…</div>
            ) : stats ? (
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.totalProcessed}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Processed</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#008a05' }}>{stats.repliesSent}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Replies sent</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1877f2' }}>{stats.dmsSent}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>DMs sent</div>
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Public reply template</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', background: 'var(--color-surface-alt)', padding: '6px 10px', borderRadius: 6, fontFamily: 'monospace' }}>{campaign.publicReplyTemplate}</div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>DM template</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', background: 'var(--color-surface-alt)', padding: '6px 10px', borderRadius: 6, fontFamily: 'monospace' }}>{campaign.dmTemplate}</div>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EditCampaignModal campaign={campaign} onClose={() => setEditing(false)} onSaved={onRefresh} />
      )}
      {pollResults && (
        <PollResultsModal triggered={pollResults.triggered} results={pollResults.results} onClose={() => setPollResults(null)} />
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, a] = await Promise.all([campaignsApi.getAll(), accountsApi.getAll()]);
      setCampaigns(c);
      setAccounts(a.filter(acc => acc.platform === 'instagram' || acc.platform === 'facebook'));
    } catch (e: any) {
      toast(e.message || 'Failed to load campaigns', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page-wrapper">
      <div className="topbar">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Auto-reply to comments and send DMs based on keywords.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Campaign
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-muted)' }}>Loading campaigns…</div>
      ) : campaigns.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Megaphone size={22} style={{ color: 'var(--color-muted)' }} />
          </div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No campaigns yet</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
            Create a campaign to automatically reply to comments on your posts.
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Campaign
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {campaigns.map(c => (
            <CampaignCard key={c._id} campaign={c} onRefresh={load} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCampaignModal
          accounts={accounts}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
