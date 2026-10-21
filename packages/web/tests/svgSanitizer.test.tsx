// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { normalizeInfographicSvg } from '../src/services/svgSanitizer';

describe('infographic display safety', () => {
  it('removes active elements, event handlers and remote references from model output', () => {
    const result = normalizeInfographicSvg(`<svg xmlns="http://www.w3.org/2000/svg" onload="window.attack=true"><script>alert(1)</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="bad" onerror="window.attack=true"/></div></foreignObject><image href="https://example.test/private"/><a href="javascript:alert(1)"><text>link</text></a><rect onclick="alert(1)" fill="url(https://example.test/a)" style="fill:url(https://example.test/b)"/><use href="https://example.test/x#id"/></svg>`);
    const doc = new DOMParser().parseFromString(result, 'image/svg+xml');
    expect(doc.querySelector('script, foreignObject, image, a')).toBeNull();
    expect(result).not.toMatch(/onload|onerror|onclick|javascript:|https:/);
  });
  it('preserves local gradients, geometry and text while normalizing numeric expressions', () => {
    const result = normalizeInfographicSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="paint"><stop offset="0" stop-color="#2563eb"/></linearGradient></defs><rect width="20+20" height="50" fill="url(#paint)"/><text x="10" y="20">Revenue &amp; profit</text></svg>');
    const doc = new DOMParser().parseFromString(result, 'image/svg+xml');
    expect(doc.querySelector('rect')?.getAttribute('width')).toBe('40');
    expect(doc.querySelector('rect')?.getAttribute('fill')).toBe('url(#paint)');
    expect(doc.querySelector('linearGradient')).not.toBeNull();
    expect(doc.querySelector('text')?.textContent).toBe('Revenue & profit');
  });
});
