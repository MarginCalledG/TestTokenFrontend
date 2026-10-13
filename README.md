# Higher frontend

React + TypeScript + Vite + wagmi/viem. Points at the live Robinhood Chain mainnet
deployment by default (addresses in `src/config/addresses.ts`, overridable via `.env`).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/ (deploy to Netlify; netlify.toml sets headers)
```

Every action is wired to the contracts: buy/sell (Uniswap V2 HIGHER/SPY), lock / relock /
withdraw (Cayman Islands), mint / audit / feed / claim / reap (IRS Agents). Approvals are
requested only when the current allowance does not cover the action.

ABIs are generated from the Foundry artifacts of the contracts repo (MarginCalledG/TestToken):
run `forge build` there, then `python3 scripts/gen-abi.py <contracts-repo>/out`. `VITE_RPC_URL` overrides the public RPC.

## Where things are

```
src/config/chains.ts      RH Chain mainnet (4663) + testnet (46630)
src/config/addresses.ts   every address, all env-driven, all nullable
src/config/protocol.ts    tiers, ranks, fees — display fallbacks only
src/abi/index.ts          ⚠️ hand-written placeholder ABIs — replace
src/lib/melt.ts           the demurrage curve, in one place
src/hooks/                chain clock, balance, locks, agents, epoch, tax
src/screens/              Wallet, Trade, Cayman, Agents, Dashboard, How it works
```

## ABIs

`src/abi/*.ts` are generated from the Foundry artifacts, as `as const` modules
rather than JSON imports — JSON loses the literal types wagmi needs to infer
call signatures. Do not hand-edit. Regenerate with:

```bash
for c in Higher CaymanIslands IRSAgent TaxSwapper TwapOracle WHigher; do
  jq '.abi' out/$c.sol/$c.json > /tmp/$c.json
done
```

DynamicTax exposes no external functions (its ABI is `[]`), so there is
nothing for the frontend to call. The dynamic tax is read via
`TwapOracle.taxBps()`.


## Resolved by the real ABIs

Every assumption the scaffold was built on has now been checked against the
artifacts. What the placeholders had wrong:

- **Decay curve** — no longer assumed. `Higher.perSecFactor()` returns the exact
  RAY-scaled multiplier the contract applies to the index each second, so the
  displayed balance uses the contract's own arithmetic and cannot drift. The
  old `(1-r)^days` curve survives only as a fallback if that read fails, with
  a console warning if the value falls outside a plausible range.
- **`CaymanIslands.FEE/DURATION/BLEED/unlockAt`** take `uint256`, not `uint8`.
  Different selector — every one of those calls would have reverted.
- **`IRSAgent.currentEpoch()` returns `uint32`**, and `claim`, `pending` and
  `settle` all take `uint32` epochs. Same problem.
- **`agents()`** returns `uint40 lastFed` and `uint32 lastAtkEpoch1`, which
  viem decodes as `number`, not `bigint`. The code was treating them as
  bigint.
- **`Minted(uint256 id, address owner)`** — the placeholder had the arguments
  the other way round.
- **`Attacked`** carries a `uint32` epoch and it is not indexed.
- **WHigher** uses `wrap`/`unwrap`, not `deposit`/`withdraw`.

Two mechanics the brief never mentioned and the ABI revealed, both now
surfaced on the Trade screen because they change what a trade does:

- **`inLaunchWindow()` / `LAUNCH_TAX_BPS`** — a fixed higher tax during an
  opening window.
- **`maxWallet()` / `MAX_WALLET_BPS`** — a per-wallet cap. A buy that would
  exceed it reverts, so the user pays gas for a failed transaction.

Both of the remaining unknowns are now closed. USDG decimals are read from the
token. Epoch timing comes from `IRSAgent.epochEnd(e)` rather than being
computed from `startTime` and `EPOCH`, which removes the guess about whether
epoch numbering starts at 0 or 1 — that guess drove when the Audit button
unlocked, so it was not cosmetic.

The one scale assumption left is `HITRATE`: uint16 fits both `30` and `3000`
for 30%, so values above 100 are treated as basis points. Worth one testnet
read to confirm.


## Trading is Uniswap V2

One hop, HIGHER directly in the pair, no wrapper. The tax lives in the token
itself, so approvals go to the router and `Zap`, `wHIGHER`, `TaxHook`,
`V4Swap`, `TwapOracleV4` and `TaxSwapper` are all gone from the contracts.
Their ABIs are kept for reference and marked as removed — they must not be
wired up again.

**The router's quote is not the answer.** HIGHER is fee-on-transfer and the
router knows nothing about the tax, so `getAmountsOut` has to be corrected —
and the correction goes on opposite sides depending on direction:

- **Buy**: the pair sends the full amount and the token taxes it on the way to
  the buyer, so the tax applies to the router's *output*.
- **Sell**: the tax comes off on the way *into* the pool, so the pair receives
  less than the user sends and `getAmountsOut(amountIn)` overstates the result.
  Quote the net amount instead.

Both directions are a ~4.2% error if uncorrected, in the flattering direction.
The logic lives once in `useTrade` rather than at each call site.

Tax is resolved in the same order as `Higher._taxBps`: launch window means a
flat 800 bps with the oracle bypassed entirely; otherwise the oracle capped at
800; a missing or reverting oracle falls back to 400.

Three contract behaviours the screen guards against, all from the audit:

- **Max sell needs a buffer.** The balance melts in discrete 30-minute steps
  and `_move` reverts rather than clamping, so signing the displayed figure
  fails if the transaction lands after a step. Max leaves 0.5% behind; a step
  at the top rate is 0.15%.
- **Launch-hour wallet cap** is cumulative per address and cannot be reset by
  moving tokens out. Checked before the buy rather than discovered in a revert.
- **Allowance is overdrawn by rounding** in the scaled-balance model, so
  approvals are padded 1% rather than exact.


## Old note: wrapper-vs-direct routing

Superseded by the section above. The question was which side the rebasing
problem would land on; it landed on the wrapper, and Zap now hides the whole
thing behind two functions.

## What's wired vs. shells

Reads are wired: balances, melt rate, free float, lock positions and
countdowns, agent roster, epoch clock, audit pool, tax preview, treasury
pending. Event subscriptions for `Revealed` and `Attacked` are live with
polling fallback (no websocket assumed).

Writes are shells — buttons render and disable correctly but don't submit.
They need real ABIs and a settled approval sequence first:

- USDG → CaymanIslands (lock fees), USDG → IRSAgent (mint + feed)
- HIGHER → CaymanIslands (lock pulls HIGHER), HIGHER → WHigher (if wrapping)

## Known scaffold limits

- Claimable winnings are found via `activeCursor`/`activeEpochs`, capped at the
  6 most recent open epochs. No event indexer needed.
- `agentsOf` is O(n); fine now, swap to a `Transfer`/`Minted` indexer if the
  population grows. That change is contained to `useAgentRoster`.
- Reads poll on an interval rather than on every block. Fine for a prototype;
  block-driven invalidation is a small change in the hooks.

## Demo mode (design work before deploy)

With no contract addresses every figure renders as `—`, which makes the
populated states impossible to review. Set:

```
VITE_DEMO_MODE=true
```

and every screen fills with invented data: a ticking balance, one empty lock,
one mid-countdown, one expired, agents of each rank including a dead one and
one still revealing, live tax percentages, dashboard stats.

The numbers are fake; the behaviour is not. The balance decays through the same
`projectBalance` the live app uses, countdowns run against the same clock, and
states are derived rather than hardcoded — so what you're looking at is the
real UI with fake inputs. A banner says so at the top of every screen.

Fixtures live in `src/config/demo.ts`. To remove demo mode entirely, delete
that file and the `if (DEMO)` branches in `src/hooks`.

Never set this true on a build pointing at real contracts.

## The honesty invariants

These aren't styling choices — breaking one is a §7 regression:

- `MeltStrip` renders above every screen and is never conditional. Not while
  loading, not during a pending tx, not on the trade screen.
- The balance ticks. A frozen number would misrepresent a token that is
  actively shrinking. It's projected forward from the last on-chain read using
  the contract's own curve, so it shows what `balanceOf` returns *now*.
- Transaction amounts use the exact on-chain bigint, never the projected
  float. The trade screen says so where it matters, and prefers max flows.
- Unconfigured contracts render "not wired up yet", never `0.00`. A zero that
  means "no contract" is indistinguishable from a zero that means "no money".
- The Agents screen opens with the losing case — 75% Junior, the running feed
  cost, "most agents lose money" — above the mint button, not below it.
- Trade tax is quoted for the user's actual size in both directions, refreshed
  every 5s, with the 7%/5% ceilings stated.
- No countdowns that aren't real contract deadlines. Every clock on screen
  reads from `unlockAt`, `startTime + EPOCH`, or `lastFed + FEED_INTERVAL`.

## Design

The app is a 1990s desktop. Screens are windows with title bars, navigation is
a desktop of icons plus a taskbar, and windows are draggable, stackable,
minimisable and closable. Below 760px the geometry is ignored and one window
fills the screen, switched from the taskbar — dragging overlapping windows on
a phone is unusable and the taskbar already does the job.

No Microsoft assets are used or reproduced. The bevels are plain CSS borders,
every icon is drawn on a 16px grid in `src/components/win/Icons.tsx`, and the
type is Tahoma/Verdana with fallbacks — fonts that ship with the OS, so no
webfont is loaded at all.

The bevel is the whole visual language, and getting it backwards is what makes
a fake 95 UI feel off: `.raised` for anything clickable or sitting on top,
`.sunken` for anything you read out of or type into.

**Why the taskbar tray matters.** The brief requires the melt to be visible at
all times, and a windowed UI breaks that the moment someone closes a window.
The tray solves it the way a real OS solves it for the clock: it's chrome, not
content, and there is no control anywhere that hides it. The full readout also
appears inside the Wallet window.

The wallpaper is `src/assets/desktop-wallpaper.webp` — Miami-at-dusk pixel art,
`background-size: cover` with `image-rendering: pixelated` so the browser
doesn't smooth it when scaling. Teal remains the fallback colour: it paints
instantly and is what shows if the image fails.

It lives under `src/` rather than `public/` on purpose: Vite fingerprints
assets it bundles, so swapping the image changes its filename and browsers
fetch it immediately. A file in `public/` keeps its name and stays cached,
which is exactly the trap this hit once already.

Two constraints if it's ever swapped. The upper-left area must stay dark,
because the desktop icon labels are white and sit there (this one averages
16/255 with nothing above 140). And keep it well under 300KB — the source was
1.7MB, reduced to 108KB as WebP.

Nothing opens on load — the desktop starts clean, which is both the authentic
behaviour and what was asked for. The risk page stays one click away via its
desktop icon, which is what the brief actually requires, and the melt readout
in the tray is visible before any window is opened.

