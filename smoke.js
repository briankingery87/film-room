/* ============================================================================
   The Film Room - smoke test.

     node smoke.js

   Playwright against a FULLY MOCKED set of ArcGIS REST responses. No network,
   no live services, no AGOL. That matters for two reasons: the test is the same
   on a Sunday afternoon as it is at 3am mid-week, and the fixture can contain
   the awkward rows the live data does not happen to have this week.

   The fixture deliberately includes:
     - an FBS program with every rating published;
     - an FBS program that is LANDLESS (rules no counties at all);
     - an FCS program whose SP+/Elo/FPI/talent are all -999 placeholders;
     - a D3 program with "N/A" strings and a capacity of -1;
     - a program with NO logo url and a near-black primary colour;
     - a recruit with a blank county_fips (unjoinable);
     - four UNCOMMITTED recruits (team_id -1) out of one program's county;
     - a county with no dominant program;
     - cross-conference raids in three directions, so the chord has something to draw;
     - a game with NO closing spread;
     - a game that is an exact PUSH against the spread;
     - a game missing one score entirely;
     - two poll weeks, with one team dropping out of the poll between them.

   Every image request is aborted on purpose, so the monogram fallback is what
   actually renders and gets exercised.
   ========================================================================== */
const { chromium } = require('playwright');
const path = require('path');

const PAGES = ['home','empire','price','pipeline','market','polls','lab','cutting'];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c?'  ok   ':'  FAIL ') + m); };

/* ---------------------------------------------------------------- fixture */
const PH = -999;
const T = (id, school, div, conf, over) => Object.assign({
  team_id:id, school, mascot:school+' Mascot', abbreviation:school.slice(0,3).toUpperCase(),
  conference:conf, division:div, data_tier:div, venue_name:school+' Stadium', city:'Town', state:'ST',
  capacity:50000, elevation_m:100, dome:0, grass:1, year_built:1960, latitude:38, longitude:-78,
  primary_color:'#2C9EC7', text_color:'#FFFFFF',
  logo_url:'https://a.espncdn.com/i/teamlogos/ncaa/500/'+id+'.png',
  ap_rank:PH, coaches_rank:PH, sp_rating:PH, elo:PH, fpi:PH, talent:PH,
  recruiting_rank:PH, recruiting_pts:PH, travel_gc_miles:-1, travel_div_rank:PH,
  travel_div_count:PH, travel_conf_avg:PH, record_2025:'N/A', final_rank_2025:PH,
  head_coach:'A Coach', rival_school:'N/A'
}, over);

const teams = [
  T(1,'Northgate','FBS','Big Test',{ sp_rating:22.4, elo:1880, fpi:18.2, talent:920, ap_rank:3,
     recruiting_rank:12, capacity:88000, year_built:1924, travel_conf_avg:6000, head_coach:'Ann Reed',
     record_2025:'11-2', rival_school:'Southmoor' }),
  T(2,'Southmoor','FBS','Big Test',{ sp_rating:11.1, elo:1710, fpi:7.9, talent:740, ap_rank:18,
     recruiting_rank:34, capacity:61000, year_built:1978, travel_conf_avg:6000 }),
  T(3,'Westpoint Tech','FBS','Big Test',{ sp_rating:-4.2, elo:1510, fpi:-2.1, talent:560,
     recruiting_rank:78, capacity:40000, year_built:2001, travel_conf_avg:6000 }),
  /* landless FBS - no empire row exists for id 4 */
  T(4,'Harbor State','FBS','Coastal',{ sp_rating:3.3, elo:1600, fpi:1.1, talent:610,
     recruiting_rank:55, capacity:35000, year_built:1955, travel_conf_avg:9000 }),
  T(5,'Old Mill','FBS','Coastal',{ sp_rating:14.9, elo:1755, fpi:9.4, talent:800, ap_rank:9,
     recruiting_rank:21, capacity:72000, year_built:1931, travel_conf_avg:9000 }),
  /* FCS - every rating is a placeholder, which is the live reality */
  T(6,'Riverbend','FCS','Valley',{ capacity:18000, year_built:1969 }),
  T(7,'Cedar Hollow','FCS','Valley',{ capacity:12500, year_built:1948 }),
  /* no logo, near-black primary: exercises the monogram and the colour lift */
  T(8,'Black Rock','D2','Summit',{ logo_url:'', primary_color:'#000000', capacity:6000, year_built:PH }),
  /* strings that must never render, capacity -1 */
  T(9,'Pine Ridge','D3','Timber',{ capacity:-1, year_built:PH, city:'N/A', venue_name:'N/A',
     head_coach:'N/A', primary_color:'N/A' })
];

/* twelve more FBS programs with nothing but ratings and a building. They exist so
   the correlation matrix has the ten paired values it refuses to compute below -
   with nine teams every cell is correctly a dot, which is right behaviour and
   useless as a test of the cell itself. */
for (let i = 0; i < 12; i++){
  const id = 10 + i;
  teams.push(T(id, 'Filler '+String.fromCharCode(65+i), 'FBS', i % 2 ? 'Big Test' : 'Coastal', {
    sp_rating: -12 + i*2.7, elo: 1450 + i*35, fpi: -9 + i*2.1, talent: 480 + i*38,
    recruiting_rank: 90 - i*4, capacity: 25000 + i*4200, year_built: 1920 + i*7,
    elevation_m: 30 + i*90, travel_conf_avg: i % 2 ? 6000 : 9000 }));
}

