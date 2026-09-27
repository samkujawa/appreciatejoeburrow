import type { CardContent } from './card-content';

/** Instagram's portrait feed size. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

// Cards always use the brand colors, whatever theme the page is in.
const ORANGE = '#fb4f14';
const INK = '#0e0b09';
const BONE = '#f6ede4';
const MUTED = '#a8978a';
const DISPLAY = '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
const LABEL = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = src;
  });
}

/** Tiger-stripe band like the site's header and footer. */
function stripes(ctx: CanvasRenderingContext2D, y: number, h: number): void {
  ctx.fillStyle = ORANGE;
  ctx.fillRect(0, y, CARD_WIDTH, h);
  ctx.fillStyle = INK;
  const slant = h * 0.47;
  for (let x = -h; x < CARD_WIDTH + h; x += 70) {
    for (const [offset, width] of [
      [0, 18],
      [42, 10],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x + offset, y + h);
      ctx.lineTo(x + offset + slant, y);
      ctx.lineTo(x + offset + slant + width, y);
      ctx.lineTo(x + offset + width, y + h);
      ctx.fill();
    }
  }
}

/** Largest font size (up to `max`) at which `text` fits in `width`. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  weight: number,
  max: number,
  width: number,
): number {
  let size = max;
  ctx.font = `${String(weight)} ${String(size)}px ${family}`;
  while (size > 24 && ctx.measureText(text).width > width) {
    size -= 4;
    ctx.font = `${String(weight)} ${String(size)}px ${family}`;
  }
  return size;
}

/**
 * Draws one line with its top edge at `top` and returns the height its glyphs actually take.
 * Measured rather than derived from the font size, because the "top" baseline sits differently
 * across browsers (Safari draws lower) and fallback fonts have different proportions.
 */
function drawLine(ctx: CanvasRenderingContext2D, text: string, x: number, top: number): number {
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(text);
  ctx.fillText(text, x, top + m.actualBoundingBoxAscent);
  return m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

/** Draws a share card: stripes, headshot, kicker, big text, label, context and the site name. */
export async function renderCard(
  content: CardContent,
  photoSrc: string | null,
): Promise<HTMLCanvasElement> {
  await Promise.all([
    document.fonts.load(`900 200px ${DISPLAY}`),
    document.fonts.load(`700 60px ${LABEL}`),
    document.fonts.load(`500 40px ${LABEL}`),
  ]).catch(() => undefined);
  const photo = photoSrc ? await loadImage(photoSrc) : null;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const cx = CARD_WIDTH / 2;
  const inner = CARD_WIDTH - 140;

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  stripes(ctx, 0, 56);
  stripes(ctx, CARD_HEIGHT - 56, 56);

  let y = 120;
  if (photo) {
    const r = 130;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, y + r, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(photo, cx - r, y, r * 2, r * 2);
    ctx.restore();
    ctx.lineWidth = 12;
    ctx.strokeStyle = ORANGE;
    ctx.beginPath();
    ctx.arc(cx, y + r, r, 0, Math.PI * 2);
    ctx.stroke();
    y += r * 2 + 70;
  } else {
    y += 60;
  }

  // Kicker tag.
  ctx.font = `700 40px ${LABEL}`;
  ctx.letterSpacing = '6px';
  const kicker = content.kicker.toUpperCase();
  const kw = ctx.measureText(kicker).width + 44;
  ctx.fillStyle = ORANGE;
  ctx.fillRect(cx - kw / 2, y, kw, 64);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(kicker, cx, y + 34);
  y += 64 + 30;

  // Big number or word.
  ctx.letterSpacing = '0px';
  const big = content.big.toUpperCase();
  fitFont(ctx, big, DISPLAY, 900, 300, inner);
  ctx.fillStyle = BONE;
  y += drawLine(ctx, big, cx, y) + 44;

  // Label.
  ctx.letterSpacing = '4px';
  const label = content.label.toUpperCase();
  fitFont(ctx, label, LABEL, 700, 64, inner);
  ctx.fillStyle = ORANGE;
  y += drawLine(ctx, label, cx, y) + 48;

  // Context lines.
  ctx.letterSpacing = '1px';
  ctx.textBaseline = 'top';
  ctx.font = `500 44px ${LABEL}`;
  ctx.fillStyle = MUTED;
  for (const line of content.lines) {
    for (const part of wrap(ctx, line, inner)) {
      ctx.fillText(part, cx, y);
      y += 56;
    }
    y += 10;
  }

  // Site name and handle above the bottom stripes, placed by baseline with room for descenders.
  const stripesTop = CARD_HEIGHT - 56;
  const handleBaseline = stripesTop - 60;
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '5px';
  ctx.font = `700 40px ${LABEL}`;
  ctx.fillStyle = BONE;
  ctx.fillText('APPRECIATEJOEBURROW.COM', cx, handleBaseline - 58);
  ctx.font = `500 34px ${LABEL}`;
  ctx.fillStyle = MUTED;
  ctx.fillText('@appreciatejoeburrow', cx, handleBaseline);
  return canvas;
}

/** PNG file for the share sheet. */
export function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob ? new File([blob], `${name}.png`, { type: 'image/png' }) : null);
    }, 'image/png');
  });
}
