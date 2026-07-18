import * as nodeProcess from 'node:process';

const g = globalThis as any;

// Cloudflare Workers with nodejs_compat provide node:process but not a global process
// We create a global process object and merge it with node:process if possible
const p = (nodeProcess as any).default || nodeProcess || {};

g.process = {
  ...p,
  env: p.env || {},
  versions: p.versions || { node: '22.0.0' },
  nextTick: p.nextTick || ((cb: any) => setTimeout(cb, 0)),
  cwd: p.cwd || (() => '/'),
  on: p.on || (() => {}),
  once: p.once || (() => {}),
  emit: p.emit || (() => {}),
};

// Ensure env is writable
if (typeof g.process.env !== 'object') {
  g.process.env = {};
}

export {};
