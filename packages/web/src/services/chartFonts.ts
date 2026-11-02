// The chart style faces (Inter, Nunito, DM Sans, Sora) are only needed once a
// chart renders. Loading them here keeps the feed's first paint free of them.
// They are self-hosted (public/fonts/chart-fonts.css) so a chart no longer waits
// on a third-party stylesheet plus a second font origin; the CSS mirrors Google
// Fonts' unicode-range slices, so browsers still fetch only the slices in use.
const CHART_FONTS_HREF = '/fonts/chart-fonts.css';

let requested = false;

export function ensureChartFonts(): void {
  if (requested || typeof document === 'undefined') return;
  requested = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CHART_FONTS_HREF;
  document.head.appendChild(link);
}
