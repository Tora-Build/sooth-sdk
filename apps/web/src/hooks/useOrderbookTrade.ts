export function useOrderbookTrade(_marketId: string) {
  const placeOrder = async (
    _outcome: 0 | 1,
    _price: string,
    _amount: string,
    _isBuy: boolean = true
  ) => {};

  const placeSpotOrder = async (_outcome: 0 | 1, _price: string, _amount: string) => {};

  const executeHybridSell = async (_outcome: 0 | 1, _price: string, _amount: string) => {};

  const cancelOrder = async (_orderId: string) => {};

  const executeTakerOrder = async (
    _outcome: 0 | 1,
    _price: string,
    _amount: string,
    _isBuy: boolean
  ) => {};

  const depositShares = async (_outcome: number, _amount: string) => {};

  const refetchBalance = async () => {};

  return {
    placeOrder,
    placeSpotOrder,
    executeHybridSell,
    cancelOrder,
    executeTakerOrder,
    depositShares,
    isPending: false,
    availableBalance: 0n,
    internalYesShares: 0n,
    internalNoShares: 0n,
    refetchBalance,
  };
}
