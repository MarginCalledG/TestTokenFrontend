import { Field } from '../components/ui'
import { MintStatus } from '../components/MintStatus'
import { EXPIRED_BLEED_PCT_PER_DAY, MINT_PRICE_USDG, TAX } from '../config/protocol'
import { useProtocolConstants, useRanks, useTiers } from '../hooks/useProtocolConstants'
import { bpsToPct } from '../lib/melt'
import { usdg } from '../lib/format'

/**
 * §7's "plain-language what you're risking page". Written flat, without the
 * offshore joke, because the joke is what the rest of the app is for and this
 * page's only job is to be understood.
 */
export function HowItWorks() {
  const ranks = useRanks()
  const tiers = useTiers()
  const { mintPrice } = useProtocolConstants()
  return (
    <div className="stack">
      <MintStatus />
      <Field title="What HIGHER is">
        <p>
          HIGHER is a token that shrinks. Holding it costs you between 4.2% and
          6.9% of your balance every day, continuously, automatically. This is
          the design, not a bug and not a fee you can avoid by holding still.
          Roughly half of an unprotected balance is gone in ten to sixteen days.
        </p>
        <p>
          The rate depends on how much of the total supply is locked. When more
          is locked, the rate falls; when more is free, it rises.
        </p>
        <p>
          There is no single melt rate. Unlocked balances, each lock length and
          the liquidity pool are separate classes with their own rates, and the
          figures on the lock screen are read per class from the contract
          rather than quoted from a table.
        </p>
      </Field>

      <Field title="Locking">
        <p>
          Locking HIGHER in a vault protects it. There are three lengths, each
          with a fee in USDG paid up front:
        </p>
        <ul>
          {tiers.map((t) => (
            <li key={t.id}>
              <strong>{t.name}</strong> — {usdg(t.feeUsdg)}.{' '}
              {`Still melts about ${t.bleedPctPerDay.toFixed(2)}% a day, and that goes to the agent pot.`}
            </li>
          ))}
        </ul>
        <p>
          Locks expire. An expired position is not returned to you
          automatically — it melts at the full unlocked rate again (up to{' '}
          {EXPIRED_BLEED_PCT_PER_DAY}% a day, burned) until you withdraw or relock,
          and relocking costs the fee again. If you lock and forget, you lose money.
        </p>
        <p>
          Locking protects the number of tokens you hold. It does nothing for
          what they are worth. You can complete a perfect 14-day lock and
          withdraw into a lower price.
        </p>
      </Field>

      <Field title="The IRS Agent game">
        <p>
          Minting an agent costs {usdg(mintPrice ?? MINT_PRICE_USDG)} and the
          rank you get is random:
        </p>
        <ul>
          {ranks.map((r) => (
            <li key={r.id}>
              <strong>{r.name}</strong> — {r.mintChancePct}% chance. Wins an
              audit {r.hitRatePct}% of the time, share weight {r.weight}, costs{' '}
              {usdg(r.feedUsdg)} every three days to keep alive.
            </li>
          ))}
        </ul>
        <p>
          Each agent can audit once per eight-hour epoch, and winners split that epoch's pool
          between them — so a good epoch for everyone is a small payout for
          everyone. Agents you stop feeding die, stop earning, and take up a
          slot until you clear them.
        </p>
        <p>
          Winnings are not paid out automatically. You have to claim them, and
          the claim expires after 90 epochs (about 30 days). The desktop shows a
          reminder when you have winnings waiting or an agent needs feeding.
        </p>
      </Field>

      <Field title="Trading tax">
        <p>
          Buying and selling against the pool is taxed. Buys pay a flat{' '}
          {bpsToPct(TAX.baseBps)}%, whatever the size. Sells start at{' '}
          {bpsToPct(TAX.baseBps)}% and rise with the size of the sale relative to
          the pool and while the price is below its 15-minute average, up to{' '}
          {bpsToPct(TAX.maxSellBps)}%. The first hour after launch was a flat{' '}
          {bpsToPct(TAX.maxSellBps)}% both ways. The tax lives in the token, so the
          same rates apply on Uniswap, in trading bots and here. The exact
          rate for your trade size is shown on the trade screen before you confirm.
        </p>
        <p>
          Sending HIGHER from one wallet to another is never taxed. Only pool
          trades are.
        </p>
      </Field>

      <Field title="What can go wrong">
        <ul>
          <li>
            The melt is relentless. Doing nothing is the most expensive option.
          </li>
          <li>
            Every protective action costs a fee, so small balances can be eaten
            by fees faster than by the melt.
          </li>
          <li>
            The agent game has a negative expected value for most players. Treat
            money spent there as spent.
          </li>
          <li>
            Token price is separate from token quantity. Both can fall at once.
          </li>
          <li>
            The operator can pause the agent game. Mints, feeds, audits and
            claims stop; feed timers do not, so a long enough pause can kill
            agents you have already paid for.
          </li>
          <li>
            Minting is permanently renounced: the supply can only shrink. The
            owner keeps a few levers (tax exemptions, epoch length, keeper
            replacement, pausing the game), all visible on-chain.
          </li>
          <li>
            The agent game depends on a keeper bot that reveals one random value
            per epoch. If it stops, audits fail for that epoch; unrevealed mints
            can be refunded after 7 days.
          </li>
          <li>
            This is unaudited software on a new chain. Smart contracts can have
            bugs that take everything, regardless of how the mechanics are
            supposed to work.
          </li>
        </ul>
        <p className="muted">
          Nothing here is financial advice, and none of it is a real tax
          strategy — the theme is a joke, the losses are not.
        </p>
      </Field>
    </div>
  )
}
