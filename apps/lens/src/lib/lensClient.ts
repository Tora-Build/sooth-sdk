/**
 * Lens V3 SDK client singleton for browser use.
 * Uses environment based on VITE_LENS_NETWORK.
 */
import { PublicClient, mainnet, testnet } from "@lens-protocol/client";
import { IS_TESTNET } from "./lensConfig";

let _client: ReturnType<typeof PublicClient.create> | null = null;

export function getLensClient() {
  if (!_client) {
    _client = PublicClient.create({
      environment: IS_TESTNET ? testnet : mainnet,
      origin: "https://sooth.market",
    });
  }
  return _client;
}
