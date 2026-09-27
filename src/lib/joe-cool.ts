/**
 * Joe Cool mode: an icy "Joe Brrr" theme with sunglasses on the headshot. Toggled by the
 * sunglasses button in the nav (every page) or by typing "joecool"; remembered in localStorage.
 */
const STORAGE_KEY = 'ajb:joe-cool';
const SECRET = 'joecool';

function stored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function remember(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    // Storage blocked: the mode just won't survive a reload.
  }
}

export function initJoeCool(): void {
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-joe-cool-toggle]')];

  // A styled tooltip under each toggle (shown on hover and keyboard focus, see base.css). The
  // button's own label already says "Joe Cool mode", so the tip is hidden from screen readers.
  const tips = buttons.map((button) => {
    const tip = document.createElement('span');
    tip.className = 'sitenav__tip';
    tip.setAttribute('aria-hidden', 'true');
    button.append(tip);
    return tip;
  });

  function apply(on: boolean): void {
    root.classList.toggle('joe-cool', on);
    for (const button of buttons) button.setAttribute('aria-pressed', String(on));
    for (const tip of tips) {
      const title = document.createElement('strong');
      title.textContent = on ? 'Turn off Joe Cool mode' : 'Joe Cool mode';
      const detail = document.createElement('span');
      detail.textContent = on ? 'Back to Bengals orange' : 'Ice-blue theme + shades';
      tip.replaceChildren(title, detail);
    }
  }

  function toggle(): void {
    const on = !root.classList.contains('joe-cool');
    apply(on);
    remember(on);
  }

  apply(stored());
  for (const button of buttons) button.addEventListener('click', toggle);

  // Easter egg: typing "joecool" anywhere (outside form fields) flips it too.
  let typed = '';
  document.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, [contenteditable="true"]')) return;
    if (event.key.length !== 1) return;
    typed = (typed + event.key.toLowerCase()).slice(-SECRET.length);
    if (typed === SECRET) {
      typed = '';
      toggle();
    }
  });
}
