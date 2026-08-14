import { useEffect, useRef } from 'react';

/**
 * Custom Hook for Physical USB PnP RFID Readers (HID Keyboard Wedge).
 * USB RFID Readers (e.g., Hassel 13.56 MHz MF1 S50) send card UID keystrokes rapidly
 * followed by an Enter key.
 */
export function useRfidWedge(onRfidScan) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // If gap between keystrokes is too long (more than 100ms), reset buffer
      if (elapsed > 100 && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // If Enter key is pressed, check if buffer contains a valid RFID UID
      if (e.key === 'Enter') {
        const candidateUid = bufferRef.current.trim().toUpperCase();
        if (candidateUid.length >= 4) { // RFID UIDs are usually 4 to 14 chars
          e.preventDefault();
          if (onRfidScan) {
            onRfidScan(candidateUid);
          }
        }
        bufferRef.current = '';
        return;
      }

      // Collect alphanumeric characters typical of RFID UIDs (0-9, A-F, or hyphen)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onRfidScan]);
}
