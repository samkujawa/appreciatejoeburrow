/**
 * The Appreciate button: every tap adds one to a global count kept by the Worker
 * (worker/index.ts). Taps show instantly and are sent in batches, so mashing the button costs a
 * handful of requests. If the API is unreachable, the button still animates and the count hides.
 */

import { crossedMilestones, isNines } from '../lib/milestones';

const ENDPOINT = '/api/appreciate';
/** Must match MAX_TAPS_PER_REQUEST in worker/limits.ts. */
const MAX_TAPS_PER_REQUEST = 25;
const FLUSH_DELAY_MS = 800;
const POLL_MS = 20_000;
const MINE_KEY = 'ajb:appreciated';

export interface AppreciateElements {
  button: HTMLButtonElement;
  /** Wrapper shown once the count has loaded. */
  countBox: HTMLElement;
  total: HTMLElement;
  mine: HTMLElement;
}

interface CountResponse {
  count: number;
  accepted?: number;
}

function isCountResponse(value: unknown): value is CountResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { count?: unknown }).count === 'number'
  );
}

function readMine(): number {
  try {
    const n = Number(window.localStorage.getItem(MINE_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeMine(n: number): void {
  try {
    window.localStorage.setItem(MINE_KEY, String(n));
  } catch {
    // Storage blocked: the personal tally just won't survive a reload.
  }
}

export function initAppreciate({ button, countBox, total, mine }: AppreciateElements): void {
  const format = new Intl.NumberFormat('en-US');
  /** Last count the server reported; null until the first successful response. */
  let serverCount: number | null = null;
  /** Taps shown on screen but not yet confirmed by the server. */
  let pending = 0;
  let inFlight = false;
  let flushTimer: number | null = null;
  let myTaps = readMine();

  function render(): void {
    if (serverCount === null) return;
    total.textContent = format.format(serverCount + pending);
    countBox.hidden = false;
    mine.textContent =
      myTaps > 0
        ? `You’ve appreciated ${format.format(myTaps)} time${myTaps === 1 ? '' : 's'}`
        : '';
  }

  function accept(response: CountResponse): void {
    // Never let the number visibly go backwards because a stale read raced a write.
    serverCount = serverCount === null ? response.count : Math.max(serverCount, response.count);
    render();
  }

  async function load(): Promise<void> {
    try {
      const res = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
      const body: unknown = await res.json();
      if (res.ok && isCountResponse(body)) accept(body);
    } catch {
      // Counter unavailable (offline, local dev without the Worker): keep the count hidden.
    }
  }

  async function flush(): Promise<void> {
    flushTimer = null;
    if (inFlight || pending === 0) return;
    const taps = Math.min(pending, MAX_TAPS_PER_REQUEST);
    inFlight = true;
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taps }),
      });
      const body: unknown = await res.json();
      pending -= taps;
      if (isCountResponse(body)) {
        accept(body);
        // The server counts batches one at a time, so the range this batch covered is ours alone.
        const accepted = body.accepted ?? 0;
        const hit = crossedMilestones(body.count - accepted, body.count).at(-1);
        if (hit !== undefined) celebrate(hit, format);
      }
    } catch {
      // Network hiccup: drop this batch rather than retry forever.
      pending = Math.max(0, pending - taps);
      render();
    } finally {
      inFlight = false;
    }
    if (pending > 0) schedule();
  }

  function schedule(): void {
    flushTimer ??= window.setTimeout(() => void flush(), FLUSH_DELAY_MS);
  }

  function burst(): void {
    const pop = document.createElement('span');
    pop.className = 'appreciate__pop';
    pop.textContent = '+1';
    pop.setAttribute('aria-hidden', 'true');
    // A little horizontal jitter so rapid taps don't stack on one spot.
    pop.style.setProperty('--x', `${Math.round(Math.random() * 40 - 20)}px`);
    pop.addEventListener('animationend', () => {
      pop.remove();
    });
    button.append(pop);
  }

  button.addEventListener('click', () => {
    pending += 1;
    myTaps += 1;
    writeMine(myTaps);
    burst();
    render();
    schedule();
  });

  // Send anything still waiting when the visitor leaves.
  window.addEventListener('pagehide', () => {
    if (pending === 0) return;
    const taps = Math.min(pending, MAX_TAPS_PER_REQUEST);
    const body = new Blob([JSON.stringify({ taps })], { type: 'application/json' });
    navigator.sendBeacon(ENDPOINT, body);
    pending = 0;
  });

  // Keep the number moving while the page is open, without polling hidden tabs.
  window.setInterval(() => {
    if (!document.hidden && !inFlight && pending === 0) void load();
  }, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void load();
  });

  render();
  void load();
}

const CONFETTI_PIECES = 60;
const CELEBRATION_MS = 9_000;

/** Confetti and a "You were appreciation #1,000" banner for the visitor whose tap hit a milestone. */
function celebrate(milestone: number, format: Intl.NumberFormat): void {
  document.querySelector('.milestone')?.remove();

  const box = document.createElement('div');
  box.className = 'milestone';
  box.setAttribute('role', 'status');

  const title = document.createElement('p');
  title.className = 'milestone__title';
  title.append('You were appreciation ');
  const number = document.createElement('strong');
  number.textContent = `#${format.format(milestone)}`;
  title.append(number);

  const note = document.createElement('p');
  note.className = 'milestone__note';
  note.textContent = isNines(milestone)
    ? 'Nines across the board. Joe’s number. Screenshot it.'
    : 'A milestone for the coolest man in Cincinnati. Screenshot it.';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'milestone__close';
  close.textContent = 'Nice';
  const dismiss = (): void => {
    box.remove();
  };
  close.addEventListener('click', dismiss);
  window.setTimeout(dismiss, CELEBRATION_MS);

  box.append(title, note, close);
  document.body.append(box);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#fb4f14', '#0e0b09', '#f6ede4'];
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < CONFETTI_PIECES; i++) {
    const piece = document.createElement('span');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length] ?? '#fb4f14';
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
    piece.style.setProperty('--drift', `${Math.round(Math.random() * 160 - 80)}px`);
    piece.style.setProperty('--spin', `${Math.round(Math.random() * 720 - 360)}deg`);
    layer.append(piece);
  }
  document.body.append(layer);
  window.setTimeout(() => {
    layer.remove();
  }, 4_500);
}
