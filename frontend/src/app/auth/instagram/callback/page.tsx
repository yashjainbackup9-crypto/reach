'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const oauthError = searchParams.get('error');
    const oauthErrorDesc = searchParams.get('error_description');

    console.debug('[Instagram callback] received', { code: !!code, state, oauthError });

    if (oauthError) {
      const msg = oauthErrorDesc || oauthError;
      console.error('[Instagram callback] OAuth error:', msg);
      setErrorMsg(`Facebook denied access: ${msg}`);
      setStatus('error');
      notifyParent({ type: 'INSTAGRAM_ERROR', error: msg });
      return;
    }

    if (!code || !state) {
      const msg = 'Missing code or state in callback URL';
      console.error('[Instagram callback]', msg);
      setErrorMsg(msg);
      setStatus('error');
      notifyParent({ type: 'INSTAGRAM_ERROR', error: msg });
      return;
    }

    const storedState = sessionStorage.getItem('instagram_oauth_state');
    console.debug('[Instagram callback] state validation', { state, storedState });

    if (!storedState || state !== storedState) {
      const msg = 'Invalid OAuth state — possible CSRF. Please retry.';
      console.error('[Instagram callback]', msg);
      setErrorMsg(msg);
      setStatus('error');
      notifyParent({ type: 'INSTAGRAM_ERROR', error: msg });
      return;
    }

    sessionStorage.removeItem('instagram_oauth_state');

    const token = localStorage.getItem('token');
    if (!token) {
      const msg = 'Not authenticated — please log in first';
      setErrorMsg(msg);
      setStatus('error');
      notifyParent({ type: 'INSTAGRAM_ERROR', error: msg });
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    console.debug('[Instagram callback] exchanging code with backend', apiUrl);

    fetch(`${apiUrl}/api/accounts/instagram/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code, state }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `Backend error ${res.status}`);
        return data;
      })
      .then((data) => {
        console.debug('[Instagram callback] account connected');
        setStatus('success');
        notifyParent({ type: 'INSTAGRAM_CONNECTED' });
        setTimeout(() => {
          if (window.opener) {
            window.close();
          } else {
            router.replace('/accounts');
          }
        }, 1800);
      })
      .catch((err: Error) => {
        console.error('[Instagram callback] backend error:', err.message);
        setErrorMsg(err.message);
        setStatus('error');
        notifyParent({ type: 'INSTAGRAM_ERROR', error: err.message });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {status === 'loading' && (
          <>
            <Spinner />
            <h2 style={styles.title}>Connecting Instagram…</h2>
            <p style={styles.sub}>Exchanging authorization code with Meta.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={styles.iconSuccess}>✓</div>
            <h2 style={styles.title}>Instagram Connected!</h2>
            <p style={styles.sub}>Your accounts have been linked. {window.opener ? 'This window will close.' : 'Redirecting…'}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={styles.iconError}>✕</div>
            <h2 style={styles.title}>Connection Failed</h2>
            <p style={styles.errorMsg}>{errorMsg}</p>
            <button
              style={styles.btn}
              onClick={() => {
                if (window.opener) window.close();
                else router.replace('/accounts');
              }}
            >
              {window.opener ? 'Close window' : 'Back to Accounts'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function notifyParent(msg: Record<string, string>) {
  if (typeof window !== 'undefined' && window.opener) {
    try {
      window.opener.postMessage(msg, window.location.origin);
    } catch {
      // opener may be cross-origin or closed
    }
  }
}

function Spinner() {
  return (
    <div style={{
      width: 40, height: 40, border: '3px solid #fce4ec',
      borderTop: '3px solid #E1306C', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite', margin: '0 auto 20px',
    }} />
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#fff0f3',
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '48px 40px',
    boxShadow: '0 4px 24px rgba(225, 48, 108, 0.12)', textAlign: 'center',
    maxWidth: 400, width: '90%',
  },
  title: { fontSize: 22, fontWeight: 700, color: '#2d3748', margin: '0 0 10px' },
  sub: { fontSize: 14, color: '#718096', margin: 0 },
  errorMsg: { fontSize: 14, color: '#e53e3e', margin: '0 0 20px' },
  iconSuccess: {
    width: 52, height: 52, borderRadius: '50%', background: '#c6f6d5',
    color: '#38a169', fontSize: 24, fontWeight: 700, display: 'flex',
    alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
  },
  iconError: {
    width: 52, height: 52, borderRadius: '50%', background: '#fed7d7',
    color: '#e53e3e', fontSize: 24, fontWeight: 700, display: 'flex',
    alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
  },
  btn: {
    padding: '10px 24px', background: '#E1306C', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },
};

export default function InstagramCallbackPage() {
  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Suspense fallback={
        <div style={styles.page}>
          <div style={styles.card}>
            <Spinner />
            <h2 style={styles.title}>Loading…</h2>
          </div>
        </div>
      }>
        <CallbackContent />
      </Suspense>
    </>
  );
}
