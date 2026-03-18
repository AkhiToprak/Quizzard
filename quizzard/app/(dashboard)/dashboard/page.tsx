'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RecentItem {
  id: string;
  name: string;
  subject?: string | null;
  color?: string | null;
  updatedAt: string;
  pageCount: number;
}

interface DashboardData {
  dailyGoal: number;
  todayPages: number;
  recentActivity: RecentItem[];
}

interface StatCard {
  label: string;
  value: string;
  icon: string;
  iconFilled?: boolean;
  iconColor: string;
  iconBg: string;
  badge?: React.ReactNode;
  arrowColor: string;
  href?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function getActivityStyle(subject?: string | null) {
  const s = (subject ?? '').toLowerCase();
  if (s.includes('sci') || s.includes('chem') || s.includes('bio') || s.includes('phys'))
    return { icon: 'science', iconBg: 'rgba(185,195,255,0.2)', iconColor: '#b9c3ff' };
  if (s.includes('hist') || s.includes('social') || s.includes('geo'))
    return { icon: 'history_edu', iconBg: 'rgba(174,137,255,0.2)', iconColor: '#ae89ff' };
  if (s.includes('math') || s.includes('calc') || s.includes('stat'))
    return { icon: 'calculate', iconBg: 'rgba(240,208,76,0.2)', iconColor: '#f0d04c' };
  if (s.includes('lang') || s.includes('english') || s.includes('lit') || s.includes('writ'))
    return { icon: 'menu_book', iconBg: 'rgba(174,137,255,0.15)', iconColor: '#ae89ff' };
  return { icon: 'auto_stories', iconBg: 'rgba(174,137,255,0.15)', iconColor: '#ae89ff' };
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [notebookCount, setNotebookCount] = useState<number | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch('/api/notebooks')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setNotebookCount(data.length); })
      .catch(() => {});

    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((data) => { if (data?.dailyGoal !== undefined) setDashboard(data); })
      .catch(() => {});
  }, []);

  const goalProgress = dashboard
    ? Math.min(100, Math.round((dashboard.todayPages / dashboard.dailyGoal) * 100))
    : 0;

  const statCards: StatCard[] = [
    {
      label: 'Notebooks',
      value: notebookCount !== null ? String(notebookCount) : '—',
      icon: 'auto_stories',
      iconColor: '#ae89ff',
      iconBg: 'rgba(174,137,255,0.1)',
      arrowColor: 'rgba(174,137,255,0.4)',
      href: '/notebooks',
    },
    {
      label: 'Quizzes Taken',
      value: '—',
      icon: 'psychology',
      iconColor: '#b9c3ff',
      iconBg: 'rgba(185,195,255,0.1)',
      arrowColor: 'rgba(185,195,255,0.4)',
    },
    {
      label: 'Flashcards',
      value: '—',
      icon: 'bolt',
      iconColor: '#f0d04c',
      iconBg: 'rgba(240,208,76,0.1)',
      arrowColor: 'rgba(240,208,76,0.4)',
    },
    {
      label: 'Day Streak',
      value: '—',
      icon: 'local_fire_department',
      iconFilled: true,
      iconColor: '#fd6f85',
      iconBg: 'rgba(253,111,133,0.1)',
      arrowColor: 'rgba(253,111,133,0.4)',
      badge: (
        <div
          style={{
            padding: '2px 8px',
            background: 'rgba(138,22,50,0.2)',
            borderRadius: '8px',
            fontSize: '10px',
            fontWeight: 700,
            color: '#fd6f85',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Hot
        </div>
      ),
    },
  ];

  const recentActivity = dashboard?.recentActivity ?? [];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Stats Row */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '24px',
        }}
      >
        {statCards.map(({ label, value, icon, iconFilled, iconColor, iconBg, badge, arrowColor, href }) => {
          const inner = (
            <div
              style={{
                background: '#121222',
                padding: '24px',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                cursor: href ? 'pointer' : 'default',
                transition: 'background 0.3s cubic-bezier(0.22,1,0.36,1)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = '#18182a';
                const arrow = (e.currentTarget as HTMLDivElement).querySelector<HTMLSpanElement>('.stat-arrow');
                if (arrow) arrow.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = '#121222';
                const arrow = (e.currentTarget as HTMLDivElement).querySelector<HTMLSpanElement>('.stat-arrow');
                if (arrow) arrow.style.transform = 'translateX(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '48px', height: '48px', borderRadius: '16px',
                    background: iconBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: '28px',
                      color: iconColor,
                      fontVariationSettings: iconFilled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : undefined,
                    }}
                  >
                    {icon}
                  </span>
                </div>
                {badge || (
                  <span
                    className="material-symbols-outlined stat-arrow"
                    style={{ color: arrowColor, fontSize: '22px', transition: 'transform 0.2s cubic-bezier(0.22,1,0.36,1)' }}
                  >
                    arrow_forward
                  </span>
                )}
              </div>
              <h3 style={{ fontFamily: '"Shrikhand", serif', fontStyle: 'italic', fontSize: '30px', fontWeight: 400, color: '#e5e3ff', margin: '0 0 4px', lineHeight: 1 }}>
                {value}
              </h3>
              <p style={{ fontSize: '15px', fontWeight: 500, color: '#aaa8c8', margin: 0 }}>{label}</p>
            </div>
          );

          return href ? (
            <Link key={label} href={href} style={{ textDecoration: 'none' }}>{inner}</Link>
          ) : (
            <div key={label}>{inner}</div>
          );
        })}
      </section>

      {/* Bento grid */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>

          {/* Recent Activity */}
          <div
            style={{
              background: '#18182a',
              borderRadius: '32px',
              padding: '32px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e5e3ff', margin: '0 0 4px' }}>Recent Activity</h2>
                <p style={{ fontSize: '13px', color: '#aaa8c8', margin: 0 }}>Pick up where you left off</p>
              </div>
              <Link
                href="/notebooks"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ae89ff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'none',
                }}
              >
                View all
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_right</span>
              </Link>
            </div>

            {recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#aaa8c8' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '12px', opacity: 0.4 }}>
                  history
                </span>
                <p style={{ fontSize: '14px', margin: 0 }}>
                  {dashboard === null ? 'Loading…' : 'No notebooks yet — create one to get started.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentActivity.map((item) => {
                  const style = getActivityStyle(item.subject);
                  return (
                    <Link
                      key={item.id}
                      href={`/notebooks/${item.id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px',
                          borderRadius: '16px',
                          background: '#121222',
                          transition: 'background 0.2s cubic-bezier(0.22,1,0.36,1)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = '#23233c';
                          const btn = (e.currentTarget as HTMLDivElement).querySelector<HTMLButtonElement>('.activity-btn');
                          if (btn) { btn.style.background = '#ae89ff'; btn.style.color = '#2a0066'; }
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = '#121222';
                          const btn = (e.currentTarget as HTMLDivElement).querySelector<HTMLButtonElement>('.activity-btn');
                          if (btn) { btn.style.background = '#23233c'; btn.style.color = '#ae89ff'; }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '48px', height: '48px', borderRadius: '14px',
                              background: style.iconBg,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, color: style.iconColor,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{style.icon}</span>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#e5e3ff', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.name}
                            </h4>
                            <p style={{ fontSize: '12px', color: '#aaa8c8', margin: 0 }}>
                              {timeAgo(item.updatedAt)} · {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}
                            </p>
                          </div>
                        </div>
                        <button
                          className="activity-btn"
                          style={{
                            padding: '8px 16px',
                            background: '#23233c',
                            borderRadius: '12px',
                            border: 'none',
                            color: '#ae89ff',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            flexShrink: 0,
                            marginLeft: '16px',
                            transition: 'background 0.2s cubic-bezier(0.22,1,0.36,1), color 0.2s cubic-bezier(0.22,1,0.36,1)',
                          }}
                        >
                          Open
                        </button>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Daily Goal */}
          <div
            style={{
              background: 'linear-gradient(135deg, #8348f6 0%, #001971 100%)',
              borderRadius: '32px',
              padding: '32px',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ marginBottom: 'auto' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '9999px',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '16px',
                }}
              >
                Daily Goal
              </span>
              <h2
                style={{
                  fontFamily: '"Shrikhand", serif',
                  fontStyle: 'italic',
                  fontSize: '30px',
                  fontWeight: 400,
                  margin: '0 0 16px',
                  lineHeight: 1.1,
                }}
              >
                {goalProgress >= 100 ? 'Goal Complete!' : 'Keep Writing'}
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.7', margin: '0 0 32px' }}>
                {dashboard === null
                  ? 'Loading your progress…'
                  : goalProgress >= 100
                  ? `You wrote ${dashboard.todayPages} pages today. Amazing work — you hit your daily target!`
                  : `${dashboard.todayPages} of ${dashboard.dailyGoal} pages written today. ${dashboard.dailyGoal - dashboard.todayPages} more to reach your goal.`}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '8px',
                  }}
                >
                  <span>Progress</span>
                  <span>{goalProgress}%</span>
                </div>
                <div
                  style={{
                    height: '12px',
                    width: '100%',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${goalProgress}%`,
                      background: '#ffde59',
                      borderRadius: '9999px',
                      boxShadow: goalProgress > 0 ? '0 0 15px rgba(255,222,89,0.5)' : 'none',
                      transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
                    }}
                  />
                </div>
              </div>
              <Link
                href="/notebooks"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '16px',
                  background: '#ffffff',
                  color: '#8348f6',
                  borderRadius: '16px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'center',
                  textDecoration: 'none',
                  boxSizing: 'border-box',
                  transition: 'background 0.2s cubic-bezier(0.22,1,0.36,1), color 0.2s cubic-bezier(0.22,1,0.36,1)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = '#ffde59';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#5f4f00';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = '#ffffff';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#8348f6';
                }}
              >
                {goalProgress >= 100 ? 'Keep Going' : 'Start Writing'}
              </Link>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0, textAlign: 'center' }}>
                Change target in{' '}
                <Link href="/settings" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }}>
                  Settings
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Empty state / CTA — only show if no notebooks */}
      {dashboard !== null && notebookCount === 0 && (
        <section
          style={{
            border: '2px dashed rgba(70,69,96,0.2)',
            borderRadius: '32px',
            padding: '48px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '80px', height: '80px',
              background: '#1d1d33',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '24px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: '#aaa8c8' }}>library_add</span>
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#e5e3ff', margin: '0 0 8px' }}>Feeling Inspired?</h3>
          <p style={{ fontSize: '14px', color: '#aaa8c8', margin: '0 0 32px', maxWidth: '380px', lineHeight: '1.7' }}>
            No notebooks yet. Create your first one to get started on your neon scholar journey.
          </p>
          <Link
            href="/notebooks"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '12px 32px',
              background: '#ae89ff', color: '#2a0066',
              borderRadius: '12px', fontWeight: 700, fontSize: '15px', textDecoration: 'none',
              transition: 'transform 0.2s cubic-bezier(0.22,1,0.36,1)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
            Create Notebook
          </Link>
        </section>
      )}
    </div>
  );
}
