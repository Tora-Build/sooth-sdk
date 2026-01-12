import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq, and, desc } from "ponder";
import { Hono } from "hono";

const app = new Hono();

const Q128 = 2n ** 128n;

function serializeBigInts<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

function calculatePendingFills(
  orderSharesTotal: bigint,
  orderClaimedShares: bigint,
  orderCrossingFilled: bigint,
  orderFillGrowthLast: bigint,
  globalFillGrowth: bigint
): bigint {
  if (globalFillGrowth <= orderFillGrowthLast) return 0n;
  
  const delta = globalFillGrowth - orderFillGrowthLast;
  let pending = (delta * orderSharesTotal) / Q128;
  
  const maxFillable = orderSharesTotal - orderCrossingFilled - orderClaimedShares;
  if (pending > maxFillable) {
    pending = maxFillable;
  }
  
  return pending > 0n ? pending : 0n;
}

const fillGrowthId = (chainId: number, marketKey: string, outcome: number) =>
  `${chainId}-${marketKey}-${outcome}`;

/**
 * Get all active orders for a market
 * GET /orders/:chainId/:marketKey
 */
app.get("/orders/:chainId/:marketKey", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;

  const orders = await db
    .select()
    .from(schema.order)
    .where(
      and(
        eq(schema.order.chainId, chainId),
        eq(schema.order.marketKey, marketKey),
        eq(schema.order.status, "active")
      )
    )
    .orderBy(desc(schema.order.createdAt));

  const fillGrowthStates = await db
    .select()
    .from(schema.fillGrowthState)
    .where(
      and(
        eq(schema.fillGrowthState.chainId, chainId),
        eq(schema.fillGrowthState.marketKey, marketKey)
      )
    );

  const fillGrowthMap = new Map<number, bigint>(
    fillGrowthStates.map((fg) => [fg.outcome, fg.fillGrowthX128] as [number, bigint])
  );

  const enrichedOrders = orders.map((order) => {
    const globalFillGrowth = fillGrowthMap.get(order.outcome) ?? 0n;
    const calculatedPendingShares = calculatePendingFills(
      order.liquidity,
      order.claimedShares,
      order.crossingFilled,
      order.fillGrowthLastX128,
      globalFillGrowth
    );
    
    const totalPending = order.crossingFilled - order.claimedShares + calculatedPendingShares;
    
    return {
      ...order,
      pendingShares: totalPending,
      calculatedPendingFromGrowth: calculatedPendingShares,
    };
  });

  return c.json(serializeBigInts(enrichedOrders));
});

/**
 * Get orders for a specific user in a market (active orders only)
 * GET /orders/:chainId/:marketKey/:owner
 */
app.get("/orders/:chainId/:marketKey/:owner", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;
  const owner = c.req.param("owner").toLowerCase() as `0x${string}`;

  const orders = await db
    .select()
    .from(schema.order)
    .where(
      and(
        eq(schema.order.chainId, chainId),
        eq(schema.order.marketKey, marketKey),
        eq(schema.order.owner, owner),
        eq(schema.order.status, "active")
      )
    )
    .orderBy(desc(schema.order.createdAt));

  const fillGrowthStates = await db
    .select()
    .from(schema.fillGrowthState)
    .where(
      and(
        eq(schema.fillGrowthState.chainId, chainId),
        eq(schema.fillGrowthState.marketKey, marketKey)
      )
    );

  const fillGrowthMap = new Map<number, bigint>(
    fillGrowthStates.map((fg) => [fg.outcome, fg.fillGrowthX128] as [number, bigint])
  );

  const enrichedOrders = orders.map((order) => {
    const globalFillGrowth = fillGrowthMap.get(order.outcome) ?? 0n;
    const calculatedPendingShares = calculatePendingFills(
      order.liquidity,
      order.claimedShares,
      order.crossingFilled,
      order.fillGrowthLastX128,
      globalFillGrowth
    );
    
    const totalPending = order.crossingFilled - order.claimedShares + calculatedPendingShares;
    
    return {
      ...order,
      pendingShares: totalPending,
      calculatedPendingFromGrowth: calculatedPendingShares,
    };
  });

  return c.json(serializeBigInts(enrichedOrders));
});

/**
 * Get orderbook depth (tick liquidity) for a market
 * GET /orderbook/:chainId/:marketKey
 */
