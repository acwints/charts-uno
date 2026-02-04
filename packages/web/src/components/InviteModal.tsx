import { useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import Mail from 'lucide-react/dist/esm/icons/mail';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Check from 'lucide-react/dist/esm/icons/check';
import { motion, AnimatePresence } from 'motion/react';
import { createInvitation, type TeamInvitation } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import './InviteModal.css';

interface InviteModalProps {
  teamId: string;
  teamName: string;
  isOpen: boolean;
  onClose: () => void;
  onInviteSent?: (invitation: TeamInvitation) => void;
  canInvite: boolean;
}

export function InviteModal({
  teamId,
  teamName,
  isOpen,
  onClose,
  onInviteSent,
  canInvite,
}: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) return;
    if (!canInvite) {
      toast.error('Seat limit reached. Upgrade your plan to invite more members.');
      return;
    }

    setIsSubmitting(true);

    try {
      const invitation = await createInvitation(teamId, email.trim(), role);
      toast.success(`Invitation sent to ${email}`);

      // Generate invite link (in production, this would be sent via email)
      const inviteLink = `${window.location.origin}/invite/${invitation.id}`;
      setLastInviteLink(inviteLink);

      setEmail('');
      onInviteSent?.(invitation);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyInviteLink = async () => {
    if (!lastInviteLink) return;

    try {
      await navigator.clipboard.writeText(lastInviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('member');
    setLastInviteLink(null);
    setCopied(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            className="invite-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <div className="invite-modal__header">
              <div className="invite-modal__title">
                <UserPlus size={20} />
                <span>Invite to {teamName}</span>
              </div>
              <button className="invite-modal__close" onClick={handleClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form className="invite-modal__form" onSubmit={handleSubmit}>
              <div className="invite-modal__field">
                <label className="invite-modal__label" htmlFor="invite-email">
                  Email address
                </label>
                <div className="invite-modal__input-wrapper">
                  <Mail size={16} className="invite-modal__input-icon" />
                  <input
                    id="invite-email"
                    type="email"
                    className="invite-modal__input"
                    placeholder="colleague@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="invite-modal__field">
                <label className="invite-modal__label">Role</label>
                <div className="invite-modal__roles">
                  <button
                    type="button"
                    className={`invite-modal__role ${role === 'member' ? 'invite-modal__role--active' : ''}`}
                    onClick={() => setRole('member')}
                  >
                    <span className="invite-modal__role-name">Member</span>
                    <span className="invite-modal__role-desc">Can view and create charts</span>
                  </button>
                  <button
                    type="button"
                    className={`invite-modal__role ${role === 'admin' ? 'invite-modal__role--active' : ''}`}
                    onClick={() => setRole('admin')}
                  >
                    <span className="invite-modal__role-name">Admin</span>
                    <span className="invite-modal__role-desc">Can manage team and billing</span>
                  </button>
                </div>
              </div>

              {!canInvite && (
                <div className="invite-modal__warning">
                  <span>Seat limit reached.</span>
                  <a href="/settings/billing">Upgrade plan</a>
                </div>
              )}

              <button
                type="submit"
                className="invite-modal__submit"
                disabled={isSubmitting || !canInvite || !email.trim()}
              >
                {isSubmitting ? 'Sending...' : 'Send Invitation'}
              </button>
            </form>

            {lastInviteLink && (
              <div className="invite-modal__link-section">
                <div className="invite-modal__link-header">
                  <span>Or share this invite link:</span>
                </div>
                <div className="invite-modal__link-row">
                  <input
                    type="text"
                    className="invite-modal__link-input"
                    value={lastInviteLink}
                    readOnly
                  />
                  <button
                    type="button"
                    className="invite-modal__copy"
                    onClick={copyInviteLink}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
