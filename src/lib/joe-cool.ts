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

  function apply(on: boolean): void {
    root.classList.toggle('joe-cool', on);
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(on));
      button.title = on ? 'Turn off Joe Cool mode' : 'Joe Cool mode';
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