app.get("/orderbook/:chainId/:marketKey", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;

  const ticks = await db
    .select()
    .from(schema.tickLiquidity)
    .where(
      and(
        eq(schema.tickLiquidity.chainId, chainId),
        eq(schema.tickLiquidity.marketKey, marketKey)
      )
    );

  // Separate into YES (outcome=1) and NO (outcome=0) sides
  const yesSide = ticks
    .filter((t) => t.outcome === 1 && t.totalLiquidity > 0n)
    .sort((a, b) => a.tick - b.tick);

  const noSide = ticks
    .filter((t) => t.outcome === 0 && t.totalLiquidity > 0n)
    .sort((a, b) => b.tick - a.tick);

  return c.json(serializeBigInts({
    yes: yesSide,
    no: noSide,
  }));
});

/**
 * Get fill history for an order
 * GET /fills/:chainId/:orderId
 */
app.get("/fills/:chainId/:orderId", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const orderIdParam = BigInt(c.req.param("orderId"));

  const fills = await db
    .select()
    .from(schema.fillClaim)
    .where(
      and(
        eq(schema.fillClaim.chainId, chainId),
        eq(schema.fillClaim.orderId, orderIdParam)
      )
    )
    .orderBy(desc(schema.fillClaim.timestamp));

  return c.json(serializeBigInts(fills));
});

/**
 * Get recent market orders (trades) for a market
 * GET /trades/:chainId/:marketKey
 */
app.get("/trades/:chainId/:marketKey", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;
  const limit = parseInt(c.req.query("limit") || "50");

  const trades = await db
    .select()
    .from(schema.marketOrder)
    .where(
      and(
        eq(schema.marketOrder.chainId, chainId),
        eq(schema.marketOrder.marketKey, marketKey)
      )
    )
    .orderBy(desc(schema.marketOrder.timestamp))
    .limit(limit);

  return c.json(serializeBigInts(trades));
});

/**
 * Get order crossings (limit order fills) for a market
 * GET /crossings/:chainId/:marketKey
 */
app.get("/crossings/:chainId/:marketKey", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;
  const limit = parseInt(c.req.query("limit") || "50");

  const crossings = await db
    .select()
    .from(schema.orderCrossed)
    .where(
      and(
        eq(schema.orderCrossed.chainId, chainId),
        eq(schema.orderCrossed.marketKey, marketKey)
      )
    )
    .orderBy(desc(schema.orderCrossed.timestamp))
    .limit(limit);

  return c.json(serializeBigInts(crossings));
});

/**
 * Get all registered markets
 * GET /markets/:chainId
 */
app.get("/markets/:chainId", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));

  const markets = await db
    .select()
    .from(schema.market)
    .where(eq(schema.market.chainId, chainId))
    .orderBy(desc(schema.market.createdAt));

  return c.json(serializeBigInts(markets));
});

// ============================================
// V9.9.7: Spot Sell API Endpoints
// ============================================

/**
 * Get active spot sell orders for a market
 * GET /spotsells/:chainId/:marketKey
 */
app.get("/spotsells/:chainId/:marketKey", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;

  const orders = await db
    .select()
    .from(schema.spotSellOrder)
    .where(
      and(
        eq(schema.spotSellOrder.chainId, chainId),
        eq(schema.spotSellOrder.marketKey, marketKey),
        eq(schema.spotSellOrder.status, "active")
      )
    )
    .orderBy(desc(schema.spotSellOrder.createdAt));

  return c.json(serializeBigInts(orders));
});

/**
 * Get spot sell orders for a specific user in a market
 * GET /spotsells/:chainId/:marketKey/:owner
 */
app.get("/spotsells/:chainId/:marketKey/:owner", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;
  const owner = c.req.param("owner").toLowerCase() as `0x${string}`;

  const orders = await db
    .select()
    .from(schema.spotSellOrder)
    .where(
      and(
        eq(schema.spotSellOrder.chainId, chainId),
        eq(schema.spotSellOrder.marketKey, marketKey),
        eq(schema.spotSellOrder.owner, owner)
      )
    )
    .orderBy(desc(schema.spotSellOrder.createdAt));

  return c.json(serializeBigInts(orders));
});

/**
 * Get fill history for a spot sell order
 * GET /spotsell-fills/:chainId/:sellId
 */
app.get("/spotsell-fills/:chainId/:sellId", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const sellIdParam = BigInt(c.req.param("sellId"));

  const fills = await db
    .select()
    .from(schema.spotSellFill)
    .where(
      and(
        eq(schema.spotSellFill.chainId, chainId),
        eq(schema.spotSellFill.sellId, sellIdParam)
      )
    )
    .orderBy(desc(schema.spotSellFill.timestamp));

  return c.json(serializeBigInts(fills));
});

