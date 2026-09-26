# Project Walkthrough: Retirement Investing Dashboard

This document is meant to help explain the project out loud, for example in an interview. It
covers what the app does, why it was built the way it was, the reasoning behind each library
choice, the interesting technical problems that came up, and the bugs that got caught along the
way.

## What the project is

It is a single page web app that projects how an ETF investment, or a mix of several ETFs,
could grow between now and retirement. The user enters a current age, a target age, how much
they already have invested, and a contribution amount on a schedule of their choosing. The app
then runs the numbers and shows the projection through a series of charts: a main growth chart,
a range showing a conservative and an optimistic outcome, a year by year breakdown, a
comparison against other funds, and a set of charts covering risk, holdings, sector exposure,
and geography.

There is also a second mode built for a different way of thinking about retirement. Instead of
starting from a contribution amount, the user enters the annual income they want in retirement,
and the app works backward to tell them the contribution required to get there, using the
common 4 percent safe withdrawal rule.

The whole thing runs in the browser. There is no backend database and no user accounts. The
only server side piece is a small function that fetches live market data when the app is
deployed on Netlify, and even that is optional. If it is not available, the app falls back to
built in historical average returns and keeps working normally.

## Why it is built this way

The scope of the project, projecting a number forward through time and drawing charts of it,
does not need a server, a database, or authentication. Keeping everything client side keeps the
app simple to run, simple to deploy, and free of the usual backend concerns like sessions or
data storage. The one place a server helps is fetching live market data, since browsers cannot
call Yahoo Finance directly due to CORS restrictions, so that one piece was pulled out into a
small serverless function rather than turning the whole project into a full stack app just to
solve one problem.

## Tech stack and why each piece was chosen

**React with TypeScript.** React was a natural fit because the app is one continuously updating
form: every input the user changes needs the charts and the summary numbers to update
immediately. TypeScript catches a large class of mistakes before they reach the browser,
especially useful here because there is a fair amount of financial math and many small pieces
of derived state that depend on each other. A typo in a field name or a missing case in the
contribution frequency conversion would be caught at compile time instead of showing up as a
wrong number on screen.

**Vite.** Vite was chosen over something like Create React App because it is faster in
development, has a much smaller and simpler configuration, and produces a lean production
build. Its dev server starts almost instantly and updates the browser as soon as a file is
saved, which mattered a lot given how many rounds of small UI tweaks this project went through.
The dev server is pinned to port 5183 in `vite.config.ts`. That matches what `netlify.toml`
expects, and it means the VS Code launch configs always point at the right URL instead of
guessing at whichever port happened to be free.

**Tailwind CSS.** Tailwind keeps styling next to the markup instead of in separate CSS files,
which made it much faster to iterate on layout and spacing across dozens of small components.
The one exception is color. Colors are not hardcoded as Tailwind utility classes anywhere in the
app. They come from CSS custom properties defined once in `index.css`, with a full set of values
for light mode, dark mode, and print. That separation meant the entire color theme, including
the print specific palette, could be changed in one place without touching any component.
Tailwind's `print:` variant also made the print layout easy to express right on the components.

**Recharts.** Recharts was chosen because it renders real SVG charts using React components,
which fits naturally into the rest of the codebase, and it comes with the pieces needed here out
of the box: area charts, bar charts, scatter plots, and pie charts, each with a customizable
tooltip. Building each chart to match the app's own color and typography system, rather than
using a heavier charting library with its own opinionated look, kept the whole dashboard feeling
like one consistent product rather than a set of pasted in widgets.

**Framer Motion.** Used for the entrance animation on the hero summary at the top of the page,
and for the numbers that count up when an input changes. Its motion values update the text
directly instead of re-rendering the React component on every frame, so a counting number stays
cheap even while other parts of the page are busy.

**Phosphor.** A consistent icon set with a small footprint and one stroke weight across every
glyph, including brand marks like GitHub. Used for things like the plus and minus buttons on the
age stepper, the Export menu, and the risk tier icons.

