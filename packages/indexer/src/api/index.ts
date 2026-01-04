import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq, and, desc } from "ponder";
import { Hono } from "hono";

const app = new Hono();

// Helper to serialize BigInt values to strings for JSON
function serializeBigInts<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

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

  return c.json(serializeBigInts(orders));
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

  return c.json(serializeBigInts(orders));
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

export default app;
