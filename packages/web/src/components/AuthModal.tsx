import { Link } from 'react-router-dom';
import { isNativeApp } from '../services/native';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import LogIn from 'lucide-react/dist/esm/icons/log-in';
import X from 'lucide-react/dist/esm/icons/x';
import { useAuth } from '../hooks/useAuth';
import { getReviewLoginStatus } from '../services/api';
import { Button } from './Button';
import './AuthModal.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function AppleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.55 8.43c-.02-1.9 1.55-2.81 1.62-2.86-.89-1.3-2.27-1.48-2.76-1.5-1.16-.12-2.28.69-2.87.69-.6 0-1.51-.67-2.49-.65-1.27.02-2.46.75-3.12 1.9-1.34 2.33-.34 5.76.95 7.65.64.93 1.39 1.97 2.38 1.93.96-.04 1.32-.61 2.48-.61 1.15 0 1.48.61 2.49.59 1.03-.02 1.68-.94 2.3-1.87.73-1.07 1.03-2.11 1.05-2.16-.02-.01-2-.77-2.03-3.11zM10.84 2.9c.52-.64.88-1.52.78-2.4-.75.03-1.68.51-2.22 1.14-.48.56-.91 1.47-.8 2.33.85.07 1.71-.43 2.24-1.07z"
      />
    </svg>
  );
}

function ReviewerSignIn({
  isSigningIn,
  onSubmit,
}: {
  isSigningIn: boolean;
  onSubmit: (email: string, password: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let cancelled = false;
    getReviewLoginStatus()
      .then((status) => {
        if (!cancelled) setEnabled(status.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;

  return (
    <div className="auth-modal__review">
      <button
        type="button"
        className="auth-modal__review-toggle"
        aria-expanded={open}
        aria-controls="auth-modal-review-form"
        onClick={() => setOpen((current) => !current)}
      >
        Reviewer sign-in
      </button>
      {open && (
        <form
          id="auth-modal-review-form"
          className="auth-modal__review-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(email, password);
          }}
        >
          <label className="auth-modal__review-label">
            Email
            <input
              type="email"
              name="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="auth-modal__review-label">
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              spellCheck={false}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="auth-modal__review-submit" disabled={isSigningIn || !email.trim() || !password}>
            {isSigningIn ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}
    </div>
  );
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, loginWithApple, loginWithReview, error, isSigningIn } = useAuth();
  const native = isNativeApp();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]');
        if (controls?.length) {
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          className="auth-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="auth-modal__header">
              <div>
                <p className="auth-modal__eyebrow">Welcome to Chartsuno</p>
                <h2 id="auth-modal-title" className="auth-modal__title">
                  Sign in or create an account
                </h2>
              </div>
              <button className="auth-modal__close" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="auth-modal__body">
              <p className="auth-modal__copy">
                Sign in to save your charts, like discoveries, and pick up where you left off.
              </p>
              {error && <p className="auth-modal__error" role="alert">{error}</p>}
              {native && (
                <button
                  type="button"
                  className="auth-modal__apple"
                  onClick={() => { void loginWithApple(); }}
                  disabled={isSigningIn}
                  aria-busy={isSigningIn}
                >
                  <AppleMark />
                  {isSigningIn ? 'Signing in…' : 'Sign in with Apple'}
                </button>
              )}
              <Button variant="primary" fullWidth onClick={login} disabled={isSigningIn} aria-busy={isSigningIn}>
                <LogIn size={16} />
                {isSigningIn ? 'Signing in…' : 'Continue with Google'}
              </Button>
              <p className="auth-modal__footnote">
                {native
                  ? 'Your chart stays on this screen. Apple and Google sign-in open in a secure system sheet and return here.'
                  : 'Sign in securely with your Google account.'}
              </p>
              {native && (
                <ReviewerSignIn
                  isSigningIn={isSigningIn}
                  onSubmit={(email, password) => { void loginWithReview(email, password); }}
                />
              )}
              <p className="auth-modal__footnote"><Link to="/privacy" onClick={onClose}>Privacy policy</Link> · <Link to="/terms" onClick={onClose}>Terms of use</Link></p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
