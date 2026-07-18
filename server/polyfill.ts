import processPolyfill from 'node:process';

const g = globalThis as any;
g.process = processPolyfill;

// Ensure env exists and is writable
if (!g.process.env) {
  g.process.env = {};
}

export {};
