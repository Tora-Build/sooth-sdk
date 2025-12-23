/**
 * V8 Hooks Test Page
 * 
 * Simple page to test all V8 hooks with deployed contracts
 */

import { useTruthMarket, useLaunchpadMarket, useAmmMarket, useCollateralizer, useCreatorPosition } from '../hooks/v8';

// Test market addresses from deployments
const MARKET_1 = '0x0b7BfdfE0FAB1b48e4435fE713d78376DAC026fC'; // UN Confirms Alien Life
const MARKET_2 = '0x122E6afFd70a66183FeBd279C418186F24d9a4e2'; // BTC TWAP

export function V8HooksTest() {
    // Test all hooks with Market 1
    const { market, isLoading: marketLoading } = useTruthMarket(MARKET_1);
    const { launchpad, isLoading: launchpadLoading } = useLaunchpadMarket(MARKET_1);
    const { amm, isLoading: ammLoading } = useAmmMarket(MARKET_1);
    const { collateralizer, isLoading: collateralizerLoading } = useCollateralizer(MARKET_1);
    const { position, isLoading: positionLoading } = useCreatorPosition(MARKET_1);

    if (marketLoading || launchpadLoading || ammLoading || collateralizerLoading || positionLoading) {
        return (
            <div style={{ padding: '2rem' }}>
                <h1>V8 Hooks Test</h1>
                <p>Loading data from contracts...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
            <h1>V8 Hooks Test - Market 1</h1>

            {/* TruthMarket Data */}
            <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
                <h2>1. TruthMarket (useTruthMarket)</h2>
                {market ? (
                    <pre>{JSON.stringify(market, null, 2)}</pre>
                ) : (
                    <p style={{ color: 'red' }}>❌ Failed to load TruthMarket data</p>
                )}
            </section>

            {/* LaunchpadEngine Data */}
            <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
                <h2>2. LaunchpadEngine (useLaunchpadMarket)</h2>
                {launchpad ? (
                    <pre>{JSON.stringify(launchpad, null, 2)}</pre>
                ) : (
                    <p style={{ color: 'red' }}>❌ Failed to load LaunchpadEngine data</p>
                )}
            </section>

            {/* AMMEngine Data */}
            <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
                <h2>3. AMMEngine (useAmmMarket)</h2>
                {amm ? (
                    <pre>{JSON.stringify(amm, null, 2)}</pre>
                ) : (
                    <p style={{ color: 'red' }}>❌ Failed to load AMMEngine data</p>
                )}
            </section>

            {/* Collateralizer Data */}
            <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
                <h2>4. Collateralizer (useCollateralizer)</h2>
                {collateralizer ? (
                    <pre>{JSON.stringify(collateralizer, null, 2)}</pre>
                ) : (
                    <p style={{ color: 'red' }}>❌ Failed to load Collateralizer data</p>
                )}
            </section>

            {/* Creator Position Data */}
            <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
                <h2>5. Creator Position (useCreatorPosition)</h2>
                {position ? (
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
