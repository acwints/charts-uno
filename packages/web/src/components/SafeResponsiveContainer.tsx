import {
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';

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
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.max(Math.floor(rect.width), 0);
      const height = Math.max(Math.floor(rect.height), 0);
      setSize((prev) => {
        if (prev.width === width && prev.height === height) {
          return prev;
        }
        return { width, height };
      });
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
      {children && isValidElement(children) && size.width > 0 && size.height > 0
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            width: Math.max(size.width, minWidth),
            height: Math.max(size.height, minHeight),
          })
        : null}
    </div>
  );
}
