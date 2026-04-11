'use client';

import { useEffect, useState, useCallback } from 'react';
import { useBreakpoint } from '@/hooks/useBreakpoint';

interface DayData {
  date: string;
  count: number;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  date: string;
  count: number;
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// `count` is now minutes spent in the app for the day. Tiers:
//   0          → empty
//   1–19       → light
//   20–59      → mid
//   60+        → full
function getColor(minutes: number): string {
  if (minutes === 0) return '#22223a';
  if (minutes < 20) return '#2d1f5e';
  if (minutes < 60) return '#6b3fa0';
  return '#ae89ff';
}

function formatDate(dateStr: string): string {
  // Cells are keyed by UTC date (to match the server's DATE(minute) group),
  // so format them in UTC as well — otherwise a CEST user hovers "Apr 11"
  // and sees "Apr 10" in the tooltip.
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "2026-04-11" from a Date, using UTC components. */
function toUtcDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface ActivityHeatmapProps {
  /** When set, fetch this user's activity instead of the authed user's. */
  userId?: string;
}

export default function ActivityHeatmap({ userId }: ActivityHeatmapProps = {}) {
  const { isPhone } = useBreakpoint();
  const [dayMap, setDayMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    date: '',
    count: 0,
  });

  // The card now shows the last ~30 days (5 weeks × 7 days = 35 cells,
  // ending today) so it stays glanceable inside the bento grid instead
  // of dominating the page. Cells are sized via CSS grid + aspect-ratio
  // so they stretch to fill the parent column width.
  const CELL_GAP = isPhone ? 4 : 6;
  const TOTAL_WEEKS = 5;

  useEffect(() => {
    const url = userId
      ? `/api/user/activity-heatmap?days=35&userId=${encodeURIComponent(userId)}`
      : '/api/user/activity-heatmap?days=35';
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((res) => {
        const data: DayData[] = res?.data?.data ?? res?.data ?? [];
        const map: Record<string, number> = {};
        for (const d of data) {
          map[d.date] = d.count;
        }
        setDayMap(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  // Build the grid: 53 columns x 7 rows, ending today.
  // Everything here is in UTC to stay in lockstep with the server, which
  // buckets minutes via Postgres `DATE("minute")` in UTC. Building the grid
  // in local time would produce an off-by-one for users in non-UTC zones
  // (e.g. CEST → today's cell gets labelled with yesterday's UTC date and
  // today's data disappears).
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayDay = today.getUTCDay(); // 0=Sun, 6=Sat

  // The grid ends on today. The last column contains today.
  const totalDays = (TOTAL_WEEKS - 1) * 7 + todayDay + 1;
  const startDate = new Date(today);
  startDate.setUTCDate(startDate.getUTCDate() - totalDays + 1);
  const startDay = startDate.getUTCDay();

  // Build cells
  const cells: { date: string; count: number; week: number; day: number }[] = [];
  const monthLabels: { label: string; week: number }[] = [];
  let lastMonth = -1;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = toUtcDateStr(d);

    // The grid starts from startDate's day-of-week, so offset the column
    // index by startDay to land the first cell in the correct row.
    const adjustedIndex = i + startDay;
    const col = Math.floor(adjustedIndex / 7);
    const row = adjustedIndex % 7;

    cells.push({ date: dateStr, count: dayMap[dateStr] ?? 0, week: col, day: row });

    // Track month labels
    const month = d.getUTCMonth();
    if (month !== lastMonth) {
      monthLabels.push({ label: MONTH_NAMES[month], week: col });
      lastMonth = month;
    }
  }

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, date: string, count: number) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const wrapperRect = e.currentTarget
        .closest('[data-heatmap-wrapper]')
        ?.getBoundingClientRect();
      if (wrapperRect) {
        setTooltip({
          visible: true,
          x: rect.left - wrapperRect.left + rect.width / 2,
          y: rect.top - wrapperRect.top - 8,
          date,
          count,
        });
      }
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  // Bucket cells into a 7-row × TOTAL_WEEKS-col 2D array, indexed [row][col].
  // Empty slots (before startDate or after today) stay null.
  const grid: ((typeof cells)[number] | null)[][] = Array.from(
    { length: 7 },
    () => Array(TOTAL_WEEKS).fill(null)
  );
  for (const c of cells) {
    if (c.week >= 0 && c.week < TOTAL_WEEKS) {
      grid[c.day][c.week] = c;
    }
  }

  return (
    <div
      style={{
        background: '#21213e',
        borderRadius: '24px',
        padding: isPhone ? '16px' : '24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#e5e3ff', margin: '0 0 4px' }}>
            Activity
          </h3>
          <p style={{ fontSize: '13px', color: '#aaa8c8', margin: 0 }}>
            Minutes in the app over the last 30 days
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: '#aaa8c8',
          }}
        >
          <span>Less</span>
          {[0, 10, 30, 60].map((minutes) => (
            <div
              key={minutes}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '3px',
                background: getColor(minutes),
              }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            minHeight: '180px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#aaa8c8',
            fontSize: '13px',
          }}
        >
          Loading activity...
        </div>
      ) : (
        <div
          data-heatmap-wrapper
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gridTemplateRows: 'auto 1fr',
            columnGap: '8px',
            rowGap: '6px',
            width: '100%',
          }}
        >
          {/* Top-left corner (empty) */}
          <div />

          {/* Month labels row — laid out as a 5-column grid mirroring the
              cell grid below so each label sits over its week. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${TOTAL_WEEKS}, 1fr)`,
              gap: `${CELL_GAP}px`,
              fontSize: '11px',
              color: '#aaa8c8',
              fontWeight: 500,
            }}
          >
            {Array.from({ length: TOTAL_WEEKS }).map((_, w) => {
              const label = monthLabels.find((m) => m.week === w)?.label ?? '';
              return (
                <div key={w} style={{ whiteSpace: 'nowrap' }}>
                  {label}
                </div>
              );
            })}
          </div>

          {/* Day labels column */}
          <div
            style={{
              display: 'grid',
              gridTemplateRows: `repeat(7, 1fr)`,
              gap: `${CELL_GAP}px`,
              fontSize: '11px',
              color: '#aaa8c8',
              fontWeight: 500,
            }}
          >
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  minHeight: 0,
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Cell grid — 5 columns × 7 rows. aspect-ratio keeps cells
              square as the column stretches with the parent. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${TOTAL_WEEKS}, 1fr)`,
              gridTemplateRows: `repeat(7, 1fr)`,
              gap: `${CELL_GAP}px`,
              gridAutoFlow: 'column',
            }}
          >
            {Array.from({ length: TOTAL_WEEKS * 7 }).map((_, idx) => {
              // gridAutoFlow: 'column' fills column-by-column, so idx maps
              // to (col = floor(idx/7), row = idx%7) which is exactly the
              // cell at grid[row][col].
              const col = Math.floor(idx / 7);
              const row = idx % 7;
              const cell = grid[row][col];
              if (!cell) {
                return <div key={idx} style={{ aspectRatio: '1 / 1' }} />;
              }
              return (
                <div
                  key={cell.date}
                  onMouseEnter={(e) => handleMouseEnter(e, cell.date, cell.count)}
                  onMouseLeave={handleMouseLeave}
                  style={{
                    aspectRatio: '1 / 1',
                    borderRadius: '4px',
                    background: getColor(cell.count),
                    cursor: 'pointer',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLDivElement).style.opacity = '0.8';
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLDivElement).style.opacity = '1';
                  }}
                />
              );
            })}
          </div>

          {/* Tooltip */}
          {tooltip.visible && (
            <div
              style={{
                position: 'absolute',
                left: `${tooltip.x}px`,
                top: `${tooltip.y}px`,
                transform: 'translate(-50%, -100%)',
                background: '#35355c',
                color: '#e5e3ff',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                zIndex: 10,
              }}
            >
              <strong>
                {tooltip.count} {tooltip.count === 1 ? 'minute' : 'minutes'}
              </strong>{' '}
              on {formatDate(tooltip.date)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