app.get("/launchpad-markets/:chainId", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));

  const markets = await db
    .select()
    .from(schema.launchpadMarket)
    .where(eq(schema.launchpadMarket.chainId, chainId))
    .orderBy(desc(schema.launchpadMarket.createdAt));

  return c.json(serializeBigInts(markets));
});

app.get("/portfolio/:chainId/:user", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const user = c.req.param("user").toLowerCase() as `0x${string}`;

  const [vaultBalance, vaultPositions, ammPositions, lpBalances, lockEntries] = await Promise.all([
    db
      .select()
      .from(schema.vaultBalance)
      .where(
        and(
          eq(schema.vaultBalance.chainId, chainId),
          eq(schema.vaultBalance.user, user)
        )
      )
      .limit(1),
    db
      .select()
      .from(schema.vaultPosition)
      .where(
        and(
          eq(schema.vaultPosition.chainId, chainId),
          eq(schema.vaultPosition.user, user)
        )
      ),
    db
      .select()
      .from(schema.ammPosition)
      .where(
        and(
          eq(schema.ammPosition.chainId, chainId),
          eq(schema.ammPosition.user, user)
        )
      ),
    db
      .select()
      .from(schema.lpBalance)
      .where(
        and(
          eq(schema.lpBalance.chainId, chainId),
          eq(schema.lpBalance.user, user)
        )
      ),
    db
      .select()
      .from(schema.lockEntry)
      .where(
        and(
          eq(schema.lockEntry.chainId, chainId),
          eq(schema.lockEntry.user, user),
          eq(schema.lockEntry.claimed, false)
        )
      )
      .orderBy(schema.lockEntry.unlockTime),
  ]);

  return c.json(
    serializeBigInts({
      vaultBalance: vaultBalance[0] ?? null,
      vaultPositions: vaultPositions.filter(
        (p) => p.yesSharesWad > 0n || p.noSharesWad > 0n
      ),
      ammPositions: ammPositions.filter(
        (p) => p.yesShares > 0n || p.noShares > 0n
      ),
      lpBalances: lpBalances.filter((p) => p.balance > 0n),
      lockEntries,
    })
  );
});

app.get("/vault-balance/:chainId/:user", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const user = c.req.param("user").toLowerCase() as `0x${string}`;

  const result = await db
    .select()
    .from(schema.vaultBalance)
    .where(
      and(
        eq(schema.vaultBalance.chainId, chainId),
        eq(schema.vaultBalance.user, user)
      )
    )
    .limit(1);

  return c.json(
    serializeBigInts(
      result[0] ?? { availableUsdcWad: "0", reservedUsdcWad: "0" }
    )
  );
});

app.get("/vault-positions/:chainId/:user", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const user = c.req.param("user").toLowerCase() as `0x${string}`;

  const positions = await db
    .select()
    .from(schema.vaultPosition)
    .where(
      and(
        eq(schema.vaultPosition.chainId, chainId),
        eq(schema.vaultPosition.user, user)
      )
    );

  return c.json(
    serializeBigInts(
      positions.filter((p) => p.yesSharesWad > 0n || p.noSharesWad > 0n)
    )
  );
});

app.get("/amm-positions/:chainId/:user", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const user = c.req.param("user").toLowerCase() as `0x${string}`;

  const positions = await db
    .select()
    .from(schema.ammPosition)
    .where(
      and(
        eq(schema.ammPosition.chainId, chainId),
        eq(schema.ammPosition.user, user)
      )
    );

  return c.json(
    serializeBigInts(positions.filter((p) => p.yesShares > 0n || p.noShares > 0n))
  );
});

app.get("/lp-balances/:chainId/:user", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const user = c.req.param("user").toLowerCase() as `0x${string}`;

  const balances = await db
    .select()
    .from(schema.lpBalance)
    .where(
      and(
        eq(schema.lpBalance.chainId, chainId),
        eq(schema.lpBalance.user, user)
      )
    );

  return c.json(serializeBigInts(balances.filter((b) => b.balance > 0n)));
});

app.get("/lock-entries/:chainId/:user", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const user = c.req.param("user").toLowerCase() as `0x${string}`;

  const entries = await db
    .select()
    .from(schema.lockEntry)
    .where(
      and(
        eq(schema.lockEntry.chainId, chainId),
        eq(schema.lockEntry.user, user),
        eq(schema.lockEntry.claimed, false)
      )
    )
    .orderBy(schema.lockEntry.unlockTime);

  return c.json(serializeBigInts(entries));
});

export default app;