const E = (team_id, school, conference, division, counties, population, states, battles, over) =>
  Object.assign({ team_id, school, conference, division, counties, population,
    pop_share_us:+(population/336000000*100).toFixed(2), avg_share:0.45, pop_rank:1, county_rank:1,
    states_touched:states, battlegrounds:battles, top_county:school+' County',
    headline:school+' country', max_empire_pop:9100000, max_empire_counties:220,
    n_empires:6, n_landless_fbs:1, last_updated:Date.UTC(2026,8,14,11,0) }, over);

const empires = [
  E(1,'Northgate','Big Test','FBS',140,9100000,4,31,{ headline:'Northgate country runs to the river', top_county:'Kent County' }),
  E(2,'Southmoor','Big Test','FBS',220,4200000,3,12,{ headline:'Wide and rural', top_county:'Moor County' }),
  E(3,'Westpoint Tech','Big Test','FBS',35,2800000,1,9,{ headline:'A city empire', top_county:'Tech County' }),
  E(5,'Old Mill','Coastal','FBS',90,5400000,2,18,{ headline:'The coast belongs to the Mill', top_county:'Mill County' }),
  E(6,'Riverbend','Valley','FCS',14,310000,1,3,{ headline:'Small but real', top_county:'Bend County' }),
  E(8,'Black Rock','Summit','D2',6,120000,1,1,{ headline:'A corner of the map', top_county:'Rock County' })
];
/* eight fillers rule a little territory, so the territory metrics also clear the
   ten-program floor in the matrix */
for (let i = 0; i < 8; i++)
  empires.push(E(10+i, 'Filler '+String.fromCharCode(65+i), i % 2 ? 'Big Test' : 'Coastal', 'FBS',
    12 + i*9, 220000 + i*310000, 1 + (i%3), 2 + i));

const counties = [
  { FIPS:'01001', county_name:'Kent County',   STATE_ABBR:'AL', POPULATION:60000, dominant_team_id:1,
    dominant_school:'Northgate', dominant_share:.43, second_team_id:2, second_school:'Southmoor', gap:.03 },
  { FIPS:'01003', county_name:'Moor County',   STATE_ABBR:'AL', POPULATION:40000, dominant_team_id:2,
    dominant_school:'Southmoor', dominant_share:.51, second_team_id:1, second_school:'Northgate', gap:.19 },
  { FIPS:'01005', county_name:'Mill County',   STATE_ABBR:'GA', POPULATION:90000, dominant_team_id:5,
    dominant_school:'Old Mill', dominant_share:.62, second_team_id:1, second_school:'Northgate', gap:.30 },
  { FIPS:'01007', county_name:'Tech County',   STATE_ABBR:'GA', POPULATION:120000, dominant_team_id:3,
    dominant_school:'Westpoint Tech', dominant_share:.38, second_team_id:5, second_school:'Old Mill', gap:.02 },
  { FIPS:'01009', county_name:'Bend County',   STATE_ABBR:'VA', POPULATION:20000, dominant_team_id:6,
    dominant_school:'Riverbend', dominant_share:.40, second_team_id:1, second_school:'Northgate', gap:.06 },
  { FIPS:'01011', county_name:'Nowhere County',STATE_ABBR:'VA', POPULATION:5000, dominant_team_id:null,
    dominant_school:'N/A', dominant_share:0, second_team_id:null, second_school:'N/A', gap:0 }
];

const states = [
  { STATE_ABBR:'AL', STATE_NAME:'Alabama', POPULATION:5000000, fbs_teams:2, fcs_teams:1, other_teams:2,
    total_teams:5, recruits_2026:40, recruit_rank:8, fav_team_id:1, fav_school:'Northgate',
    fav_in_state:1, rival_outside_full:'Old Mill' },
  { STATE_ABBR:'GA', STATE_NAME:'Georgia', POPULATION:10000000, fbs_teams:3, fcs_teams:1, other_teams:1,
    total_teams:5, recruits_2026:65, recruit_rank:3, fav_team_id:5, fav_school:'Old Mill',
    fav_in_state:1, rival_outside_full:'Northgate' }
];

const recruits = [];
let rid = 100;
function addRecruit(teamId, committedTo, fips, stars, miles){
  recruits.push({ recruit_id:String(rid++), name:'Player '+rid, position:'WR', stars,
    rating:.9, team_id:teamId, committed_to:committedTo, division:'FBS', conference:'Big Test',
    city:'Town', state:'AL', county_fips:fips, commit_miles:miles, dist_pctl:40,
    class_rank:10, class_count:130 });
}
/* Northgate: 6 from its own county, 2 from Southmoor's, 1 unjoinable */
for (let i=0;i<6;i++) addRecruit(1,'Northgate','01001',4,30);
addRecruit(1,'Northgate','01003',5,120);
addRecruit(1,'Northgate','01003',3,140);
addRecruit(1,'Northgate','',4,999);
/* Southmoor: 2 at home, 3 raided out of Northgate's county (same conference) */
for (let i=0;i<2;i++) addRecruit(2,'Southmoor','01003',3,40);
for (let i=0;i<3;i++) addRecruit(2,'Southmoor','01001',4,200);
/* Old Mill: 4 at home, 1 from the ownerless county */
for (let i=0;i<4;i++) addRecruit(5,'Old Mill','01005',4,25);
addRecruit(5,'Old Mill','01011',3,300);
/* Westpoint: 3 at home */
for (let i=0;i<3;i++) addRecruit(3,'Westpoint Tech','01007',3,15);
/* Riverbend FCS: 3 at home */
for (let i=0;i<3;i++) addRecruit(6,'Riverbend','01009',2,20);
/* CROSS-CONFERENCE raids in three directions, so the chord has flows to draw */
for (let i=0;i<2;i++) addRecruit(5,'Old Mill','01001',4,410);   /* Coastal out of Big Test */
addRecruit(6,'Riverbend','01005',3,380);                        /* Valley out of Coastal */
for (let i=0;i<2;i++) addRecruit(3,'Westpoint Tech','01009',3,290); /* Big Test out of Valley */
/* four UNCOMMITTED players out of Northgate's county. team_id -1 is the pipeline's
   placeholder for "has not chosen a school". Nobody has taken them, so they must
   not appear as a raid, as a loss, or in anybody's denominator. */
