import { referralShareUrl } from './referrals';

const REFERRAL_RE = /^[A-Za-z0-9_-]{8,16}$/;

export const CREDIT_LABEL = 'Made with Chartsuno';
export const CREDIT_HOME = 'https://www.chartsuno.com/';

/** Invite link for a chart credit. Logged-out visitors get the plain homepage. */
export function creditHref(code: string | null | undefined): string {
  if (code && REFERRAL_RE.test(code)) return referralShareUrl(code);
  return CREDIT_HOME;
}

/** Only the public site, with an optional invite code, may be linked from an export. */
export function safeCreditHref(href: string | null | undefined): string {
  if (!href) return CREDIT_HOME;
  try {
    const url = new URL(href);
    const ref = url.searchParams.get('ref');
    const onlyRef = url.search === '' || (ref != null && url.search === `?ref=${ref}`);
    if (url.origin === 'https://www.chartsuno.com' && url.pathname === '/' && onlyRef && (ref == null || REFERRAL_RE.test(ref))) {
      return ref ? referralShareUrl(ref) : CREDIT_HOME;
    }
  } catch {
    // A bad credit target falls back to the homepage.
  }
  return CREDIT_HOME;
}

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export interface CreditChartData {
  labels: string[];
  series: { name: string; data: Array<number | null> }[];
}

function creditAnchor(href: string, x: number, y: number): string {
  return `<a href="${xml(safeCreditHref(href))}"><text x="${x}" y="${y}" text-anchor="end" font-size="12" font-family="Manrope, sans-serif" fill="#5c6170">${CREDIT_LABEL}</text></a>`;
}

function readBox(svg: SVGSVGElement): { minX: number; minY: number; width: number; height: number } {
  const view = svg.getAttribute('viewBox');
  if (view) {
    const parts = view.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((part) => Number.isFinite(part)) && parts[2] > 0 && parts[3] > 0) {
      return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
    }
  }
  const width = Number(svg.getAttribute('width'));
  const height = Number(svg.getAttribute('height'));
  return {
    minX: 0,
    minY: 0,
    width: Number.isFinite(width) && width > 0 ? width : 640,
    height: Number.isFinite(height) && height > 0 ? height : 360,
  };
}

/** Chart SVG plus a small credit link. A table export is used when the markup is not an SVG. */
export function svgWithCredit(svgMarkup: string, href: string): string {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg || doc.querySelector('parsererror')) {
    return tableChartSvg({ labels: [], series: [] }, href);
  }
  const box = readBox(svg);
  const extra = 28;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('viewBox', `${box.minX} ${box.minY} ${box.width} ${box.height + extra}`);
  const heightAttr = svg.getAttribute('height');
  if (heightAttr && /^\d+(\.\d+)?$/.test(heightAttr)) {
    svg.setAttribute('height', String(Number(heightAttr) + extra));
  }
  const link = doc.createElementNS('http://www.w3.org/2000/svg', 'a');
  link.setAttribute('href', safeCreditHref(href));
  const text = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', String(box.minX + box.width - 8));
  text.setAttribute('y', String(box.minY + box.height + 18));
  text.setAttribute('text-anchor', 'end');
  text.setAttribute('font-size', '12');
  text.setAttribute('font-family', 'Manrope, sans-serif');
  text.setAttribute('fill', '#5c6170');
  text.textContent = CREDIT_LABEL;
  link.appendChild(text);
  svg.appendChild(link);
  return new XMLSerializer().serializeToString(svg);
}

/** SVG for a chart that is not already an SVG, such as a table, with the same credit. */
export function tableChartSvg(data: CreditChartData, href: string): string {
  const labels = data.labels.slice(0, 12);
  const series = data.series.slice(0, 3);
  const rowCount = Math.max(labels.length, 1);
  const width = 640;
  const height = 48 + rowCount * 22 + 36;
  const body = (labels.length ? labels : ['Chart']).map((label, index) => {
    const values = series.map((item) => {
      const value = item.data[index];
      return value == null ? '—' : String(value);
    }).join('  ');
    const line = values ? `${label}  ${values}` : label;
    return `<text x="16" y="${40 + index * 22}" font-size="13" font-family="Manrope, sans-serif" fill="#1c1c22">${xml(line)}</text>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}${creditAnchor(href, width - 12, height - 14)}</svg>`;
}
