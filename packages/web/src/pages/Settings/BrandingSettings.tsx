import { useState, useEffect, useRef } from 'react';
import { ImageIcon, Upload, Trash2, Sparkles, Lock } from 'lucide-react';
import { useTeam } from '../../contexts/TeamContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/Button';
import { getTeamBranding, updateTeamBranding, deleteTeamLogo, type TeamBranding } from '../../services/api';
import { Link } from 'react-router-dom';

export function BrandingSettings() {
  const { currentTeam } = useTeam();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [branding, setBranding] = useState<TeamBranding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const isPaidPlan = currentTeam?.subscription?.plan && currentTeam.subscription.plan !== 'free';

  // Fetch branding settings
  useEffect(() => {
    if (!currentTeam?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    getTeamBranding(currentTeam.id)
      .then(setBranding)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to load branding settings');
      })
      .finally(() => setIsLoading(false));
  }, [currentTeam?.id]);

  const handleToggleWatermark = async () => {
    if (!currentTeam?.id || !branding) return;

    setIsSaving(true);
    try {
      const updated = await updateTeamBranding(currentTeam.id, {
        watermark_enabled: !branding.watermark_enabled,
      });
      setBranding(updated);
      toast.success(updated.watermark_enabled ? 'Watermark enabled' : 'Watermark disabled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update watermark setting');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTeam?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 500KB)
    if (file.size > 500 * 1024) {
      toast.error('Image must be smaller than 500KB');
      return;
    }

    setIsUploading(true);
    try {
      // Convert to base64 data URL
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const updated = await updateTeamBranding(currentTeam.id, {
            custom_logo_url: base64,
          });
          setBranding(updated);
          toast.success('Logo uploaded successfully');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to upload logo');
        } finally {
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        toast.error('Failed to read file');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('Failed to process image');
      setIsUploading(false);
    }

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDeleteLogo = async () => {
    if (!currentTeam?.id) return;

    setIsSaving(true);
    try {
      await deleteTeamLogo(currentTeam.id);
      setBranding((prev) => prev ? { ...prev, custom_logo_url: null } : null);
      toast.success('Logo removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove logo');
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentTeam) {
    return (
      <div className="settings-empty">
        <ImageIcon size={48} className="settings-empty__icon" />
        <p className="settings-empty__text">No team selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="settings-section">
        <div className="settings-section__header">
          <h1 className="settings-section__title">Branding</h1>
        </div>
        <div className="settings-card">
          <p className="settings-muted-text">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <div className="settings-section__header">
        <h1 className="settings-section__title">Branding</h1>
        <p className="settings-section__description">
          Customize the watermark on exported PNG images
        </p>
      </div>

      {/* Upgrade prompt for free users */}
      {!isPaidPlan && (
        <div className="settings-card settings-card--warning">
          <div className="branding-upgrade">
            <div className="branding-upgrade__icon">
              <Lock size={24} />
            </div>
            <div className="branding-upgrade__content">
              <h3 className="branding-upgrade__title">Upgrade to customize branding</h3>
              <p className="branding-upgrade__text">
                Free accounts include an "Epic Charts" watermark on all exported images.
                Upgrade to Pro or Business to remove the watermark or add your own logo.
              </p>
              <Link to="/settings/billing" className="settings-warning-link">
                <Button variant="primary">
                  <Sparkles size={16} />
                  Upgrade Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Watermark Preview */}
      <div className="settings-card">
        <div className="settings-card__header">
          <h3 className="settings-card__title">Watermark Preview</h3>
        </div>
        <div className="settings-card__content">
          <div className="branding-preview">
            <div className="branding-preview__chart">
              <div className="branding-preview__placeholder">
                <span>Chart Preview</span>
              </div>
              {(branding?.watermark_enabled !== false || !isPaidPlan) && (
                <div className="branding-preview__watermark">
                  {branding?.custom_logo_url ? (
                    <img
                      src={branding.custom_logo_url}
                      alt="Custom logo"
                      className="branding-preview__logo"
                    />
                  ) : (
                    <span className="branding-preview__text">Epic Charts</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Watermark Toggle - only for paid users */}
      {isPaidPlan && (
        <div className="settings-card">
          <div className="settings-card__header">
            <h3 className="settings-card__title">Watermark Settings</h3>
          </div>
          <div className="settings-card__content">
            <div className="branding-toggle">
              <div className="branding-toggle__info">
                <span className="branding-toggle__label">Show watermark on exports</span>
                <span className="branding-toggle__description">
                  When disabled, exported images will have no watermark
                </span>
              </div>
              <button
                className={`branding-toggle__switch ${branding?.watermark_enabled !== false ? 'branding-toggle__switch--on' : ''}`}
                onClick={handleToggleWatermark}
                disabled={isSaving}
                aria-pressed={branding?.watermark_enabled !== false}
              >
                <span className="branding-toggle__switch-thumb" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Logo Upload - only for paid users */}
      {isPaidPlan && (
        <div className="settings-card">
          <div className="settings-card__header">
            <h3 className="settings-card__title">Custom Logo</h3>
          </div>
          <div className="settings-card__content">
            <p className="settings-muted-text" style={{ marginBottom: '16px' }}>
              Upload a custom logo to replace the default "Epic Charts" text watermark.
              For best results, use a PNG with transparency, max 500KB.
            </p>

            <div className="branding-logo-upload">
              {branding?.custom_logo_url ? (
                <div className="branding-logo-current">
                  <img
                    src={branding.custom_logo_url}
                    alt="Current logo"
                    className="branding-logo-current__image"
                  />
                  <div className="branding-logo-current__actions">
                    <Button onClick={handleFileSelect} disabled={isUploading}>
                      <Upload size={16} />
                      Replace
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleDeleteLogo}
                      disabled={isSaving}
                      className="branding-logo-delete"
                    >
                      <Trash2 size={16} />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  className="branding-logo-dropzone"
                  onClick={handleFileSelect}
                  disabled={isUploading}
                >
                  <Upload size={24} />
                  <span>{isUploading ? 'Uploading...' : 'Click to upload logo'}</span>
                  <span className="branding-logo-dropzone__hint">PNG, JPG up to 500KB</span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
