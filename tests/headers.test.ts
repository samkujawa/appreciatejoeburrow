import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseHeadersFile } from '../scripts/headers';

interface VercelConfig {
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

const netlify = parseHeadersFile(readFileSync('public/_headers', 'utf8'));
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as VercelConfig;

function vercelHeaders(source: string): Record<string, string> {
  const rule = vercel.headers.find((r) => r.source === source);
  return Object.fromEntries((rule?.headers ?? []).map((h) => [h.key, h.value]));
}

describe('security headers', () => {
  it('parses the _headers file', () => {
    expect(Object.keys(netlify)).toEqual(['/*', '/assets/*']);
  });

  it('keeps vercel.json in sync with public/_headers', () => {
    expect(vercelHeaders('/(.*)')).toEqual(netlify['/*']);
    expect(vercelHeaders('/assets/(.*)')).toEqual(netlify['/assets/*']);
  });

  it('allows the YouTube and X embeds the wall depends on', () => {
    const csp = netlify['/*']?.['Content-Security-Policy'] ?? '';
    for (const origin of [
      'https://www.youtube.com',
      'https://www.youtube-nocookie.com',
      'https://platform.twitter.com',
    ]) {
      expect(csp).toContain(origin);
    }
  });
});
