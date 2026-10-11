import { runCheck } from '../check/run.js';

const { output, exitCode } = runCheck(process.argv.slice(2));
process.stdout.write(output + '\n');
process.exitCode = exitCode;
