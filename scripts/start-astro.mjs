import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.env.LOCAL_EDITOR = '1';
process.env.ASTRO_TELEMETRY_DISABLED ??= '1';
const args=process.argv.slice(2);
const portIndex=args.indexOf('--port');
const port=args.find(value=>value.startsWith('--port='))?.slice(7) || (portIndex>=0?args[portIndex+1]:undefined) || '4321';
process.env.BCB_EDITOR_PORT=port;
console.log(`Editor nach dem Start: http://127.0.0.1:${port}/__editor/`);
const astro = fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url));
const child = spawn(process.execPath, [astro, 'dev', '--host', '127.0.0.1', ...args], {
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
