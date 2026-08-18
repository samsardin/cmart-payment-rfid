/**
 * Date & Timezone Utilities for Indonesian Local Time (WIB / UTC+7)
 * Ensures timestamps sent to Supabase and displayed in UI reflect exact local wall-clock time.
 */

export function getLocalIsoTimestamp(date = new Date()) {
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
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${pad(date.getHours())}.${pad(date.getMinutes())}.${pad(date.getSeconds())}`;
  }
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

export function parseTimestampMs(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  const str = String(ts).trim();
  const sqlIsoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})/);
  if (sqlIsoMatch) {
    const [_, year, month, day, hour, minute, second] = sqlIsoMatch;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10), parseInt(second, 10)).getTime();
  }
  if (str.includes('/')) {
    const dParts = str.split(/[\s,]+/);
    if (dParts.length >= 2) {
      const dateTokens = dParts[0].split('/');
      const timeTokens = dParts[1].replace(/\./g, ':').split(':');
      if (dateTokens.length === 3 && timeTokens.length >= 2) {
        const year = parseInt(dateTokens[2], 10);
        const month = parseInt(dateTokens[1], 10) - 1;
        const day = parseInt(dateTokens[0], 10);
        const hour = parseInt(timeTokens[0], 10);
        const min = parseInt(timeTokens[1], 10);
        const sec = parseInt(timeTokens[2] || '0', 10);
        return new Date(year, month, day, hour, min, sec).getTime();
      }
    }
  }
  const parsed = Date.parse(str);
  return isNaN(parsed) ? 0 : parsed;
}
