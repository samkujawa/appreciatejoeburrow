const WIDGETS_SRC = 'https://platform.twitter.com/widgets.js';

export interface CreateTweetOptions {
  theme?: 'light' | 'dark';
  /** Do Not Track: asks X not to personalize based on this embed. */
  dnt?: boolean;
  conversation?: 'none' | 'all';
  align?: 'left' | 'center' | 'right';
}

/** The slice of X's widgets.js API this site uses. */
export interface XWidgets {
  widgets: {
    /** Resolves with the embed, or undefined when the post is deleted, private or unavailable. */
    createTweet(
      id: string,
      target: HTMLElement,
      options?: CreateTweetOptions,
    ): Promise<HTMLElement | undefined>;
  };
}

function currentApi(): XWidgets | undefined {
  const twttr = (window as { twttr?: Partial<XWidgets> }).twttr;
  return twttr?.widgets ? (twttr as XWidgets) : undefined;
}

let pending: Promise<XWidgets> | null = null;

/**
 * Loads X's widgets.js once. Concurrent callers share one request, and a failed load
 * (blocked by an extension, network issue) can be retried by calling again.
 */
export function loadXWidgets(timeoutMs: number): Promise<XWidgets> {
  const loaded = currentApi();
  if (loaded) return Promise.resolve(loaded);
  if (pending) return pending;

  pending = new Promise<XWidgets>((resolve, reject) => {
    const script = document.createElement('script');

    const timer = window.setTimeout(() => {
      fail(new Error(`X widgets.js did not load within ${timeoutMs}ms`));
    }, timeoutMs);

    function fail(error: Error): void {
      window.clearTimeout(timer);
      script.remove();
      pending = null;
      reject(error);
    }

    script.src = WIDGETS_SRC;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timer);
      const api = currentApi();
      if (api) resolve(api);
      else fail(new Error('X widgets.js loaded without a twttr.widgets global'));
    };
    script.onerror = () => {
      fail(new Error('X widgets.js failed to load'));
    };
    document.head.append(script);
  });

  return pending;
}

export function postUrl(postId: string): string {
  return `https://x.com/i/status/${encodeURIComponent(postId)}`;
}
