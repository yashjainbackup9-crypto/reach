'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { Zap, Eye, EyeOff, ArrowRight } from 'lucide-react';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ email: '', username: '', password: '', firstName: '', lastName: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await authApi.login({ email: form.email, password: form.password });
        login(res.accessToken, res.user);
        toast('Welcome back!', 'success');
        router.push('/dashboard');
      } else {
        await authApi.register({
          email: form.email,
          username: form.username,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
        });
        toast('Account created — please sign in', 'success');
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: 'var(--color-canvas)',
    }}>
      {/* Left panel */}
      <div style={{
        background: 'linear-gradient(135deg, #ff385c 0%, #e00b41 60%, #92174d 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'flex-end',
        padding: '64px 56px', color: '#fff',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 360, height: 360, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', top: 60, right: 60, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', bottom: 120, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(0,0,0,0.08)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} color="#fff" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 700 }}>SocialOS</span>
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Your multi-tenant<br />social command centre
          </h1>
          <p style={{ fontSize: 16, opacity: 0.85, lineHeight: 1.6, maxWidth: 360 }}>
            Generate AI-powered brand tones, manage LinkedIn accounts, run Telegram bots, and orchestrate your content queue — all in one place.
          </p>

          <div style={{ display: 'flex', gap: 24, marginTop: 48 }}>
            {[['∞', 'Tones'], ['🤖', 'Bots'], ['🔗', 'Accounts'], ['📋', 'Queue']].map(([icon, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22 }}>{icon}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 56px',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }} className="fade-in">
          {/* Pill tabs */}
          <div className="pill-tabs" style={{ marginBottom: 36, width: 'fit-content' }}>
            <button className={`pill-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); }}>
              Sign in
            </button>
            <button className={`pill-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError(''); }}>
              Create account
            </button>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--color-ink)' }}>
            {mode === 'login' ? 'Welcome back' : 'Get started'}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 32 }}>
            {mode === 'login' ? 'Sign in to your SocialOS workspace' : 'Create your workspace in seconds'}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'register' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">First name</label>
                  <input className="input" placeholder="John" value={form.firstName} onChange={set('firstName')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last name</label>
                  <input className="input" placeholder="Doe" value={form.lastName} onChange={set('lastName')} />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="input" placeholder="john_doe" value={form.username} onChange={set('username')} required />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email address</label>
              <input className="input" type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} required />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Minimum 6 characters"
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={6}
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', lineHeight: 0 }}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#fff0f1', border: '1px solid var(--color-primary-disabled)',
                borderRadius: 'var(--r-sm)', padding: '10px 14px',
                fontSize: 14, color: 'var(--color-error)',
              }}>
                {error}
              </div>
            )}

            <button
              className="btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', marginTop: 8 }}
            >
              {loading ? <div className="spinner" style={{ borderTopColor: '#fff', width: 18, height: 18 }} /> : null}
              {mode === 'login' ? 'Sign in' : 'Create account'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p style={{ fontSize: 12, color: 'var(--color-muted-soft)', marginTop: 24, textAlign: 'center' }}>
            By continuing, you agree to SocialOS Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
