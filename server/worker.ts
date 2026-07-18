import { Hono } from 'hono';
import { db } from './db.js';
import { api } from './api.js';
import { initBot } from './bot.js';

const app = new Hono();

app.use('*', async (c, next) => {
  if (c.env.DB_KV) {
    await db.initFromKV(c.env.DB_KV);
  }
  
  await next();
  
  if (c.env.DB_KV) {
    await db.flushToKV(c.env.DB_KV);
  }
});

app.get('/', (c) => c.text('Bot is running on Cloudflare Workers!'));

app.route('/api', api);

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    // Inject env to Hono
    return app.fetch(request, env, ctx);
  }
};

// Add scheduled event handler for Cloudflare Workers
export const scheduled = async (event: any, env: any, ctx: ExecutionContext) => {
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
