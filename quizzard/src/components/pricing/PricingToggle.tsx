'use client';

import { useState } from 'react';

interface PricingToggleProps {
  value: 'monthly' | 'annual';
  onChange: (period: 'monthly' | 'annual') => void;
}

export default function PricingToggle({ value, onChange }: PricingToggleProps) {
  const [hovered, setHovered] = useState<'monthly' | 'annual' | null>(null);

  const isAnnual = value === 'annual';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          position: 'relative',
          background: 'var(--surface-container-high)',
          borderRadius: 'var(--radius-full)',
          padding: 4,
          border: '1px solid rgba(85,85,120,0.25)',
        }}
      >
        {/* Sliding indicator */}
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            width: 'calc(50% - 4px)',
            height: 'calc(100% - 8px)',
            borderRadius: 'var(--radius-full)',
            background: 'var(--primary-container)',
            boxShadow: '0 2px 12px rgba(174,137,255,0.2)',
            transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)',
            transform: isAnnual ? 'translateX(100%)' : 'translateX(0)',
            zIndex: 0,
          }}
        />

        <button
          onClick={() => onChange('monthly')}
          onMouseEnter={() => setHovered('monthly')}
          onMouseLeave={() => setHovered(null)}
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '8px 20px',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            background: 'transparent',
            color: !isAnnual ? '#fff' : 'var(--on-surface-variant)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: !isAnnual ? 1 : hovered === 'monthly' ? 0.75 : 0.5,
            transition: 'opacity 0.25s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          Monthly
        </button>

        <button
          onClick={() => onChange('annual')}
          onMouseEnter={() => setHovered('annual')}
          onMouseLeave={() => setHovered(null)}
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '8px 20px',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            background: 'transparent',
            color: isAnnual ? '#fff' : 'var(--on-surface-variant)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: isAnnual ? 1 : hovered === 'annual' ? 0.75 : 0.5,
            transition: 'opacity 0.25s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          Annual
        </button>
      </div>

      {/* Save badge */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          background: 'rgba(255,222,89,0.12)',
          color: 'var(--tertiary-container)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.02em',
          border: '1px solid rgba(255,222,89,0.2)',
          transform: isAnnual ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        Save 20%
      </span>
    </div>
  );
}
