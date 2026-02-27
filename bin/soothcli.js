#!/usr/bin/env bun

/**
 * soothcli — Sooth Protocol CLI
 *
 * Thin wrapper that launches the interactive REPL.
 * All logic lives in src/cli/interactive.ts.
 *
 * Usage:
 *   soothcli <nodeId>              Connect to node and enter REPL
 *   soothcli <nodeId> --rpc=<url>  Connect with custom RPC
 *   soothcli --list                List available nodes
 */

import '../src/cli/interactive.ts';
