/**
 * V8 Hooks Test Page
 * 
 * Simple page to test all V8 hooks with deployed contracts
 */

import { useEffect } from 'react';
import { useTruthMarket, useLaunchpadMarket, useAmmMarket, useCollateralizer, useCreatorPosition } from '../hooks/v8';
import { useChainStore } from '../store/useChainStore';
import { useRef } from 'react';

// Test market addresses from deployments
const MARKET_1 = '0x0b7BfdfE0FAB1b48e4435fE713d78376DAC026fC'; // UN Confirms Alien Life
const MARKET_2 = '0x122E6afFd70a66183FeBd279C418186F24d9a4e2'; // BTC TWAP

export function V8HooksTest() {
    const { selectedChainId } = useChainStore();
    // Test all hooks with Market 1
    const { market, isLoading: marketLoading } = useTruthMarket(MARKET_1);
    const { launchpad, isLoading: launchpadLoading } = useLaunchpadMarket(MARKET_1);
    const { amm, isLoading: ammLoading } = useAmmMarket(MARKET_1);
    const { collateralizer, isLoading: collateralizerLoading } = useCollateralizer(MARKET_1);
    const { position, isLoading: positionLoading } = useCreatorPosition(MARKET_1);

    // #region agent log (hypothesis A/C/D)
    useEffect(() => {
        // Emit a summary once the non-TruthMarket hooks have settled so the page isn't blocked
        // by intermittent TruthMarket hangs.
        const coreDone = !launchpadLoading && !ammLoading && !collateralizerLoading && !positionLoading;
        if (!coreDone) return;
        fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',mode:'no-cors',body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C',location:'V8HooksTest.tsx:summary',message:'v8-test summary (core done)',data:{selectedChainId,truthMarketLoading:marketLoading,marketLoaded:!!market,launchpadLoaded:!!launchpad,ammLoaded:!!amm,collateralizerLoaded:!!collateralizer,creatorPositionLoaded:!!position},timestamp:Date.now()})}).catch(()=>{});
    }, [selectedChainId, marketLoading, launchpadLoading, ammLoading, collateralizerLoading, positionLoading, market, launchpad, amm, collateralizer, position]);
    // #endregion

    // #region agent log (hypothesis D)
    const lastLoadingKeyRef = useRef<string | null>(null);
    useEffect(() => {
        const key = JSON.stringify({
            selectedChainId,
            marketLoading,
            launchpadLoading,
            ammLoading,
            collateralizerLoading,
            positionLoading,
            marketOk: !!market,
            launchpadOk: !!launchpad,
            ammOk: !!amm,
            collateralizerOk: !!collateralizer,
            positionOk: !!position,
        });
        if (lastLoadingKeyRef.current === key) return;
        lastLoadingKeyRef.current = key;
        fetch('http://127.0.0.1:7242/ingest/d6bfcae9-9603-4479-b460-97a3c584da0e',{method:'POST',mode:'no-cors',body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'D',location:'V8HooksTest.tsx:loading',message:'loading state changed',data:JSON.parse(key),timestamp:Date.now()})}).catch(()=>{});
    }, [selectedChainId, marketLoading, launchpadLoading, ammLoading, collateralizerLoading, positionLoading, market, launchpad, amm, collateralizer, position]);
    // #endregion

    return (
        <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
            <h1>V8 Hooks Test - Market 1</h1>
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
