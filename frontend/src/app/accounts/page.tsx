'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { accountsApi, Account } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  Briefcase, X, Eye, EyeOff, Key, AtSign, Info,
  RefreshCw,
  ExternalLink,
  Users,
  Unlink,
  ShieldCheck,
  Link2,
} from 'lucide-react';

// Inline Instagram icon (lucide-react version doesn't include Instagram)
const InstagramIcon = ({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

export const FacebookIcon = ({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const INSTAGRAM_COLOR = '#E1306C';
const INSTAGRAM_GRADIENT = 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [igConnecting, setIgConnecting] = useState(false);
  const [fbConnecting, setFbConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAccounts = useCallback(async () => {
    try { setAccounts(await accountsApi.getAll()); }
    catch { toast('Failed to load accounts', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // Listen for postMessage from the OAuth popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'LINKEDIN_CONNECTED') {
        toast('LinkedIn account connected!', 'success');
        fetchAccounts();
      } else if (event.data?.type === 'LINKEDIN_ERROR') {
        toast(event.data.error || 'LinkedIn connection failed', 'error');
      }

      if (event.data?.type === 'INSTAGRAM_CONNECTED') {
        toast('Instagram account(s) connected!', 'success');
        fetchAccounts();
      } else if (event.data?.type === 'INSTAGRAM_ERROR') {
        toast(event.data.error || 'Instagram connection failed', 'error');
      }

      if (event.data?.type === 'FACEBOOK_CONNECTED') {
        toast('Facebook Page(s) connected!', 'success');
        fetchAccounts();
      } else if (event.data?.type === 'FACEBOOK_ERROR') {
        toast(event.data.error || 'Facebook connection failed', 'error');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchAccounts, toast]);

  const handleConnectLinkedIn = async () => {
    setConnecting(true);
    try {
      const { authUrl, state } = await accountsApi.linkedin.getAuthUrl();
      sessionStorage.setItem('linkedin_oauth_state', state);
      const popup = window.open(authUrl, 'linkedin-oauth', 'width=600,height=700,noopener=0');
      if (!popup) {
        toast('Popup blocked — please allow popups for this site and try again', 'error');
        return;
      }
      toast('Authorize LinkedIn in the popup window', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setConnecting(false); }
  };

  const handleConnectInstagram = async () => {
    setIgConnecting(true);
    try {
      const { authUrl, state } = await accountsApi.instagram.getAuthUrl();
      sessionStorage.setItem('instagram_oauth_state', state);
      const popup = window.open(authUrl, 'instagram-oauth', 'width=600,height=700,noopener=0');
      if (!popup) {
        toast('Popup blocked — please allow popups for this site and try again', 'error');
        return;
      }
      toast('Authorize Instagram via Facebook in the popup window', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setIgConnecting(false); }
  };

  const handleConnectFacebook = async () => {
    setFbConnecting(true);
    try {
      const { authUrl, state } = await accountsApi.facebook.getAuthUrl();
      sessionStorage.setItem('facebook_oauth_state', state);
      const popup = window.open(authUrl, 'facebook-oauth', 'width=600,height=700,noopener=0');
      if (!popup) {
        toast('Popup blocked — please allow popups for this site and try again', 'error');
        return;
      }
      toast('Authorize Facebook in the popup window', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setFbConnecting(false); }
  };

  const handleDisconnect = async (id: string, name: string, platform: string) => {
    if (!confirm(`Disconnect "${name}"?`)) return;
    setDisconnecting(id);
    try {
      if (platform === 'instagram') {
        await accountsApi.instagram.disconnect(id);
      } else if (platform === 'facebook') {
        await accountsApi.facebook.disconnect(id);
      } else {
        await accountsApi.linkedin.disconnect(id);
      }
      await fetchAccounts();
      toast('Account disconnected', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setDisconnecting(null); }
  };

  const linkedInAccounts = accounts.filter(a => a.platform === 'linkedin');
  const instagramAccounts = accounts.filter(a => a.platform === 'instagram');
  const facebookAccounts = accounts.filter(a => a.platform === 'facebook');

  const platformMeta: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    linkedin: { color: '#0a66c2', bg: '#e8f1fb', icon: <Briefcase size={18} color="#0a66c2" /> },
    instagram: {
      color: INSTAGRAM_COLOR,
      bg: '#fce4ec',
      icon: <InstagramIcon size={18} color={INSTAGRAM_COLOR} />,
    },
    facebook: {
      color: '#1877f2',
      bg: '#e7f3ff',
      icon: <FacebookIcon size={18} color="#1877f2" />,
    },
  };

  return (
    <div className="fade-in">
      <div className="topbar">
        <div>
          <h1 className="page-title">Connected Accounts</h1>
          <p className="page-subtitle">Manage your social media integrations across platforms.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost btn-sm" onClick={fetchAccounts}><RefreshCw size={14} /> Refresh</button>
          <button className="btn-primary btn-sm" onClick={handleConnectLinkedIn} disabled={connecting}>
            {connecting ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> : <Link2 size={14} />}
            Connect LinkedIn
          </button>
          <button
            className="btn-sm"
            onClick={handleConnectInstagram}
            disabled={igConnecting}
            style={{
              background: INSTAGRAM_GRADIENT, color: '#fff', border: 'none',
              borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: igConnecting ? 'not-allowed' : 'pointer',
              opacity: igConnecting ? 0.7 : 1
            }}
          >
            {igConnecting ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> : <InstagramIcon size={14} color="#fff" />}
            Connect Instagram
          </button>
          <button
            className="btn-sm"
            onClick={handleConnectFacebook}
            disabled={fbConnecting}
            style={{
              background: '#1877f2', color: '#fff', border: 'none',
              borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: fbConnecting ? 'not-allowed' : 'pointer',
              opacity: fbConnecting ? 0.7 : 1
            }}
          >
            {fbConnecting ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> : <FacebookIcon size={14} color="#fff" />}
            Connect Facebook
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--r-md)', padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <ShieldCheck size={18} color="#64748b" style={{ flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>OAuth-based Connections</p>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>We use official OAuth flows for all platforms. Your credentials are never shared with us, only a secure access token is stored.</p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state" style={{ paddingTop: 80 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : accounts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-surface-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Users size={32} color="var(--color-muted-soft)" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No accounts connected</h2>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 28, maxWidth: 400, margin: '0 auto 28px', lineHeight: 1.6 }}>
            Connect your LinkedIn or Instagram accounts to start managing content and automating posts across platforms.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleConnectInstagram}
              disabled={igConnecting}
              style={{
                background: INSTAGRAM_GRADIENT, color: '#fff', border: 'none',
                borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', fontWeight: 600, fontSize: 14, cursor: igConnecting ? 'not-allowed' : 'pointer',
              }}
            >
              <InstagramIcon size={16} color="#fff" /> Connect Instagram
            </button>
            <button
              onClick={handleConnectFacebook}
              disabled={fbConnecting}
              style={{
                background: '#1877f2', color: '#fff', border: 'none',
                borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', fontWeight: 600, fontSize: 14, cursor: fbConnecting ? 'not-allowed' : 'pointer',
              }}
            >
              <FacebookIcon size={16} color="#fff" /> Connect Facebook
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* LinkedIn accounts */}
          {linkedInAccounts.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Briefcase size={14} color="#0a66c2" />
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted-soft)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  LinkedIn · {linkedInAccounts.length} account{linkedInAccounts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {linkedInAccounts.map((account) => renderAccountCard(account, platformMeta, disconnecting, handleDisconnect))}
              </div>
            </section>
          )}

          {/* Instagram accounts */}
          {instagramAccounts.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <InstagramIcon size={14} color={INSTAGRAM_COLOR} />
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted-soft)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Instagram · {instagramAccounts.length} account{instagramAccounts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {instagramAccounts.map((account) => renderAccountCard(account, platformMeta, disconnecting, handleDisconnect))}
              </div>
            </section>
          )}

          {/* Facebook accounts */}
          {facebookAccounts.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <FacebookIcon size={14} color="#1877f2" />
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted-soft)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Facebook · {facebookAccounts.length} Page{facebookAccounts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {facebookAccounts.map((account) => renderAccountCard(account, platformMeta, disconnecting, handleDisconnect))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function renderAccountCard(
  account: Account,
  platformMeta: Record<string, { color: string; bg: string; icon: React.ReactNode }>,
  disconnecting: string | null,
  handleDisconnect: (id: string, name: string, platform: string) => void,
) {
  const meta = platformMeta[account.platform] || { color: '#929292', bg: 'var(--color-surface-strong)', icon: <Users size={18} /> };
  const isInstagram = account.platform === 'instagram';
  const IG_GRADIENT = 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)';
  const InstagramIcon = ({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );

  return (
    <div key={account._id} className="card-hover" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 'var(--r-sm)',
        background: isInstagram ? IG_GRADIENT : meta.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        {isInstagram ? <InstagramIcon size={20} color="#fff" /> : meta.icon}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{account.profileName}</span>
          <span className="badge badge-success">Connected</span>
          {account.username && (
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>@{account.username}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--color-muted)', textTransform: 'capitalize' }}>{account.platform}</span>
          {isInstagram && account.supportedPostTypes && (
            <>
              <span style={{ color: 'var(--color-hairline)' }}>·</span>
              {account.supportedPostTypes.map((t) => (
                <span key={t} style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 7px',
                  borderRadius: 20, background: '#fce4ec', color: '#c2185b', textTransform: 'capitalize'
                }}>{t}</span>
              ))}
            </>
          )}
          {account.profileUrl && (
            <>
              <span style={{ color: 'var(--color-hairline)' }}>·</span>
              <a href={account.profileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: meta.color, display: 'flex', alignItems: 'center', gap: 3 }}>
                View profile <ExternalLink size={11} />
              </a>
            </>
          )}
        </div>
      </div>
      <button
        className="btn-danger btn-sm"
        onClick={() => handleDisconnect(account._id, account.profileName, account.platform)}
        disabled={disconnecting === account._id}
      >
        {disconnecting === account._id ? <div className="spinner" style={{ width: 13, height: 13 }} /> : <Unlink size={14} />}
        Disconnect
      </button>
    </div>
  );
}
