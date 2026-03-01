# cc-day-pattern

> What day of the week do you actually code with Claude Code?

```
  cc-day-pattern — weekday usage pattern (all time)

  Day         Sessions   Hours   Avg/session  Chart
  ─────────────────────────────────────────────────────────────────
  Sun               10     0.7h         0.1h  ████████░░░░░░░░░░░░░░░░
  Mon                0       —             —  ░░░░░░░░░░░░░░░░░░░░░░░░
  Tue                7     0.2h         0.0h  ██████░░░░░░░░░░░░░░░░░░
  Wed                4     0.0h         0.0h  ███░░░░░░░░░░░░░░░░░░░░░
  Thu               28    11.2h         0.4h  ████████████████████████  ← PEAK
  Fri               20    10.1h         0.5h  █████████████████░░░░░░░
  Sat               15     1.0h         0.1h  █████████████░░░░░░░░░░░
  ─────────────────────────────────────────────────────────────────

  Summary
    Peak day     Thursday
    Weekdays     59 sessions (70%)  /  21.5h
    Weekend      25 sessions (30%)  /  1.7h
    Pattern      Mostly weekdays 📅
```

## Usage

```bash
npx cc-day-pattern           # All-time pattern
npx cc-day-pattern --days=30 # Last 30 days
npx cc-day-pattern --json    # JSON output for piping
```

## What it measures

Reads your `~/.claude/projects/**/*.jsonl` session files and groups them by day of week. Shows:

- Sessions and hours per day-of-week
- Average session length per day (reveals focus depth vs quick checks)
- Weekday vs weekend split
- Your coding pattern: Weekday grinder, Mostly weekdays, Weekend hacker, or Always on

Sessions over 8 hours are excluded (likely autonomous overnight runs).

## Part of cc-toolkit

One of [35 free tools](https://yurukusa.github.io/cc-toolkit/) for understanding your Claude Code usage.

## License

MIT
