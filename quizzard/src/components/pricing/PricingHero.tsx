'use client';

import { useEffect, useState } from 'react';

export default function PricingHero() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section
      className="pricing-hero"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '160px 40px 80px',
        textAlign: 'center',
      }}
    >
      {/* ── Aurora gradient mesh ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          className="aurora-orb-1"
          style={{
            position: 'absolute',
            width: 900,
            height: 900,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(174,137,255,0.1) 0%, transparent 70%)',
            top: '-20%',
            left: '50%',
            transform: 'translateX(-50%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="aurora-orb-2"
          style={{
            position: 'absolute',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(185,195,255,0.06) 0%, transparent 70%)',
            top: '50%',
            right: '5%',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="aurora-orb-3"
          style={{
            position: 'absolute',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,222,89,0.04) 0%, transparent 70%)',
            bottom: '5%',
            left: '10%',
            filter: 'blur(50px)',
          }}
        />
      </div>

      {/* ── Content ── */}
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--primary)',
          marginBottom: 20,
          position: 'relative',
          zIndex: 1,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)',
          transitionDelay: '0ms',
        }}
      >
        Pricing
      </p>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(36px, 5vw, 64px)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.06,
          marginBottom: 20,
          color: 'var(--on-surface)',
          position: 'relative',
          zIndex: 1,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)',
          transitionDelay: '80ms',
        }}
      >
        Study smarter,{' '}
        <span
          style={{
            background: 'linear-gradient(135deg, var(--primary), var(--tertiary-container))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          not harder
        </span>
      </h1>

      <p
        style={{
          fontSize: 'clamp(15px, 2vw, 18px)',
          color: 'var(--on-surface-variant)',
          opacity: mounted ? 0.7 : 0,
          lineHeight: 1.7,
          maxWidth: 560,
          position: 'relative',
          zIndex: 1,
          transform: mounted ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)',
          transitionDelay: '160ms',
        }}
      >
        Start free, upgrade when you need more. Every plan includes the core Quizzard
        experience — AI flashcards, study plans, and Scholar Chat.
      </p>
    </section>
  );
}
