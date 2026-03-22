# Codex Review — Spec Consistency Audit

Reviewed files:
- `LAYER1-CORE-PROTOCOL.md`
- `LAYER2_ADJUDICATOR_SPEC.md`
- `LAYER3-CREATOR.md`
- `SPEC-INDEX.md`

## Findings (Ordered by Severity)

1. **High**: Cross-spec API mismatch for `createMarket` and creator-controlled params.  
`LAYER1-CORE-PROTOCOL.md` defines `createMarket(...)` with `question/startTime/deadline/adjudicator/bBase` only, while `LAYER3-CREATOR.md` adds `_initialProbabilityWad` and `_graduationBps`, and states creator controls `graduationBps`.

2. **High**: `redeemLP` eligibility is contradictory.  
Layer 1 says settlement-gated (`requires isSettled`), but Layer 3 says redemption is allowed before settlement (`does not enforce settlement requirement`).

3. **High**: Creator deposit semantics conflict (refunded vs not refunded).  
Layer 1 says creator deposit is explicitly refunded on graduation in `notifyGraduation`. Layer 3 says there is no separate deposit refund and LP is the only claim.

4. **High**: Layer 2 still documents removed architecture elements.  
Layer 2 includes `Collateralizer` in Layer 1 architecture and redemption narrative, while Layer 1 marks `Collateralizer` removed.

5. **High**: `SPEC-INDEX` is on an older state machine/model than Layer 1.  
It references `ProtocolConfig`, `SETTLING/FINALIZED`, `claimRefund` on Launchpad, and `settle(outcome,tStar)` paths, conflicting with Layer 1’s `RESOLVING/RESOLVED/SETTLED`, removed `ProtocolConfig`, and `claimRefund` moved to AMM.

6. **Medium**: Broken cross-links / filename drift for Layer 2 doc.  
Many references point to `LAYER2-ADJUDICATOR.md`, but the present file is `LAYER2_ADJUDICATOR_SPEC.md`.

7. **Medium**: Layer 2 version metadata is inconsistent.  
Header says `Version: 0.2.0`; footer says `Version: 0.1.0`.

8. **Medium**: `SPEC-INDEX` compiler settings conflict with repository standards.  
Quick-reference card states `solc 0.8.33, via_ir=false, 200 runs`, conflicting with current repo guidance.

## Recommendation

Pick one canonical source (recommended: Layer 1 for contract truth), then align Layer 2/Layer 3/SPEC-INDEX to that canonical API + state machine in a single sweep to avoid integration bugs.
