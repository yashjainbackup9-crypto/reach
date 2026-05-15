'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Zap } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: 'var(--color-surface-soft)'
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Zap size={22} color="#fff" />
        </div>
        <div className="spinner" style={{ width: 28, height: 28 }} />
        <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Loading SocialOS…</p>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