**ExcelJS.** Needed for the "download as a spreadsheet" feature, which produces a real multi
sheet .xlsx file rather than a single flat CSV. An earlier attempt used the more commonly known
`xlsx` package, but `npm audit` flagged it for a high severity, unpatched vulnerability, so it
was dropped in favor of ExcelJS, which had no such issues. Since ExcelJS is a fairly large
library, it is loaded with a dynamic `import()` inside the download function rather than at the
top of the file, so it only gets downloaded by the browser if someone actually clicks the export
button. This kept it from roughly doubling the size of the main JavaScript bundle for every
visitor.

**Netlify Functions.** A single serverless function that proxies Yahoo Finance's chart endpoint.
This was the simplest way to get live market data without needing a full backend, a database, or
an API key that would otherwise need to be committed to a public repository or managed as a
secret.

**oxlint.** The lint step. It is very fast, which suits a project this size, and it catches
mistakes like breaking the rules of hooks. It runs alongside the strict TypeScript settings
(unused variables and parameters are compile errors), so a lot of small problems never reach a
browser.

## State and data flow

All of the user's inputs live in one `Controls` object held in `App.tsx` with a single
`useState`. The Your Plan panel receives that object and a setter, so it is a fully controlled
component and there is no second copy of the inputs to keep in sync. Everything else is derived
from it. The blended return, the growth projection, the scenario range, the risk points, and the composition breakdowns are all computed with `useMemo` in `App`, then
passed down as plain props to charts that only know how to draw what they are given.

That structure keeps the math separate from the drawing, which makes the math easy to check and
the charts easy to change. It also means a change flows in one direction: inputs, then derived
values, then charts. There is no place where a chart can disagree with the numbers next to it.

Live data is the one input that does not come from the user. When it arrives it is stored in a
separate `liveData` state keyed by ticker and merged in at the point it is used. For example,
live volatility is preferred over the built in estimate when both exist, and when a custom
ticker is added, its real five year return is used once to seed that ticker's assumed return.
After that the user can override it, and the app will not overwrite their value.

## How the growth projection actually works

The core model lives in `src/lib/projection.ts`. Contributions can be entered as weekly,
biweekly, monthly, or yearly, so the first step is converting whatever the user chose into a
monthly equivalent amount. From there the model simulates the plan one month at a time: each
month, the contribution is added to the balance first, and then the balance is grown by the
monthly rate implied by the assumed annual return. That monthly rate is derived from the annual
rate using `(1 + annualReturn) ** (1/12) - 1`, rather than just dividing the annual return by
twelve, so that compounding over a full year lines up exactly with the stated annual return.

This same simulation is run three times to build the scenario chart, once at the assumed
return, once two percentage points lower, and once two percentage points higher, to give a
rough sense of how sensitive the outcome is to the return assumption.

## The goal mode solver

Goal mode required inverting the model above. Instead of simulating forward from a known
contribution to find the ending balance, it needs to start from a target ending balance (the
retirement income the user wants, divided by the 4 percent withdrawal rate) and solve for the
contribution that gets there.

Rather than approximating this with a search or iteration loop, it is solved directly using the
future value of an annuity due formula, which is the standard closed form formula for a stream
of equal payments added at the start of each period and then compounded. Given the target
balance, the current savings grown forward on their own, and the number of months remaining, the
formula gives the exact monthly contribution required in one calculation. This was verified by
plugging the result back into the forward simulation and confirming it lands on the original
target balance, which is a nice example of testing an inverse function by round tripping it
through the function it inverts.

## Portfolio mixing

When a user blends multiple funds together, `src/lib/portfolio.ts` computes a weighted average
return and a weighted average volatility across the mix. The rebalancing logic behind the plus
and minus buttons on each fund's weight is written so the total allocation always stays at
exactly 100 percent. Adding a fund gives it an equal share and proportionally shrinks the
others. Removing a fund proportionally grows the remaining funds to fill the gap. Dragging or
stepping one fund's weight redistributes the difference across the others in proportion to
their current weights. The goal was for the allocation panel to never show a total other than
100 percent, no matter what sequence of additions, removals, or adjustments the user makes.

