#!/usr/bin/env node

import { CLI } from './core/cli.js';

async function main(): Promise<void> {
  const cli = new CLI();
  await cli.run(process.argv);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});