/**
 * Spreads `extras` evenly through `base`, keeping each list's own order.
 * With 19 videos and 12 posts, posts land roughly every 1–2 videos instead of clumping.
 */
export function interleave<A, B>(base: readonly A[], extras: readonly B[]): (A | B)[] {
  const total = base.length + extras.length;
  const out: (A | B)[] = [];
  let b = 0;
  let e = 0;
  for (let i = 0; i < total; i++) {
    // Place an extra whenever doing so keeps extras at or below their fair share so far.
    const extrasDue = Math.round(((i + 1) * extras.length) / total);
    if (e < extras.length && (e < extrasDue || b >= base.length)) {
      out.push(extras[e++] as B);
    } else {
      out.push(base[b++] as A);
    }
  }
  return out;
}
