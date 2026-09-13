const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

interface TimeInterval {
  start: number; // minutes from midnight (0..1439)
  end: number;   // minutes from midnight (0..1440)
  is24Hours?: boolean;
}

/**
 * Parses a single time string like "9:00 AM", "5 PM", "11:30", "23:00" into minutes from midnight (0..1439).
 */
function parseTimeMinutes(timeStr: string, refAmPm?: 'am' | 'pm', refEndHour?: number): number | null {
  const clean = timeStr.trim().toLowerCase();
  if (!clean) return null;

  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  let period = match[3]?.toLowerCase() as 'am' | 'pm' | undefined;

  if (minute < 0 || minute > 59 || hour < 0 || hour > 24) return null;

  if (hour === 24 && minute === 0) {
    return 1440;
  }

  // If no AM/PM specified, infer from context if possible
  if (!period && refAmPm) {
    if (refAmPm === 'am') {
      period = 'am';
    } else if (refAmPm === 'pm') {
      if (hour === 12) {
        period = 'pm';
      } else if (refEndHour !== undefined && hour > refEndHour) {
        period = 'am'; // e.g. 11:30 to 2:30 PM -> 11:30 AM
      } else {
        period = 'pm'; // e.g. 5:30 to 10:00 PM -> 5:30 PM
      }
    }
  }

  if (period === 'am') {
    if (hour === 12) hour = 0;
  } else if (period === 'pm') {
    if (hour < 12) hour += 12;
  }

  return hour * 60 + minute;
}

/**
 * Parses a day description line (e.g. "Monday: 9:00 AM – 5:00 PM, 6:00 PM – 10:00 PM")
 * into an array of TimeInterval objects.
 */
function parseDaySchedule(scheduleText: string): TimeInterval[] {
  const colonIndex = scheduleText.indexOf(':');
  const body = (colonIndex >= 0 ? scheduleText.slice(colonIndex + 1) : scheduleText).trim();
  const lower = body.toLowerCase();

  if (!lower || lower.includes('closed')) {
    return [];
  }

  if (lower.includes('24 hour') || lower.includes('24h') || lower.includes('open 24')) {
    return [{ start: 0, end: 1440, is24Hours: true }];
  }

  // Split multiple intervals separated by comma or semicolon
  const rangeStrings = body.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const intervals: TimeInterval[] = [];

  for (const rangeStr of rangeStrings) {
    const parts = rangeStr.split(/[–—−]|(?:\s+to\s+)|\s+-\s+|(?<=\d)-(?=\d)/i);
    if (parts.length < 2) continue;

    const startRaw = parts[0].trim();
    const endRaw = parts[1].trim();

    const endMatch = endRaw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    const endPeriod = endMatch?.[3]?.toLowerCase() as 'am' | 'pm' | undefined;
    const endHour = endMatch?.[1] ? parseInt(endMatch[1], 10) : undefined;

    const start = parseTimeMinutes(startRaw, endPeriod, endHour);
    const end = parseTimeMinutes(endRaw);

    if (start !== null && end !== null) {
      intervals.push({ start, end });
    }
  }

  return intervals;
}

/**
 * Finds the schedule description string for a given day index (0 = Sunday, 1 = Monday, ...).
 */
function getDaySchedule(weekdayDescriptions: string[], dayIndex: number): string | null {
  const targetDay = DAY_NAMES[dayIndex];
  const found = weekdayDescriptions.find((desc) => {
    const prefix = desc.split(':')[0]?.trim().toLowerCase();
    return prefix.startsWith(targetDay.slice(0, 3));
  });
  return found ?? null;
}

/**
 * Computes whether a place is currently open given its regular opening hours (weekdayDescriptions array).
 * Returns `null` if no opening hours data is available.
 * Returns `true` if open, `false` if closed.
 */
export function computeIsOpenNow(
  weekdayDescriptions?: string[] | null,
  date: Date = new Date()
): boolean | null {
  if (!weekdayDescriptions || !Array.isArray(weekdayDescriptions) || weekdayDescriptions.length === 0) {
    return null;
  }

  const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, ...
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  // 1. Check today's schedule
  const todayText = getDaySchedule(weekdayDescriptions, dayIndex);
  if (todayText) {
    const intervals = parseDaySchedule(todayText);
    for (const { start, end, is24Hours } of intervals) {
      if (is24Hours) return true;

      if (start <= end) {
        // Normal interval on the same day (e.g. 09:00 to 17:00)
        if (currentMinutes >= start && currentMinutes < end) {
          return true;
        }
      } else {
        // Interval crosses midnight (e.g. 18:00 to 02:00)
        // Active from start until midnight
        if (currentMinutes >= start) {
          return true;
        }
      }
    }
  }

  // 2. Check yesterday's schedule for intervals that spill past midnight into today
  const prevDayIndex = (dayIndex + 6) % 7;
  const yesterdayText = getDaySchedule(weekdayDescriptions, prevDayIndex);
  if (yesterdayText) {
    const yesterdayIntervals = parseDaySchedule(yesterdayText);
    for (const { start, end } of yesterdayIntervals) {
      if (start > end) {
        // Crosses midnight, active during early morning today before 'end'
        if (currentMinutes < end) {
          return true;
        }
      }
    }
  }

  return false;
}
