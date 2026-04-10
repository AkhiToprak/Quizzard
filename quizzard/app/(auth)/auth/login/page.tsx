'use client';

import { signIn } from 'next-auth/react';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes('ACCOUNT_LOCKED:')) {
          const unlockAt = new Date(result.error.split('ACCOUNT_LOCKED:')[1]);
          const timeStr = unlockAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setError(
            `Your account has been locked due to too many failed login attempts. It will be unlocked at ${timeStr}.`
          );
        } else {
          setError('Invalid email or password');
        }
      } else if (result?.ok) {
        router.push('/home');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '16px 16px 16px 44px',
    background: '#23233c',
    border: 'none',
    borderRadius: '16px',
    color: '#e5e3ff',
    fontSize: '15px',
    fontFamily: 'inherit',
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'box-shadow 0.2s cubic-bezier(0.22,1,0.36,1)',
  };

  return (
    <>
      {/* Logo + heading */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '40px',
        }}
      >
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(174,137,255,0.2)',
              filter: 'blur(24px)',
              borderRadius: '50%',
            }}
          />
          <Image
            src="/logo_trimmed.png"
            alt="Notemage"
            width={96}
            height={96}
            style={{ objectFit: 'contain', position: 'relative' }}
            priority
          />
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '48px',
            fontWeight: 400,
            color: '#ae89ff',
            margin: '0 0 8px',
            letterSpacing: '-0.02em',
          }}
        >
          Welcome back
        </h1>
        <p style={{ color: '#aaa8c8', fontSize: '17px', margin: 0 }}>
          Continue your quest for knowledge.
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          background: '#121222',
          borderRadius: '32px',
          padding: '40px',
          boxShadow: '0 32px 64px -12px rgba(0,0,0,0.5)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top gradient line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '1px',
            background:
              'linear-gradient(90deg, transparent 0%, rgba(174,137,255,0.4) 50%, transparent 100%)',
          }}
        />

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(253,111,133,0.12)',
              color: '#fd6f85',
              fontSize: '14px',
              marginBottom: '24px',
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
        >
          {/* Email */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 700,
                color: '#b9c3ff',
                marginBottom: '8px',
                paddingLeft: '4px',
              }}
            >
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  paddingLeft: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  color: '#737390',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  mail
                </span>
              </div>
              <input
                type="email"
                placeholder="mage@notemage.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.boxShadow = '0 0 0 2px rgba(174,137,255,0.4)';
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 700,
                color: '#b9c3ff',
                marginBottom: '8px',
                paddingLeft: '4px',
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  paddingLeft: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  color: '#737390',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  lock
                </span>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{ ...inputStyle, paddingRight: '48px' }}
                onFocus={(e) => {
                  e.target.style.boxShadow = '0 0 0 2px rgba(174,137,255,0.4)';
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  paddingRight: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: '#737390',
                  cursor: 'pointer',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <a
                href="#"
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#c1a4ff',
                  textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
              >
                Forgot Password?
              </a>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading ? '#464560' : 'linear-gradient(135deg, #ae89ff 0%, #884efb 100%)',
              border: 'none',
              borderRadius: '16px',
              color: loading ? '#aaa8c8' : '#2a0066',
              fontSize: '17px',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: loading ? 'none' : '0 8px 24px rgba(174,137,255,0.25)',
              transition:
                'transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s cubic-bezier(0.22,1,0.36,1)',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 12px 32px rgba(174,137,255,0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 8px 24px rgba(174,137,255,0.25)';
              }
            }}
            onMouseDown={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
            }}
          >
            {loading ? 'Signing in…' : 'Log In'}
            {!loading && (
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                auto_awesome
              </span>
            )}
          </button>
        </form>
      </div>

      {/* Waitlist link */}
      <p
        style={{
          marginTop: '32px',
          textAlign: 'center',
          color: '#aaa8c8',
          fontSize: '15px',
        }}
      >
        Don&apos;t have an account?{' '}
        <Link
          href="/auth/register"
          style={{ color: '#ffde59', fontWeight: 900, textDecoration: 'none' }}
        >
          Sign Up
        </Link>
      </p>

      {/* Footer */}
      <div
        style={{
          marginTop: '48px',
          display: 'flex',
          justifyContent: 'center',
          gap: '32px',
        }}
      >
        {['Privacy Policy', 'Terms of Service', 'Help Center'].map((item) => (
          <a
            key={item}
            href="#"
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'rgba(115,115,144,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = '#737390';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(115,115,144,0.4)';
            }}
          >
            {item}
          </a>
        ))}
      </div>
    </>
  );
}
