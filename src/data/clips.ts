export interface Clip {
  /** 11-character YouTube video ID. */
  readonly id: string;
  /** Short label shown on the tile and used as the player's accessible name. */
  readonly title: string;
}

/**
 * The wall. Order doesn't matter: it's shuffled on every visit.
 *
 * Most NFL-owned uploads block playback on other websites (player error 150) even though
 * YouTube's oEmbed endpoint says they're embeddable. After editing, run `npm run dev` and open
 * /check.html to confirm every clip actually plays in an embedded player.
 */
export const CLIPS: readonly Clip[] = [
  // Bengals
  { id: '548KO30-UBs', title: '"It Is Us" · NFL Films on the 2021 Bengals' },
  { id: '6DtimiQTsPk', title: 'Top plays of the 2023 season' },
  { id: 'bUrrnQYc4BE', title: 'Best plays from September' },
  { id: '5vAqMa608TE', title: "Mic'd up vs. Arizona · 2025" },
  { id: 'GvL2hR7BQCQ', title: '2022–23: a fan for life' },
  { id: 'lv7kVvTapRg', title: '2024–25 highlights' },
  { id: 'Neeu0fxs4yA', title: '2023–24 hype mix' },
  { id: 'lfjmli6t3tQ', title: 'Rookie year mix · 2020' },
  { id: 'AS0ahtyYtPA', title: 'Bengals mix' },
  { id: 'id2TvmHmFoE', title: '"Back In Blood" mix' },
  { id: 'qa6swCnm-lY', title: '"The Box" mix' },

  // LSU
  { id: 'zR2dwpgbUPI', title: '6 TDs in the national title game' },
  { id: 'ejXN3p-zV8A', title: '7 first-half TDs vs. Oklahoma' },
  { id: 'UlOSfRkOiv8', title: 'LSU takes down Alabama · 2019' },
  { id: 'zto8fX5fdA4', title: 'Best moments as an LSU Tiger' },
  { id: 'V5DjPs09RQw', title: '2019 Heisman season' },
  { id: 'M-k4gsReMpM', title: 'Every touchdown of 2019' },
  { id: 'HGxAh7emAWI', title: 'Beating Texas on the road' },
  { id: 'P4F7KS_yrgg', title: 'Heisman highlights' },
];
