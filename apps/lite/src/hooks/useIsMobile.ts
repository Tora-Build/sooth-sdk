import { useState, useEffect } from 'react';

/**
 * Detects if the user is on a mobile device.
 * Uses both screen width and user agent for reliable detection.
 * On mobile: show raw dapp (fullscreen).
 * On desktop: show showcase with phone frame.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  });

  useEffect(() => {
    const check = () => {
      setIsMobile(
        window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      );
    };

    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
