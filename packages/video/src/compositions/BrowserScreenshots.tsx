import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
  staticFile,
  Easing,
} from 'remotion';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '../lib/constants';

export interface BrowserScreenshotsProps {
  /** Paths to screenshot images (relative to public/ or absolute URLs) */
  screenshotPaths: string[];
  /** Seconds to hold each screenshot before crossfading (default: scene duration / screenshots) */
  holdDurationSeconds?: number;
  /** Ken Burns zoom amount (1.0 = no zoom, 1.08 = subtle, default: 1.06) */
  zoomAmount?: number;
}

/**
 * Renders a sequence of browser screenshots with:
 * - Ken Burns effect (subtle slow zoom on each frame)
 * - Crossfade transitions between screenshots
 * - Spring-based easing via Remotion's interpolate()
 *
 * Used by the `browser-remotion` capture method to polish
 * raw screenshots into a cinematic scene.
 */
export const BrowserScreenshots: React.FC<BrowserScreenshotsProps> = ({
  screenshotPaths,
  holdDurationSeconds,
  zoomAmount = 1.06,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const count = screenshotPaths.length;
  if (count === 0) return null;

  // Calculate frames per screenshot (equal distribution)
  const framesPerShot = holdDurationSeconds
    ? Math.round(holdDurationSeconds * fps)
    : Math.round(durationInFrames / count);

  // Crossfade duration in frames (0.4s)
  const crossfadeDuration = Math.round(fps * 0.4);

  return (
    <div
      style={{
        position: 'relative',
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        overflow: 'hidden',
        backgroundColor: '#0a0a0a',
      }}
    >
      {screenshotPaths.map((path, i) => {
        const startFrame = i * framesPerShot;
        const endFrame = startFrame + framesPerShot;

        // Opacity: fade in at start, hold, fade out at end
        const fadeIn = i === 0
          ? 1
          : interpolate(
              frame,
              [startFrame, startFrame + crossfadeDuration],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) },
            );

        const fadeOut = i === count - 1
          ? interpolate(
              frame,
              [durationInFrames - 10, durationInFrames],
              [1, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            )
          : interpolate(
              frame,
              [endFrame - crossfadeDuration, endFrame],
              [1, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) },
            );

        const opacity = Math.min(fadeIn, fadeOut);

        // Ken Burns: slow zoom from 1.0 to zoomAmount over the hold duration
        const localProgress = interpolate(
          frame,
          [startFrame, endFrame],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );

        // Alternate zoom direction for visual variety
        const scale = i % 2 === 0
          ? interpolate(localProgress, [0, 1], [1, zoomAmount])
          : interpolate(localProgress, [0, 1], [zoomAmount, 1]);

        // Skip rendering frames far outside this screenshot's window
        if (frame < startFrame - crossfadeDuration || frame > endFrame + crossfadeDuration) {
          return null;
        }

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: VIDEO_WIDTH,
              height: VIDEO_HEIGHT,
              opacity,
              transform: `scale(${scale})`,
              transformOrigin: i % 2 === 0 ? 'center center' : '60% 40%',
            }}
          >
            <Img
              src={path.startsWith('/') || path.startsWith('http') ? path : staticFile(path)}
              style={{
                width: VIDEO_WIDTH,
                height: VIDEO_HEIGHT,
                objectFit: 'cover',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
