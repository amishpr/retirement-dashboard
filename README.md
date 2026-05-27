# Retirement Investing Dashboard

An interactive dashboard for projecting how ETF and stock investments could grow toward
retirement. Pick a preset fund, type in any ticker, or blend several funds into a portfolio.
Set your age, current savings, and contribution schedule, and the dashboard projects your
balance forward with charts covering growth, risk, holdings, sector exposure, and more. There
is also a goal mode that works backward: tell it the retirement income you want, and it solves
for the contribution you would need to get there.

Everything runs in the browser using built in historical return assumptions by default. When
deployed on Netlify, or run locally with the Netlify CLI, the app also pulls a real trailing
five year return and volatility for any ticker you type in, through a small serverless function.

## Features

- Choose from ten preset ETFs (VOO, SPY, VTI, VT, VXUS, QQQ, SCHD, BND, AGG, SPLV) or type in
  any custom ticker
- Blend multiple funds into a single portfolio with adjustable weights that always add up to
  100 percent
- Enter your current age, target age, current invested amount, and a contribution amount on a
  weekly, biweekly, monthly, or yearly schedule
- Switch to goal mode and enter a desired annual retirement income instead. The app solves for
  the contribution needed to reach it
- Five year return and volatility lookup for any ticker, when live data is available
- Growth projection chart (with a table view), a conservative to optimistic scenario range, a
  year by year candlestick style breakdown, and a bar chart of yearly gains
- Risk versus return scatter plot and a volatility comparison across funds
- Top ten holdings, sector weightings, and domestic versus international breakdowns, with
  automatic blending across a multi fund portfolio
- A comparison of your plan against every preset fund
- Estimated retirement income using the 4 percent safe withdrawal rule
- Stat tiles and the headline projection count up to their new value when you change an input
- CSV export on individual charts, a full multi sheet Excel workbook, and a one click PDF export
- Light and dark themes

## Tech stack

- React 19, TypeScript, and Vite
- Tailwind CSS v4 for styling
- Recharts for all charts
- Framer Motion for the headline entrance and for numbers that count up when an input changes
- lucide-react for icons
- ExcelJS for the multi sheet workbook export, loaded on demand so it does not add weight to
  the initial page load
- A single Netlify Function for the optional live data proxy
- oxlint for linting

## Project structure

```
.vscode/                     Tasks and Chrome debug configs
netlify/functions/finance.mts Serverless proxy for live returns and volatility
netlify.toml                 Netlify build, dev, and redirect settings
vite.config.ts               Vite config (dev server is pinned to port 5183)
src/
  App.tsx                    Top level state, derived calculations, and page layout
  main.tsx                   React entry point
  index.css                  Theme variables (light, dark, and print) and global styles
  components/
    ControlsPanel.tsx        The "Your Plan" sidebar: fund picker, mix builder, age, contributions
    GrowthChart.tsx          Main projected balance area chart, with a table view
    ScenarioChart.tsx        Conservative / expected / optimistic range
    BreakdownDonut.tsx       Contributions versus growth split
    YearlyGrowthBarChart.tsx Bar chart of growth earned each year
    CandlestickChart.tsx     Year by year growth shown as a candlestick style chart
    RetirementIncomeCard.tsx Estimated retirement income at the 4 percent rule
    RiskReturnChart.tsx      Scatter plot of volatility versus average return
    VolatilityBarChart.tsx   Volatility comparison across funds
    HoldingsDonut.tsx / HoldingsChart.tsx   Top ten holdings, as a donut and as a bar chart
    SectorChart.tsx          Sector weighting breakdown
    GeographyDonut.tsx       Domestic versus international split
    CompareChart.tsx         Side by side comparison against every preset fund
    FundOverviewCard.tsx     Summary card for the selected fund or portfolio mix
    DownloadCsvButton.tsx / DownloadReportButton.tsx / PrintPageButton.tsx   Export controls
    Card.tsx, ChartTooltip.tsx, StatTile.tsx, AnimatedNumber.tsx, ThemeToggle.tsx, RiskBadge.tsx
                             Shared UI pieces
  data/
    etfs.ts                  Preset fund list and their assumed return, expense ratio, and risk
    fundComposition.ts       Static top holdings, sector, and geography data per fund
  lib/
    projection.ts            The compounding growth model and the goal mode reverse solver
    portfolio.ts             Blended return and volatility math, and mix rebalancing logic
    liveData.ts              Client for the live data function
    risk.ts                  Volatility to risk label bucketing
    excelExport.ts, download.ts   Export helpers
```

## Getting started

Requires Node.js 20.19 or newer, or 22.12 or newer. Vite 8 will not run on older versions.

```bash
npm install
npm run dev
```

This opens the app at `http://localhost:5183`. That alone gives you the full app with the built
in return assumptions. Live data is optional and the app works correctly without it.

## Available scripts

- `npm run dev`, starts the Vite dev server
- `npm run build`, type checks the project and builds a production bundle into `dist/`
- `npm run lint`, runs oxlint
- `npm run preview`, serves the production build locally to sanity check it before deploying

## VS Code

The `.vscode/` folder has task and debug configs for this project.

- Tasks (Terminal, then Run Task): `dev`, `netlify dev`, `build`, `lint`, and `preview`. `build`
  is the default build task, so Cmd+Shift+B runs it.