## Live data and progressive enhancement

The live data feature is designed so that its absence is never a problem. On page load, the app
tries calling `/.netlify/functions/finance` for whatever tickers are currently selected. If that
route does not exist, which is the case for a plain `npm run dev` without the Netlify CLI, the
fetch simply fails and is caught silently, and the app continues using its built in return
assumptions. This progressive enhancement approach meant the app could be developed and tested
entirely locally without ever needing a Netlify account, while still supporting real live data
once deployed.

The function itself does a few things worth mentioning. It validates every ticker against a
strict pattern before it is used in a URL, caps the number of tickers per request, and sets a
timeout on the upstream fetch, since it is proxying an undocumented third party endpoint that
was never meant to be called this way. It also computes an annualized volatility figure from the
monthly price history, which feeds directly into the risk versus return chart.

Prices follow the same rule. The app shows each fund's live price and refreshes it every five
minutes, which matches how long the function's responses are cached. If a quote is missing, it
falls back to a 12 month average price, first from the function and then from figures built into
the fund list. That way the preset funds always show a price, and the fund list marks an average
with "~" so it's never mistaken for a live quote.

## Choosing the right chart for each piece of data

Each chart type was picked to match the kind of comparison it needs to support, rather than
defaulting to whatever looked good. A line and area chart carries the main growth projection
because the primary question there is how a single value changes over time. A scatter plot
handles risk versus return because the point is to compare two independent measurements across
several funds at once. Holdings, sectors, and the fund comparison are ranked horizontal bars
with the value printed on every row, because the question there is which items are biggest and
by how much, and a bar length is easier to compare than a slice angle. Two part splits, like
contributions versus growth or US versus international, are a single split bar. A bar chart
carries yearly growth, where each year is its own amount rather than a point on a trend.

Color is treated the same way. Categorical colors, like each fund's slice in a chart, series
colors, like contributions versus growth, and status colors, like a risk level of low, medium,
high, or very high, are three different kinds of information, so they are drawn from three
separate, fixed sets of colors rather than one shared palette that gets reused for everything.
That keeps a viewer from misreading, say, a red slice in a pie chart as a warning simply because
red also happens to mean "high risk" somewhere else on the page.

The series colors were also checked for colorblind separation and for contrast against the
white card background, instead of judged by eye. That turned up something surprising. Every
"nicer looking" set of blues and greens that was tried at first actually failed, because navy,
green, and teal all sit in the cool half of the color wheel, and the teal gets squeezed between
the other two. Making it greener made it collide with the green, and making it bluer made it
collide with the navy. What worked was spreading the colors apart in lightness as well as hue.

The same thing came up again when the charts moved to Nord's own colors: Frost blue for
contributions, Aurora green for growth, and two more Frost blues for the holdings and sectors
cards, which had been plain gray. Nord's blue and green are almost exactly the same lightness, so
they sit closer together than the check allows. The charts keep the Nord values anyway and
separate the two layers of the balance chart with different fill strengths, a small gap, a
legend, and a table view. On the light theme, darker and more saturated versions that passed
every check were tried first, but they looked muddy next to the rest of Nord, so the light theme
uses the same colors only one small step darker instead. The Your Plan panel sits on a lighter surface than the result cards, so
the one area users can edit is not confused with the results.

## Making it feel fast

Sliders and text fields felt laggy at one point, so the first step was to measure instead of
guess. A quick benchmark showed that all the projections for one render take about 0.03
milliseconds, so the calculations were not the problem. The time was going into rendering and
formatting. Four changes made the difference:

1. **Number formatting.** The compact currency formatter created a new `Intl.NumberFormat` on
   every call, which costs about 118 microseconds, compared with about 1 microsecond for
   reusing one. It runs on every chart axis tick and on every frame of the counting animation,
   and it added up to roughly 28 milliseconds of main thread time per second while a number was
   animating. Creating the formatter once at module level fixed that.
