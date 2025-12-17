import { useReadContracts } from 'wagmi';
import { PROTOCOL_CONFIG_ABI, LAUNCHPAD_FACTORY_ABI } from '../../config/abis';
import { useDeployments } from '../useDeployments';
import { useMemo } from 'react';

/**
 * V6: Hook for accessing ProtocolConfig (guardian, liquidation fees)
 * @param factoryAddress Optional factory address, defaults to deployment config
 */
export function useProtocolConfig(factoryAddress?: `0x${string}`) {
    const { config } = useDeployments();
    const defaultFactoryAddress = config?.contracts?.LaunchpadFactory as `0x${string}` | undefined;
    const resolvedFactoryAddress = factoryAddress || defaultFactoryAddress;

    // First, get ProtocolConfig address from Factory
    const { data: protocolConfigAddress } = useReadContracts({
        contracts: resolvedFactoryAddress ? [
            { address: resolvedFactoryAddress, abi: LAUNCHPAD_FACTORY_ABI, functionName: 'protocolConfig' }
        ] : [],
        query: {
            enabled: !!resolvedFactoryAddress,
        }
    });

    const configAddress = protocolConfigAddress?.[0]?.result as `0x${string}` | undefined;

    // Then read ProtocolConfig data
    const { data: configData, refetch } = useReadContracts({
        contracts: configAddress ? [
            { address: configAddress, abi: PROTOCOL_CONFIG_ABI, functionName: 'guardian' },
            { address: configAddress, abi: PROTOCOL_CONFIG_ABI, functionName: 'liquidationFeeBps' },
        ] : [],
        query: {
            enabled: !!configAddress,
        }
    });

    const [guardian, liquidationFeeBps] = configData?.map(r => r.result) || [];

    const isGuardian = useMemo(() => {
        return (address: `0x${string}` | undefined): boolean => {
            if (!address || !guardian) return false;
            return address.toLowerCase() === (guardian as `0x${string}`).toLowerCase();
        };
    }, [guardian]);

    return {
        protocolConfigAddress: configAddress,
        guardian: guardian as `0x${string}` | undefined,
        liquidationFeeBps: liquidationFeeBps as bigint | undefined,
        isGuardian,
        isLoading: !configAddress || !configData,
        refetch
    };
}
