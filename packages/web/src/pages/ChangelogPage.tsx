import { useEffect, useState } from 'react';
import { getShippedCount, getShippedImprovements, type ShippedImprovement } from '../services/api';
import './ChangelogPage.css';

function formatShipped(value: string): string {
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function ChangelogPage() {
  const [items, setItems] = useState<ShippedImprovement[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [listError, setListError] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Shipped from your feedback';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    let live = true;
    getShippedImprovements()
      .then((body) => { if (live) setItems(body.items); })
      .catch(() => { if (live) setListError(true); });
    getShippedCount()
      .then((body) => { if (live) setCount(body.count); })
      .catch(() => { if (live) setCount(null); });
    return () => { live = false; };
  }, []);

  const countLabel = count === null ? null : `${count} shipped`;

  return (
    <article className="changelog">
      <h1>Shipped from your feedback</h1>
      {countLabel && <p className="changelog-count">{countLabel}</p>}
      {listError && <p className="changelog-empty">Couldn&apos;t load what shipped.</p>}
      {items && items.length === 0 && !listError && (
        <p className="changelog-empty">Nothing has shipped yet.</p>
      )}
      {items && items.length > 0 && (
        <div className="changelog-list">
          {items.map((item) => (
            <article key={item.id} className="changelog-item">
              <time dateTime={item.shipped_at}>{formatShipped(item.shipped_at)}</time>
              {item.public_note ? <p>{item.public_note}</p> : null}
            </article>
          ))}
        </div>
      )}
    </article>
  );
}
