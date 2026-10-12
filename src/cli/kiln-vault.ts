import { homedir } from 'node:os';
import { runVault } from '../vault/run.js';

const where = { cwd: process.cwd(), env: process.env, home: homedir(), platform: process.platform };
const { output, exitCode } = runVault(process.argv.slice(2), where);
process.stdout.write(output + '\n');
process.exitCode = exitCode;
