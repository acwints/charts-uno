import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useOutletContext } from 'react-router-dom';
import Check from 'lucide-react/dist/esm/icons/check';
import X from 'lucide-react/dist/esm/icons/x';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Users from 'lucide-react/dist/esm/icons/users';
import { getInvitationByToken, acceptInvitation, type TeamInvitation } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import './InviteAccept.css';

interface OutletContextType {
  openAuthModal: () => void;
}

export function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const context = useOutletContext<OutletContextType>();

  const [invitation, setInvitation] = useState<TeamInvitation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setIsLoading(false);
      return;
    }

    async function fetchInvitation() {
      try {
        const inv = await getInvitationByToken(token!);
        setInvitation(inv);

        if (inv.accepted_at) {
          setError('This invitation has already been accepted');
        } else if (new Date(inv.expires_at) < new Date()) {
          setError('This invitation has expired');
        }
      } catch {
        setError('Invitation not found or has expired');
      } finally {
        setIsLoading(false);
      }
    }

    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!token || !isAuthenticated) return;

    setIsAccepting(true);
    try {
      await acceptInvitation(token);
      setAccepted(true);
      setTimeout(() => {
        navigate('/settings/team');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSignIn = () => {
    context?.openAuthModal?.();
  };

  if (isLoading || authLoading) {
    return (
      <div className="invite-accept">
        <div className="invite-accept__card">
          <Loader2 className="invite-accept__spinner" size={32} />
          <p className="invite-accept__loading-text">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="invite-accept">
        <div className="invite-accept__card invite-accept__card--error">
          <div className="invite-accept__icon invite-accept__icon--error">
            <X size={32} />
          </div>
          <h1 className="invite-accept__title">Unable to Join Team</h1>
          <p className="invite-accept__message">{error}</p>
          <Link to="/" className="invite-accept__link">
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="invite-accept">
        <div className="invite-accept__card invite-accept__card--success">
          <div className="invite-accept__icon invite-accept__icon--success">
            <Check size={32} />
          </div>
          <h1 className="invite-accept__title">Welcome to the Team!</h1>
          <p className="invite-accept__message">
            You've joined <strong>{invitation?.team?.name}</strong>
          </p>
          <p className="invite-accept__redirect">Redirecting to team settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-accept">
      <div className="invite-accept__card">
        <div className="invite-accept__icon">
          <Users size={32} />
        </div>
        <h1 className="invite-accept__title">Team Invitation</h1>

        <div className="invite-accept__details">
          <p className="invite-accept__team-name">
            You've been invited to join <strong>{invitation?.team?.name}</strong>
          </p>
          {invitation?.inviter && (
            <p className="invite-accept__inviter">
              Invited by {invitation.inviter.name || invitation.inviter.email}
            </p>
          )}
          <p className="invite-accept__role">
            Role: <span className="invite-accept__role-badge">{invitation?.role}</span>
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="invite-accept__auth">
            <p className="invite-accept__auth-message">
              Sign in to accept this invitation
            </p>
            <Button variant="primary" onClick={handleSignIn}>
              Sign in
            </Button>
          </div>
        ) : (
          <div className="invite-accept__actions">
            <Button
              variant="primary"
              onClick={handleAccept}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <>
                  <Loader2 className="invite-accept__button-spinner" size={16} />
                  Accepting...
                </>
              ) : (
                'Accept Invitation'
              )}
            </Button>
            <Link to="/" className="invite-accept__decline">
              Decline
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
