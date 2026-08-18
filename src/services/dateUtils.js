/**
 * Date & Timezone Utilities for Indonesian Local Time (WIB / UTC+7)
 * Ensures timestamps sent to Supabase and displayed in UI reflect exact local wall-clock time.
 */

export function getLocalIsoTimestamp(date = new Date()) {
  return date.toISOString();
}

export function getLocalTodayDateString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDisplayTimestamp(ts) {
  if (!ts) return '-';
  
  // If ts is already formatted as Indonesian string "18/08/2026, 20.18.55"
  if (typeof ts === 'string' && ts.includes('/') && ts.includes(',')) {
    return ts;
  }

  // Parse ts into ms (handles ISO strings with Z, numbers, or custom formats)
  let date;
  if (typeof ts === 'number') {
    date = new Date(ts);
  } else {
    const str = String(ts).trim();
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
      date = new Date(parsed);
    } else {
      // Fallback for custom date formats "DD/MM/YYYY, HH.mm.ss"
      try {
        const parts = str.split(/[,\s]+/);
        if (parts.length >= 2) {
          const dateParts = parts[0].split('/');
          const timeParts = parts[1].replace(/\./g, ':').split(':');
          if (dateParts.length === 3) {
            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1;
            const year = parseInt(dateParts[2], 10);
            const hours = parseInt(timeParts[0] || '0', 10);
            const minutes = parseInt(timeParts[1] || '0', 10);
            const seconds = parseInt(timeParts[2] || '0', 10);
            date = new Date(year, month, day, hours, minutes, seconds);
          }
        }
      } catch (e) {}
    }
  }

  if (!date || isNaN(date.getTime())) return String(ts);

  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${day}/${month}/${year}, ${hours}.${minutes}.${seconds}`;
}
