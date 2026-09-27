/**
 * Confirms every YouTube clip and X post on the wall still exists. Exits 1 if any fail,
 * so it can gate CI.
 *
 *   npm run check:clips
 *
 * YouTube: the oEmbed endpoint answers 401 when embedding is disabled and 404 when the video is
 * removed or private. It does NOT catch videos that block playback on other sites (player error
 * 150, common for NFL uploads); for that, run `npm run dev` and open /check.html.
 *
 * X: uses the same syndication endpoint widgets.js renders embeds from. It's undocumented, so if
 * every post suddenly fails, check whether the endpoint changed before deleting posts.
 */
import { CLIPS } from '../src/data/clips';
import { POSTS } from '../src/data/posts';

interface Result {
  kind: 'clip' | 'post';
  id: string;
  title: string;
  ok: boolean;
  detail: string;
}

const TIMEOUT_MS = 10_000;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function checkClip(id: string, title: string): Promise<Result> {
  const target = `https://www.youtube.com/watch?v=${id}`;
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(target)}`;
  const result = { kind: 'clip' as const, id, title };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) {
      const body = (await res.json()) as { title?: string; author_name?: string };
      return { ...result, ok: true, detail: `${body.author_name ?? '?'} — ${body.title ?? '?'}` };
    }
    const reason =
      res.status === 401
        ? 'embedding disabled'
        : res.status === 404
          ? 'removed or private'
          : `HTTP ${res.status}`;
    return { ...result, ok: false, detail: reason };
  } catch (error) {
    return { ...result, ok: false, detail: describeError(error) };
  }
}

/** The token widgets.js sends with syndication requests, derived from the post ID. */
function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

interface SyndicatedPost {
  __typename?: string;
  text?: string;
  user?: { screen_name?: string };
  mediaDetails?: { type?: string }[];
}

async function checkPost(id: string, title: string): Promise<Result> {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${syndicationToken(id)}`;
  const result = { kind: 'post' as const, id, title };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      const reason = res.status === 404 ? 'deleted or private' : `HTTP ${res.status}`;
      return { ...result, ok: false, detail: reason };
    }
    const body = (await res.json()) as SyndicatedPost;
    if (body.__typename !== 'Tweet') {
      return { ...result, ok: false, detail: `unavailable (${body.__typename ?? 'unknown'})` };
    }
    const hasVideo = (body.mediaDetails ?? []).some((m) => m.type === 'video');
    const text = (body.text ?? '').replace(/\s+/g, ' ').slice(0, 60);
    return {
      ...result,
      ok: hasVideo,
      detail: hasVideo ? `@${body.user?.screen_name ?? '?'} — ${text}` : 'no video attached',
    };
  } catch (error) {
    return { ...result, ok: false, detail: describeError(error) };
  }
}

const results = await Promise.all([
  ...CLIPS.map((c) => checkClip(c.id, c.title)),
  ...POSTS.map((p) => checkPost(p.id, p.title)),
]);

for (const { kind, id, title, ok, detail } of results) {
  const label = kind === 'clip' ? 'YouTube' : 'X      ';
  console.log(`${ok ? '✔' : '✘'} ${label} ${id.padEnd(19)} ${title.padEnd(44)} ${detail}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} clips and posts available.`);
if (failed.length > 0) process.exit(1);
