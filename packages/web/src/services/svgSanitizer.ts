const NUMERIC_ATTRS = [
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'font-size',
  'stroke-width',
  'dx',
  'dy',
] as const;

const MUST_BE_NON_NEGATIVE = new Set<string>([
  'width',
  'height',
  'r',
  'rx',
  'ry',
  'font-size',
  'stroke-width',
]);

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) < 1e-9) return '0';
  return Number(value.toFixed(4)).toString();
}

function parseNumberLiteral(source: string, start: number): { value: number; next: number } | null {
  const match = /^(\d+(\.\d+)?|\.\d+)(e[+-]?\d+)?/i.exec(source.slice(start));
  if (!match) return null;
  const text = match[0];
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return { value, next: start + text.length };
}

function evaluateArithmeticExpression(expression: string): number | null {
  const input = expression.trim();
  if (!input) return null;
  if (!/^[\d+\-*/().\seE]+$/.test(input)) return null;

  let i = 0;

  const skipWhitespace = () => {
    while (i < input.length && /\s/.test(input[i])) i += 1;
  };

  const parseFactor = (): number | null => {
    skipWhitespace();
    if (i >= input.length) return null;

    const ch = input[i];
    if (ch === '+' || ch === '-') {
      i += 1;
      const nested = parseFactor();
      if (nested === null) return null;
      return ch === '-' ? -nested : nested;
    }

    if (ch === '(') {
      i += 1;
      const inner = parseExpression();
      if (inner === null) return null;
      skipWhitespace();
      if (input[i] !== ')') return null;
      i += 1;
      return inner;
    }

    const parsed = parseNumberLiteral(input, i);
    if (!parsed) return null;
    i = parsed.next;
    return parsed.value;
  };

  const parseTerm = (): number | null => {
    let value = parseFactor();
    if (value === null) return null;

    while (true) {
      skipWhitespace();
      const op = input[i];
      if (op !== '*' && op !== '/') break;
      i += 1;
      const rhs = parseFactor();
      if (rhs === null) return null;
      if (op === '*') value *= rhs;
      else value /= rhs;
      if (!Number.isFinite(value)) return null;
    }
    return value;
  };

  const parseExpression = (): number | null => {
    let value = parseTerm();
    if (value === null) return null;

    while (true) {
      skipWhitespace();
      const op = input[i];
      if (op !== '+' && op !== '-') break;
      i += 1;
      const rhs = parseTerm();
      if (rhs === null) return null;
      if (op === '+') value += rhs;
      else value -= rhs;
      if (!Number.isFinite(value)) return null;
    }
    return value;
  };

  const result = parseExpression();
  if (result === null) return null;
  skipWhitespace();
  if (i !== input.length) return null;
  return result;
}

function normalizeNumericAttribute(value: string, attr: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Keep units and percentages untouched.
  if (/[a-df-zA-DF-Z%]/.test(trimmed)) return null;

  let numericValue: number | null = null;
  if (/^[+-]?(\d+(\.\d+)?|\.\d+)(e[+-]?\d+)?$/i.test(trimmed)) {
    const parsed = Number(trimmed);
    numericValue = Number.isFinite(parsed) ? parsed : null;
  } else {
    numericValue = evaluateArithmeticExpression(trimmed);
  }

  if (numericValue === null) return null;
  if (MUST_BE_NON_NEGATIVE.has(attr) && numericValue < 0) {
    numericValue = Math.abs(numericValue);
  }
  return formatNumber(numericValue);
}

export function normalizeInfographicSvg(rawSvg: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
  const parseError = doc.querySelector('parsererror');
  const root = doc.documentElement;
  if (parseError || !root || root.nodeName.toLowerCase() !== 'svg') {
    throw new Error('Infographic renderer returned invalid SVG markup');
  }

  const nodes = root.querySelectorAll('*');
  nodes.forEach((node) => {
    NUMERIC_ATTRS.forEach((attr) => {
      const raw = node.getAttribute(attr);
      if (!raw) return;
      const normalized = normalizeNumericAttribute(raw, attr);
      if (normalized !== null) {
        node.setAttribute(attr, normalized);
      }
    });
  });

  // SVG rect does not support negative width/height; convert to valid geometry.
  root.querySelectorAll('rect').forEach((rect) => {
    const width = Number(rect.getAttribute('width'));
    const x = Number(rect.getAttribute('x') ?? '0');
    if (Number.isFinite(width) && width < 0) {
      if (Number.isFinite(x)) {
        rect.setAttribute('x', formatNumber(x + width));
      }
      rect.setAttribute('width', formatNumber(Math.abs(width)));
    }

    const height = Number(rect.getAttribute('height'));
    const y = Number(rect.getAttribute('y') ?? '0');
    if (Number.isFinite(height) && height < 0) {
      if (Number.isFinite(y)) {
        rect.setAttribute('y', formatNumber(y + height));
      }
      rect.setAttribute('height', formatNumber(Math.abs(height)));
    }
  });

  return new XMLSerializer().serializeToString(root);
}
