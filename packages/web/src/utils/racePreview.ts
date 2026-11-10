// Resolve one shared final frame, honoring the same explicit carry-forward
// policy as the race renderer. Never borrow observations beyond that frame.
export function racePreviewRows(data: { labels: string[]; series: { name: string; data: Array<number | null> }[] }, holdLast: boolean, limit = 8) {
  const frame = data.labels.length - 1;
  return data.series.map(series => {
    let value: number | null = null;
    for (let index = frame; index >= 0; index--) {
      const candidate = series.data[index];
      if (typeof candidate === 'number' && Number.isFinite(candidate)) { value = candidate; break; }
      if (!holdLast) break;
    }
    return { name: series.name, value };
  }).filter((row): row is { name: string; value: number } => row.value !== null)
    .sort((a, b) => b.value - a.value).slice(0, limit);
}
