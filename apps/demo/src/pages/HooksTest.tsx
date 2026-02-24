import { useEffect } from 'react';
import { useTruthMarket, useLaunchpadMarket, useAmmMarket, useCollateralizer, useCreatorPosition } from '../hooks';
import { useChainStore } from '../store/useChainStore';
import { useRef } from 'react';

const MARKET_1 = '0x50929360c5bc0027fc9e229bfdf5e76a4f730718'; // BTC $150k (Base Sepolia V12)
const MARKET_2 = '0xc19a08e929b31d0ffb7e3094f6abd1fef706db27'; // ETH flip BTC (Base Sepolia V12)

export function HooksTest() {
    const { selectedChainId } = useChainStore();
    // Test all hooks with Market 1
    const { market, isLoading: marketLoading } = useTruthMarket(MARKET_1);
    const { launchpad, isLoading: launchpadLoading } = useLaunchpadMarket(MARKET_1);
    const { amm, isLoading: ammLoading } = useAmmMarket(MARKET_1);
    const { collateralizer, isLoading: collateralizerLoading } = useCollateralizer(MARKET_1);
    const { position, isLoading: positionLoading } = useCreatorPosition(MARKET_1);

    return (
        <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
            <h1>Hooks Test - Market 1</h1>
            <p>
                Loading:{" "}
                {marketLoading || launchpadLoading || ammLoading || collateralizerLoading || positionLoading
                    ? "YES"
                    : "NO"}
            </p>

            {/* TruthMarket Data */}
            <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
                <h2>1. TruthMarket (useTruthMarket)</h2>
                {marketLoading ? (
                    <p>Loading...</p>
                ) : market ? (
                    <pre>{JSON.stringify(market, null, 2)}</pre>
                ) : (
                    <p style={{ color: 'red' }}>❌ Failed to load TruthMarket data</p>
                )}
            </section>

            {/* LaunchpadEngine Data */}
            <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
                <h2>2. LaunchpadEngine (useLaunchpadMarket)</h2>
                {launchpadLoading ? (
                    <p>Loading...</p>
                ) : launchpad ? (
                    <pre>{JSON.stringify(launchpad, null, 2)}</pre>
                ) : (
                    <p style={{ color: 'red' }}>❌ Failed to load LaunchpadEngine data</p>
                )}
            </section>

            {/* AMMEngine Data */}
            <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
                <h2>3. AMMEngine (useAmmMarket)</h2>
                {ammLoading ? (
                    <p>Loading...</p>
                ) : amm ? (
                    <pre>{JSON.stringify(amm, null, 2)}</pre>
                ) : (
                    <p style={{ color: 'red' }}>❌ Failed to load AMMEngine data</p>
                )}
            </section>

            {/* Collateralizer Data */}
            <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
                <h2>4. Collateralizer (useCollateralizer)</h2>
                {collateralizerLoading ? (
                    <p>Loading...</p>
                ) : collateralizer ? (
                    <pre>{JSON.stringify(collateralizer, null, 2)}</pre>
                ) : (
                    <p style={{ color: 'red' }}>❌ Failed to load Collateralizer data</p>
                )}
            </section>

            {/* Creator Position Data */}
            <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
                <h2>5. Creator Position (useCreatorPosition)</h2>
                {positionLoading ? (
                    <p>Loading...</p>
                ) : position ? (
                    <pre>{JSON.stringify(position, null, 2)}</pre>
                ) : (
                    <p style={{ color: 'red' }}>❌ Failed to load Creator Position data</p>
                )}
            </section>

            {/* Summary */}
            <section style={{ marginTop: '2rem', padding: '1rem', background: '#f0f0f0' }}>
                <h2>Summary</h2>
                <ul>
                    <li>✅ TruthMarket: {market ? 'Working' : '❌ Failed'}</li>
                    <li>✅ LaunchpadEngine: {launchpad ? 'Working' : '❌ Failed'}</li>
                    <li>✅ AMMEngine: {amm ? 'Working' : '❌ Failed'}</li>
                    <li>✅ Collateralizer: {collateralizer ? 'Working' : '❌ Failed'}</li>
                    <li>✅ Creator Position: {position ? 'Working' : '❌ Failed'}</li>
                </ul>
            </section>
        </div>
    );
}
