import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { api } from './server/api.js';
import { db } from './server/db.js';
import { initBot } from './server/bot.js';

const app = new Hono();

app.route('/api', api);

// Serve static files from dist
app.use('/*', serveStatic({ root: './dist' }));

const PORT = 3000;

serve({
  fetch: app.fetch,
  port: PORT
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
  initBot();
});
