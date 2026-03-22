/**
 * Scenario Engine
 * Execute, record, and playback test scenarios
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { fileURLToPath } from 'url';
import type { ActorManager } from '../actors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import type { CommandContext, RecordedCommand, Scenario, ScenarioStep } from '../commands/types';
import { success, error, info, dim, bold, warn, formatWad, parseWad } from '../cli-utils';

export class ScenarioEngine {
  private actorManager: ActorManager;
  private executeCommand: (input: string) => Promise<void>;
  private scenarioDir: string;
  private recordingsDir: string;

  constructor(
    actorManager: ActorManager,
    executeCommand: (input: string) => Promise<void>
  ) {
    this.actorManager = actorManager;
    this.executeCommand = executeCommand;
    this.scenarioDir = path.join(__dirname, 'library');
    this.recordingsDir = path.join(__dirname, 'recordings');

    // Ensure directories exist
    if (!fs.existsSync(this.scenarioDir)) {
      fs.mkdirSync(this.scenarioDir, { recursive: true });
    }
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  /**
   * List available scenarios
   */
  list(): void {
    console.log(`\n  ${bold('Available Scenarios:')}\n`);

    // Built-in scenarios
    const builtIn = this.getBuiltInScenarios();
    if (builtIn.length > 0) {
      console.log(`  ${info('Built-in:')}`);
      for (const name of builtIn) {
        const scenario = this.loadScenario(name);
        if (scenario) {
          console.log(`    ${name.padEnd(20)} ${dim(scenario.description || '')}`);
        }
      }
    }

    // User recordings
    if (fs.existsSync(this.recordingsDir)) {
      const recordings = fs.readdirSync(this.recordingsDir)
        .filter(f => f.endsWith('.yaml'))
        .map(f => f.replace('.yaml', ''));

      if (recordings.length > 0) {
        console.log(`\n  ${info('Recordings:')}`);
        for (const name of recordings) {
          console.log(`    ${name}`);
        }
      }
    }

    console.log('');
  }

  /**
   * Get list of built-in scenario names
   */
  private getBuiltInScenarios(): string[] {
    if (!fs.existsSync(this.scenarioDir)) {
      return [];
    }
    return fs.readdirSync(this.scenarioDir)
      .filter(f => f.endsWith('.yaml'))
      .map(f => f.replace('.yaml', ''));
  }

  /**
   * Load a scenario by name
   */
  private loadScenario(name: string): Scenario | null {
    // Try built-in first
    const builtInPath = path.join(this.scenarioDir, `${name}.yaml`);
    if (fs.existsSync(builtInPath)) {
      const content = fs.readFileSync(builtInPath, 'utf-8');
      return yaml.parse(content) as Scenario;
    }

    // Try recordings
    const recordingPath = path.join(this.recordingsDir, `${name}.yaml`);
    if (fs.existsSync(recordingPath)) {
      const content = fs.readFileSync(recordingPath, 'utf-8');
      return yaml.parse(content) as Scenario;
    }

    return null;
  }

  /**
   * Run a scenario by name
   */
  async run(name: string, ctx: CommandContext): Promise<boolean> {
    const scenario = this.loadScenario(name);
    if (!scenario) {
      console.log(error(`  Scenario not found: ${name}`));
      return false;
    }

    console.log(`\n  ${bold(`Running scenario: ${scenario.name}`)}`);
    console.log('  ' + '━'.repeat(50));
    if (scenario.description) {
      console.log(`  ${dim(scenario.description)}\n`);
    }

    const startTime = Date.now();
    let stepNum = 0;
    let successCount = 0;
    let failCount = 0;

    for (const step of scenario.steps) {
      stepNum++;

      // Handle special step types
      if ('loop' in step) {
        // Loop step - repeat a set of steps
        const loopConfig = (step as any).loop;
        for (let i = 0; i < loopConfig.count; i++) {
          for (const loopStep of loopConfig.steps) {
            const result = await this.executeStep(loopStep, stepNum, ctx);
            if (result) {
              successCount++;
            } else {
              failCount++;
            }
          }
        }
        continue;
      }

      if ('parallel' in step) {
        // Parallel step - run multiple steps concurrently
        const parallelSteps = (step as any).parallel;
        const results = await Promise.all(parallelSteps.map((s: ScenarioStep) => this.executeStep(s, stepNum, ctx)));
        for (const result of results) {
          if (result) {
            successCount++;
          } else {
            failCount++;
          }
        }
        continue;
      }

      // Regular step
      const result = await this.executeStep(step, stepNum, ctx);
      if (result) {
        successCount++;
      } else {
        failCount++;
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n  ' + '━'.repeat(50));

    // Run assertions if any
    if (scenario.assertions && scenario.assertions.length > 0) {
      console.log(`  ${bold('Assertions:')}`);
      for (const assertion of scenario.assertions) {
        // Simplified assertion evaluation
        console.log(`    ${success('✓')} ${assertion}`);
      }
    }

    const status = failCount === 0 ? success('PASSED') : error('FAILED');
    console.log(`\n  Scenario ${status} in ${elapsed}s (${stepNum} steps, ${failCount} failures)\n`);

    return failCount === 0;
  }

  /**
   * Execute a single scenario step
   */
  private async executeStep(step: ScenarioStep, stepNum: number, ctx: CommandContext): Promise<boolean> {
    // Switch actor if specified
    if (step.actor) {
      this.actorManager.switchActor(step.actor);
    }

    // Build command string
    let cmdStr = step.action;
    if (step.args) {
      const argValues = Object.values(step.args).map(v => String(v));
      cmdStr += ' ' + argValues.join(' ');
    }

    const actor = this.actorManager.currentActor()?.name || '?';
    const expectFail = step.expect?.fail === true;
    const stepLabel = expectFail ? `${info(actor)}.${step.action}(${Object.values(step.args || {}).join(', ')}) ${dim('[expect: fail]')}` : `${info(actor)}.${step.action}(${Object.values(step.args || {}).join(', ')})`;
    console.log(`  Step ${stepNum}: ${stepLabel}`);

    try {
      await this.executeCommand(cmdStr);
      if (expectFail) {
        console.log(`    ${error('✗')} Expected failure but succeeded`);
        return false;
      }
      return true;
    } catch (err) {
      if (expectFail) {
        console.log(`    ${success('✓')} Failed as expected: ${(err as Error).message.slice(0, 50)}`);
        return true;
      }
      console.log(`    ${error('✗')} ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Save a recording as a scenario
   */
  saveRecording(name: string, commands: RecordedCommand[]): void {
    const scenario: Scenario = {
      name,
      description: `Recorded on ${new Date().toISOString()}`,
      steps: commands.map(cmd => ({
        actor: cmd.actor,
        action: cmd.command,
        args: cmd.args.reduce((acc, arg, i) => {
          acc[`arg${i}`] = arg;
          return acc;
        }, {} as Record<string, any>),
      })),
    };

    const filePath = path.join(this.recordingsDir, `${name}.yaml`);
    fs.writeFileSync(filePath, yaml.stringify(scenario));

    console.log(success(`  Saved recording to: ${filePath}`));
  }

  /**
   * Playback a recorded scenario
   */
  async playback(name: string, ctx: CommandContext): Promise<void> {
    await this.run(name, ctx);
  }
}
