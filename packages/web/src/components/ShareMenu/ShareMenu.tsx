import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Clipboard from 'lucide-react/dist/esm/icons/clipboard';
import Check from 'lucide-react/dist/esm/icons/check';
import Linkedin from 'lucide-react/dist/esm/icons/linkedin';
import { copyImageToClipboard, type WatermarkSettings } from '../../services/exportService';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../Button';
import './ShareMenu.css';

type SharePlatform = 'x' | 'linkedin';
type ShareActivity = SharePlatform | 'copy';

interface ShareMenuProps {
  chartRef: React.RefObject<HTMLElement | null>;
  chartId?: string;
  isPublic?: boolean;
  title?: string;
  watermark?: WatermarkSettings;
  isAuthenticated?: boolean;
}

function XMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

export function ShareMenu({
  chartRef,
  chartId,
  isPublic = false,
  title,
  watermark,
  isAuthenticated = false,
}: ShareMenuProps) {
  const [copiedImage, setCopiedImage] = useState(false);
  const [shareActivity, setShareActivity] = useState<ShareActivity | null>(null);
  const [pasteHint, setPasteHint] = useState<SharePlatform | null>(null);
  const toast = useToast();

  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const pasteShortcut = isMac ? '⌘V' : 'Ctrl+V';
  const isShareDisabled = shareActivity !== null || !isAuthenticated;

  const publicChartUrl = chartId && isPublic
    ? `${window.location.origin}/chart/${chartId}`
    : null;

  const getComposeUrl = (platform: SharePlatform) => {
    if (platform === 'linkedin') {
      // LinkedIn does not offer a safe text-prefill web intent. Opening the
      // composer keeps the copied chart image as the primary share artifact.
      return 'https://www.linkedin.com/feed/?shareActive=true';
    }

    const text = title?.trim() || 'A chart made with Chartsuno';
    const params = new URLSearchParams({ text });
    if (publicChartUrl) params.set('url', publicChartUrl);
    return `https://twitter.com/intent/tweet?${params.toString()}`;
  };

  const copyChartImage = async () => {
    if (!chartRef.current) throw new Error('Chart preview is not available');
    await copyImageToClipboard(chartRef.current, watermark);
  };

  const handleCopyImage = async () => {
    setShareActivity('copy');
    try {
      await copyChartImage();
      setCopiedImage(true);
      toast.success('Chart image copied. Paste it anywhere with ⌘V / Ctrl+V.');
      window.setTimeout(() => setCopiedImage(false), 2000);
    } catch (error) {
      console.error('Copy image failed:', error);
      toast.error('Unable to copy the chart image. Try Download instead.');
    } finally {
      setShareActivity(null);
    }
  };

  const handleSocialShare = async (platform: SharePlatform) => {
    if (!chartRef.current) return;

    // Open synchronously so popup blockers do not swallow the composer while
    // the chart is being rendered to the clipboard.
    window.open(
      getComposeUrl(platform),
      `chartsuno-share-${platform}`,
      'popup,width=760,height=760,noopener,noreferrer',
    );

    setShareActivity(platform);
    try {
      await copyChartImage();
      setPasteHint(platform);
      window.setTimeout(() => setPasteHint(null), 5000);
    } catch (error) {
      console.error('Social share image copy failed:', error);
      toast.error('The post composer opened, but the image could not be copied. Use Download instead.');
    } finally {
      setShareActivity(null);
    }
  };

  return (
    <div className="share-actions" role="group" aria-label="Share chart">
      <Button
        variant="default"
        size="sm"
        className="share-action share-action--x"
        onClick={() => handleSocialShare('x')}
        disabled={isShareDisabled}
        aria-label="Share chart to X"
        aria-busy={shareActivity === 'x'}
      >
        <XMark size={15} />
        <span><span className="share-action-prefix">Share to </span>X</span>
      </Button>

      <Button
        variant="default"
        size="sm"
        className="share-action share-action--linkedin"
        onClick={() => handleSocialShare('linkedin')}
        disabled={isShareDisabled}
        aria-label="Share chart to LinkedIn"
        aria-busy={shareActivity === 'linkedin'}
      >
        <Linkedin size={16} />
        <span><span className="share-action-prefix">Share to </span>LinkedIn</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="share-action share-action--copy"
        onClick={handleCopyImage}
        disabled={isShareDisabled}
        aria-busy={shareActivity === 'copy'}
        aria-label={copiedImage ? 'Chart image copied' : 'Copy chart image'}
        title={copiedImage ? 'Chart image copied' : 'Copy chart image'}
      >
        <span className="share-action-icon" aria-hidden="true">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={copiedImage ? 'copied' : 'copy'}
              className={copiedImage ? 'share-action-icon--success' : undefined}
              initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            >
              {copiedImage ? <Check size={16} /> : <Clipboard size={16} />}
            </motion.span>
          </AnimatePresence>
        </span>
      </Button>

      <AnimatePresence initial={false}>
        {pasteHint && (
          <motion.div
            className="share-paste-hint"
            role="status"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <Check size={14} className="paste-hint-icon" />
            <span>
              Chart copied — paste it into your {pasteHint === 'x' ? 'post on X' : 'LinkedIn post'} with {pasteShortcut}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
