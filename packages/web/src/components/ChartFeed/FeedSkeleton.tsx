import './FeedSkeleton.css';

interface FeedSkeletonProps {
  count?: number;
}

// Shimmer placeholders matching the feed card layout, shown while the first
// page loads so the feed appears instantly instead of behind a spinner.
export function FeedSkeleton({ count = 3 }: FeedSkeletonProps) {
  return (
    <div className="feed-skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="feed-skeleton__card">
          <div className="feed-skeleton__header">
            <span className="feed-skeleton__avatar" />
            <span className="feed-skeleton__line feed-skeleton__line--name" />
          </div>
          <div className="feed-skeleton__media" />
          <div className="feed-skeleton__footer">
            <span className="feed-skeleton__line feed-skeleton__line--wide" />
            <span className="feed-skeleton__line" />
          </div>
        </div>
      ))}
    </div>
  );
}