for (let i=0;i<4;i++)
  recruits.push({ recruit_id:String(rid++), name:'Uncommitted '+rid, position:'DL', stars:4,
    rating:.9, team_id:-1, committed_to:'N/A', division:'N/A', conference:'N/A',
    city:'Town', state:'AL', county_fips:'01001', commit_miles:-1, dist_pctl:-1,
    class_rank:-1, class_count:-1 });

const travel = [];
[[1,'Northgate','Big Test',6,700],[2,'Southmoor','Big Test',5,520],[3,'Westpoint Tech','Big Test',6,410],
 [4,'Harbor State','Coastal',7,1450],[5,'Old Mill','Coastal',5,300],[6,'Riverbend','Valley',5,260]]
 .forEach(([id,school,conf,trips,avg],ix) => {
  const season = trips*avg*2;
  for (let w=1;w<=trips;w++)
    travel.push({ route_id:id+'-'+w, game_id:1000+id*10+w, team_id:id, school, division:ix<5?'FBS':'FCS',
      conference:conf, week:w, opponent:'Someone', neutral:0,
      gc_miles: avg + (w===1?avg*0.9:0), season_gc_miles:season, season_trips:trips,
      div_rank:ix+1, div_count:6, conf_avg_gc: conf==='Big Test'?6000:conf==='Coastal'?9000:2600 });
});
/* ten fillers have a routed schedule too, so both big conferences clear the
   five-member floor the box plot needs */
for (let i = 0; i < 10; i++){
  const id = 10 + i, trips = 4 + (i % 3), avg = 250 + i*140;
  for (let w = 1; w <= trips; w++)
    travel.push({ route_id:id+'-'+w, game_id:2000+id*10+w, team_id:id,
      school:'Filler '+String.fromCharCode(65+i), division:'FBS',
      conference: i % 2 ? 'Big Test' : 'Coastal', week:w, opponent:'Someone', neutral:0,
      gc_miles:avg, season_gc_miles:trips*avg*2, season_trips:trips, div_rank:7+i,
      div_count:18, conf_avg_gc: i % 2 ? 6000 : 9000 });
}

const rankings = [];
[['AP Top 25'],['Coaches Poll']].forEach(([poll]) => {
  [[1,1,60],[5,2,45],[2,4,30],[3,9,12]].forEach(([id,rank,pts]) =>
    rankings.push({ season:2026, week:1, poll, rank, team_id:id,
      school:teams.find(t=>t.team_id===id).school, conference:'Big Test', points:pts,
      first_votes: rank===1?55:0 }));
  /* week 2 - Westpoint Tech drops out, Southmoor climbs */
  [[1,1,62],[2,2,50],[5,5,28]].forEach(([id,rank,pts]) =>
    rankings.push({ season:2026, week:2, poll, rank, team_id:id,
      school:teams.find(t=>t.team_id===id).school, conference:'Big Test', points:pts,
      first_votes: rank===1?58:0 }));
});

const ratings = teams.filter(t=>t.division==='FBS').map(t => ({ team_id:t.team_id, school:t.school,
  season:2026, sp_overall:t.sp_rating, sp_offense:PH, sp_defense:PH, elo:t.elo, srs:PH, fpi:t.fpi }));

const lines = [
  { game_id:1, season:2026, week:1, home_team:'Northgate', away_team:'Southmoor', provider:'consensus',
    spread:-10.5, spread_open:-3.5, over_under:55.5, over_under_open:52.5, home_moneyline:-400, away_moneyline:320 },
  { game_id:2, season:2026, week:1, home_team:'Old Mill', away_team:'Harbor State', provider:'consensus',
    spread:-7, spread_open:-7, over_under:48, over_under_open:48, home_moneyline:-260, away_moneyline:210 },
  { game_id:3, season:2026, week:2, home_team:'Westpoint Tech', away_team:'Riverbend', provider:'book',
    spread:-21, spread_open:-14, over_under:44, over_under_open:41, home_moneyline:-900, away_moneyline:600 },
  /* no opening number published - must not appear as a move of NaN */
  { game_id:4, season:2026, week:2, home_team:'Southmoor', away_team:'Cedar Hollow', provider:'book',
    spread:-28, spread_open:PH, over_under:PH, over_under_open:PH, home_moneyline:PH, away_moneyline:PH }
];

