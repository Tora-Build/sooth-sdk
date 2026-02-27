/**
 * Command Types
 * Shared types for all command modules
 */

import type { ActorManager } from '../actors';
import type { Deployment, InteractiveConfig } from '../config';

export interface CommandContext {
  actorManager: ActorManager;
  deployment: Deployment;
  config: InteractiveConfig;
  marketKey: `0x${string}` | null;
  marketAddress: `0x${string}` | null;
  marketName: string | null;
  recording: RecordingState;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  txHash?: string;
  data?: any;
}

export type CommandHandler = (ctx: CommandContext, args: string[]) => Promise<CommandResult>;

export interface RecordingState {
  active: boolean;
  commands: RecordedCommand[];
  startTime: number;
}

export interface RecordedCommand {
  actor: string;
  command: string;
  args: string[];
  timestamp: number;
}

export interface ScenarioStep {
  actor: string;
  action: string;
  args?: Record<string, any>;
  expect?: Record<string, any>;
}

export interface Scenario {
  name: string;
  description: string;
  steps: ScenarioStep[];
  assertions?: string[];
}
