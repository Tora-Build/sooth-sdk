import { PublicClient, mainnet } from "@lens-protocol/client";
import { fetchPosts } from "@lens-protocol/client/actions";

const client = PublicClient.create({ environment: mainnet, origin: "https://sooth.market" });
const result = await fetchPosts(client, {});
if (result.isErr()) { console.log("ERROR"); process.exit(1); }

for (const item of result.value.items) {
  if (item.__typename !== "Post") continue;
  const meta = item.metadata;
  const content = meta?.content ?? "";
  const tags = meta?.tags ?? [];
  if (content.includes("ORB") || content.includes("orb") || tags.some(t => t.includes("ORB") || t.includes("orb"))) {
    console.log("---");
    console.log("Author:", item.author?.username?.value);
    console.log("Content tail:", JSON.stringify(content.slice(-120)));
    console.log("Tags:", JSON.stringify(tags));
  }
}
