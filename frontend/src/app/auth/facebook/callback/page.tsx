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

    console.debug('[Facebook callback] received', { code: !!code, state, oauthError });

    if (oauthError) {
      const msg = oauthErrorDesc || oauthError;
      console.error('[Facebook callback] OAuth error:', msg);
      setErrorMsg(`Facebook denied access: ${msg}`);
      setStatus('error');
      notifyParent({ type: 'FACEBOOK_ERROR', error: msg });
      return;
    }

    if (!code || !state) {
      const msg = 'Missing code or state in callback URL';
      console.error('[Facebook callback]', msg);
      setErrorMsg(msg);
      setStatus('error');
      notifyParent({ type: 'FACEBOOK_ERROR', error: msg });
      return;
    }

    const storedState = sessionStorage.getItem('facebook_oauth_state');
    console.debug('[Facebook callback] state validation', { state, storedState });

    if (!storedState || state !== storedState) {
      const msg = 'Invalid OAuth state — possible CSRF. Please retry.';
      console.error('[Facebook callback]', msg);
      setErrorMsg(msg);
      setStatus('error');
      notifyParent({ type: 'FACEBOOK_ERROR', error: msg });
      return;
    }

    sessionStorage.removeItem('facebook_oauth_state');

    const token = localStorage.getItem('token');
    if (!token) {
      const msg = 'Not authenticated — please log in first';
      setErrorMsg(msg);
      setStatus('error');
      notifyParent({ type: 'FACEBOOK_ERROR', error: msg });
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    console.debug('[Facebook callback] exchanging code with backend', apiUrl);

    fetch(`${apiUrl}/api/accounts/facebook/callback`, {
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
        console.debug('[Facebook callback] account connected');
        setStatus('success');
        notifyParent({ type: 'FACEBOOK_CONNECTED' });
        setTimeout(() => {
          if (window.opener) {
            window.close();
          } else {
            router.replace('/accounts');
          }
        }, 1800);
      })
      .catch((err: Error) => {
        console.error('[Facebook callback] backend error:', err.message);
        setErrorMsg(err.message);
        setStatus('error');
        notifyParent({ type: 'FACEBOOK_ERROR', error: err.message });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {status === 'loading' && (
          <>
            <Spinner />
            <h2 style={styles.title}>Connecting Facebook…</h2>
            <p style={styles.sub}>Exchanging authorization code with Meta.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={styles.iconSuccess}>✓</div>
            <h2 style={styles.title}>Facebook Connected!</h2>
            <p style={styles.sub}>Your Pages have been linked. {window.opener ? 'This window will close.' : 'Redirecting…'}</p>
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
      width: 40, height: 40, border: '3px solid #e7f3ff',
      borderTop: '3px solid #1877f2', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite', margin: '0 auto 20px',
    }} />
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#f0f2f5',
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '48px 40px',
    boxShadow: '0 4px 24px rgba(24, 119, 242, 0.12)', textAlign: 'center',
    maxWidth: 400, width: '90%',
  },
  title: { fontSize: 22, fontWeight: 700, color: '#1c1e21', margin: '0 0 10px' },
  sub: { fontSize: 14, color: '#65676b', margin: 0 },
  errorMsg: { fontSize: 14, color: '#fa3e3e', margin: '0 0 20px' },
  iconSuccess: {
    width: 52, height: 52, borderRadius: '50%', background: '#e7f3ff',
    color: '#1877f2', fontSize: 24, fontWeight: 700, display: 'flex',
    alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
  },
  iconError: {
    width: 52, height: 52, borderRadius: '50%', background: '#ffebe9',
    color: '#fa3e3e', fontSize: 24, fontWeight: 700, display: 'flex',
    alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
  },
  btn: {
    padding: '10px 24px', background: '#1877f2', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },
};

export default function FacebookCallbackPage() {
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
