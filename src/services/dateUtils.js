/**
 * Date & Timezone Utilities for Indonesian Local Time (WIB / UTC+7)
 * Ensures timestamps sent to Supabase and displayed in UI reflect exact local wall-clock time.
 */

export function getLocalIsoTimestamp(date = new Date()) {
  const pad = (n, len = 2) => String(Math.floor(Math.abs(n))).padStart(len, '0');
  
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);

  const tzOffsetMinutes = -date.getTimezoneOffset();
  const tzSign = tzOffsetMinutes >= 0 ? '+' : '-';
  const tzHours = pad(Math.floor(Math.abs(tzOffsetMinutes) / 60));
  const tzMins = pad(Math.abs(tzOffsetMinutes) % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${tzSign}${tzHours}:${tzMins}`;
}

export function getLocalTodayDateString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDisplayTimestamp(ts) {
  if (!ts) return '-';
  
  // If ts is already formatted as Indonesian string "18/8/2026, 16.34.59"
  if (typeof ts === 'string' && ts.includes('/') && ts.includes(',')) {
    return ts;
  }

  const str = String(ts).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (isoMatch) {
    const [, y, m, d, hh, mm, ss] = isoMatch;
    return `${d}/${m}/${y}, ${hh}.${mm}.${ss}`;
  }

  const date = new Date(ts);
  if (isNaN(date.getTime())) return String(ts);

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${pad(date.getHours())}.${pad(date.getMinutes())}.${pad(date.getSeconds())}`;
}
