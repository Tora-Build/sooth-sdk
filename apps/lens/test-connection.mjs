/**
 * Quick test: Connect to Lens V3 API via the canary SDK
 * Run: node apps/lens/test-connection.mjs
 */

import { PublicClient, testnet, mainnet } from "@lens-protocol/client";
import { fetchAccount, fetchPosts } from "@lens-protocol/client/actions";

async function main() {
  console.log("--- Lens V3 SDK Connection Test ---\n");

  // 1. Create testnet client
  const testnetClient = PublicClient.create({
    environment: testnet,
    origin: "https://sooth.market",
  });
  console.log("[OK] Testnet PublicClient created");

  // 2. Create mainnet client
  const mainnetClient = PublicClient.create({
    environment: mainnet,
    origin: "https://sooth.market",
  });
  console.log("[OK] Mainnet PublicClient created");

  // 3. Fetch account from mainnet (stani)
  console.log("\n--- Mainnet: Fetch account (lens/stani) ---");
  const account = await fetchAccount(mainnetClient, {
    username: { localName: "stani" },
  });
  if (account.isOk()) {
    const a = account.value;
    console.log(`  Address: ${a.address}`);
    console.log(`  Username: ${a.username?.value}`);
    console.log(`  Name: ${a.metadata?.name}`);
    console.log(`  Bio: ${a.metadata?.bio}`);
  } else {
    console.log(`  Error: ${account.error}`);
  }

  // 4. Fetch recent posts from testnet
  console.log("\n--- Testnet: Fetch recent posts ---");
  const posts = await fetchPosts(testnetClient, {
    pageSize: "TEN",
  });
  if (posts.isOk()) {
    const items = posts.value.items;
    console.log(`  Found ${items.length} posts`);
    for (const item of items.slice(0, 3)) {
      if (item.__typename === "Post") {
        const content =
          item.metadata?.__typename === "TextOnlyMetadata"
            ? item.metadata.content?.slice(0, 80)
            : item.metadata?.__typename === "ArticleMetadata"
              ? item.metadata.title
              : `[${item.metadata?.__typename}]`;
        console.log(`  - ${item.author.username?.value || item.author.address}: ${content}`);
      }
    }
  } else {
    console.log(`  Error: ${posts.error}`);
  }

  // 5. Test fetching posts with tag filter (prediction-market)
  console.log("\n--- Testnet: Search for prediction-market tagged posts ---");
  const marketPosts = await fetchPosts(testnetClient, {
    filter: {
      metadata: {
        tags: { oneOf: ["prediction-market"] },
      },
    },
  });
  if (marketPosts.isOk()) {
    console.log(`  Found ${marketPosts.value.items.length} prediction-market posts`);
  } else {
    console.log(`  Error: ${marketPosts.error}`);
  }

  console.log("\n--- Done ---");
}

main().catch(console.error);
