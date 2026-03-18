'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

type Section = 'account' | 'notifications' | 'goals' | 'privacy';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: '56px',
        height: '32px',
        borderRadius: '9999px',
        background: checked ? '#ae89ff' : '#23233c',
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.2s cubic-bezier(0.22,1,0.36,1)',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '4px',
          left: checked ? '28px' : '4px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: '#ffffff',
          transition: 'left 0.2s cubic-bezier(0.22,1,0.36,1)',
          display: 'block',
        }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeSection, setActiveSection] = useState<Section>('account');

  const [notifications, setNotifications] = useState({
    studyReminders: true,
    productUpdates: true,
    weeklyReport: false,
  });

  const [dailyGoal, setDailyGoal] = useState<number>(10);
  const [goalInput, setGoalInput] = useState<string>('10');
  const [goalStatus, setGoalStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [goalLoading, setGoalLoading] = useState(false);

  useEffect(() => {
    fetch('/api/user/settings')
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.dailyGoal === 'number') {
          setDailyGoal(data.dailyGoal);
          setGoalInput(String(data.dailyGoal));
        }
      })
      .catch(() => {});
  }, []);

  const handleGoalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(goalInput, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 200) {
      setGoalStatus({ type: 'error', msg: 'Please enter a number between 1 and 200.' });
      return;
    }
    setGoalLoading(true);
    setGoalStatus(null);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyGoal: parsed }),
      });
      if (res.ok) {
        setDailyGoal(parsed);
        setGoalStatus({ type: 'success', msg: 'Daily goal updated!' });
      } else {
        setGoalStatus({ type: 'error', msg: 'Failed to save. Try again.' });
      }
    } catch {
      setGoalStatus({ type: 'error', msg: 'Network error. Try again.' });
    }
    setGoalLoading(false);
  };

  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [pwStatus, setPwStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPass !== passwords.confirm) {
      setPwStatus({ type: 'error', msg: 'New passwords do not match' });
      return;
    }
    if (passwords.newPass.length < 8) {
      setPwStatus({ type: 'error', msg: 'Password must be at least 8 characters' });
      return;
    }
    setPwLoading(true);
    // Stub — wire to API when available
    await new Promise((r) => setTimeout(r, 800));
    setPwStatus({ type: 'success', msg: 'Password updated successfully' });
    setPasswords({ current: '', newPass: '', confirm: '' });
    setPwLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '16px 20px',
    background: 'rgba(35,35,60,0.4)',
    border: 'none',
    borderRadius: '16px',
    color: '#e5e3ff',
    fontSize: '15px',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'box-shadow 0.2s cubic-bezier(0.22,1,0.36,1)',
  };

  const navItems: { section: Section; icon: string; label: string }[] = [
    { section: 'account', icon: 'person', label: 'Account Details' },
    { section: 'notifications', icon: 'notifications_active', label: 'Notifications' },
    { section: 'goals', icon: 'track_changes', label: 'Study Goals' },
    { section: 'privacy', icon: 'lock', label: 'Privacy & Security' },
  ];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', position: 'relative' }}>

      {/* Ambient bg blobs */}
      <div style={{ position: 'fixed', top: 0, right: 0, width: '600px', height: '600px', background: 'rgba(174,137,255,0.05)', filter: 'blur(120px)', borderRadius: '50%', zIndex: 0, transform: 'translate(50%, -50%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: 0, left: '256px', width: '400px', height: '400px', background: 'rgba(185,195,255,0.05)', filter: 'blur(100px)', borderRadius: '50%', zIndex: 0, transform: 'translate(-50%, 50%)', pointerEvents: 'none' }} />

      {/* Page header */}
      <header style={{ marginBottom: '48px' }}>
        <h2
          style={{
            fontFamily: '"Shrikhand", serif',
            fontStyle: 'italic',
            fontSize: '48px',
            fontWeight: 400,
            color: '#ae89ff',
            margin: '0 0 8px',
            letterSpacing: '-0.02em',
          }}
        >
          Settings
        </h2>
        <p style={{ fontSize: '17px', color: '#aaa8c8', margin: 0 }}>
          Manage your digital study sanctum and preferences.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px', alignItems: 'start', position: 'relative', zIndex: 1 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Profile card */}
          <div style={{ background: '#121222', borderRadius: '32px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Avatar + name */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, #ae89ff 0%, #8348f6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {getInitials(session?.user?.name)}
                </div>
                <button
                  style={{
                    position: 'absolute',
                    bottom: '-8px',
                    right: '-8px',
                    background: '#ae89ff',
                    color: '#2a0066',
                    border: 'none',
                    borderRadius: '12px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    transition: 'transform 0.2s cubic-bezier(0.22,1,0.36,1)',
                  }}
                  onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)'; }}
                  onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                </button>
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#e5e3ff', margin: '0 0 4px' }}>
                  {session?.user?.name ?? 'Scholar'}
                </h3>
                <p style={{ fontSize: '13px', color: '#b9c3ff', fontWeight: 500, margin: 0 }}>Scholar Level 1</p>
              </div>
            </div>

            {/* Settings nav */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {navItems.map(({ section, icon, label }) => {
                const active = activeSection === section;
                return (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: 'none',
                      background: active ? 'rgba(174,137,255,0.1)' : 'transparent',
                      color: active ? '#ae89ff' : '#aaa8c8',
                      fontWeight: active ? 700 : 500,
                      fontSize: '15px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(35,35,60,0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      }
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{icon}</span>
                    {label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sync status card */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(131,72,246,0.2) 0%, rgba(18,18,34,1) 100%)',
              borderRadius: '32px',
              padding: '32px',
              border: '1px solid rgba(174,137,255,0.1)',
            }}
          >
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#e5e3ff', margin: '0 0 8px' }}>Sync Status</h4>
            <p style={{ fontSize: '12px', color: '#aaa8c8', margin: '0 0 16px', lineHeight: 1.6 }}>
              Your knowledge base is synced across your devices.
            </p>
            <div
              style={{
                height: '6px',
                width: '100%',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '9999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: '100%',
                  background: 'linear-gradient(90deg, #ae89ff 0%, #ffde59 100%)',
                  borderRadius: '9999px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Account Security */}
          <section
            style={{
              background: '#18182a',
              borderRadius: '32px',
              padding: '32px',
              display: activeSection === 'account' || activeSection === 'privacy' ? 'flex' : 'none',
              flexDirection: 'column',
              gap: '32px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px', height: '48px', borderRadius: '16px',
                  background: 'rgba(174,137,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span className="material-symbols-outlined" style={{ color: '#ae89ff', fontSize: '24px' }}>fingerprint</span>
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#e5e3ff', margin: 0 }}>Account Security</h3>
            </div>

            {/* Email row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#cbd2ff', paddingLeft: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={session?.user?.email ?? ''}
                  readOnly
                  style={{ ...inputStyle, color: '#aaa8c8' }}
                />
              </div>
              <button
                style={{
                  padding: '16px 24px',
                  background: '#23233c',
                  border: '1px solid rgba(70,69,96,0.3)',
                  borderRadius: '16px',
                  color: '#e5e3ff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#292946'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#23233c'; }}
              >
                Change Email
              </button>
            </div>

            {/* Change Password */}
            <div style={{ paddingTop: '24px', borderTop: '1px solid rgba(70,69,96,0.1)' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#e5e3ff', margin: '0 0 24px' }}>Change Password</h4>
              <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pwStatus && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: pwStatus.type === 'error' ? 'rgba(253,111,133,0.12)' : 'rgba(174,137,255,0.12)',
                      color: pwStatus.type === 'error' ? '#fd6f85' : '#ae89ff',
                      fontSize: '14px',
                    }}
                  >
                    {pwStatus.msg}
                  </div>
                )}
                <input
                  type="password"
                  placeholder="Current Password"
                  value={passwords.current}
                  onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px rgba(174,137,255,0.4)'; }}
                  onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <input
                    type="password"
                    placeholder="New Password"
                    value={passwords.newPass}
                    onChange={(e) => setPasswords((p) => ({ ...p, newPass: e.target.value }))}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px rgba(174,137,255,0.4)'; }}
                    onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px rgba(174,137,255,0.4)'; }}
                    onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={pwLoading}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '14px 32px',
                    background: pwLoading ? '#464560' : '#ae89ff',
                    color: pwLoading ? '#aaa8c8' : '#2a0066',
                    border: 'none',
                    borderRadius: '16px',
                    fontWeight: 700,
                    fontSize: '15px',
                    cursor: pwLoading ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: pwLoading ? 'none' : '0 8px 24px rgba(174,137,255,0.3)',
                    transition: 'transform 0.2s cubic-bezier(0.22,1,0.36,1)',
                  }}
                  onMouseEnter={(e) => { if (!pwLoading) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'; }}
                  onMouseLeave={(e) => { if (!pwLoading) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                  onMouseDown={(e) => { if (!pwLoading) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                >
                  {pwLoading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </div>
          </section>

          {/* Notifications */}
          <section
            style={{
              background: '#18182a',
              borderRadius: '32px',
              padding: '32px',
              display: activeSection === 'notifications' || activeSection === 'account' ? 'flex' : 'none',
              flexDirection: 'column',
              gap: '32px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px', height: '48px', borderRadius: '16px',
                  background: 'rgba(185,195,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span className="material-symbols-outlined" style={{ color: '#b9c3ff', fontSize: '24px' }}>campaign</span>
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#e5e3ff', margin: 0 }}>Notifications</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { key: 'studyReminders' as const, label: 'Study Reminders', desc: 'Get nudged when you fall behind your daily streak.' },
                { key: 'productUpdates' as const, label: 'Product Updates', desc: 'Stay informed about new AI features and beta releases.' },
                { key: 'weeklyReport' as const, label: 'Weekly Scholar Report', desc: 'A detailed breakdown of your learning progress via email.' },
              ].map(({ key, label, desc }) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '24px',
                    padding: '16px',
                    background: '#121222',
                    borderRadius: '16px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#1d1d33'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#121222'; }}
                >
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: '#e5e3ff', margin: '0 0 2px' }}>{label}</p>
                    <p style={{ fontSize: '12px', color: '#aaa8c8', margin: 0 }}>{desc}</p>
                  </div>
                  <Toggle
                    checked={notifications[key]}
                    onChange={(v) => setNotifications((n) => ({ ...n, [key]: v }))}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Study Goals */}
          <section
            style={{
              background: '#18182a',
              borderRadius: '32px',
              padding: '32px',
              display: activeSection === 'goals' ? 'flex' : 'none',
              flexDirection: 'column',
              gap: '32px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px', height: '48px', borderRadius: '16px',
                  background: 'rgba(255,222,89,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span className="material-symbols-outlined" style={{ color: '#ffde59', fontSize: '24px' }}>track_changes</span>
              </div>
              <div>
                <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#e5e3ff', margin: '0 0 4px' }}>Study Goals</h3>
                <p style={{ fontSize: '13px', color: '#aaa8c8', margin: 0 }}>Set the targets that drive your daily learning habit.</p>
              </div>
            </div>

            <form onSubmit={handleGoalSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div
                style={{
                  background: '#121222',
                  borderRadius: '20px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px' }}>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: '#e5e3ff', margin: '0 0 4px' }}>Daily Page Goal</p>
                    <p style={{ fontSize: '13px', color: '#aaa8c8', margin: 0, lineHeight: 1.6 }}>
                      How many pages do you want to write or study each day? Your dashboard progress bar tracks this.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => { const v = Math.max(1, parseInt(goalInput || '0', 10) - 1); setGoalInput(String(v)); }}
                      style={{
                        width: '36px', height: '36px',
                        borderRadius: '10px',
                        background: '#23233c',
                        border: 'none',
                        color: '#ae89ff',
                        fontSize: '20px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#2d2d4a'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#23233c'; }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      style={{
                        width: '72px',
                        padding: '10px',
                        background: 'rgba(35,35,60,0.6)',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#e5e3ff',
                        fontSize: '18px',
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        outline: 'none',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px rgba(174,137,255,0.4)'; }}
                      onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => { const v = Math.min(200, parseInt(goalInput || '0', 10) + 1); setGoalInput(String(v)); }}
                      style={{
                        width: '36px', height: '36px',
                        borderRadius: '10px',
                        background: '#23233c',
                        border: 'none',
                        color: '#ae89ff',
                        fontSize: '20px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#2d2d4a'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#23233c'; }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Quick presets */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[5, 10, 20, 30, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setGoalInput(String(preset))}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '9999px',
                        border: 'none',
                        background: parseInt(goalInput, 10) === preset ? '#ae89ff' : '#23233c',
                        color: parseInt(goalInput, 10) === preset ? '#2a0066' : '#aaa8c8',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >
                      {preset} pages
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    flex: 1,
                    height: '8px',
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, (dailyGoal / 50) * 100)}%`,
                      background: 'linear-gradient(90deg, #ae89ff 0%, #ffde59 100%)',
                      borderRadius: '9999px',
                      transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)',
                    }}
                  />
                </div>
                <span style={{ fontSize: '12px', color: '#aaa8c8', flexShrink: 0 }}>
                  Current: {dailyGoal} pages/day
                </span>
              </div>

              {goalStatus && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: goalStatus.type === 'error' ? 'rgba(253,111,133,0.12)' : 'rgba(174,137,255,0.12)',
                    color: goalStatus.type === 'error' ? '#fd6f85' : '#ae89ff',
                    fontSize: '14px',
                  }}
                >
                  {goalStatus.msg}
                </div>
              )}

              <button
                type="submit"
                disabled={goalLoading}
                style={{
                  alignSelf: 'flex-start',
                  padding: '14px 32px',
                  background: goalLoading ? '#464560' : '#ae89ff',
                  color: goalLoading ? '#aaa8c8' : '#2a0066',
                  border: 'none',
                  borderRadius: '16px',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: goalLoading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: goalLoading ? 'none' : '0 8px 24px rgba(174,137,255,0.3)',
                  transition: 'transform 0.2s cubic-bezier(0.22,1,0.36,1)',
                }}
                onMouseEnter={(e) => { if (!goalLoading) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'; }}
                onMouseLeave={(e) => { if (!goalLoading) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
              >
                {goalLoading ? 'Saving…' : 'Save Goal'}
              </button>
            </form>
          </section>

          {/* Danger Zone */}
          <section
            style={{
              background: 'rgba(138,22,50,0.05)',
              borderRadius: '32px',
              padding: '32px',
              border: '1px solid rgba(253,111,133,0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px', height: '48px', borderRadius: '16px',
                  background: 'rgba(253,111,133,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span className="material-symbols-outlined" style={{ color: '#fd6f85', fontSize: '24px' }}>dangerous</span>
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#fd6f85', margin: 0 }}>Danger Zone</h3>
            </div>
            <div
              style={{
                background: 'rgba(138,22,50,0.1)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <p style={{ fontSize: '14px', color: 'rgba(255,151,163,0.8)', lineHeight: 1.7, margin: 0 }}>
                Once you delete your account, there is no going back. All your study notebooks, flashcards, and progress history will be permanently erased from our neon scrolls.
              </p>
              <button
                style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 40px',
                  background: '#c8475d',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '16px',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 20px rgba(253,111,133,0.2)',
                  transition: 'background 0.2s cubic-bezier(0.22,1,0.36,1), transform 0.2s cubic-bezier(0.22,1,0.36,1)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#fd6f85';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#c8475d';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                }}
                onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete_forever</span>
                Delete Account
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