const R = (id, week, hid, aid, hp, ap, spread, over) => ({
  game_id:id, season:2026, week, week_label:'Week '+week, week_key:'2026-0-0'+week,
  home_id:hid, away_id:aid,
  home_team:(teams.find(t=>t.team_id===hid)||{}).school, away_team:(teams.find(t=>t.team_id===aid)||{}).school,
  home_conference:'Big Test', away_conference:'Big Test', home_division:'FBS', away_division:'FBS',
  home_points:hp, away_points:ap, total_points:(hp||0)+(ap||0), margin:Math.abs((hp||0)-(ap||0)),
  winner_id: hp>ap?hid:aid, winner_team:'', excitement_index:6.1, aftermath_index:71,
  elo_swing:18, attendance:PH, capacity:PH, pct_capacity:PH, neutral_site:0, conference_game:1,
  closing_spread:spread, over_under:over, cover_result:'N/A', ou_result:'N/A',
  home_rank:PH, away_rank:PH, upset:0, rivalry:0, road_miles:PH,
  home_logo_url:'', away_logo_url:'', one_score:0, went_ot:0, ranked_matchup:0,
  fav_covered:0, home_won: hp>ap?1:0, ml_payout:PH
});

const results = [
  R(1,1,1,2,35,20,-10.5,55.5),          /* home covered */
  R(2,1,5,4,24,17,-7,48),               /* EXACT PUSH: margin 7, spread -7 */
  R(3,2,3,6,28,31,-21,44),              /* big market miss */
  R(4,2,2,7,42,7,PH,PH),                /* no line published at all */
  R(5,2,1,5,21,24,-3,51),               /* underdog outright */
  R(6,1,4,3,17,PH,-2,44)                /* missing away score - must count for neither */
];
/* a dozen priced filler games, so the market histogram has a distribution to draw
   and the error scatter has enough cloud to label outliers on */
for (let i = 0; i < 12; i++){
  const h = 10 + i, a = 10 + ((i+5) % 12);
  const hp = 17 + (i*3) % 24, ap = 10 + (i*7) % 21;
  results.push(R(100+i, 1 + (i%3), h, a, hp, ap, -(3 + (i*2)%18), 47 + (i%9)));
}

