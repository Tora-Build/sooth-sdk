import { ponder } from "@ponder/core";
import { eq, and, desc } from "drizzle-orm";
import { order, fillClaim, marketOrder, tickLiquidity, market } from "../../ponder.schema";

/**
 * Get all active orders for a market
 * GET /orders/:chainId/:marketKey
 */
ponder.get("/orders/:chainId/:marketKey", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;

  const orders = await c.db
    .select()
    .from(order)
    .where(and(eq(order.chainId, chainId), eq(order.marketKey, marketKey), eq(order.status, "active")))
    .orderBy(desc(order.createdAt));

  return c.json(orders);
});

/**
 * Get orders for a specific user in a market
 * GET /orders/:chainId/:marketKey/:owner
 */
ponder.get("/orders/:chainId/:marketKey/:owner", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;
  const owner = c.req.param("owner").toLowerCase() as `0x${string}`;

  const orders = await c.db
    .select()
    .from(order)
    .where(
      and(
        eq(order.chainId, chainId),
        eq(order.marketKey, marketKey),
        eq(order.owner, owner)
      )
    )
    .orderBy(desc(order.createdAt));

  return c.json(orders);
});

/**
 * Get orderbook depth (tick liquidity) for a market
 * GET /orderbook/:chainId/:marketKey
 */
ponder.get("/orderbook/:chainId/:marketKey", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;

  const ticks = await c.db
    .select()
    .from(tickLiquidity)
    .where(and(eq(tickLiquidity.chainId, chainId), eq(tickLiquidity.marketKey, marketKey)));

  // Separate into YES (outcome=1) and NO (outcome=0) sides
  const yesSide = ticks
    .filter((t) => t.outcome === 1 && t.totalLiquidity > 0n)
    .sort((a, b) => a.tick - b.tick);

  const noSide = ticks
    .filter((t) => t.outcome === 0 && t.totalLiquidity > 0n)
    .sort((a, b) => b.tick - a.tick);

  return c.json({
    yes: yesSide,
    no: noSide,
  });
});

/**
 * Get fill history for an order
 * GET /fills/:chainId/:orderId
 */
ponder.get("/fills/:chainId/:orderId", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const orderIdParam = BigInt(c.req.param("orderId"));

  const fills = await c.db
    .select()
    .from(fillClaim)
    .where(and(eq(fillClaim.chainId, chainId), eq(fillClaim.orderId, orderIdParam)))
    .orderBy(desc(fillClaim.timestamp));

  return c.json(fills);
});

/**
 * Get recent market orders (trades) for a market
 * GET /trades/:chainId/:marketKey
 */
ponder.get("/trades/:chainId/:marketKey", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;
  const limit = parseInt(c.req.query("limit") || "50");

  const trades = await c.db
    .select()
    .from(marketOrder)
    .where(and(eq(marketOrder.chainId, chainId), eq(marketOrder.marketKey, marketKey)))
    .orderBy(desc(marketOrder.timestamp))
    .limit(limit);

  return c.json(trades);
});

/**
 * Get all registered markets
 * GET /markets/:chainId
 */
ponder.get("/markets/:chainId", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));

  const markets = await c.db
    .select()
    .from(market)
    .where(eq(market.chainId, chainId))
    .orderBy(desc(market.createdAt));

  return c.json(markets);
});

/**
 * Health check
 * GET /health
 */
ponder.get("/health", async (c) => {
  return c.json({ status: "ok", timestamp: Date.now() });
});
