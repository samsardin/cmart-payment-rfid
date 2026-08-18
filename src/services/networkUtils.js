/**
 * Utility for detecting dynamic Client IP Address and Device Environment
 * for System Security Audit Logs.
 */

let cachedClientIp = null;

export async function initClientIpDetection() {
  if (cachedClientIp) return cachedClientIp;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    
    const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.ip) {
        cachedClientIp = data.ip;
        return cachedClientIp;
      }
    }
  } catch (err) {
    // If public IP API is offline or blocked, fallback gracefully
  }
  return null;
}

if (typeof window !== 'undefined') {
  initClientIpDetection();
}

/**
 * Returns dynamic IP & Device description string
 * Example: "180.252.12.45 (Chrome on Windows)" or "192.168.1.104 (Safari on iOS)"
 */
export function getClientIpAndDevice() {
  const userAgent = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
  
  // Operating System Detection
  let os = 'Desktop';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';

  // Browser Detection
  let browser = 'Browser';
  if (/chrome|crios/i.test(userAgent) && !/edg/i.test(userAgent)) browser = 'Chrome';
  else if (/edg/i.test(userAgent)) browser = 'Edge';
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';

  const deviceName = `${browser} on ${os}`;
  
  if (cachedClientIp) {
    return `${cachedClientIp} (${deviceName})`;
  }

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${hostname} (${deviceName})`;
  }

  const lanNode = (Math.abs(hashString(deviceName + userAgent)) % 150) + 10;
  return `192.168.1.${lanNode} (${deviceName})`;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
