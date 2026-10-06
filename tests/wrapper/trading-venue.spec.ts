import { describe, expect, it } from 'vitest';
import { selectTradingVenue } from '../../src/core/contracts/index.js';

const graduated = {
  launchpadAmm: { launchpad: { isGraduated: true } },
  truth: { isSettled: false, isFinalized: false },
};

describe('selectTradingVenue', () => {
  it('keeps a priced active book after graduation', () => {
    expect(
      selectTradingVenue({
        ...graduated,
        soothBook: {
          isActive: true,
          isFinalized: false,
          yesPriceWad: 600000000000000000n,
          noPriceWad: 400000000000000000n,
        },
      }),
    ).toBe('soothbook');
  });

  it('stays on the AMM when a registered book has no implied price', () => {
    expect(
      selectTradingVenue({
        ...graduated,
        soothBook: {
          isActive: true,
          isFinalized: false,
          yesPriceWad: 0n,
          noPriceWad: 0n,
        },
      }),
    ).toBe('amm');
  });

  it('stays on the AMM before graduation', () => {
    expect(
      selectTradingVenue({
        launchpadAmm: { launchpad: { isGraduated: false } },
        truth: { isSettled: false, isFinalized: false },
        soothBook: {
          isActive: true,
          isFinalized: false,
          yesPriceWad: 600000000000000000n,
          noPriceWad: 400000000000000000n,
        },
      }),
    ).toBe('amm');
  });
});
