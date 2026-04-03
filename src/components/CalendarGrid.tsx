import React from 'react';
import { T } from '../lib/theme';
import CalendarTaskBar from './CalendarTaskBar';

// ── Exported types ──────────────────────────────────────────────────────────

export type IssueStatus = 'not-started' | 'in-progress' | 'under-review' | 'done';

// ── Exported interface ──────────────────────────────────────────────────────

export interface CalendarTask {
  id: string;
  title: string;
  description?: string;
  startDate: string;         // YYYY-MM-DD
  endDate: string;           // YYYY-MM-DD
  assignees: string[];       // GitHub logins
  color: string;             // resolved hex colour
  type: 'milestone' | 'epic' | 'issue';
  milestoneTitle?: string;   // parent milestone name (epics only)
  milestoneId?: string;      // parent milestone ID (epics) or linked milestone ID (issues)
  issueCount?: number;
  // Issue-only fields
  issueStatus?: IssueStatus;
  columnId?: string;
}

// ── Bar layout constants ────────────────────────────────────────────────────

export const BAR_HEIGHT = 24;
export const ISSUE_BAR_HEIGHT = 16;
export const BAR_GAP = 4;
export const BAR_TOP_OFFSET = 6;
export const BAR_SLOT = BAR_HEIGHT + BAR_GAP;

// ── Internal pure date helpers ──────────────────────────────────────────────

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateToString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeeksInMonth(year: number, month: number): Date[][] {
  // Find the Monday on or before the first day of the month
  const firstDay = new Date(year, month, 1);
  const firstDow = firstDay.getDay(); // 0=Sun, 1=Mon...
  const daysToMon = firstDow === 0 ? 6 : firstDow - 1;
  const startMon = new Date(year, month, 1 - daysToMon);

  const lastDay = new Date(year, month + 1, 0);

  const weeks: Date[][] = [];
  const cursor = new Date(startMon);

  while (cursor <= lastDay) {
    const week: Date[] = [];
    for (let i = 0; i < 5; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    // Skip the weekend (Sat + Sun)
    cursor.setDate(cursor.getDate() + 2);
    weeks.push(week);
  }

  return weeks;
}

function dayColIndex(d: Date): number {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return -1;
  return dow - 1; // Mon=0 … Fri=4
}

function clampToWeek(
  taskStart: string,
  taskEnd: string,
  weekMon: Date,
  weekFri: Date,
): [string, string] | null {
  const ts = parseLocalDate(taskStart);
  const te = parseLocalDate(taskEnd);

  if (te < weekMon || ts > weekFri) return null;

  const clampedStart = ts < weekMon ? dateToString(weekMon) : taskStart;
  const clampedEnd = te > weekFri ? dateToString(weekFri) : taskEnd;

  return [clampedStart, clampedEnd];
}

// ── Component ───────────────────────────────────────────────────────────────

interface Props {
  tasks: CalendarTask[];
  year: number;
  month: number; // 0-indexed (0=Jan)
  assigneeColors: Map<string, string>;
  onBarClick?: (task: CalendarTask, e: React.MouseEvent) => void;
  onCellClick?: (date: Date, e: React.MouseEvent) => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function CalendarGrid({ tasks, year, month, assigneeColors, onBarClick, onCellClick }: Props) {
  const weeks = getWeeksInMonth(year, month);
  const todayStr = dateToString(new Date());

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        fontFamily: T.fontPrimary,
      }}
    >
      {weeks.map((week, weekIdx) => {
        const weekMon = week[0];
        const weekFri = week[4];

        // Find tasks that overlap this week and assign lanes
        type TaskSegment = {
          task: CalendarTask;
          segmentStart: string;
          segmentEnd: string;
          lane: number;
        };

        const segments: TaskSegment[] = [];
        tasks.forEach((task) => {
          const clamped = clampToWeek(task.startDate, task.endDate, weekMon, weekFri);
          if (clamped) {
            segments.push({
              task,
              segmentStart: clamped[0],
              segmentEnd: clamped[1],
              lane: segments.length,
            });
          }
        });

        const barZoneHeight =
          segments.length > 0
            ? BAR_TOP_OFFSET + segments.length * BAR_SLOT + 6
            : 12;

        return (
          <div
            key={weekIdx}
            style={{ borderBottom: T.glassBorder }}
          >
            {/* Week cell header — day name + large date number per column */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                borderBottom: '1px solid rgba(100,116,139,0.12)',
              }}
            >
              {week.map((date, colIdx) => {
                const inMonth = date.getMonth() === month;
                const isToday = dateToString(date) === todayStr;
                const dateNum = date.getDate();

                return (
                  <div
                    key={colIdx}
                    style={{
                      padding: '8px 10px',
                      textAlign: 'center',
                      borderRight:
                        colIdx < 4 ? '1px solid rgba(100,116,139,0.15)' : undefined,
                    }}
                  >
                    {/* Day name label */}
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: T.textFaint,
                        marginBottom: 4,
                        fontFamily: T.fontPrimary,
                      }}
                    >
                      {DAY_LABELS[colIdx]}
                    </div>

                    {/* Date number — circle for today, plain for others */}
                    {isToday ? (
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#6366f1',
                          color: '#fff',
                          fontSize: 13,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto',
                          fontFamily: T.fontPrimary,
                        }}
                      >
                        {dateNum}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 300,
                          color: inMonth ? T.textPrimary : T.textFaint,
                          opacity: inMonth ? 1 : 0.35,
                          lineHeight: 1,
                          fontFamily: T.fontPrimary,
                        }}
                      >
                        {dateNum}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bar zone — auto-sized to fit all task bars */}
            <div
              style={{
                position: 'relative',
                height: barZoneHeight,
                minHeight: 80,
              }}
            >
              {/* Subtle column guide lines */}
              {[20, 40, 60, 80].map((pct) => (
                <div
                  key={pct}
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${pct}%`,
                    width: 1,
                    background: 'rgba(100,116,139,0.08)',
                    pointerEvents: 'none',
                  }}
                />
              ))}

              {/* Clickable day columns (behind bars, z-index 0) */}
              {onCellClick && week.map((date, colIdx) => (
                <div
                  key={`cell-${colIdx}`}
                  onClick={(e) => onCellClick(date, e)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${colIdx * 20}%`,
                    width: '20%',
                    zIndex: 0,
                    cursor: 'pointer',
                  }}
                />
              ))}

              {segments.map(({ task, segmentStart, segmentEnd, lane }) => (
                <CalendarTaskBar
                  key={`${task.id}-${weekIdx}`}
                  task={task}
                  segmentStart={segmentStart}
                  segmentEnd={segmentEnd}
                  lane={lane}
                  assigneeColors={assigneeColors}
                  onClick={onBarClick}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
