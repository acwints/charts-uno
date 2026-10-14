import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import type { ChartResponse } from '../../services/api';
import { blockUser, reportChart } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import './ChartSafetyMenu.css';

const REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'inappropriate', label: 'Inappropriate' },
  { id: 'other', label: 'Other' },
] as const;

interface ChartSafetyMenuProps {
  chart: ChartResponse;
  onAuthRequired?: () => void;
  onDismiss?: (target: { chartId: string; userId?: string }) => void;
}

export function ChartSafetyMenu({ chart, onAuthRequired, onDismiss }: ChartSafetyMenuProps) {
  const { user } = useAuth();
  const toast = useToast();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus();
    };
  }, [open, reporting]);

  if (user && chart.user_id === user.id) return null;

  const authorName = chart.user?.name || 'this author';

  const close = () => {
    setOpen(false);
    setReporting(false);
  };

  const requireAuth = () => {
    if (user) return false;
    close();
    onAuthRequired?.();
    return true;
  };

  const submitReport = async (reason: string) => {
    if (requireAuth()) return;
    setBusy(true);
    try {
      await reportChart(chart.id, reason);
      toast.success('Report sent. This chart is hidden for you, and we review reports within 24 hours.');
      onDismiss?.({ chartId: chart.id });
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the report. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitBlock = async () => {
    if (requireAuth()) return;
    setBusy(true);
    try {
      await blockUser(chart.user_id);
      toast.success(`${authorName} is blocked. Their public charts are hidden from your feed.`);
      onDismiss?.({ chartId: chart.id, userId: chart.user_id });
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not block this account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="safety-trigger"
        aria-label={`Report or block ${authorName}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setReporting(false);
          setOpen(true);
        }}
      >
        <MoreHorizontal size={20} />
      </button>
      {open && createPortal(
        <div className="safety-backdrop" onClick={close}>
          <div
            ref={dialogRef}
            className="safety-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId} className="safety-sheet__title">
              {reporting ? 'Report this chart' : authorName}
            </h2>
            {reporting ? (
              <div className="safety-sheet__actions">
                {REASONS.map((reason) => (
                  <button key={reason.id} type="button" className="safety-sheet__action" disabled={busy} onClick={() => { void submitReport(reason.id); }}>
                    {reason.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="safety-sheet__actions">
                <button type="button" className="safety-sheet__action" disabled={busy} onClick={() => setReporting(true)}>
                  Report chart
                </button>
                <button type="button" className="safety-sheet__action" disabled={busy} onClick={() => { void submitBlock(); }}>
                  Block {authorName}
                </button>
              </div>
            )}
            <button type="button" className="safety-sheet__action safety-sheet__cancel" disabled={busy} onClick={() => (reporting ? setReporting(false) : close())}>
              {reporting ? 'Back' : 'Cancel'}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
