'use client';

import HomeHeader from '@/components/layout/HomeHeader';
import RecentNotebooksPanel from '@/components/home/RecentNotebooksPanel';
import HomeFeed from '@/components/home/HomeFeed';
import SocialPanel from '@/components/home/SocialPanel';

const COLORS = {
  pageBg: '#0d0d1a',
} as const;

export default function HomePage() {
  return (
    <>
      <HomeHeader />
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          width: '100%',
          padding: '24px 20px',
          display: 'flex',
          gap: 24,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left column — hidden on mobile */}
        <div
          className="home-left-col"
          style={{
            width: 280,
            flexShrink: 0,
          }}
        >
          <RecentNotebooksPanel />
        </div>

        {/* Center column */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <HomeFeed />
        </div>

        {/* Right column — hidden on tablet and below */}
        <div
          className="home-right-col"
          style={{
            width: 300,
            flexShrink: 0,
          }}
        >
          <SocialPanel />
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .home-right-col {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          .home-left-col {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
