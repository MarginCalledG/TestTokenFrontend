import { Notice } from './ui'
import { useHigherStats } from '../hooks/useHigher'

/**
 * Whether new HIGHER can still be created.
 *
 * This is the single largest risk in the token that has nothing to do with the
 * melt: while mint is un-renounced, the owner can create supply at will and
 * dilute every holder, and no amount of locking protects against it. It is
 * exactly the kind of fact a scam frontend leaves out, so it gets stated
 * plainly in both directions.
 *
 * The undefined case renders as unknown rather than as safe. Reassuring
 * someone because a read hasn't landed yet would be the worst of the three
 * outcomes.
 */
export function MintStatus() {
  const { mintRenounced, exemptControlRenounced, configured } = useHigherStats()
  if (!configured) return null

  if (mintRenounced === undefined) {
    return (
      <Notice kind="setup">
        <p>
          Couldn't read whether minting has been renounced. Until that read
          succeeds, treat the supply as changeable.
        </p>
      </Notice>
    )
  }

  return (
    <>
      {mintRenounced ? (
        <Notice kind="calm">
          <p>
            Minting has been renounced. No new HIGHER can be created by anyone,
            including the deployer. The supply only ever shrinks from here.
          </p>
        </Notice>
      ) : (
        <Notice kind="warn">
          <p>
            Minting has not been renounced. The owner can create new HIGHER at
            any time, which would dilute everyone holding it. Locking does not
            protect against this — a fully protected 14-day position keeps its
            tokens and still loses value if the supply grows.
          </p>
        </Notice>
      )}

      {exemptControlRenounced === false ? (
        <Notice kind="warn">
          <p>
            Exemption control has not been renounced. The owner can still
            exempt an address from the trading tax and the wallet cap, meaning
            some wallets can be given terms you don't get. This is a separate
            power from minting.
          </p>
        </Notice>
      ) : null}
    </>
  )
}
