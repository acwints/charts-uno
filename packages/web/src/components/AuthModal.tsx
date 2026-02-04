import { useEffect } from 'react';
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
  const { login } = useAuth();

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="auth-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
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
                <p className="auth-modal__eyebrow">Welcome to Epic Charts</p>
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
                Sign in to save charts, manage teams, and handle billing from your account settings.
              </p>
              <Button variant="primary" fullWidth onClick={login}>
                <LogIn size={16} />
                Continue with Google
              </Button>
              <p className="auth-modal__footnote">
                We only use Google to verify your account. No billing happens until after login.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
