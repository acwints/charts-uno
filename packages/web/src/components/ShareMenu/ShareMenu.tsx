import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, Clipboard, Check, ExternalLink } from 'lucide-react';
import { copyImageToClipboard, type WatermarkSettings } from '../../services/exportService';
import { Button } from '../Button';
import './ShareMenu.css';

interface ShareMenuProps {
  chartRef: React.RefObject<HTMLElement | null>;
  title?: string;
  watermark?: WatermarkSettings;
  shareUrl?: string | null;
}

export function ShareMenu({ chartRef, title, watermark, shareUrl }: ShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copying, setCopying] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCopyImage = async () => {
    if (!chartRef.current) return;
    setCopying(true);
    try {
      await copyImageToClipboard(chartRef.current, watermark);
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    } finally {
      setCopying(false);
      setIsOpen(false);
    }
  };

  const handleSocialShare = (platform: 'twitter' | 'linkedin') => {
    if (!shareUrl) return;
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(title ? `Check out "${title}"` : 'Check out this chart');
    const targetUrl =
      platform === 'twitter'
        ? `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`
        : `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  return (
    <div className="share-menu" ref={menuRef}>
      <Button
        variant="default"
        size="sm"
        className="share-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Share2 size={16} />
        <span>Share</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="share-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
          >
            <button
              className="share-option"
              onClick={handleCopyImage}
              disabled={copying}
            >
              {copiedImage ? <Check size={16} className="copied-icon" /> : <Clipboard size={16} />}
              <span>{copiedImage ? 'Copied Image!' : 'Copy Image'}</span>
              {copying && <span className="share-loading">...</span>}
            </button>

            <div className="share-divider" />

            <button
              className="share-option"
              onClick={() => handleSocialShare('twitter')}
              disabled={!shareUrl}
            >
              <ExternalLink size={16} />
              <span>Post on Twitter</span>
            </button>

            <button
              className="share-option"
              onClick={() => handleSocialShare('linkedin')}
              disabled={!shareUrl}
            >
              <ExternalLink size={16} />
              <span>Post on LinkedIn</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
