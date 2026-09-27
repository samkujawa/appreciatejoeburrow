import type { CardContent } from '../lib/card-content';
import { canvasToFile, renderCard } from '../lib/share-card';

let dialog: HTMLDialogElement | null = null;

function ensureDialog(): HTMLDialogElement {
  if (dialog) return dialog;
  const d = document.createElement('dialog');
  d.className = 'share-dialog';
  d.setAttribute('aria-label', 'Share card');
  d.innerHTML = `
    <div class="share-dialog__inner">
      <p class="share-dialog__status" role="status">Making your card…</p>
      <img class="share-dialog__preview" alt="" hidden />
      <div class="share-dialog__actions">
        <button type="button" class="share-dialog__share" hidden>Share</button>
        <a class="share-dialog__download" hidden>Download</a>
        <button type="button" class="share-dialog__close">Close</button>
      </div>
      <p class="share-dialog__hint"></p>
    </div>`;
  d.querySelector('.share-dialog__close')?.addEventListener('click', () => {
    d.close();
  });
  // Clicking the dim backdrop closes it too.
  d.addEventListener('click', (event) => {
    if (event.target === d) d.close();
  });
  document.body.append(d);
  dialog = d;
  return d;
}

/** Phones and tablets, where saving should land in the photo library rather than Files. */
function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Renders a share card and shows it with Share (phone share sheet, e.g. straight into Instagram)
 * and Download buttons. On phones the share sheet also saves to Photos, so it's the only button.
 */
export async function openShareCard(content: CardContent, photoSrc: string | null): Promise<void> {
  const d = ensureDialog();
  const status = d.querySelector<HTMLElement>('.share-dialog__status');
  const preview = d.querySelector<HTMLImageElement>('.share-dialog__preview');
  const share = d.querySelector<HTMLButtonElement>('.share-dialog__share');
  const download = d.querySelector<HTMLAnchorElement>('.share-dialog__download');
  const hint = d.querySelector<HTMLElement>('.share-dialog__hint');
  if (!status || !preview || !share || !download || !hint) return;

  status.hidden = false;
  status.textContent = 'Making your card…';
  preview.hidden = true;
  share.hidden = true;
  download.hidden = true;
  hint.textContent = '';
  if (!d.open) d.showModal();

  const canvas = await renderCard(content, photoSrc);
  const url = canvas.toDataURL('image/png');
  preview.src = url;
  preview.alt = `${content.kicker}: ${content.big} ${content.label}`;
  preview.hidden = false;
  status.hidden = true;

  download.href = url;
  download.download = `${content.slug}.png`;

  const file = await canvasToFile(canvas, content.slug);
  // Not every browser can share files (desktop Firefox can't), so feature-check first.
  const canShareFile =
    file !== null && 'canShare' in navigator && navigator.canShare({ files: [file] });

  if (canShareFile) {
    // One share sheet covers both saving (Save Image puts it in Photos; a web page can't write
    // there directly) and posting to Instagram. Share only the file: with text attached, iOS can
    // leave "Save Image" out of the sheet, and the card already carries the site name.
    const phone = isTouchDevice();
    share.textContent = phone ? 'Share or save' : 'Share';
    share.hidden = false;
    share.onclick = () => {
      navigator.share({ files: [file] }).catch(() => undefined); // Cancelled share sheet: nothing to do.
    };
    download.hidden = phone;
    hint.textContent = phone
      ? 'Save Image puts it in your Photos; Instagram posts it straight to your feed or story.'
      : 'On your phone, Share → Instagram posts it straight to your feed or story.';
  } else {
    download.hidden = false;
    hint.textContent = 'Download it, then post it to Instagram from your phone.';
  }
}

/** A small "Share" button that opens a card when tapped. */
export function shareButton(
  label: string,
  card: () => CardContent,
  photoSrc: string | null,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'share-button';
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v12M7 8l5-5 5 5M5 13v6h14v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  button.append(label);
  button.addEventListener('click', () => {
    void openShareCard(card(), photoSrc);
  });
  return button;
}
