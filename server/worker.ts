import './polyfill.js';
import * as nodeProcess from 'node:process';
const process = (nodeProcess as any).default || nodeProcess;
(globalThis as any).process = process;
import { Hono } from 'hono';
import { db } from './db.js';
import { api } from './api.js';
import { initBot } from './bot.js';

const app = new Hono<{ Bindings: { DB_KV: any } }>();

app.use('*', async (c, next) => {
  const env = c.env as any;
  if (env && env.DB_KV) {
    await db.initFromKV(env.DB_KV);
  }
  
  await next();
  
  if (env && env.DB_KV) {
    await db.flushToKV(env.DB_KV);
  }
});

app.get('/', (c) => c.text('Bot is running on Cloudflare Workers!'));

app.route('/api', api);

export default {
  async fetch(request: Request, env: any, ctx: any) {
    if (typeof globalThis !== 'undefined' && env) {
      (globalThis as any).cfEnv = env;
      if ((globalThis as any).process && (globalThis as any).process.env) {
        Object.assign((globalThis as any).process.env, env);
      }
    }
    // Inject env to Hono
    return app.fetch(request, env, ctx);
  }
};

// Add scheduled event handler for Cloudflare Workers
export const scheduled = async (event: any, env: any, ctx: any) => {
  if (typeof globalThis !== 'undefined' && env) {
    (globalThis as any).cfEnv = env;
    if ((globalThis as any).process && (globalThis as any).process.env) {
      Object.assign((globalThis as any).process.env, env);
    }
  }
  if (env.DB_KV) {
    await db.initFromKV(env.DB_KV);
  }
  
  // Need to import runAutoBackup and runLimitCheck from bot.ts
  const botModule = await import('./bot.js');
  
  if (botModule.runAutoBackup) {
    await botModule.runAutoBackup();
  }
  
  if (botModule.runLimitCheck) {
    await botModule.runLimitCheck();
  }
  
  if (env.DB_KV) {
    await db.flushToKV(env.DB_KV);
  }
};
