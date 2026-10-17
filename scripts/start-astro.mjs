import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.env.LOCAL_EDITOR = '1';
const astro = fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url));
const child = spawn(process.execPath, [astro, 'dev', '--host', '127.0.0.1', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (error) => {
  console.error(`Unable to start Astro dev server: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : code ?? 1;
});
