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
  // Bengals: highlights
  { id: '548KO30-UBs', title: '"It Is Us" · NFL Films on the 2021 Bengals' },
  { id: '6DtimiQTsPk', title: 'Top plays of the 2023 season' },
  { id: 'bUrrnQYc4BE', title: 'Best plays from September' },
  { id: 'iVaEBB2iyns', title: 'Top 10 plays of 2020' },
  { id: '2dnfJTI5qhM', title: 'His first NFL start' },
  { id: 'bW3DcRQB2pk', title: 'Road to the Super Bowl' },
  { id: 'GvL2hR7BQCQ', title: '2022–23: a fan for life' },
  { id: 'lv7kVvTapRg', title: '2024–25 highlights' },

  // Bengals: mixes
  { id: 'Neeu0fxs4yA', title: '2023–24 hype mix' },
  { id: 'lfjmli6t3tQ', title: 'Rookie year mix · 2020' },
  { id: 'AS0ahtyYtPA', title: 'Bengals mix' },
  { id: 'id2TvmHmFoE', title: '"Back In Blood" mix' },
  { id: 'qa6swCnm-lY', title: '"The Box" mix' },
  { id: 'vlyK6AyFQQg', title: '"Mad Max" · 2023 playoffs mix' },
  { id: 'SYSY_h1h8MI', title: '"Come and Go" mix' },
  { id: 'Dk7l7SDtEPU', title: '"Life Is Good" mix' },
  { id: '6A49sl679UM', title: 'Burrow mix' },
  { id: 'aHCMyWq8OmU', title: '"Flex" mix' },
  { id: 'GIiKcKbPT5s', title: 'Super Bowl hype · "DNA"' },
  { id: 'nuEew-ogRro', title: '"Fear Is the Enemy"' },
  { id: 'NGHsxCacc9A', title: 'Comeback SZN 2021' },

  // Bengals: mic'd up and off the field
  { id: '5vAqMa608TE', title: "Mic'd up vs. Arizona · 2025" },
  { id: 'dj59UBJDqGA', title: "Mic'd up vs. Kansas City" },
  { id: 'tNILY0lUX8E', title: "Mic'd up vs. Cleveland" },
  { id: 'q2J5MrKAZk0', title: "Mic'd up in Week 7" },
  { id: 'rRm8qt7iPp4', title: "Mic'd up vs. Pittsburgh" },
  { id: 'kbiVYRJ4l7g', title: '"That\'s a first down, brother"' },
  { id: 'v-4CEzLHwFY', title: "Best mic'd up moments" },
  { id: 'SyfOYuB352Q', title: "Mic'd up in his first NFL win" },
  { id: '9ikqu0GfIAI', title: '"Victory on one, ready"' },
  { id: 'ifNn2lWHdC8', title: 'Funny moments' },
  { id: '2hVGbor_sD4', title: 'More funny moments' },
  { id: 'dm2GjAsQloU', title: 'Sundae Conversation' },
  { id: 'NHiJjwH153o', title: 'Breaking down his iconic fits' },
  { id: 's0bWUPF4xho', title: 'Cooking with Ted Karras' },
  { id: 'yJqjv6DpImc', title: 'Quarterback: Season 2' },
  { id: 'qjIAiK0OSk8', title: 'Best of Quarterback' },
  { id: 'o6dS6Q752Kk', title: '"I want the ball in my hands"' },

  // Bengals: the comebacks
  { id: 'RAWu8Wr7Lz0', title: 'The Comeback' },
  { id: '_q95BDiOXtc', title: 'Behind the scenes of the comeback' },
  { id: 'JEPVezuOiv0', title: 'Comeback Player of the Year · 2025' },

  // His story
  { id: 'xl6bpzDSWQU', title: 'The story of Joe Burrow' },
  { id: 'E6duyEqCBWI', title: 'The hometown hero' },
  { id: 'rmG2OPlgQOQ', title: 'From Ohio State to LSU' },
  { id: 'NluFP0YPs2w', title: 'From Athens legend to Bengals savior' },
  { id: 'nuyFfMrhzmo', title: 'Lifting up Southeast Ohio' },

  // Athens High School
  { id: 'NlbNZMiY7tI', title: 'Athens High highlights' },
  { id: 'ZHQ-maIH2bM', title: 'Senior year at Athens' },
  { id: '8EILasubfl4', title: 'Athens High reel' },
  { id: 'euqCA-RUMuk', title: 'Highlights vs. Steubenville · 2014' },
  { id: '9JBOhaZnJws', title: 'Full game vs. Steubenville · 2014' },
  { id: 'IUnY2XT6mSM', title: 'Running over everyone in high school' },

  // Ohio State
  { id: 'aRc2QGzAjts', title: 'From backup to Heisman' },
  { id: 'JK_rPtNkMBE', title: 'Ohio State highlights' },
  { id: 'h95r3SGxncE', title: 'Buckeye days' },
  { id: 'qXIHhhZqGig', title: '2016 Ohio State spring game' },

  // LSU: the season
  { id: 'zto8fX5fdA4', title: 'Best moments as an LSU Tiger' },
  { id: 'V5DjPs09RQw', title: '2019 Heisman season' },
  { id: 'M-k4gsReMpM', title: 'Every touchdown of 2019' },
  { id: 'P4F7KS_yrgg', title: 'Heisman highlights' },
  { id: 'x2dnemsUZDA', title: 'Heisman highlights, extended' },
  { id: 'DPdj3Xm-MOo', title: 'College career highlights' },
  { id: 'yt8wW971YUU', title: 'LSU mini movie' },
  { id: 'BGTCCFfq_VM', title: 'College Football Playoff highlights' },
  { id: 'RY9PCuacTX0', title: 'LSU hype mix' },
  { id: '2gVoq8YO41I', title: '2019 Heisman hype' },
  { id: 'N4JjLBpq6IU', title: 'LSU Heisman hype video' },
  { id: 'PmxqT_QbXvc', title: 'College GameDay feature' },

  // LSU: the games
  { id: 'HGxAh7emAWI', title: 'Beating Texas on the road' },
  { id: 'i9ZsjGqv_-s', title: '6 TDs vs. Utah State' },
  { id: 'UlOSfRkOiv8', title: 'LSU takes down Alabama · 2019' },
  { id: 'DclsJ5KTg78', title: 'Burrow vs. Tua · 2019' },
  { id: 'Remf9ddHD8g', title: 'LSU–Alabama instant classic' },
  { id: 'kG-DIIwFPig', title: 'Every play vs. Alabama' },
  { id: 'ZTJ8HTV_YWE', title: 'Highlights vs. Alabama' },
  { id: '444FneLf_xE', title: 'Alabama game highlights' },
  { id: 'bf-_K0mvnFU', title: 'vs. Alabama · 2018' },
  { id: 'E3iyNO5FWfU', title: 'Heisman play vs. Georgia' },
  { id: 'yi55GvPcMD0', title: 'SEC Championship Heisman moments' },
  { id: 'DaYaWNyHwh0', title: 'SEC Championship MVP' },
  { id: 'ejXN3p-zV8A', title: '7 first-half TDs vs. Oklahoma' },
  { id: 'nP1lzok4IT0', title: 'Seven TDs in one half' },
  { id: 'e_cth5-SJgk', title: '8 TDs in the Peach Bowl' },
  { id: 'QJj3nQxjhhw', title: 'Highlights vs. Oklahoma' },
  { id: 'dGFS1UmVrNs', title: 'Every play vs. Oklahoma' },
  { id: 'zJglr8rAa_k', title: 'Semifinal win over Oklahoma' },
  { id: 'nSTQXK537eM', title: 'vs. Oklahoma · 2019' },
  { id: 'WYhxOd_3eq8', title: 'Peach Bowl highlights' },
  { id: 'zR2dwpgbUPI', title: '6 TDs in the national title game' },
  { id: 'icjWoGKD3tI', title: 'Highlights vs. Clemson' },
  { id: 'xQQ8cEY8Zs0', title: 'Legendary night vs. Clemson' },

  // LSU: the Heisman
  { id: 'DYI5iT5Pb-U', title: 'Heisman finalist' },
  { id: 'Zq68naJBdW0', title: 'Winning the 2019 Heisman' },
  { id: 'ZJehkX2ScFE', title: 'The Heisman speech' },
  { id: 'e2L62yai3ow', title: 'How he became a Louisiana legend' },
];
