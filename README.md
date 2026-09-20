# The Film Room

The analytics side of the **CFB Atlas** - the third custom app in the family,
after [Ask the Atlas](https://briankingery87.github.io/ask-the-atlas/)
(question-first) and Tux's Take (post-game).

Ask the Atlas answers a question about one place. Tux's Take tells you what
happened on Saturday. The Film Room does the thing neither of them can: it puts
two different Atlas layers on the same pair of axes and asks whether they have
anything to do with each other.

**One HTML file. No server, no API key, no build tooling, and no third-party
code at all** - there is no chart library here, because a dependency that draws
your charts also decides what an honest chart looks like. Every plot is inline
SVG the file writes itself. It reads the published ArcGIS services live over
REST on every page load.

## The rooms

| Page | Question |
|---|---|
| Q1. The Empire Ledger | Does owning people win games? |
| Q2. The Price | What does the schedule cost? |
| Q3. The Pipeline | Who farms their own country? |
| Q4. The Market | Where is the line wrong? |
| Q5. The Poll Machine | What do voters see that models do not? |
| Q6. The Lab | Plot anything against anything - board first, then the chart it drives |
| The Cutting Room | How is any of this computed? |

Every program on every chart, bar and table is clickable and opens a full
dossier in a side panel.

## What it reads

Ten layers across six services, all public, all anonymous. The Cutting Room
lists them in the family's standard service catalogue format - the one Ask the
Atlas established and Tux's Take copied - grouped by service and ordered by
layer number inside each one:

- **CFB Atlas Teams** 0 - identity, venue, SP+/Elo/FPI/talent
- **CFB Atlas Territories** 1, 2, 3 - state rollups, all 3,144 counties, fan empires
- **CFB Atlas Recruiting** 0 - the 2026 class
- **CFB Atlas Travel** 0 - road trips and season rollups
- **CFB Atlas Stats** 1, 2, 3 - rankings, ratings, betting lines
- **CFB Atlas Recaps** 0 - completed games (never the recap prose; that is Tux's)

Only Teams, Empires, Rankings, Ratings and GameResults load on arrival. The
rest are fetched the first time a page needs them, which is why The Pipeline
pauses on its first open and never again.

## Working on it

```
python build.py          # src/app.template.html -> index.html + .appcheck.js
node --check .appcheck.js
node smoke.js            # Playwright, fully mocked REST, 116 assertions
```

**`src/app.template.html` is the source of truth. Never hand-edit `index.html`** -
it is generated. There is no vendor step; the app draws no maps, so there is no
Leaflet to inline.

The smoke test runs entirely offline against a fixture that deliberately
contains a landless FBS program, an FCS team whose every rating is a -999
placeholder, a D3 program with "N/A" strings, a recruit with no county, four
uncommitted recruits, an ownerless county, cross-conference raids in three
directions, a game with no closing spread, an exact push against the spread, a
game missing a score, and a team that drops out of the poll between weeks. It
also asserts that every chart form actually draws, that table filters cascade
and the search box keeps focus, and that all eight pages have zero horizontal
overflow at 390px.

## Fourteen chart forms, no chart library

Scatter (with fit line, quadrant split, log axes and direct labels on the
outliers), lollipop, diverging bars, box and whisker, beeswarm, histogram,
treemap, sankey, chord, bump, slope, dumbbell, waffle and a correlation matrix -
all inline SVG this file writes itself. The Cutting Room shows a **drawn
miniature of every one**, with what it is for and which pages use it. Categorical colour comes from eight hues
validated for colour-vision separation and contrast against the page's navy,
assigned in fixed order and never cycled; a ninth category becomes "Other".
Every multi-series chart carries a legend, and nothing is identified by colour
alone.

To publish: double-click `publish.bat`, paste a message.

## Honesty rules this app is built on

- A typed placeholder (-1, -999, "N/A", "Pending") is never plotted as a value.
- Meter bars scale to a fixed ceiling, never to whatever is on screen.
- Every correlation prints its `n`, and the sentence under it stops at "tendency".
- Fan territory is a **model estimate, not survey data**, and every page that
  uses it says so on the page.

Built and maintained by Brian Kingery. Data: College Football Data (CFBD), US
Census via Esri Living Atlas, and the brand-weighted gravity model documented
in the CFB Atlas. Betting figures are historical record, not advice.
