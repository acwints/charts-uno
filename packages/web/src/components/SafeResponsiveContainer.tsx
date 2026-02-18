import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

interface SafeResponsiveContainerProps {
  children: ReactElement | null;
  minWidth?: number;
  minHeight?: number;
  className?: string;
}

export function SafeResponsiveContainer({
  children,
  minWidth = 0,
  minHeight = 0,
  className,
}: SafeResponsiveContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      setReady(rect.width > 0 && rect.height > 0);
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      const handle = window.requestAnimationFrame(update);
      return () => window.cancelAnimationFrame(handle);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', minWidth, minHeight }}
    >
      {ready && children ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={minWidth} minHeight={minHeight}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
