import { Hono } from 'hono';
import { db } from './db.js';
import { initBot, sendBroadcast, checkPaygReactivation, sendDirectMessage, handleTelegramWebhook } from './bot.js';
import { xui } from './xui.js';
import { encryptData, decryptData } from './crypto.js';
import { v4 as uuidv4 } from "uuid";

// Helpers
function parseInboundId(val: any): string | number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const num = Number(val);
  return isNaN(num) ? String(val).trim() : num;
}
function parseInboundIds(vals: any): (string | number)[] {
  if (!Array.isArray(vals)) return [];
  return vals
    .map(val => {
      if (val === undefined || val === null || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? String(val).trim() : num;
    })
    .filter((val): val is string | number => val !== null && val !== '');
}

const api = new Hono();

api.post("/webhook/telegram", async (c) => {
  const body = await c.req.json();
  handleTelegramWebhook(body);
  return c.text('OK');
});

api.get("/state", (c) => {
  return c.json({ success: true, state: db.getState() });
});

api.post("/update-settings", async (c) => {
  const data = await c.req.json();
  if (data.adminIds && Array.isArray(data.adminIds)) {
    data.adminIds = data.adminIds.map(Number);
  }
  if (data.botToken !== undefined) {
    const isNewToken = data.botToken !== db.getState().botToken;
    db.updateState(data);
    if (isNewToken) initBot();
  } else {
    db.updateState(data);
  }
  return c.json({ success: true, state: db.getState() });
});

api.post("/update-panel", async (c) => {
  const data = await c.req.json();
  if (data.inboundId !== undefined) {
    data.inboundId = parseInboundId(data.inboundId);
  }
  if (data.inboundIds !== undefined) {
    data.inboundIds = parseInboundIds(data.inboundIds);
  }
  db.updateState({ panel: data });
  return c.json({ success: true, state: db.getState() });
});

api.post("/broadcast", async (c) => {
  const { message } = await c.req.json();
  if (!message) return c.json({ success: false, message: 'Message is required' }, 400);
  try {
    const count = await sendBroadcast(message);
    return c.json({ success: true, count });
  } catch (e: any) {
    return c.json({ success: false, message: e.message || 'Error sending broadcast' }, 500);
  }
});

api.get("/xui-inbounds", async (c) => {
  try {
    const inbounds = await xui.getInbounds();
    if (!inbounds) throw new Error('Could not fetch inbounds');
    return c.json({ success: true, inbounds });
  } catch (e: any) {
    return c.json({ success: false, message: e.message || 'Error fetching inbounds' }, 500);
  }
});

api.post("/test-panel-connection", async (c) => {
  try {
    const inbounds = await xui.getInbounds();
    if (inbounds && inbounds.length > 0) {
      return c.json({ success: true, message: 'اتصال به پنل با موفقیت انجام شد.' });
    } else {
      return c.json({ success: false, message: 'اتصال برقرار شد اما هیچ اینباندی یافت نشد.' });
    }
  } catch (e: any) {
    return c.json({ success: false, message: e.message || 'خطا در برقراری اتصال به پنل' }, 500);
  }
});

api.post("/categories", async (c) => {
  const category = await c.req.json();
  if (!category.id) category.id = uuidv4();
  const state = db.getState();
  const existingIndex = (state.categories || []).findIndex((cat: any) => cat.id === category.id);
  const newCategories = [...(state.categories || [])];
  if (existingIndex >= 0) newCategories[existingIndex] = category;
  else newCategories.push(category);
  db.updateState({ categories: newCategories });
  return c.json({ success: true, categories: newCategories });
});

api.delete("/categories/:id", (c) => {
  const state = db.getState();
  const newCategories = (state.categories || []).filter((cat: any) => cat.id !== c.req.param('id'));
  db.updateState({ categories: newCategories });
  return c.json({ success: true });
});

api.post("/products", async (c) => {
  const product = await c.req.json();
  if (!product.id) product.id = uuidv4();
  if (product.inboundId !== undefined) product.inboundId = parseInboundId(product.inboundId);
  if (product.limitIp !== undefined) product.limitIp = parseInt(product.limitIp) || 0;
  if (product.inboundIds !== undefined) product.inboundIds = parseInboundIds(product.inboundIds);
  const state = db.getState();
  const existingIndex = state.products.findIndex((p: any) => p.id === product.id);
  const newProducts = [...state.products];
  if (existingIndex >= 0) newProducts[existingIndex] = product;
  else newProducts.push(product);
  db.updateState({ products: newProducts });
  return c.json({ success: true, products: newProducts });
});

api.delete("/products/:id", (c) => {
  const state = db.getState();
  const newProducts = state.products.filter((p: any) => p.id !== c.req.param('id'));
  db.updateState({ products: newProducts });
  return c.json({ success: true });
});

api.post("/users/:chatId/charge", async (c) => {
  const { amount } = await c.req.json();
  const user = db.getUser(parseInt(c.req.param('chatId')));
  if (!user) return c.json({ success: false, message: 'User not found' }, 404);
  const parsedAmount = parseInt(amount);
  user.balance += parsedAmount;
  db.saveUser(user);
  checkPaygReactivation(user).catch(console.error);
  
  const manualChargeMsg = `🎉 <b>حساب کاربری شما توسط مدیریت مبلغ ${parsedAmount.toLocaleString()} تومان شارژ شد!</b>\n\n` +
    `💰 موجودی جدید حساب شما: <b>${user.balance.toLocaleString()}</b> تومان\n\n` +
    `🛒 <b>هم‌اکنون با زدن دکمه زیر می‌توانید محصول یا سرویس مورد نظر خود را خریداری کنید:</b>`;
  sendDirectMessage(user.chatId, manualChargeMsg, {
    inline_keyboard: [
      [{ text: '🛍 خرید و ثبت سفارش', callback_data: 'buy_service_now' }]
    ]
  }).catch(console.error);
  return c.json({ success: true, balance: user.balance });
});

api.post("/users/:chatId/role", async (c) => {
  const { isSeller } = await c.req.json();
  const user = db.getUser(parseInt(c.req.param('chatId')));
  if (!user) return c.json({ success: false }, 404);
  user.isSeller = isSeller;
  if (isSeller) {
    if (user.debt === undefined) user.debt = 0;
    if (user.debtVolume === undefined) user.debtVolume = 0;
    if (user.debtLimit === undefined) user.debtLimit = 1000000;
    if (user.totalSales === undefined) user.totalSales = 0;
  }
  db.saveUser(user);
  return c.json({ success: true });
});

api.post("/users/:chatId/reset-test", async (c) => {
  const { testUsed } = await c.req.json();
  const user = db.getUser(parseInt(c.req.param('chatId')));
  if (!user) return c.json({ success: false, message: 'User not found' }, 404);
  user.testUsed = !!testUsed;
  db.saveUser(user);
  return c.json({ success: true, testUsed: user.testUsed });
});

api.post("/users/:chatId/seller-limits", async (c) => {
  const { debtLimit, debtVolume, debt, sellerDiscount, sellerDiscounts } = await c.req.json();
  const user = db.getUser(parseInt(c.req.param('chatId')));
  if (!user) return c.json({ success: false, message: 'کاربر پیدا نشد' }, 404);
  if (debtLimit !== undefined) user.debtLimit = Number(debtLimit);
  if (debtVolume !== undefined) user.debtVolume = Number(debtVolume);
  if (debt !== undefined) user.debt = Number(debt);
  if (sellerDiscount !== undefined) user.sellerDiscount = Number(sellerDiscount);
  if (sellerDiscounts !== undefined) user.sellerDiscounts = sellerDiscounts;
  db.saveUser(user);
  return c.json({ success: true, user });
});

api.post("/users/add-seller", async (c) => {
  const { chatId, username, debtLimit } = await c.req.json();
  if (!chatId) return c.json({ success: false, message: 'شناسه عددی کاربری الزاماً باید فرستاده شود.' }, 400);
  const numChatId = parseInt(chatId);
  if (isNaN(numChatId)) return c.json({ success: false, message: 'شناسه عددی وارد شده معتبر نمی‌باشد.' }, 400);
  let user = db.getUser(numChatId);
  if (!user) {
    user = {
      chatId: numChatId,
      username: username || '',
      balance: 0,
      testUsed: false,
      registeredAt: new Date().toISOString(),
      isSeller: true,
      debt: 0,
      debtVolume: 0,
      debtLimit: Number(debtLimit) || 1000000,
      totalSales: 0,
      purchases: []
    };
  } else {
    user.isSeller = true;
    if (user.debt === undefined) user.debt = 0;
    if (user.debtVolume === undefined) user.debtVolume = 0;
    if (debtLimit !== undefined) user.debtLimit = Number(debtLimit);
  }
  db.saveUser(user);
  return c.json({ success: true, users: db.getState().users });
});

api.post("/users/:chatId/settle", (c) => {
  const user = db.getUser(parseInt(c.req.param('chatId')));
  if (!user) return c.json({ success: false }, 404);
  user.debt = 0;
  user.debtVolume = 0;
  db.saveUser(user);
  return c.json({ success: true, debt: user.debt, debtVolume: user.debtVolume });
});

export { api };