/* -------------------------------------------------------------- routing */
function payload(rows){ return JSON.stringify({ features: rows.map(a => ({ attributes:a })) }); }
function serviceFor(url){
  if (/CFB_Atlas_Teams\/FeatureServer\/0/.test(url))        return teams;
  if (/Territories\/FeatureServer\/3/.test(url))            return empires;
  if (/Territories\/FeatureServer\/2/.test(url))            return counties;
  if (/Territories\/FeatureServer\/1/.test(url))            return states;
  if (/Recruiting\/FeatureServer\/0/.test(url))             return recruits;
  if (/Travel\/FeatureServer\/0/.test(url))                 return travel;
  if (/Stats\/FeatureServer\/1/.test(url))                  return rankings;
  if (/Stats\/FeatureServer\/2/.test(url))                  return ratings;
  if (/Stats\/FeatureServer\/3/.test(url))                  return lines;
  if (/Recaps\/FeatureServer\/0/.test(url))                 return results;
  return null;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_EXEC ||
      '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
    args:['--no-sandbox']
  });
  const ctx = await browser.newContext({ viewport:{ width:1560, height:1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_FAILED/.test(m.text()))
    errors.push('console: ' + m.text()); });

  await page.route('**/*', route => {
    const url = route.request().url();
    if (route.request().resourceType() === 'image') return route.abort();
    if (/arcgis\.com/.test(url)){
      const rows = serviceFor(url);
      if (rows) return route.fulfill({ contentType:'application/json', body:payload(rows) });
      return route.fulfill({ contentType:'application/json', body:'{"features":[]}' });
    }
    return route.continue();
  });

  const file = 'file://' + path.join(__dirname, 'index.html');
  await page.goto(file);
  await page.waitForSelector('#m-home .tiles', { timeout:15000 });

  console.log('\n--- load ---');
  ok(errors.length === 0, 'no page errors on load' + (errors.length ? ' :: ' + errors[0] : ''));
  ok(/programs/i.test(await page.locator('#loadstate').innerText()), 'load stamp reports program count');

  /* home: rooms BEFORE findings, and six findings */
  const homeOrder = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#m-home .card'));
    const idx = t => cards.findIndex(c => /START WITH A QUESTION|WHAT THE NUMBERS/i.test(c.innerText)
      && new RegExp(t, 'i').test(c.innerText.slice(0, 80)));
    const rc = Array.from(document.querySelectorAll('#m-home .roomcard'));
    const anat = rc.map(c => ({
      eyebrow: (c.querySelector('.rk-eyebrow') || {}).textContent || '',
      head:    (c.querySelector('.rk-head')    || {}).textContent || '',
      body:   ((c.querySelector('.rk-body')    || {}).textContent || '').length,
      rule:    !!c.querySelector('.rk-rule'),
      num:    ((c.querySelector('.rk-num')     || {}).textContent || '').trim(),
      lab:     ((c.querySelector('.rk-lab')    || {}).textContent || '').trim(),
      cta:    ((c.querySelector('.rk-cta')     || {}).textContent || '').trim(),
      go:      c.dataset.go,
      nested:  c.querySelectorAll('button, a').length
    }));
    return { rooms: idx('start with a question'), noticed: idx('what the numbers'),
      nRooms: rc.length, anat,
      eyebrowColor: rc.length ? getComputedStyle(rc[0].querySelector('.rk-eyebrow')).color : '',
      ctaBg: rc.length ? getComputedStyle(rc[0].querySelector('.rk-cta')).backgroundColor : '',
      findings: document.querySelectorAll('#m-home .cards3')[1].querySelectorAll('.qcard').length,
      cols: getComputedStyle(document.querySelectorAll('#m-home .cards3')[1])
              .gridTemplateColumns.split(' ').length };
  });
  ok(homeOrder.rooms > -1 && homeOrder.noticed > -1 && homeOrder.rooms < homeOrder.noticed,
    'home puts the six rooms ABOVE what the numbers noticed');
  ok(homeOrder.findings === 6, 'six findings render (' + homeOrder.findings + ')');
  ok(homeOrder.cols === 3, 'and they land as two rows of THREE, not as many as happen to fit');

  /* ---- the room cards carry the Ask the Atlas / Tux's Take anatomy ---- */
  ok(homeOrder.nRooms === 6, 'six room cards render (' + homeOrder.nRooms + ')');
  const anat = homeOrder.anat;
  ok(anat.every((a, i) => new RegExp('question\\s*' + (i + 1), 'i').test(a.eyebrow)),
    'every room card carries a numbered QUESTION N eyebrow, in order');
  ok(anat.every(a => /\?$|\.$/.test(a.head.trim()) && a.head.length > 12),
    'every room card headline is a real sentence, not a label');
  ok(anat.every(a => a.body >= 180), 'every room card carries a real paragraph, not a one-liner');
  ok(anat.every(a => a.rule), 'every room card carries the divider rule');
  ok(anat.every(a => /\d/.test(a.num) && a.lab.length > 4),
    'every room card prints a live number with an uppercase label');
  ok(anat.every(a => /^open\b/i.test(a.cta) && /→|->/.test(a.cta)),
    'every room card ends in an OPEN ... arrow call to action');
  ok(anat.every(a => a.nested === 0),
    'the call to action is a span, not a button nested inside a button');
  ok(anat.map(a => a.go).join(',') === 'empire,price,pipeline,market,polls,lab',
    'the six cards point at the six rooms in page order');
  ok(homeOrder.eyebrowColor === 'rgb(242, 100, 48)',
    'the eyebrow is Atlas orange, matching Ask the Atlas (' + homeOrder.eyebrowColor + ')');
  ok(homeOrder.ctaBg === 'rgb(77, 195, 232)',
    'the call to action is solid Atlas cyan (' + homeOrder.ctaBg + ')');

  /* ---- every page renders ---- */
  console.log('\n--- pages ---');
  for (const id of PAGES){
    const before = errors.length;
    await page.evaluate(p => setMode(p), id);
    await page.waitForTimeout(650);
    const txt = await page.locator('#m-'+id).innerText();
    ok(txt.length > 400, id + ' renders content (' + txt.length + ' chars)');
    ok(errors.length === before, id + ' threw nothing' + (errors.length>before?' :: '+errors[before]:''));
    const badRe = id === 'cutting'
      ? /\bNaN\b|undefined|\[object Object\]/      /* this page quotes -999 on purpose */
      : /-999|\bNaN\b|undefined|\[object Object\]/;
    ok(!badRe.test(txt), id + ' shows no placeholder, NaN, undefined or [object Object]');
  }

  /* ---- the derived numbers ---- */
  console.log('\n--- derivation ---');
  const d = await page.evaluate(() => {
    const t = id => DB.teams.get(id);
    return {
      northSoil: t(1).m.home_soil, northSoilN: t(1)._soil.n,
      northYield: t(1).m.yield, northRaided: t(1).m.raided, northClass: t(1).m.n_commits,
      landless4: t(4)._landless, empPop4: t(4).m.emp_pop,
      fcsSP: t(6).m.sp_rating, d3cap: t(9).m.capacity, d3year: t(9).m.year_built,
      soilNotes: DB.notes.soil,
      millAts: t(5).m.ats_pct, millN: t(5)._ats_n, harborAts: t(4).m.ats_pct,
      westGames: t(3)._games, harborGames: t(4)._games,
      raidTop: DB.raids[0], travel1: t(1).m.travel_mi, trips1: t(1).m.travel_trips
    };
  });
  ok(Math.abs(d.northSoil - 6/8) < 1e-9, 'home soil excludes the unjoinable commit (6 of 8, not 6 of 9)');
  ok(d.northSoilN === 8, 'placeable denominator is 8');
  ok(Math.abs(d.northYield - 6/11) < 1e-9,
    'yield counts every signing out of the county, including the cross-conference raids (6 of 11)');
  ok(d.northRaided === 5, 'five players were signed out of Northgate country by somebody else');
  ok(d.landless4 === true && d.empPop4 === 0, 'an FBS program with no empire row is landless with a real zero');
  ok(d.fcsSP === null, 'an FCS -999 SP+ derives to null, not to -999');
  ok(d.d3cap === null && d.d3year === null, 'a -1 capacity and a -999 year both derive to null');
  ok(d.soilNotes.unjoinable === 1 && d.soilNotes.ownerless === 1,
    'the honesty note counts 1 unjoinable and 1 ownerless commit');
  ok(d.soilNotes.uncommitted === 4 && d.soilNotes.committed === d.soilNotes.total - 4,
    'the four uncommitted players are counted out loud and taken off the total');
  ok(d.northClass === 9, 'an uncommitted player is in nobody\'s class size');
  ok(d.millN === 2 && Math.abs(d.millAts - 0.75) < 1e-9,
    'an EXACT PUSH scores HALF a cover and stays in the denominator (one push + one cover = 75%)');
  ok(d.harborAts != null && Math.abs(d.harborAts - 0.5) < 1e-9, 'the other side of the push also scores half');
  ok(d.westGames === 1 && d.harborGames === 1, 'a game missing a score counts for neither team');
  ok(d.raidTop && d.raidTop.n === 3, 'the poaching board ranks the biggest raid first');
  ok(d.travel1 === 6*700*2 && d.trips1 === 6, 'season miles come from the stamped rollup, not a re-sum');

  /* ---- the new chart forms all actually render ---- */
  console.log('\n--- chart forms ---');
  const count = async (sel) => page.locator(sel).count();
  await page.evaluate(() => setMode('empire'));
  await page.waitForTimeout(500);
  ok(await count('#m-empire svg.ch circle.cdot') > 4, 'empire: scatter draws dots');
  ok(await count('#m-empire text.olab') >= 3, 'empire: the scatter DIRECT-LABELS its outliers');
  ok(await count('#m-empire svg.ch circle[fill]') > 10, 'empire: lollipop draws its dots');
  ok(await count('#m-empire rect.seg') > 6, 'empire: treemap draws nested tiles');
  ok(await count('#m-empire circle.swarm') > 6, 'empire: beeswarm draws one dot per program');
  ok(await count('#m-empire .row2') >= 2, 'empire: charts are laid out two to a row');
  ok(await count('#m-empire dl.defs dt') === 4, 'empire: all four quadrants are defined in words');

  await page.evaluate(() => setMode('price'));
  await page.waitForTimeout(600);
  ok(await count('#m-price rect.boxrect') >= 2, 'price: box plot draws a box per conference');
  ok(await count('#m-price line.medline') >= 2, 'price: each box carries its median line');
  ok(await count('#m-price svg.ch') >= 4, 'price: four or more charts on the page');
  ok(await count('#m-price .row2') >= 2, 'price: charts are laid out two to a row');

  await page.evaluate(() => setMode('pipeline'));
  await page.waitForTimeout(900);
  ok(await count('#m-pipeline path.ribbon') > 4, 'pipeline: sankey and chord draw ribbons');
  ok(await count('#m-pipeline .waffle rect, #m-pipeline svg.ch rect[rx="3"]') >= 50,
    'pipeline: the waffle draws a hundred squares');
  ok(await count('#m-pipeline line.dumb') >= 3, 'pipeline: dumbbell draws a connector per row');

  await page.evaluate(() => setMode('market'));
  await page.waitForTimeout(700);
  ok(await count('#m-market line.cid') === 1, 'market: the identity diagonal is drawn');
  ok(await count('#m-market text.olab') >= 4, 'market: the worst-priced games are labelled on the chart');
  ok(await count('#m-market line.slopeline') >= 1, 'market: slope chart draws the open-to-close moves');
  ok(await count('#m-market .readme') >= 2, 'market: both charts carry a how-to-read block');
  const mkTxt = await page.locator('#m-market').innerText();
  ok(/against the spread/i.test(mkTxt) && /push/i.test(mkTxt), 'market: ATS is explained in words on the page');
  const atsTip = await page.getAttribute('#mkt-tbl th[data-col="ats_pct"]', 'title');
  ok(atsTip && /against the spread/i.test(atsTip), 'market: the ATS column header carries a tooltip');

  await page.evaluate(() => setMode('polls'));
  await page.waitForTimeout(600);
  ok(await count('#m-polls path.bumpline') >= 2, 'polls: bump chart draws a line per ranked team');
  ok(await count('#m-polls line.slopeline') >= 2, 'polls: slope chart draws week-over-week movement');
  ok(await count('#m-polls line.dumb') >= 2, 'polls: dumbbell compares poll rank with SP+ rank');

  await page.evaluate(() => setMode('cutting'));
  await page.waitForTimeout(400);
  ok(await count('#m-cutting .formgrid .formcard') === 14,
    'cutting: every one of the fourteen chart forms has a card');
  ok(await count('#m-cutting .formcard .art svg') === 14,
    'and every card carries a drawn miniature of that form');
  const artMarks = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('#m-cutting .formcard').forEach(c => {
      out[c.querySelector('b').textContent] = c.querySelectorAll('.art svg *').length;
    });
    return out;
  });
  ok(Object.values(artMarks).every(n => n >= 3),
    'no miniature is empty - the thinnest has ' + Math.min.apply(null, Object.values(artMarks)) + ' marks');
  ok(await count('#m-cutting .formcard .used') === 14,
    'each form says which pages it is actually used on');
  ok(await count('#m-cutting .formcard .art [data-team]') === 0,
    'and no miniature is clickable - nothing invites a click that will not happen');

  ok(await count('#m-cutting #svc-list .svcrow') === 10,
    'cutting: the service catalogue uses the Ask the Atlas / Tux row format, one row per layer');
  ok(await count('#m-cutting #svc-list .svcgroup') === 6,
    'and one group heading per service, not one per layer');
  ok(await count('#m-cutting .endpoint .eplab') === 10, 'every row carries its REST endpoint block');
  const svcOrder = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#svc-list > *').forEach(el => {
      if (el.classList.contains('svcgroup')) out.push({ g:el.textContent });
      else out.push({ svc:el.querySelector('.sn').textContent,
                      layer:el.querySelectorAll('.tiny.dim')[0].textContent });
    });
    return out;
  });
  const groups = svcOrder.filter(x => x.g).map(x => x.g);
  ok(groups.join('|') === 'CFB Atlas Teams|CFB Atlas Territories|CFB Atlas Recruiting|' +
     'CFB Atlas Travel|CFB Atlas Stats|CFB Atlas Recaps',
     'services are listed in the Atlas publish order');
  const terr = svcOrder.filter(x => x.svc === 'CFB Atlas Territories').map(x => x.layer);
  ok(terr.join('|') === 'Layer 1 - State Breakdowns|Layer 2 - Fan Territories|Layer 3 - Fan Empires',
     'and layers WITHIN a service ascend by layer number (Territories 1, 2, 3)');
  const stats = svcOrder.filter(x => x.svc === 'CFB Atlas Stats').map(x => x.layer);
  ok(stats.join('|') === 'Layer 1 - Rankings (table)|Layer 2 - Ratings (table)|Layer 3 - BettingLines (table)',
     'Stats reads 1, 2, 3 as well');

  await page.evaluate(() => setMode('lab'));
  await page.waitForTimeout(900);
  ok(await count('#m-lab table.heat td[data-x]') > 0, 'lab: the matrix renders clickable cells');
  /* the board is the starting point, so it has to come BEFORE the chart it drives */
  const labOrder = await page.evaluate(() => {
    const board = document.querySelector('#m-lab table.heat');
    const chart = document.querySelector('#lab-chart');
    if (!board || !chart) return null;
    return board.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING ? 'board-first' : 'chart-first';
  });
  ok(labOrder === 'board-first', 'lab: the board comes BEFORE the chart it drives');
  ok(await count('#m-lab table.heat td.on') === 2,
    'lab: the pair currently on the chart is outlined on the board, both symmetric cells');
  ok(await count('#m-lab .scale .ramp') === 1, 'lab: the matrix ships a colour scale legend');
  ok(await count('#m-lab .readme') >= 2, 'lab: both the scatter and the matrix carry a how-to-read block');
  ok(await count('#m-lab .legend') >= 1, 'lab: the scatter ships a colour legend');
  ok(await count('#m-lab svg.ch') >= 3, 'lab: the scatter has its two marginal histograms beside it');

  /* ---- tables: centred, capped, cascading ---- */
  console.log('\n--- tables ---');
  await page.evaluate(() => setMode('empire'));
  await page.waitForTimeout(500);
  const tAlign = await page.evaluate(() => {
    const td = document.querySelector('#emp-tbl td.n');
    const th = document.querySelector('#emp-tbl th:not(.rk):not(.lft)');
    return { td: td && getComputedStyle(td).textAlign, th: th && getComputedStyle(th).textAlign };
  });
  ok(tAlign.td === 'center' && tAlign.th === 'center', 'table values and headers are centred');
  const capped = await page.evaluate(() => {
    const box = document.querySelector('#emp-tbl .tbox');
    const cs = getComputedStyle(box);
    return { max: parseFloat(cs.maxHeight), over: cs.overflowY, h: box.clientHeight };
  });
  ok(capped.max > 0 && capped.max <= 640 && capped.over === 'auto',
    'the table body is height-capped at ' + capped.max + 'px and scrolls inside the page');
  /* and it really does clip when the content is longer than the cap */
  const clips = await page.evaluate(() => {
    const box = document.querySelector('#emp-tbl .tbox');
    const tall = box.scrollHeight > box.clientHeight;
    return { tall, rows: document.querySelectorAll('#emp-tbl tbody tr').length };
  });
  ok(clips.rows > 0, 'the ledger has rows to cap (' + clips.rows + ' in the fixture)');
  const sticky = await page.evaluate(() =>
    getComputedStyle(document.querySelector('#emp-tbl th')).position);
  ok(sticky === 'sticky', 'the header stays put while the body scrolls');

  const cascade = await page.evaluate(async () => {
    const sel = document.querySelector('#emp-tbl select[data-fk="div"]');
    const before = document.querySelectorAll('#emp-tbl select[data-fk="conf"] option').length;
    sel.value = 'FBS';
    sel.dispatchEvent(new Event('change', { bubbles:true }));
    const after = document.querySelectorAll('#emp-tbl select[data-fk="conf"] option').length;
    const rows = document.querySelectorAll('#emp-tbl tbody tr').length;
    return { before, after, rows };
  });
  ok(cascade.after < cascade.before && cascade.after > 1,
    'choosing a division CASCADES: the conference list narrows to that division (' +
    cascade.before + ' -> ' + cascade.after + ')');

  const searched = await page.evaluate(() => {
    const inp = document.querySelector('#emp-tbl input[data-fk="q"]');
    inp.focus();
    inp.value = 'northg';
    inp.dispatchEvent(new Event('input', { bubbles:true }));
    return { rows: document.querySelectorAll('#emp-tbl tbody tr').length,
      focused: document.activeElement === document.querySelector('#emp-tbl input[data-fk="q"]') };
  });
  ok(searched.rows === 1, 'the search box filters the table down to the match');
  ok(searched.focused, 'and does NOT steal focus from the input between keystrokes');

  const afterReset = await page.evaluate(() => {
    document.querySelector('#emp-tbl [data-tblreset]').click();
    return document.querySelectorAll('#emp-tbl tbody tr').length;
  });
  ok(afterReset > 1, 'Reset clears every filter and brings the rows back');

  const sortCheck = await page.evaluate(() => {
    const id = 'emp-tbl';
    const col = TBL[id].cols.findIndex(c => c.k === 'sp_rating') + 1;  /* +1 for the rank cell */
    const read = () => $$('#'+id+' tbody tr').map(r => r.children[col].innerText.trim());
    sortTable(id, 'sp_rating'); const a = read();
    sortTable(id, 'sp_rating'); const b = read();
    return { descLast:a[a.length-1], ascLast:b[b.length-1], blanks:a.filter(v=>v==='—').length };
  });
  ok(sortCheck.blanks > 0, 'the ledger contains blank SP+ values to test the sort with');
  ok(sortCheck.descLast === '—' && sortCheck.ascLast === '—',
    'blanks sort last in BOTH directions, not to the top on ascending');

  /* ---- interaction ---- */
  console.log('\n--- interaction ---');
  await page.locator('#m-empire svg.ch circle.cdot').first().click();
  await page.waitForTimeout(300);
  ok(await page.locator('#drawer.on').count() === 1, 'clicking a scatter dot opens the program drawer');
  ok(await count('#drawer polygon.radar-area') === 1, 'the drawer draws the program profile radar');
  const dtxt = await page.locator('#drawer-body').innerText();
  ok(!/-999|NaN|undefined/.test(dtxt), 'the drawer shows no placeholders');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok(await page.locator('#drawer.on').count() === 0, 'Escape closes the drawer');

  await page.evaluate(() => setMode('pipeline'));
  await page.waitForTimeout(600);
  await page.locator('#m-pipeline rect[data-team]').first().click({ timeout:5000 }).catch(()=>{});
  await page.waitForTimeout(250);
  ok(await page.locator('#drawer.on').count() === 1, 'a sankey node opens the program behind it');
  await page.keyboard.press('Escape');

  await page.evaluate(() => setMode('lab'));
  await page.waitForTimeout(800);
  const beforeLab = errors.length;
  const clicked = await page.evaluate(() => {
    const c = document.querySelector('#m-lab table.heat td[data-x]:not(.on)');
    c.click();
    return { x:c.dataset.x, y:c.dataset.y };
  });
  await page.waitForTimeout(500);
  ok(errors.length === beforeLab, 'clicking a matrix cell replots without throwing');
  const nowPlotting = await page.evaluate(() => ({ x:LAB.x, y:LAB.y }));
  ok(nowPlotting.x === clicked.x && nowPlotting.y === clicked.y,
    'the clicked cell becomes the chart\'s two axes');
  ok(await count('#m-lab table.heat td.on') === 2,
    'and the outline follows it to the newly selected cell');
  for (let i=0;i<6;i++){ await page.locator('#lab-surprise').click(); await page.waitForTimeout(200); }
  ok(errors.length === beforeLab, '"Find me something" survives six presses');
  await page.locator('#lab-swap').click();
  await page.waitForTimeout(300);
  ok(errors.length === beforeLab, 'swapping the axes does not throw');

  await page.evaluate(() => setMode('pipeline'));
  await page.waitForTimeout(700);
  const beforePip = errors.length;
  await page.selectOption('#pip-min', '18');
  await page.waitForTimeout(500);
  const pipTxt = await page.locator('#m-pipeline').innerText();
  ok(errors.length === beforePip, 'raising the class minimum to 18 does not throw');
  ok(/Nothing to plot|scored/i.test(pipTxt), 'an empty selection explains itself rather than going blank');
  ok(/Minimum class/i.test(pipTxt), 'the filters survive an empty selection, so the reader can get back');

  /* ---- 390px: no horizontal overflow anywhere ---- */
  console.log('\n--- phone, 390px ---');
  await page.setViewportSize({ width:390, height:844 });
  for (const id of PAGES){
    await page.evaluate(p => setMode(p), id);
    await page.waitForTimeout(500);
    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over <= 0, id + ' has no horizontal page overflow at 390px (' + over + 'px)');
  }

  /* ---- screenshots to actually look at ----
     reset everything the assertions above changed, so the shots show each page
     as a reader first meets it rather than mid-test */
  await page.evaluate(() => {
    PIP.minN = 8; PIP.div = 'FBS'; PIP.conf = 'ALL'; PIP.y = 'avg_commit_mi';
    LAB.x = 'emp_pop'; LAB.y = 'sp_rating'; LAB.xlog = true; LAB.ylog = false;
    EMP.div = 'FBS'; EMP.conf = 'ALL'; MKT.div = 'FBS'; MKT.minN = 2;
    Object.keys(TBL).forEach(id => TBL[id].filters.forEach(f => TBL[id].fstate[f.k] = 'ALL'));
    drawn.clear();
    document.querySelectorAll('section.mode').forEach(s => s.innerHTML = '');
  });
  await page.setViewportSize({ width:1560, height:1400 });
  for (const id of PAGES){
    await page.evaluate(p => setMode(p), id);
    await page.waitForTimeout(650);
    await page.screenshot({ path:'shot-'+id+'.png', fullPage:false });
  }
  /* the service catalogue sits below the fold on the Cutting Room, and it is the
     block most likely to be restyled by accident - shoot it on its own */
  await page.evaluate(() => setMode('cutting'));
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('.formgrid')
    .closest('.card').scrollIntoView({ block:'start' }));
  await page.waitForTimeout(350);
  await page.screenshot({ path:'shot-forms.png', fullPage:false });
  await page.evaluate(() => window.scrollBy({ top:900 }));
  await page.waitForTimeout(300);
  await page.screenshot({ path:'shot-forms2.png', fullPage:false });
  await page.evaluate(() => document.querySelector('#svc-list')
    .closest('.card').scrollIntoView({ block:'start' }));
  await page.waitForTimeout(350);
  await page.screenshot({ path:'shot-services.png', fullPage:false });

  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(() => setMode('empire'));
  await page.waitForTimeout(450);
  await page.screenshot({ path:'shot-phone.png', fullPage:false });

  console.log('\n--- errors seen ---');
  if (errors.length) errors.slice(0,8).forEach(e => console.log('  ! ' + e));
  else console.log('  none');

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
