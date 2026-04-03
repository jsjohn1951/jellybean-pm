import { useState, useEffect } from 'react';

/** Returns true when the viewport width is at or below `breakpoint` pixels (default 768). */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  );

  useEffect(() => {
    function handler() { setIsMobile(window.innerWidth <= breakpoint); }
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);

  return isMobile;
}
