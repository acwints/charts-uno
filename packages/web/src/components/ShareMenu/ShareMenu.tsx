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
  isAuthenticated?: boolean;
}

export function ShareMenu({
  chartRef,
  title,
  watermark,
  isAuthenticated = false,
}: ShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copying, setCopying] = useState(false);
  const [pasteHint, setPasteHint] = useState<'twitter' | 'linkedin' | null>(null);
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

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const pasteShortcut = isMac ? '⌘V' : 'Ctrl+V';

  const handleSocialShare = async (platform: 'twitter' | 'linkedin') => {
    if (!chartRef.current) return;
    setCopying(true);
    try {
      // Copy chart image to clipboard first
      await copyImageToClipboard(chartRef.current, watermark);

      // Open the compose window
      const text = title ? `Check out "${title}"` : 'Check out this chart';
      const encodedText = encodeURIComponent(text);
      const composeUrl =
        platform === 'twitter'
          ? `https://twitter.com/intent/tweet?text=${encodedText}`
          : `https://www.linkedin.com/feed/?shareActive=true`;
      window.open(composeUrl, '_blank', 'noopener,noreferrer');

      // Show paste hint
      setPasteHint(platform);
      setTimeout(() => setPasteHint(null), 4000);
    } finally {
      setCopying(false);
      setIsOpen(false);
    }
  };

  const isShareDisabled = copying || !isAuthenticated;

  return (
    <div className="share-menu" ref={menuRef}>
      <Button
        variant="default"
        size="sm"
        className="share-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={!isAuthenticated}
      >
        <Share2 size={16} />
        <span>Share</span>
      </Button>

      <AnimatePresence>
        {pasteHint && (
          <motion.div
            className="share-paste-hint"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <Check size={14} className="paste-hint-icon" />
            <span>Image copied — paste into your {pasteHint === 'twitter' ? 'tweet' : 'post'} with {pasteShortcut}</span>
          </motion.div>
        )}
      </AnimatePresence>

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
              disabled={isShareDisabled}
            >
              {copiedImage ? <Check size={16} className="copied-icon" /> : <Clipboard size={16} />}
              <span>{copiedImage ? 'Copied Image!' : 'Copy Image'}</span>
              {copying && <span className="share-loading">...</span>}
            </button>

            <div className="share-divider" />

            <button
              className="share-option"
              onClick={() => handleSocialShare('twitter')}
              disabled={isShareDisabled}
            >
              <ExternalLink size={16} />
              <span>{copying ? 'Copying image...' : 'Post on X / Twitter'}</span>
            </button>

            <button
              className="share-option"
              onClick={() => handleSocialShare('linkedin')}
              disabled={isShareDisabled}
            >
              <ExternalLink size={16} />
              <span>{copying ? 'Copying image...' : 'Post on LinkedIn'}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
