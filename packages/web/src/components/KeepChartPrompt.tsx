import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import LogIn from 'lucide-react/dist/esm/icons/log-in';
import { armKeepPromptSignIn, reportKeepPromptClicked } from '../services/homepageChartEvent';
import { Button } from './Button';
import './KeepChartPrompt.css';

interface KeepChartPromptProps {
  open: boolean;
  onDismiss: () => void;
  onSignIn: () => void;
}

export function KeepChartPrompt({ open, onDismiss, onSignIn }: KeepChartPromptProps) {
  const signInRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    signInRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  return createPortal(
    <div className="keep-backdrop" onClick={onDismiss}>
      <div
        className="keep-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keep-chart-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="keep-chart-title" className="keep-title">Keep this chart</h2>
        <p className="keep-copy">Sign in with Google and this chart is saved to your account.</p>
        <Button
          ref={signInRef}
          variant="primary"
          size="lg"
          fullWidth
          className="keep-signin"
          onClick={() => {
            armKeepPromptSignIn();
            reportKeepPromptClicked();
            onSignIn();
          }}
        >
          <LogIn size={16} />
          Sign in with Google
        </Button>
        <button type="button" className="keep-dismiss" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>,
    document.body,
  );
}