2. **Chart animations.** Recharts plays its entry animation again whenever the data changes, so
   dragging a slider restarted a fresh animation on every chart with every step. Those are now
   off, except for one draw in on the growth chart.
3. **Memoization.** Nothing was memoized, so any state change re-rendered every chart. The chart
   and card components are wrapped in `React.memo`, and the props they receive are stable
   (values computed with `useMemo`, or constants moved outside the component), so a chart only
   re-renders when its own data changes.
4. **Priority.** `App` gives the sidebar the live controls and gives everything else a copy from
   `useDeferredValue`. React handles the typing or dragging first and lets the charts catch up
   afterward, and it drops stale chart renders if the user keeps moving.

One smaller detail goes with these. The projection input is memoized on the individual fields it
uses instead of the whole controls object, so changing something unrelated, like switching
planning mode, does not recompute every chart.

## Animation choices

Animation is used where it explains something and left out where it costs something. The stat
tiles and the headline projection count up to their new value when an input changes, which makes
it obvious that the change did something. The headline also gives a small scale pulse.

The counting starts at the real value on the first render instead of at zero. Counting up from
zero on page load looked like the page was briefly showing wrong numbers before correcting
itself, even though the right value was there all along.

The growth chart draws in once on load, and again when the user switches back from the table
view, but not while inputs are changing. Switching to the table unmounts the chart, so the
animation flag has to already be true on the first render of the new chart. That is why the
state is adjusted during render instead of in an effect, which would flip it one render too
late.

## Exports: CSV, Excel, and PDF

Every individual chart has a small CSV export button next to it, so a specific piece of data can
be pulled out on its own. Separately, there is a single button that builds a full multi sheet
Excel workbook covering the whole plan: a summary sheet, the year by year growth projection, the
scenario range, risk data, holdings, sectors, geography, the portfolio mix, and a comparison
against every preset fund. Both features share the same underlying row data used to draw the
charts, so the numbers in the spreadsheet always match what is on screen.

The PDF export uses the browser's own print dialog rather than a PDF generation library, since
every modern browser can already save a printed page as a PDF, and this avoids pulling in a
heavy rendering dependency just to produce a document the browser can already produce on its
own. A dedicated print stylesheet switches the page to a light theme and a landscape layout
regardless of which theme the user currently has selected, hides the interactive controls, and
forces each chart to stay on one page rather than splitting across a page break.

## A tricky bug worth mentioning: getting charts to print correctly

This ended up being the most iteratively debugged part of the project, and it is a good story
for explaining how to work through a bug you cannot fully observe yourself.

The charts are rendered by Recharts, which measures its container's size using a
`ResizeObserver` and only then draws the chart at that size. That works well on screen, but the
browser's print pipeline does something charts were not designed around: it can reuse a cached,
already painted version of any part of the page that has never actually been scrolled into view,
rather than painting it fresh. The practical effect was that charts further down a long page
could come out blank in the exported PDF, even though they rendered perfectly fine while
scrolling through the page on screen.

The fix went through a few iterations as new symptoms showed up, which is fairly typical of this
kind of layout bug. The first version made the print stylesheet force a single column, landscape
layout, and made every chart's container stay within its card so charts stopped overlapping. The
next symptom was that charts were blank unless the page had already been scrolled down once, so
the print button was changed to scroll to the bottom of the page, then back to the top, before
opening the print dialog, hoping that would force the browser to paint everything along the way.
That introduced a new problem: after scrolling back to the top, the content near the bottom of
the page had only been visible very briefly, and part of it ended up missing from the PDF again.
The final version simplified the approach: scroll to the bottom once, hold there for a couple of
seconds to give both the browser's paint pipeline and Recharts' resize handling time to fully
settle, and only then trigger the print dialog, restoring the original scroll position afterward
rather than before.

