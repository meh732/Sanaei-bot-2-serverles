// Polyfill for process for libraries that expect it (like axios or uuid)
const g = globalThis as any;
if (typeof g.process === 'undefined') {
  g.process = {
    env: {},
    versions: { node: '22.0.0' },
    nextTick: (cb: Function) => setTimeout(cb, 0),
    cwd: () => '/',
  };
}
export {};
