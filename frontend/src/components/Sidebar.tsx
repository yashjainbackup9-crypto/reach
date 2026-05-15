'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Wand2, Users, Bot, ListOrdered, LogOut, Zap, Calendar, History
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const nav = [
  { label: 'Dashboard',      href: '/dashboard',  icon: LayoutDashboard },
  { label: 'Content Studio', href: '/content',     icon: Wand2 },
  { label: 'Accounts',       href: '/accounts',    icon: Users },
  { label: 'Telegram Bots',  href: '/telegram',    icon: Bot },
  { label: 'Content Queue',  href: '/queue',       icon: ListOrdered },
  { label: 'Schedules',      href: '/schedules',   icon: Calendar },
  { label: 'Post History',   href: '/history',     icon: History },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const initials = user
    ? ((user as any).profile?.firstName?.[0] || user.email[0]).toUpperCase()
    : '?';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <Zap size={16} />
        </div>
        <span className="sidebar-logo-text">SocialOS</span>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Menu</div>
        {nav.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-link ${pathname.startsWith(href) ? 'active' : ''}`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div className="user-avatar">{initials}</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.username || 'User'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
        </div>
        <button className="sidebar-link" onClick={logout} style={{ width: '100%', color: 'var(--color-muted)' }}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