One more variant showed up later. The top holdings bar chart was cut off at the bottom in the
PDF. Four charts got their height from `flex-1` inside a card that stretched to fill a grid row.
On screen that works, because the two column grid gives the row a fixed height. In print the
grid becomes one column, so that height source disappears and the chart container collapses
toward its minimum height. An `overflow: hidden` rule that had been added earlier as a safety
measure then clipped everything that did not fit. The fix was to give those charts an explicit
height in print and to stop clipping.

The lesson worth mentioning here is less about the specific fix and more about the process. This
is a case where the bug could not be reproduced by the build and lint checks, so each fix started
from a theory about what the browser was doing internally, and was then confirmed by printing the
page and looking at the result.

## Real bugs found during a full audit of the math

At one point the entire financial model, every formula and every derived number on the page,
was audited end to end. That audit caught two genuine bugs worth mentioning, since they are good
concrete examples of subtle correctness issues rather than surface level UI bugs.

The first was in the live data function's CAGR calculation. The number of years spanning a
price history was being computed as the number of monthly data points divided by twelve, but a
five year monthly price history actually contains sixty one data points, not sixty, since it
includes both the starting and ending price. Dividing by the point count instead of the actual
elapsed time between the first and last timestamp caused the calculated span to come out
slightly too long, which in turn understated the annualized return by a small but real amount.
The fix was to compute the span directly from the difference between the first and last
timestamps.

The second was in the portfolio blending logic. When computing a mix's weighted average return,
an allocation whose ticker did not match any known fund, for example right after a custom
ticker was removed but before the allocation list had caught up, was still being counted toward
the total weight used in the average, effectively treating it as a real position earning a zero
percent return and quietly dragging down the blended figure. The fix was to exclude any
unmatched allocation from both the numerator and the total weight, rather than letting it be
silently treated as a real, zero return holding.

Both of these are the kind of bug that will not throw an error or crash anything. The page keeps
working and the number just quietly comes out slightly wrong, which is exactly why a full
audit, checking every formula against its intended definition rather than just checking that the
page runs, was worth doing.

## How correctness was verified without a test suite

The project does not have an automated test suite. Verification instead relied on a few things:
a full manual audit of every formula against its stated definition, a round trip check on the
goal mode solver by feeding its output back into the forward simulation, the TypeScript compiler
plus a linter (oxlint) catching structural mistakes before anything ran, and, for the
performance work, a small benchmark that measured the math and the formatter separately before
anything was changed. For a project of this size and a single developer, this was a reasonable
tradeoff, though a natural next step would be a small unit test suite around `projection.ts` and
`portfolio.ts`, since those two files contain essentially all of the actual math and would
benefit most from being locked down with tests.

## What could be improved with more time

A few honest answers for "what would you do differently" or "what's next":

- Add a real unit test suite, particularly around the projection and portfolio math, so future
  changes cannot silently reintroduce a bug like the two found during the audit.
- Replace the static, hand entered fund composition data (top holdings, sectors, geography) with
  a live holdings data source, if a reliable and reasonably priced one could be found. The
  current data is accurate at the time it was written but will drift as fund holdings change.
- Add inflation adjustment to the projection, since a dollar amount thirty years from now buys
  less than the same amount today, and this is currently left out for simplicity.
- Consider a lightweight way to save or share a specific plan, for example by encoding the
  inputs into a shareable URL, since right now every session starts from the same defaults.
- Cut down the first load. Recharts makes up most of the roughly 875 KB main bundle, so loading
  the charts that sit further down the page lazily would help the initial paint.

## Quick summary if asked "walk me through this project"

It is a client side React and TypeScript dashboard that projects retirement savings growth for
a chosen ETF or a custom blend of funds, using a month by month compounding model, with an
optional serverless function for live market data that the app is designed to work perfectly
well without. The interesting engineering is mostly in four places: the financial model itself,
including a closed form solver for the goal based planning mode; the portfolio mixing math that
keeps allocations balanced at exactly 100 percent through any sequence of edits; a measured
approach to performance, where profiling showed the math was never the bottleneck; and a real
world debugging exercise in getting charts to render correctly when exported to PDF through the
browser's print pipeline.
