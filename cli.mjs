#!/usr/bin/env node
/**
 * cc-day-pattern — What day of the week do you actually code with Claude Code?
 *
 * Shows a weekday heatmap: sessions and hours per day-of-week.
 * Are you a Monday builder or a Friday coder? Weekday grinder or weekend hacker?
 *
 * Zero dependencies. Node.js 18+. ESM.
 *
 * Usage:
 *   npx cc-day-pattern           # All-time pattern
 *   npx cc-day-pattern --days=30 # Last 30 days
 *   npx cc-day-pattern --json    # JSON output
 */

import { readdir, stat, open } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HOME = homedir();
const MAX_SESSION_HOURS = 8;

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const helpFlag = args.includes('--help') || args.includes('-h');
const jsonFlag = args.includes('--json');
const daysArg  = parseInt(args.find(a => a.startsWith('--days='))?.slice(7) ?? '0') || 0;

if (helpFlag) {
  console.log(`cc-day-pattern — What day of the week do you code with Claude Code?

USAGE
  npx cc-day-pattern           # All-time weekday pattern
  npx cc-day-pattern --days=30 # Last N days
  npx cc-day-pattern --json    # JSON output

OUTPUT
  Weekday heatmap: sessions, hours, avg session length per day-of-week.
  Shows your peak day and weekday vs weekend split.
`);
  process.exit(0);
}

// ── Date range ────────────────────────────────────────────────────────────────
const now = new Date();
const cutoff = daysArg > 0
  ? new Date(now.getTime() - daysArg * 24 * 60 * 60 * 1000)
  : null;

// ── Helpers ───────────────────────────────────────────────────────────────────
async function readFirstLastLine(filePath) {
  const fh = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(8192);
    const { bytesRead } = await fh.read(buf, 0, 8192, 0);
    if (bytesRead === 0) return null;
    const firstChunk = buf.toString('utf8', 0, bytesRead);
    const nl = firstChunk.indexOf('\n');
    const firstLine = nl >= 0 ? firstChunk.substring(0, nl) : firstChunk;

    const fileStat = await fh.stat();
    const size = fileStat.size;
    if (size < 2) return { firstLine, lastLine: firstLine };
    const readSize = Math.min(65536, size);
    const tailBuf = Buffer.alloc(readSize);
    const { bytesRead: tb } = await fh.read(tailBuf, 0, readSize, size - readSize);
    const lines = tailBuf.toString('utf8', 0, tb).split('\n').filter(l => l.trim());
    return { firstLine, lastLine: lines[lines.length - 1] || firstLine };
  } finally { await fh.close(); }
}

function parseTimestamp(jsonLine) {
  try {
    const d = JSON.parse(jsonLine);
    const ts = d.timestamp || d.ts;
    if (ts) return new Date(ts);
  } catch {}
  return null;
}

// ── Scan sessions ─────────────────────────────────────────────────────────────
if (!jsonFlag) process.stdout.write('  Reading session data...\r');

const claudeDir   = join(HOME, '.claude');
const projectsDir = join(claudeDir, 'projects');

// Per day-of-week: index 0=Sunday ... 6=Saturday
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dowSessions = Array(7).fill(0);
const dowHours    = Array(7).fill(0);

let totalSessions = 0;
let projectDirs;
try { projectDirs = await readdir(projectsDir); } catch { projectDirs = []; }

for (const projDir of projectDirs) {
  const projPath = join(projectsDir, projDir);
  const ps = await stat(projPath).catch(() => null);
  if (!ps?.isDirectory()) continue;
  let files;
  try { files = await readdir(projPath); } catch { continue; }
  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue;
    const fp = join(projPath, file);
    const fs2 = await stat(fp).catch(() => null);
    if (!fs2 || fs2.size < 50) continue;
    try {
      const r = await readFirstLastLine(fp);
      if (!r) continue;
      const s = parseTimestamp(r.firstLine);
      const e = parseTimestamp(r.lastLine);
      if (!s || !e) continue;
      const durMs = e - s;
      if (durMs < 0 || durMs > 7 * 24 * 60 * 60 * 1000) continue;
      const durH = durMs / (1000 * 60 * 60);
      if (durH > MAX_SESSION_HOURS) continue;
      if (cutoff && s < cutoff) continue;

      const dow = s.getDay(); // 0=Sun, 6=Sat
      dowSessions[dow]++;
      dowHours[dow]   += durH;
      totalSessions++;
    } catch {}
  }
}

// ── Compute stats ─────────────────────────────────────────────────────────────
const totalHours     = dowHours.reduce((a, b) => a + b, 0);
const weekdaySessions = dowSessions.slice(1, 6).reduce((a, b) => a + b, 0); // Mon-Fri
const weekendSessions = dowSessions[0] + dowSessions[6]; // Sun+Sat
const weekdayHours    = dowHours.slice(1, 6).reduce((a, b) => a + b, 0);
const weekendHours    = dowHours[0] + dowHours[6];

