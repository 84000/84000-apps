const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['week', WEEK],
  ['day', DAY],
  ['hour', HOUR],
  ['minute', MINUTE],
];

/**
 * A timestamp as "3 days ago", falling back to a date past a month.
 *
 * Relative time is what a reader of a discussion wants — how long ago someone
 * said this — but it stops being informative once the answer is "8 weeks", so
 * older comments carry their date instead.
 */
export const relativeTime = (iso: string, now: Date = new Date()): string => {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const seconds = Math.round((then.getTime() - now.getTime()) / 1000);
  const elapsed = Math.abs(seconds);

  if (elapsed > WEEK * 4) return then.toLocaleDateString();
  if (elapsed < MINUTE) return 'just now';

  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  for (const [unit, size] of UNITS) {
    if (elapsed >= size) {
      return format.format(Math.round(seconds / size), unit);
    }
  }

  return 'just now';
};
