#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { startMcpServer } from './mcp/server.js';

const USAGE = 'Usage: kiln mcp    Start the MCP stdio server\n';

function usage(): void {
  process.stderr.write(USAGE);
  process.exitCode = 2;
}

async function main(argv: string[]): Promise<void> {
  let positionals: string[];
  try {
    ({ positionals } = parseArgs({ args: argv, allowPositionals: true, options: {} }));
  } catch {
    return usage();
  }
  const [command, ...rest] = positionals;
  if (command === 'mcp' && rest.length === 0) {
    await startMcpServer({ cwd: process.env.CLAUDE_PROJECT_DIR ?? process.cwd() });
    return;
  }
  usage();
}

await main(process.argv.slice(2));
