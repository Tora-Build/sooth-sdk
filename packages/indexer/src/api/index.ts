/// <reference types="ponder/virtual" />

import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq, and, desc } from "ponder";
import { Hono } from "hono";

const app = new Hono();

function parseChainId(chainIdParam: string): number {
  return parseInt(chainIdParam);
}

function normalizeUser(userParam: string): `0x${string}` {
  return userParam.toLowerCase() as `0x${string}`;
}

function serializeBigInts<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

app.get("/launchpad-markets/:chainId", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));

  const markets = await db
    .select()
    .from(schema.launchpadMarket)
    .where(eq(schema.launchpadMarket.chainId, chainId))
    .orderBy(desc(schema.launchpadMarket.createdAt));

  return c.json(serializeBigInts(markets));
});

app.get("/v12/markets/:chainId", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));

  const markets = await db
    .select()
    .from(schema.market)
    .where(eq(schema.market.chainId, chainId))
    .orderBy(desc(schema.market.createdAt));

  return c.json(serializeBigInts(markets));
});

app.get("/v12/orders/:chainId/:marketKey", async (c) => {
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

app.get("/v12/orders/:chainId/:marketKey/:owner", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;
  const owner = c.req.param("owner").toLowerCase() as `0x${string}`;

  const status = c.req.query("status") ?? "active";

  const whereClause = status === "all"
    ? and(
        eq(schema.order.chainId, chainId),
        eq(schema.order.marketKey, marketKey),
        eq(schema.order.maker, owner)
      )
    : and(
        eq(schema.order.chainId, chainId),
        eq(schema.order.marketKey, marketKey),
        eq(schema.order.maker, owner),
        eq(schema.order.status, "active")
      );

  const orders = await db
    .select()
    .from(schema.order)
    .where(whereClause)
    .orderBy(desc(schema.order.createdAt));

  return c.json(serializeBigInts(orders));
});

app.get("/v12/fills/:chainId/:marketKey", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;
  const limit = parseInt(c.req.query("limit") || "50");

  const fills = await db
    .select()
    .from(schema.fill)
    .where(
      and(
        eq(schema.fill.chainId, chainId),
        eq(schema.fill.marketKey, marketKey)
      )
    )
    .orderBy(desc(schema.fill.timestamp))
    .limit(limit);

  return c.json(serializeBigInts(fills));
});

app.get("/v12/activity/:chainId/:marketKey", async (c) => {
  const chainId = parseInt(c.req.param("chainId"));
  const marketKey = c.req.param("marketKey") as `0x${string}`;
  const limit = parseInt(c.req.query("limit") || "100");

  const [orders, fills, mintMerges] = await Promise.all([
    db
      .select()
      .from(schema.order)
      .where(
        and(
          eq(schema.order.chainId, chainId),
          eq(schema.order.marketKey, marketKey)
        )
      )
      .orderBy(desc(schema.order.createdAt))
      .limit(limit),
    db
      .select()
      .from(schema.fill)
      .where(
        and(
          eq(schema.fill.chainId, chainId),
          eq(schema.fill.marketKey, marketKey)
        )
      )
      .orderBy(desc(schema.fill.timestamp))
      .limit(limit),
    db
      .select()
      .from(schema.mintMerge)
      .where(
        and(
          eq(schema.mintMerge.chainId, chainId),
          eq(schema.mintMerge.marketKey, marketKey)
        )
      )
      .orderBy(desc(schema.mintMerge.timestamp))
      .limit(limit),
  ]);

  const activity = [
    ...orders.map((order) => ({
      type: "order",
      timestamp: order.createdAt,
      data: order,
    })),
    ...fills.map((fill) => ({
      type: "fill",
      timestamp: fill.timestamp,
      data: fill,
    })),
    ...mintMerges.map((entry) => ({
      type: "mint_merge",
      timestamp: entry.timestamp,
      data: entry,
    })),
  ]
    .sort((a, b) => {
      if (a.timestamp === b.timestamp) return 0;
      return a.timestamp > b.timestamp ? -1 : 1;
    })
    .slice(0, limit);

  return c.json(serializeBigInts(activity));
});

app.get("/amm-positions/:chainId/:user", async (c) => {
  const chainId = parseChainId(c.req.param("chainId"));
  const user = normalizeUser(c.req.param("user"));

  const positions = await db
    .select()
    .from(schema.ammPosition)
    .where(
      and(
        eq(schema.ammPosition.chainId, chainId),
        eq(schema.ammPosition.user, user)
      )
    )
    .orderBy(desc(schema.ammPosition.updatedAt));

  return c.json(serializeBigInts(positions));
});

app.get("/lp-balances/:chainId/:user", async (c) => {
  const chainId = parseChainId(c.req.param("chainId"));
  const user = normalizeUser(c.req.param("user"));

  const balances = await db
    .select()
    .from(schema.lpBalance)
    .where(
      and(
        eq(schema.lpBalance.chainId, chainId),
        eq(schema.lpBalance.user, user)
      )
    )
    .orderBy(desc(schema.lpBalance.updatedAt));

  return c.json(serializeBigInts(balances));
});

app.get("/lock-entries/:chainId/:user", async (c) => {
  const chainId = parseChainId(c.req.param("chainId"));
  const user = normalizeUser(c.req.param("user"));

  const entries = await db
    .select()
    .from(schema.lockEntry)
    .where(
      and(
        eq(schema.lockEntry.chainId, chainId),
        eq(schema.lockEntry.user, user)
      )
    )
    .orderBy(desc(schema.lockEntry.createdAt));

  return c.json(serializeBigInts(entries));
});

app.get("/vault-balance/:chainId/:user", async (c) => {
  parseChainId(c.req.param("chainId"));
  normalizeUser(c.req.param("user"));

  return c.json(null);
});

app.get("/vault-positions/:chainId/:user", async (c) => {
  parseChainId(c.req.param("chainId"));
  normalizeUser(c.req.param("user"));

  return c.json([]);
});

app.get("/portfolio/:chainId/:user", async (c) => {
  const chainId = parseChainId(c.req.param("chainId"));
  const user = normalizeUser(c.req.param("user"));

  const [ammPositions, lpBalances, lockEntries] = await Promise.all([
    db
      .select()
      .from(schema.ammPosition)
      .where(
        and(
          eq(schema.ammPosition.chainId, chainId),
          eq(schema.ammPosition.user, user)
        )
      )
      .orderBy(desc(schema.ammPosition.updatedAt)),
    db
      .select()
      .from(schema.lpBalance)
      .where(
        and(
          eq(schema.lpBalance.chainId, chainId),
          eq(schema.lpBalance.user, user)
        )
      )
      .orderBy(desc(schema.lpBalance.updatedAt)),
    db
      .select()
      .from(schema.lockEntry)
      .where(
        and(
          eq(schema.lockEntry.chainId, chainId),
          eq(schema.lockEntry.user, user)
        )
      )
      .orderBy(desc(schema.lockEntry.createdAt)),
  ]);

  return c.json(
    serializeBigInts({
      vaultBalance: null,
      vaultPositions: [],
      ammPositions,
      lpBalances,
      lockEntries,
    })
  );
});

app.get("/api-health", (c) => {
  return c.json({ status: "ok" });
});

export default app;
