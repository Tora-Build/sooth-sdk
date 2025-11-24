"use client";

import { useEffect, useState } from "react";
import { BrowserProvider, Contract } from "ethers";

const SOOTH_MARKET_ADDRESS = process.env.NEXT_PUBLIC_SOOTH_MARKET_ADDRESS || "";

const soothMarketAbi = [
  "function price(uint8 outcomeIndex) view returns (uint256)",
];

export default function Home() {
  const [account, setAccount] = useState<string>("");
  const [price0, setPrice0] = useState<string>("");

  async function connect() {
    if (!(window as any).ethereum) return;
    const provider = new BrowserProvider((window as any).ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    setAccount(accounts[0]);
    const market = new Contract(SOOTH_MARKET_ADDRESS, soothMarketAbi, provider);
    const p0 = await market.price(0);
    setPrice0((Number(p0) / 1e18).toFixed(4));
  }

  return (
    <main style={{ padding: 32, color: "white", backgroundColor: "#050509", minHeight: "100vh" }}>
      <h1>Sooth Protocol</h1>
      <p>Upgradeable skeleton with vault, markets, adjudicators, and settlement.</p>
      <p style={{ marginTop: 16 }}>
        <button
          onClick={connect}
          style={{
            padding: "8px 16px",
            borderRadius: 12,
            border: "1px solid #444",
            backgroundColor: "#0f172a",
            color: "white",
            cursor: "pointer",
          }}
        >
          {account ? "Refresh Price" : "Connect Wallet & Load Price"}
        </button>
      </p>
      {account && (
        <p style={{ marginTop: 12, fontSize: 14 }}>
          Connected: {account}
        </p>
      )}
      {price0 && (
        <p style={{ marginTop: 12 }}>
          Outcome 0 Price: <strong>{price0}</strong>
        </p>
      )}
      <p style={{ marginTop: 24, fontSize: 12, opacity: 0.7 }}>
        Note: LMSR math is simplified. Replace with a real fixed-point LMSR (see contracts/math/SoothLMSRReal.sol) before mainnet.
      </p>
    </main>
  );
}
