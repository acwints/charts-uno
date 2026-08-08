import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Heart from 'lucide-react/dist/esm/icons/heart';
import Bookmark from 'lucide-react/dist/esm/icons/bookmark';
import Send from 'lucide-react/dist/esm/icons/send';
import Check from 'lucide-react/dist/esm/icons/check';
import User from 'lucide-react/dist/esm/icons/user';
import Eye from 'lucide-react/dist/esm/icons/eye';
import type { ChartResponse } from '../../services/api';
import { likeChart, unlikeChart, saveChart, unsaveChart } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { MiniChartPreview } from '../MiniChartPreview';
import './InstaChartCard.css';

interface InstaChartCardProps {
  chart: ChartResponse;
  onChartClick?: (chart: ChartResponse) => void;
  onUpdate?: (chart: ChartResponse) => void;
  onAuthRequired?: () => void;
}

const DOUBLE_TAP_MS = 300;

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  return date.toLocaleDateString();
}

// Full-bleed feed card: tap opens the chart, double-tap likes it,
// actions row mirrors the like/save/share affordances of a social feed.
export function InstaChartCard({ chart, onChartClick, onUpdate, onAuthRequired }: InstaChartCardProps) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(chart.is_liked);
  const [likeCount, setLikeCount] = useState(chart.like_count);
  const [isSaved, setIsSaved] = useState(chart.is_saved);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const [justShared, setJustShared] = useState(false);
  const tapTimerRef = useRef<number | null>(null);

  const toggleLike = async (forceOn = false) => {
    if (!user) {
      onAuthRequired?.();
      return;
    }
    if (isLikeLoading || (forceOn && isLiked)) return;

    setIsLikeLoading(true);
    try {
      if (isLiked && !forceOn) {
        await unlikeChart(chart.id);
        setIsLiked(false);
        setLikeCount((prev) => prev - 1);
        onUpdate?.({ ...chart, is_liked: false, like_count: likeCount - 1 });
      } else {
        await likeChart(chart.id);
        setIsLiked(true);
        setLikeCount((prev) => prev + 1);
        onUpdate?.({ ...chart, is_liked: true, like_count: likeCount + 1 });
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    } finally {
      setIsLikeLoading(false);
    }
  };

  const toggleSave = async () => {
    if (!user) {
      onAuthRequired?.();
      return;
    }
    if (isSaveLoading) return;

    setIsSaveLoading(true);
    try {
      if (isSaved) {
        await unsaveChart(chart.id);
        setIsSaved(false);
        onUpdate?.({ ...chart, is_saved: false });
      } else {
        await saveChart(chart.id);
        setIsSaved(true);
        onUpdate?.({ ...chart, is_saved: true });
      }
    } catch (error) {
      console.error('Failed to toggle save:', error);
    } finally {
      setIsSaveLoading(false);
    }
  };

  const handleShare = async () => {
    const title = chart.title || chart.config.title || 'Chart on Chartsuno';
    const url = `${window.location.origin}/chart/${chart.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setJustShared(true);
      window.setTimeout(() => setJustShared(false), 1500);
    } catch (error) {
      console.error('Failed to copy share link:', error);
    }
  };

  // Single tap opens the chart, double tap likes it. The first tap arms a
  // short timer; a second tap inside the window cancels navigation.
  const handleMediaTap = () => {
    if (tapTimerRef.current !== null) {
      window.clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      setShowBurst(true);
      window.setTimeout(() => setShowBurst(false), 900);
      toggleLike(true);
      return;
    }

    tapTimerRef.current = window.setTimeout(() => {
      tapTimerRef.current = null;
      onChartClick?.(chart);
    }, DOUBLE_TAP_MS);
  };

  const authorName = chart.user?.name || 'Anonymous';
  const caption = chart.title || chart.config.title || 'Untitled Chart';

  return (
    <article className="insta-card">
      <header className="insta-card__header">
        {chart.user?.picture ? (
          <img src={chart.user.picture} alt="" className="insta-card__avatar" />
        ) : (
          <div className="insta-card__avatar insta-card__avatar--placeholder">
            <User size={16} />
          </div>
        )}
        <div className="insta-card__byline">
          <span className="insta-card__author">{authorName}</span>
          <span className="insta-card__date">{formatRelativeDate(chart.created_at)}</span>
        </div>
        <span className="insta-card__type">{chart.config.type}</span>
      </header>

      <button
        type="button"
        className="insta-card__media"
        onClick={handleMediaTap}
        aria-label={`Open chart: ${caption}. Double tap to like.`}
      >
        <MiniChartPreview
          className="insta-card__preview"
          data={chart.data}
          config={chart.config}
          minHeight={280}
        />
        <AnimatePresence>
          {showBurst && (
            <motion.div
              className="insta-card__burst"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1.1, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden="true"
            >
              <Heart size={72} fill="currentColor" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <div className="insta-card__actions">
        <button
          className={`insta-card__action ${isLiked ? 'insta-card__action--liked' : ''}`}
          onClick={() => toggleLike()}
          disabled={isLikeLoading}
          aria-label={isLiked ? 'Unlike' : 'Like'}
          aria-pressed={isLiked}
        >
          <Heart size={24} fill={isLiked ? 'currentColor' : 'none'} />
        </button>
        <button
          className="insta-card__action"
          onClick={handleShare}
          aria-label={justShared ? 'Link copied' : 'Share'}
        >
          {justShared ? <Check size={24} /> : <Send size={24} />}
        </button>
        <div className="insta-card__views">
          <Eye size={16} />
          <span>{chart.view_count}</span>
        </div>
        <button
          className={`insta-card__action insta-card__action--save ${isSaved ? 'insta-card__action--saved' : ''}`}
          onClick={toggleSave}
          disabled={isSaveLoading}
          aria-label={isSaved ? 'Remove from saved' : 'Save'}
          aria-pressed={isSaved}
        >
          <Bookmark size={24} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="insta-card__body">
        <span className="insta-card__likes">
          {likeCount} {likeCount === 1 ? 'like' : 'likes'}
        </span>
        <p className="insta-card__caption">
          <span className="insta-card__author">{authorName}</span> {caption}
        </p>
        {chart.description && (
          <p className="insta-card__description">{chart.description}</p>
        )}
      </div>
    </article>
  );
}
