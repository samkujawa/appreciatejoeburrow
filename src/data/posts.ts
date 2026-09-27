export interface Post {
  /** Numeric X (Twitter) post ID: the number after /status/ in the URL. */
  readonly id: string;
  /** Short label shown before the embed loads and used as the tile's accessible name. */
  readonly title: string;
}

/**
 * X posts mixed into the wall between the YouTube tiles. NFL game footage mostly can't be
 * embedded from YouTube, but the NFL's own X clips can, so this is where single plays live.
 * Photo posts are welcome too; they carry the Joe Cool side of things.
 * Run `npm run check:clips` after editing to confirm each post still exists and has media.
 */
export const POSTS: readonly Post[] = [
  // Plays: Burrow to Chase
  { id: '2101735938896633876', title: 'Launches it to Chase · 2026' },
  { id: '2101752655068667986', title: 'Chase again, two TDs · 2026' },
  { id: '1843013286998245876', title: 'Five TD passes vs. Baltimore' },
  { id: '1842995575714689152', title: '41 yards to Chase vs. Baltimore' },
  { id: '1854722076390633921', title: 'Chase 67-yard TD at Baltimore' },
  { id: '1848077615468363975', title: 'Burrow. Ja’Marr. Masterful.' },
  { id: '1866296725427671524', title: 'Burrow to Chase for six vs. Dallas' },
  { id: '1858362961716461705', title: '5.39 seconds, then a TD to Chase' },
  { id: '1477717448665145344', title: 'To Chase again vs. KC · 2021' },
  { id: '1930002280855810150', title: 'Burrow to Chase is back' },

  // Plays: everyone else
  { id: '1873172510394728764', title: 'To Tee Higgins for the win' },
  { id: '1848083087420227600', title: 'Burrow to Higgins TD' },
  { id: '1853167090741465272', title: 'Finally, a TD to Gesicki' },
  { id: '1845659986690748467', title: 'Clutch on 3rd and 12' },
  { id: '1835446954215850145', title: 'Second TD to Iosivas at KC' },
  { id: '1870911219642622317', title: 'Playing a different game' },
  { id: '1870975236218474910', title: '"I might have to post that one"' },
  { id: '1931441029443662289', title: 'Burrow vs. Lamar, 2024' },

  // Plays: on the run
  { id: '1845625857785663983', title: '47-yard TD run at 19.86 mph' },
  { id: '1467575059506085890', title: 'Six-yard rushing TD' },
  { id: '1850592879632322901', title: 'The 34.9-yard scramble' },

  // Film room
  { id: '1857068910035468308', title: '6.5 minutes of deep-ball dimes' },
  { id: '2068807420042989613', title: 'Throwing in under 2.5 seconds' },
  { id: '1948432041898279218', title: 'Camp deep ball to Higgins' },
  { id: '2082828564177850691', title: 'NFL Top 100 · 2026' },

  // Celebrations
  { id: '1873163481416876451', title: 'Hitting the griddy with Ja’Marr' },
  { id: '1805279601100570785', title: '"Do you want to try and griddy?" "NO!"' },
  { id: '1723767007055634687', title: 'Bow and arrow after the dime' },
  { id: '1477756069363474432', title: 'Cigar Joe, dancing Ja’Marr' },
  { id: '1477769046057631747', title: 'Cigar celebrations never get old' },
  { id: '1612208840967176194', title: 'Cigar Joe is back' },
  { id: '1216964870299623424', title: 'Walking out with a cigar · LSU' },

  // Joe Cool
  { id: '1599495049150013440', title: 'The glasses are back' },
  { id: '1485050964755292167', title: 'Joe Brr. Ice in his veins.' },
  { id: '1997709211216871542', title: 'Joe Brrr' },
  { id: '2018860982450213354', title: 'JOE. BURROW.' },
  { id: '1484269128722571273', title: 'Joey Franchise, Joe Brr, Joe Shiesty…' },
  { id: '1617314084923543552', title: 'Rockin’ Seinfeld sweats' },
  { id: '1832867081358082238', title: 'Without the fur coat and sunglasses' },
  { id: '1985759803231121450', title: 'Joker for Halloween' },
  { id: '1920146428908757024', title: 'The headband is back' },

  // Arrivals
  { id: '2099137151266967944', title: 'QB1 fit check · 2026' },
  { id: '1863237638892708047', title: '9 has arrived' },
  { id: '1575602013366362122', title: 'Rate the fit' },
  { id: '1988290758873673985', title: 'The fit for Pitt' },

  // Honors
  { id: '1887684200163168697', title: 'Joe Burrow stuns · NFL Honors' },
  { id: '1887945186031915260', title: 'The NFL Honors outfit' },
  { id: '1887700069798855083', title: 'Comeback Player of the Year' },
  { id: '1994266155674894825', title: 'Back winning football games' },

  // LSU
  { id: '1204206987640287233', title: 'Heisman hype, narrated by the Honey Badger' },
  { id: '1206029298068578304', title: 'Winning the Heisman' },
  { id: '1216958476473249792', title: '"He looks like a national champion"' },
  { id: '1720459567941967882', title: 'LSU–Alabama 2019' },
  { id: '1889351613631918180', title: 'Burrow, Chase, Jefferson: LSU icons' },
  { id: '1492200992611438594', title: 'LSU’s Super Bowl salute' },
];
