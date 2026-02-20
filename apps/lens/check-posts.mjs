/**
 * Check all posts from lens/soothalpha on Lens mainnet.
 * Run: node apps/lens/check-posts.mjs
 */

import { PublicClient, mainnet, evmAddress } from "@lens-protocol/client";
import { fetchAccount, fetchPosts } from "@lens-protocol/client/actions";

const SOOTHALPHA_ADDRESS = "0xD663aAdBBe8C669797aE5171aAe25116f50a5be9";

async function main() {
  const client = PublicClient.create({
    environment: mainnet,
    origin: "https://sooth.market",
  });

  // ── 1. Fetch account info ──
  console.log("=== ACCOUNT INFO ===\n");

  const acctByUsername = await fetchAccount(client, {
    username: { localName: "soothalpha" },
  });

  if (acctByUsername.isOk() && acctByUsername.value) {
    console.log("Account (by username):");
    console.log(JSON.stringify(acctByUsername.value, null, 2));
  } else {
    console.log("Account by username lookup failed or not found:", acctByUsername.isErr() ? acctByUsername.error : "null");
  }

  const acctByAddr = await fetchAccount(client, {
    address: evmAddress(SOOTHALPHA_ADDRESS),
  });

  if (acctByAddr.isOk() && acctByAddr.value) {
    console.log("\nAccount (by address):");
    console.log(JSON.stringify(acctByAddr.value, null, 2));
  } else {
    console.log("\nAccount by address lookup failed or not found:", acctByAddr.isErr() ? acctByAddr.error : "null");
  }

  // ── 2. Fetch posts by author ──
  console.log("\n\n=== POSTS BY SOOTHALPHA ===\n");

  let cursor = undefined;
  let totalPosts = 0;

  while (true) {
    const postsResult = await fetchPosts(client, {
      filter: {
        authors: [evmAddress(SOOTHALPHA_ADDRESS)],
      },
      cursor,
    });

    if (postsResult.isErr()) {
      console.log("Error fetching posts:", JSON.stringify(postsResult.error, null, 2));
      break;
    }

    const page = postsResult.value;
    const items = page.items;

    if (items.length === 0 && totalPosts === 0) {
      console.log("No posts found for this account.");
      break;
    }

    for (const item of items) {
      totalPosts++;
      console.log(`\n--- POST #${totalPosts} ---`);
      console.log(JSON.stringify(item, null, 2));
      console.log(""); // blank line separator

      // Highlight key fields
      if (item.__typename === "Post") {
        console.log(`  [SUMMARY]`);
        console.log(`  ID: ${item.id}`);
        console.log(`  Timestamp: ${item.timestamp}`);
        console.log(`  Author: ${item.author?.username?.value || item.author?.address}`);
        console.log(`  Content type: ${item.metadata?.__typename}`);

        const meta = item.metadata;
        if (meta?.content) {
          console.log(`  Content: ${meta.content.slice(0, 200)}`);
        }
        if (meta?.title) {
          console.log(`  Title: ${meta.title}`);
        }
        if (meta?.tags?.length > 0) {
          console.log(`  Tags: ${JSON.stringify(meta.tags)}`);
        }
        if (meta?.attributes?.length > 0) {
          console.log(`  Attributes: ${JSON.stringify(meta.attributes)}`);
        }

        // Check for actions
        if (item.actions?.length > 0) {
          console.log(`  Actions (${item.actions.length}):`);
          for (const action of item.actions) {
            console.log(`    - ${action.__typename}: ${JSON.stringify(action)}`);
          }
        }

        // Check stats
        if (item.stats) {
          console.log(`  Stats: ${JSON.stringify(item.stats)}`);
        }

        // Check for prediction-related fields
        const fullJson = JSON.stringify(item);
        const predictionTerms = ["prediction", "market", "outcome", "resolver", "oracle", "resolution", "entry", "ORB-PREDICTION", "entries"];
        for (const term of predictionTerms) {
          if (fullJson.toLowerCase().includes(term.toLowerCase())) {
            console.log(`  [MATCH] Contains "${term}" in data`);
          }
        }
      }
    }

    // Pagination
    if (page.pageInfo?.next) {
      cursor = page.pageInfo.next;
      console.log(`\n[Fetching next page...]`);
    } else {
      break;
    }
  }

  console.log(`\n\nTotal posts by soothalpha: ${totalPosts}`);

  // ── 3. Search for ORB-PREDICTION tagged posts ──
  console.log("\n\n=== POSTS TAGGED 'ORB-PREDICTION' ===\n");

  const orbResult = await fetchPosts(client, {
    filter: {
      metadata: {
        tags: { oneOf: ["ORB-PREDICTION"] },
      },
    },
  });

  if (orbResult.isErr()) {
    console.log("Error:", JSON.stringify(orbResult.error, null, 2));
  } else {
    const orbItems = orbResult.value.items;
    console.log(`Found ${orbItems.length} posts tagged 'ORB-PREDICTION'`);
    for (let i = 0; i < orbItems.length; i++) {
      console.log(`\n--- ORB-PREDICTION POST #${i + 1} ---`);
      console.log(JSON.stringify(orbItems[i], null, 2));
    }
  }

  // ── 4. Also try lowercase variant ──
  console.log("\n\n=== POSTS TAGGED 'prediction-market' ===\n");

  const pmResult = await fetchPosts(client, {
    filter: {
      metadata: {
        tags: { oneOf: ["prediction-market"] },
      },
    },
  });

  if (pmResult.isErr()) {
    console.log("Error:", JSON.stringify(pmResult.error, null, 2));
  } else {
    const pmItems = pmResult.value.items;
    console.log(`Found ${pmItems.length} posts tagged 'prediction-market'`);
    for (let i = 0; i < pmItems.length; i++) {
      console.log(`\n--- prediction-market POST #${i + 1} ---`);
      console.log(JSON.stringify(pmItems[i], null, 2));
    }
  }

  // ── 5. Try "prediction" and "sooth" tags too ──
  console.log("\n\n=== POSTS TAGGED 'prediction' ===\n");

  const predResult = await fetchPosts(client, {
    filter: {
      metadata: {
        tags: { oneOf: ["prediction"] },
      },
    },
  });

  if (predResult.isErr()) {
    console.log("Error:", JSON.stringify(predResult.error, null, 2));
  } else {
    const predItems = predResult.value.items;
    console.log(`Found ${predItems.length} posts tagged 'prediction'`);
    for (let i = 0; i < predItems.length; i++) {
      console.log(`\n--- prediction POST #${i + 1} ---`);
      console.log(JSON.stringify(predItems[i], null, 2));
    }
  }

  console.log("\n\n=== POSTS TAGGED 'sooth' ===\n");

  const soothResult = await fetchPosts(client, {
    filter: {
      metadata: {
        tags: { oneOf: ["sooth"] },
      },
    },
  });

  if (soothResult.isErr()) {
    console.log("Error:", JSON.stringify(soothResult.error, null, 2));
  } else {
    const soothItems = soothResult.value.items;
    console.log(`Found ${soothItems.length} posts tagged 'sooth'`);
    for (let i = 0; i < soothItems.length; i++) {
      console.log(`\n--- sooth POST #${i + 1} ---`);
      console.log(JSON.stringify(soothItems[i], null, 2));
    }
  }

  console.log("\n\n=== DONE ===");
}

main().catch(console.error);
