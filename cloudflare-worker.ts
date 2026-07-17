/**
 * Cloudflare Worker Serverless Bot for X-UI Sanaei
 * این فایل کاملاً بدون نیاز به سرور (VPS) و با استفاده از زیرساخت ابری Cloudflare اجرا می‌شود.
 */

export interface Env {
  // Cloudflare KV Database Binding
  SANAIE_DB: KVNamespace;
  // Environment variables
  BOT_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. مسیر راه‌اندازی Webhook (فقط یکبار در مرورگر باز کنید)
    if (url.pathname === '/setup') {
      const webhookUrl = `https://${url.hostname}/webhook`;
      const tgRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
      const tgData = await tgRes.json();
      return Response.json({ success: true, webhookUrl, telegramResponse: tgData });
    }

    // 2. مسیر دریافت پیام‌ها از تلگرام
    if (request.method === 'POST' && url.pathname === '/webhook') {
      try {
        const update = await request.json();
        
        // با استفاده از waitUntil به کلودفلر می‌گوییم پروسه را در پس‌زمینه ادامه دهد 
        // تا پاسخ به تلگرام سریع ارسال شود و تایم‌اوت نخوریم
        ctx.waitUntil(handleTelegramUpdate(update, env));
        
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error("Webhook Error:", error);
        return new Response('Error', { status: 500 });
      }
    }

    // 3. صفحه اصلی (برای تست وضعیت ربات)
    if (url.pathname === '/') {
      return new Response('Sanaei Serverless Bot is Running on Cloudflare Workers! 🚀', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

/**
 * مدیریت آپدیت‌های تلگرام
 */
async function handleTelegramUpdate(update: any, env: Env) {
  if (!update.message || !update.message.text) return;

  const chatId = update.message.chat.id;
  const text = update.message.text;

  // خواندن اطلاعات دیتابیس از Cloudflare KV
  let state = await env.SANAIE_DB.get('bot_state', 'json') as any;
  if (!state) {
    state = { users: {}, servers: [] }; // دیتابیس اولیه
  }

  // دستور استارت
  if (text === '/start') {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, 'سلام! به ربات سرورلس مدیریت پنل سنایی خوش آمدید. 🚀\nاین ربات روی Cloudflare Workers بدون نیاز به VPS در حال اجراست.');
    
    // ثبت کاربر در دیتابیس KV
    if (!state.users[chatId]) {
      state.users[chatId] = { joinedAt: Date.now(), balance: 0 };
      await env.SANAIE_DB.put('bot_state', JSON.stringify(state));
    }
  }

  // نمونه کامند ارتباط با پنل X-UI
  if (text === '/status') {
    if (state.servers && state.servers.length > 0) {
      const server = state.servers[0];
      try {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, 'در حال بررسی وضعیت سرور از طریق X-UI...');
        const xuiData = await checkXUIStatus(server);
        await sendTelegramMessage(env.BOT_TOKEN, chatId, `وضعیت سرور: ${JSON.stringify(xuiData)}`);
      } catch (e: any) {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, `خطا در ارتباط با پنل X-UI: ${e.message}`);
      }
    } else {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, 'هیچ سروری در دیتابیس KV ثبت نشده است.');
    }
  }
}

/**
 * ارسال پیام به تلگرام با استفاده از Fetch (بدون نیاز به کتابخانه‌های Node.js)
 */
async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    })
  });
}

/**
 * ارتباط با پنل X-UI سنایی با استفاده از Fetch (جایگزین Axios)
 */
async function checkXUIStatus(server: any) {
  // 1. لاگین و دریافت کوکی
  const loginRes = await fetch(`${server.url}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: server.username, password: server.password })
  });

  const setCookie = loginRes.headers.get('set-cookie');
  if (!loginRes.ok || !setCookie) {
    throw new Error('Login failed');
  }

  // 2. درخواست لیست کانکشن‌ها یا وضعیت سرور
  const statusRes = await fetch(`${server.url}/panel/api/inbounds/list`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cookie': setCookie // ارسال کوکی سشن
    }
  });

  if (!statusRes.ok) {
    throw new Error('Failed to fetch inbounds');
  }

  return await statusRes.json();
}
