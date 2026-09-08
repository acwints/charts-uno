// The five chart style faces (Inter, Nunito, DM Sans, Sora and Instrument
// Serif italics) are only needed once a chart renders. Loading them here keeps
// the feed's first paint free of any Google Fonts request.
const CHART_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Inter:wght@400;500;600;700&family=Nunito:wght@400;500;600;700&family=Sora:wght@400;500;600;700&display=swap';

let requested = false;

export function ensureChartFonts(): void {
  if (requested || typeof document === 'undefined') return;
  requested = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CHART_FONTS_HREF;
  document.head.appendChild(link);
}
