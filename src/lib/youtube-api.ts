const API_SRC = 'https://www.youtube.com/iframe_api';

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** `YT` only exists once the API script has run, even though @types/youtube declares it globally. */
function currentApi(): typeof YT | undefined {
  return (window as { YT?: typeof YT }).YT;
}

let pending: Promise<typeof YT> | null = null;

/**
 * Loads YouTube's IFrame Player API once and resolves with the global `YT` namespace.
 * Concurrent callers share one request. A failed load can be retried by calling again.
 */
export function loadYouTubeApi(timeoutMs: number): Promise<typeof YT> {
  const loaded = currentApi();
  if (loaded) return Promise.resolve(loaded);
  if (pending) return pending;

  pending = new Promise<typeof YT>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement('script');

    const timer = window.setTimeout(() => {
      fail(new Error(`YouTube IFrame API did not load within ${timeoutMs}ms`));
    }, timeoutMs);

    function fail(error: Error): void {
      window.clearTimeout(timer);
      script.remove();
      pending = null;
      reject(error);
    }

    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timer);
      const api = currentApi();
      if (api) resolve(api);
      else fail(new Error('YouTube IFrame API reported ready without a YT global'));
    };

    script.src = API_SRC;
    script.async = true;
    script.onerror = () => {
      fail(new Error('YouTube IFrame API failed to load'));
    };
    document.head.append(script);
  });

  return pending;
}
