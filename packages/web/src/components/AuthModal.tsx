import { Link } from 'react-router-dom';
import { isNativeApp } from '../services/native';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import LogIn from 'lucide-react/dist/esm/icons/log-in';
import X from 'lucide-react/dist/esm/icons/x';
import { useAuth } from '../hooks/useAuth';
import { Button } from './Button';
import './AuthModal.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, error, isSigningIn } = useAuth();
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
              <Button variant="primary" fullWidth onClick={login} disabled={isSigningIn} aria-busy={isSigningIn}>
                <LogIn size={16} />
                {isSigningIn ? 'Signing in…' : 'Continue with Google'}
              </Button>
              <p className="auth-modal__footnote">
                {isNativeApp() ? 'Your charts stay here while you sign in securely with Google.' : 'Sign in securely with your Google account.'}
              </p>
              <p className="auth-modal__footnote"><Link to="/privacy" onClick={onClose}>Privacy policy</Link> · <Link to="/terms" onClick={onClose}>Terms of use</Link></p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