const peakDow   = dowSessions.indexOf(Math.max(...dowSessions));
const quietDow  = dowSessions.indexOf(Math.min(...dowSessions.map((v, i) => v > 0 ? v : Infinity)));

// ── JSON output ───────────────────────────────────────────────────────────────
if (jsonFlag) {
  console.log(JSON.stringify({
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    timeRange: daysArg > 0 ? `last ${daysArg} days` : 'all time',
    summary: {
      totalSessions,
      totalHours:       Math.round(totalHours * 10) / 10,
      peakDay:          DOW_NAMES[peakDow],
      weekdaySessions,
      weekendSessions,
      weekdayHours:     Math.round(weekdayHours * 10) / 10,
      weekendHours:     Math.round(weekendHours * 10) / 10,
    },
    byDayOfWeek: DOW_NAMES.map((name, i) => ({
      day:      name,
      sessions: dowSessions[i],
      hours:    Math.round(dowHours[i] * 10) / 10,
      avgHours: dowSessions[i] > 0 ? Math.round(dowHours[i] / dowSessions[i] * 10) / 10 : 0,
    })),
  }, null, 2));
  process.exit(0);
}

// ── Terminal output ───────────────────────────────────────────────────────────
process.stdout.write('\x1b[2K\r');

const bold   = '\x1b[1m';
const dim    = '\x1b[2m';
const reset  = '\x1b[0m';
const purple = '\x1b[35m';
const green  = '\x1b[32m';
const cyan   = '\x1b[36m';
const orange = '\x1b[33m';
const muted  = '\x1b[90m';

const maxSessions = Math.max(...dowSessions, 1);
const maxHours    = Math.max(...dowHours, 0.1);
const BAR_WIDTH   = 24;

const timeRange = daysArg > 0 ? ` (last ${daysArg} days)` : ' (all time)';
console.log(`\n${bold}  cc-day-pattern${reset}${muted} — weekday usage pattern${reset}${timeRange}\n`);

// Table header
console.log(`  ${muted}${'Day'.padEnd(11)} ${'Sessions'.padStart(8)}  ${'Hours'.padStart(6)}  ${'Avg/session'.padStart(12)}  Chart${reset}`);
console.log(`  ${'─'.repeat(65)}`);

for (let i = 0; i < 7; i++) {
  const name     = DOW_SHORT[i];
  const sessions = dowSessions[i];
  const hours    = dowHours[i];
  const avgH     = sessions > 0 ? hours / sessions : 0;
  const isPeak   = i === peakDow && sessions > 0;
  const isWkend  = i === 0 || i === 6;

  const barLen   = Math.round(sessions / maxSessions * BAR_WIDTH);
  const bar      = '█'.repeat(barLen) + '░'.repeat(BAR_WIDTH - barLen);
  const barColor = isPeak ? purple : isWkend ? cyan : (sessions > 0 ? green : muted);

  const nameStr    = (isWkend ? dim : '') + name.padEnd(11) + reset;
  const sessStr    = (isPeak ? bold + purple : '') + String(sessions).padStart(8) + reset;
  const hoursStr   = hours > 0 ? cyan + hours.toFixed(1).padStart(6) + 'h' + reset : muted + '    —  ' + reset;
  const avgStr     = avgH > 0  ? muted + (avgH.toFixed(1) + 'h').padStart(12) + reset : muted + '          —  ' + reset;
  const barStr     = barColor + bar + reset + (isPeak ? `  ${bold}${purple}← PEAK${reset}` : '');

  console.log(`  ${nameStr} ${sessStr}  ${hoursStr}  ${avgStr}  ${barStr}`);
}

console.log(`  ${'─'.repeat(65)}\n`);

// Summary box
const wdPct = totalSessions > 0 ? Math.round(weekdaySessions / totalSessions * 100) : 0;
const wePct = totalSessions > 0 ? Math.round(weekendSessions / totalSessions * 100) : 0;

console.log(`  ${bold}Summary${reset}`);
console.log(`    Peak day     ${bold}${purple}${DOW_NAMES[peakDow]}${reset}`);
console.log(`    Weekdays     ${bold}${weekdaySessions}${reset} sessions (${wdPct}%)  /  ${bold}${weekdayHours.toFixed(1)}h${reset}`);
console.log(`    Weekend      ${bold}${weekendSessions}${reset} sessions (${wePct}%)  /  ${bold}${weekendHours.toFixed(1)}h${reset}`);

const pattern = wdPct >= 85 ? 'Weekday grinder 💼'
  : wdPct >= 65 ? 'Mostly weekdays 📅'
  : wePct >= 50 ? 'Weekend hacker 🏠'
  : 'Always on 🔄';

console.log(`    Pattern      ${bold}${pattern}${reset}`);
console.log();