- Launch configs (Run and Debug): "Launch Chrome against dev server" starts the `dev` task and
  opens Chrome with breakpoints working in the TypeScript source. "Launch Chrome against Netlify
  dev (live data)" does the same through `netlify dev` on port 8888. "Attach to Chrome" connects
  to a Chrome window that was started with remote debugging on port 9222.
- The same three configs exist for Firefox. They need the "Debugger for Firefox" extension
  (`firefox-devtools.vscode-firefox-debug`), which `.vscode/extensions.json` recommends, so VS Code
  offers to install it the first time you open the project. "Attach to Firefox" expects Firefox to
  have been started with `--start-debugger-server 6000` and `devtools.debugger.remote-enabled` set
  to true.

## Live market data

`netlify/functions/finance.mts` proxies Yahoo Finance's chart endpoint so the browser can get a
real five year CAGR for any ticker without running into CORS restrictions or needing an API key.
It also computes an annualized volatility figure from the same price history, and returns the
latest price, which the interface does not currently show.

This is an unofficial, undocumented endpoint. It can change or start rate limiting without
notice. That is an acceptable tradeoff for a personal project, since it needs no signup and no
API key that could leak from a public repository, but it should not be relied on for anything
that needs guarantees.

To test it locally before deploying, run the Netlify CLI:

```bash
npx netlify dev
```

This runs the Vite dev server and the function together on one origin at
`http://localhost:8888`, using the settings in `netlify.toml`. Without it, a plain `npm run dev`
still gives you the full app. It simply falls back to the built in historical averages, since
the `/.netlify/functions/*` route only exists in a Netlify environment.

## Deploying to Netlify

1. Push this repository to GitHub.
2. In Netlify, choose "Add a new site", then "Import an existing project", and pick the
   repository.
3. Netlify reads `netlify.toml` automatically. Build command is `npm run build`, the publish
   directory is `dist`, and the functions directory is `netlify/functions`. No environment
   variables are required.

## Exporting

- **CSV.** Each chart card has a small download button that exports the rows behind that chart.
- **Excel.** The header button builds one workbook with a sheet each for the summary, growth
  projection, scenario range, yearly growth, risk versus return, top holdings, sector
  weightings, domestic versus international split, portfolio composition, and the fund
  comparison. ExcelJS is only downloaded when you click the button.
- **PDF.** The header button scrolls to the bottom of the page, waits two seconds so every chart
  finishes drawing, then opens the browser print dialog. Choose "Save as PDF" as the
  destination. The print styles force the light theme and a landscape layout, hide the Your Plan
  panel, and put each chart card on its own page.

## Theming

All colors live in `src/index.css` as CSS custom properties, with separate values for light
mode, dark mode, and print. Components read the variables, so changing a color is a one line
edit. Printing always uses the light values, whichever theme is active on screen.

The three chart series colors (navy for contributions, green for growth, and teal for the
accent series) were checked for colorblind separation and for contrast against the white card
background, and the light theme values were picked to pass those checks. The Your Plan panel has
its own color, `--plan-accent`, so the one area you can edit is not mistaken for a chart series.

## Performance

The projection math is cheap. All of the projections for one render take about 0.03 milliseconds,
so the work that matters is rendering. A few choices keep sliders and text fields responsive:

- Chart components are wrapped in `React.memo`, so a change only re-renders the charts whose
  data actually changed.
- `App` gives the inputs panel the live state and feeds everything else from `useDeferredValue`,
  so typing and dragging stay responsive while the charts catch up.
- Recharts animations are off, except for the first draw of the growth chart. A full animation
  restarting on every slider step made the page feel laggy.
- `Intl.NumberFormat` instances are created once and reused. Creating one costs about 100 times
  more than formatting with an existing one.

## How the projection works

The model lives in `src/lib/projection.ts` and is intentionally simple to reason about: it
simulates the plan one month at a time rather than relying on a single formula for the whole
span of years.

Whatever contribution schedule the user picks, weekly, biweekly, monthly, or yearly, is first
converted into a monthly equivalent amount. From there, each month follows the same two steps:
the contribution is added to the balance, and then the balance is grown by the monthly rate
implied by the assumed annual return. That monthly rate is derived from the annual rate using
`(1 + annualReturn) ** (1/12) - 1`, rather than simply dividing the annual return by twelve, so
that compounding over a full year lands exactly on the stated annual return. Running this same
simulation three times, once at the assumed return and once each a couple of points above and
below it, produces the conservative to optimistic scenario range shown on the chart.

Goal mode runs the same model in reverse. Instead of simulating forward from a contribution to
find an ending balance, it starts from a target balance, the desired retirement income divided
by the 4 percent safe withdrawal rate, and solves directly for the monthly contribution needed
to reach it. This uses the future value of an annuity due formula, the standard closed form
formula for a stream of equal payments added at the start of each period and then compounded,
rather than approximating the answer with a search or iteration loop. It was verified by feeding
the resulting contribution back into the forward simulation and confirming it lands on the exact
target balance.

A fuller explanation of the reasoning behind this approach, along with the portfolio blending
math and two real bugs the model went through during an audit, is in `WALKTHROUGH.md`.

## Disclaimer

Historical average returns, the scenario range, the candlestick breakdown, fund composition
data, and the retirement income estimate are all educational approximations. They are not
guarantees, predictions, or financial advice.
