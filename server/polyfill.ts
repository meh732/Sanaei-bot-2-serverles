import * as nodeProcess from 'node:process';
const process = (nodeProcess as any).default || nodeProcess;
(globalThis as any).process = process;
export {};
