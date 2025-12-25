/**
 * OperatorRoleBadge - Displays the user's role in the market per V8_OPERATOR_CONSOLE_SPEC.md
 * 
 * Shows: Creator, Adjudicator, or Guardian role with appropriate styling
 */
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Key, Scale, Shield, Crown, AlertCircle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useTruthMarketDirect } from '../../../hooks/v8';

interface OperatorRoleBadgeProps {
  address: `0x${string}`;
}

type Role = 'creator' | 'adjudicator' | 'guardian' | 'none';

interface RoleConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  badgeColor: 'default' | 'success' | 'warning' | 'danger';
}

const roleConfigs: Record<Role, RoleConfig> = {
  creator: {
    icon: Crown,
    label: 'Creator',
    description: 'You can initialize and manage this market\'s liquidity.',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400',
    badgeColor: 'default',
  },
  adjudicator: {
    icon: Scale,
    label: 'Adjudicator',
    description: 'You can settle this market\'s outcome when conditions are met.',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
    badgeColor: 'default',
  },
  guardian: {
    icon: Shield,
    label: 'Guardian',
    description: 'You have emergency veto power over this market\'s settlement.',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    badgeColor: 'danger',
  },
  none: {
    icon: AlertCircle,
    label: 'No Role',
    description: 'You are not an operator of this market.',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
    textColor: 'text-slate-400',
    badgeColor: 'default',
  },
};

export const OperatorRoleBadge = ({ address }: OperatorRoleBadgeProps) => {
  const { address: userAddress, isConnected } = useAccount();
  const { truthMarket, isLoading } = useTruthMarketDirect(address);

  // Determine user's role
  const getUserRoles = (): Role[] => {
    if (!isConnected || !userAddress || !truthMarket) return [];
    
    const roles: Role[] = [];
    const lowerUser = userAddress.toLowerCase();
    
    if (truthMarket.creator?.toLowerCase() === lowerUser) {
      roles.push('creator');
    }
    if (truthMarket.adjudicator?.toLowerCase() === lowerUser) {
      roles.push('adjudicator');
    }
    if (truthMarket.guardian?.toLowerCase() === lowerUser) {
      roles.push('guardian');
    }
    
    return roles;
  };

  const roles = getUserRoles();
  const primaryRole = roles[0] ?? 'none';
  const config = roleConfigs[primaryRole];

  if (!isConnected) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <div className="p-4 flex items-center gap-3">
          <Key className="w-6 h-6 text-slate-500" />
          <div>
            <p className="text-slate-400 font-medium">Connect Wallet</p>
            <p className="text-slate-500 text-sm">Connect to view your role</p>
          </div>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <div className="p-4 animate-pulse flex items-center gap-3">
          <div className="w-6 h-6 bg-slate-700 rounded" />
          <div className="flex-1">
            <div className="h-4 bg-slate-700 rounded w-1/3 mb-2" />
            <div className="h-3 bg-slate-700 rounded w-2/3" />
          </div>
        </div>
      </Card>
    );
  }

  if (roles.length === 0) {
    return null; // Don't show if user has no role
  }

  const Icon = config.icon;

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border`}>
      <div className="p-4 space-y-3">
        {/* Primary Role */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <Icon className={`w-5 h-5 ${config.textColor}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">Your Role:</span>
                <Badge variant={config.badgeColor} className={config.textColor}>
                  {config.label}
                </Badge>
              </div>
              <p className="text-slate-400 text-sm mt-0.5">
                {config.description}
              </p>
            </div>
          </div>
        </div>

        {/* Multiple Roles */}
        {roles.length > 1 && (
          <div className="pt-2 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 mb-2">Additional Roles:</p>
            <div className="flex flex-wrap gap-2">
              {roles.slice(1).map((role) => {
                const roleConfig = roleConfigs[role];
                const RoleIcon = roleConfig.icon;
                return (
                  <div 
                    key={role}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${roleConfig.bgColor} ${roleConfig.borderColor} border`}
                  >
                    <RoleIcon className={`w-3 h-3 ${roleConfig.textColor}`} />
                    <span className={`text-xs font-medium ${roleConfig.textColor}`}>
                      {roleConfig.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

