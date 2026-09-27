/**
 * Parses the Netlify / Cloudflare Pages `_headers` format into { path pattern: headers }.
 * Used to serve the real production headers from `vite preview` and to check that
 * vercel.json hasn't drifted from public/_headers.
 */
export function parseHeadersFile(source: string): Record<string, Record<string, string>> {
  const rules: Record<string, Record<string, string>> = {};
  let current: Record<string, string> | null = null;

  for (const raw of source.split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = {};
      rules[line.trim()] = current;
      continue;
    }
    const colon = line.indexOf(':');
    if (!current || colon === -1) throw new Error(`Malformed _headers line: ${line}`);
    current[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return rules;
}
