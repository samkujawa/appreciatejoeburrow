import { CLIPS } from '../data/clips';
import type { Poll } from '../data/play-of-the-week';
import { POSTS } from '../data/posts';
import { watchUrl } from '../lib/playback';
import { postUrl } from '../lib/x-widgets';

const ENDPOINT = '/api/poll';

interface PollState {
  id: string | null;
  tally: Record<string, number>;
  total: number;
  closed: boolean;
}

function isPollState(value: unknown): value is PollState {
  return typeof value === 'object' && value !== null && 'tally' in value && 'total' in value;
}

function storedVote(pollId: string): string | null {
  try {
    return window.localStorage.getItem(`ajb:vote:${pollId}`);
  } catch {
    return null;
  }
}

function rememberVote(pollId: string, choice: string): void {
  try {
    window.localStorage.setItem(`ajb:vote:${pollId}`, choice);
  } catch {
    // Storage blocked: the server's per-visitor limit still applies.
  }
}

/** Title and link for a candidate, from the wall's own clip and post lists. */
function describe(id: string): { title: string; href: string; source: string } {
  const clip = CLIPS.find((c) => c.id === id);
  if (clip) return { title: clip.title, href: watchUrl(id), source: 'YouTube' };
  const post = POSTS.find((p) => p.id === id);
  return { title: post?.title ?? 'Play', href: postUrl(id), source: 'X' };
}

const format = new Intl.NumberFormat('en-US');

/**
 * Play of the Week: vote once for the best play from the latest game, then see live results.
 * After the poll closes it shows the final results and the winner.
 */
export function initPlayOfTheWeek(section: HTMLElement, poll: Poll | null): void {
  if (!poll) return;
  const current = poll;
  const closesAt = Date.parse(current.closes);
  let state: PollState | null = null;
  let myVote = storedVote(current.id);
  let sending = false;

  const heading = document.createElement('div');
  heading.className = 'potw__head';
  const title = document.createElement('h2');
  title.className = 'potw__title';
  title.id = 'potw-title';
  title.textContent = 'Play of the Week';
  const sub = document.createElement('p');
  sub.className = 'potw__sub';
  heading.append(title, sub);
  const list = document.createElement('ol');
  list.className = 'potw__list';
  const note = document.createElement('p');
  note.className = 'potw__note';
  note.setAttribute('role', 'status');
  section.replaceChildren(heading, list, note);
  section.hidden = false;

  function closed(): boolean {
    return state?.closed ?? Date.now() >= closesAt;
  }

  function render(): void {
    const showResults = myVote !== null || closed();
    const total = state?.total ?? 0;
    const max = Math.max(0, ...Object.values(state?.tally ?? {}));
    const closeDay = new Date(closesAt).toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: 'America/New_York',
    });
    sub.textContent = closed()
      ? `${current.label} · Final results`
      : `${current.label} · Voting closes ${closeDay}`;

    list.replaceChildren(
      ...current.candidates.map((id) => {
        const { title: name, href, source } = describe(id);
        const votes = state?.tally[id] ?? 0;
        const share = total > 0 ? votes / total : 0;
        const item = document.createElement('li');
        item.className = 'potw__item';
        if (myVote === id) item.classList.add('is-mine');
        if (closed() && votes === max && max > 0) item.classList.add('is-winner');

        const top = document.createElement('div');
        top.className = 'potw__row';
        const label = document.createElement('span');
        label.className = 'potw__name';
        label.textContent = name;
        const watch = document.createElement('a');
        watch.className = 'potw__watch';
        watch.href = href;
        watch.target = '_blank';
        watch.rel = 'noopener noreferrer';
        watch.textContent = 'Watch ↗';
        watch.setAttribute('aria-label', `Watch ${name} on ${source} (opens in a new tab)`);
        top.append(label, watch);
        item.append(top);

        if (showResults) {
          const bar = document.createElement('div');
          bar.className = 'potw__bar';
          const fill = document.createElement('span');
          fill.style.width = `${String(Math.round(share * 100))}%`;
          bar.append(fill);
          const result = document.createElement('span');
          result.className = 'potw__result';
          const tags = [
            item.classList.contains('is-winner') ? 'Winner' : '',
            myVote === id ? 'Your pick' : '',
          ].filter(Boolean);
          result.textContent = `${String(Math.round(share * 100))}% · ${format.format(votes)} ${votes === 1 ? 'vote' : 'votes'}${tags.length ? ` · ${tags.join(' · ')}` : ''}`;
          item.append(bar, result);
        } else {
          const vote = document.createElement('button');
          vote.type = 'button';
          vote.className = 'potw__vote';
          vote.textContent = 'Vote';
          vote.setAttribute('aria-label', `Vote for ${name}`);
          vote.disabled = sending;
          vote.addEventListener('click', () => void cast(id));
          item.append(vote);
        }
        return item;
      }),
    );

    if (showResults && state) {
      note.textContent = `${format.format(total)} ${total === 1 ? 'vote' : 'votes'} so far${closed() ? '' : ' · results update live'}`;
    }
  }

  async function load(): Promise<void> {
    try {
      const res = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
      const body: unknown = await res.json();
      if (res.ok && isPollState(body) && body.id === current.id) state = body;
    } catch {
      // Poll API unreachable: voting still shows; results appear once it answers.
    }
    render();
  }

  async function cast(choice: string): Promise<void> {
    if (sending) return;
    sending = true;
    render();
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poll: current.id, choice }),
      });
      const body: unknown = await res.json();
      if (isPollState(body)) state = body;
      if (res.ok || res.status === 429) {
        // 429: this connection already voted; show results rather than a dead end.
        myVote = choice;
        rememberVote(current.id, choice);
        note.textContent = res.ok
          ? 'Thanks for voting!'
          : 'Looks like you already voted this week.';
      } else {
        note.textContent = 'Voting is closed for this one.';
      }
    } catch {
      note.textContent = 'Could not send your vote. Try again in a moment.';
    } finally {
      sending = false;
      render();
    }
  }

  render();
  void load();
  // Keep results moving while the page is open and visible.
  window.setInterval(() => {
    if (!document.hidden && (myVote !== null || closed())) void load();
  }, 30_000);
}
