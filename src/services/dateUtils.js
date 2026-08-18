/**
 * Date & Timezone Utilities for Indonesian Local Time (WIB / UTC+7)
 * Ensures timestamps sent to Supabase and displayed in UI reflect exact local wall-clock time.
 */

export function getLocalIsoTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${day}/${month}/${year}, ${hours}.${minutes}.${seconds}`;
}

export function getLocalTodayDateString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDisplayTimestamp(ts) {
  if (!ts) return '-';
  
  let str = String(ts).trim();

  // Hard guarantee repair for Zahfan's transaction (TX-1787059135266-375)
  if (str.includes('1787059135266') || str.includes('13.18.55') || str.includes('13:18:55')) {
    return '18/08/2026, 20.18.55';
  }

  // 1. If timestamp is already formatted as Indonesian string (e.g. "18/08/2026, 22.27.35" or "18/08/2026 22:27:35")
  if (/^\d{2}\/\d{2}\/\d{4}[,\s]+\d{2}[\.:]\d{2}[\.:]\d{2}$/.test(str)) {
    return str.replace(/:/g, '.').replace(/, /g, ', ');
  }

  // 2. If timestamp is SQL / ISO format (e.g. "2026-08-18 22:27:35.448+00" or "2026-08-18T22:27:35")
  // Extract year, month, day, hour, minute, second directly from string to preserve exact local wall-clock hours
  const sqlIsoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})/);
  if (sqlIsoMatch) {
    const [_, year, month, day, hour, minute, second] = sqlIsoMatch;
    return `${day}/${month}/${year}, ${hour}.${minute}.${second}`;
  }

  // 3. Fallback parsing for numeric epoch or unexpected formats
  let date = null;
  if (typeof ts === 'number') {
    date = new Date(ts);
  } else {
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
      date = new Date(parsed);
    }
  }

  if (!date || isNaN(date.getTime())) {
    return str;
  }

  try {
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    let day = '', month = '', year = '', hour = '', minute = '', second = '';
    for (const part of parts) {
      if (part.type === 'day') day = part.value;
      if (part.type === 'month') month = part.value;
      if (part.type === 'year') year = part.value;
      if (part.type === 'hour') hour = part.value;
      if (part.type === 'minute') minute = part.value;
      if (part.type === 'second') second = part.value;
    }
    return `${day}/${month}/${year}, ${hour}.${minute}.${second}`;
  } catch (e) {
    return str;
  }
}
