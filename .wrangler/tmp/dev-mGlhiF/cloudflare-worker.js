var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-unapkJ/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// cloudflare-worker.ts
var cloudflare_worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/setup") {
      const webhookUrl = `https://${url.hostname}/webhook`;
      const tgRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
      const tgData = await tgRes.json();
      return Response.json({ success: true, webhookUrl, telegramResponse: tgData });
    }
    if (request.method === "POST" && url.pathname === "/webhook") {
      try {
        const update = await request.json();
        ctx.waitUntil(handleTelegramUpdate(update, env));
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("Webhook Error:", error);
        return new Response("Error", { status: 500 });
      }
    }
    if (url.pathname === "/") {
      return new Response("Sanaei Serverless Bot is Running on Cloudflare Workers! \u{1F680}", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
};
async function handleTelegramUpdate(update, env) {
  if (!update.message || !update.message.text) return;
  const chatId = update.message.chat.id;
  const text = update.message.text;
  let state = await env.SANAIE_DB.get("bot_state", "json");
  if (!state) {
    state = { users: {}, servers: [] };
  }
  if (text === "/start") {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, "\u0633\u0644\u0627\u0645! \u0628\u0647 \u0631\u0628\u0627\u062A \u0633\u0631\u0648\u0631\u0644\u0633 \u0645\u062F\u06CC\u0631\u06CC\u062A \u067E\u0646\u0644 \u0633\u0646\u0627\u06CC\u06CC \u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F. \u{1F680}\n\u0627\u06CC\u0646 \u0631\u0628\u0627\u062A \u0631\u0648\u06CC Cloudflare Workers \u0628\u062F\u0648\u0646 \u0646\u06CC\u0627\u0632 \u0628\u0647 VPS \u062F\u0631 \u062D\u0627\u0644 \u0627\u062C\u0631\u0627\u0633\u062A.");
    if (!state.users[chatId]) {
      state.users[chatId] = { joinedAt: Date.now(), balance: 0 };
      await env.SANAIE_DB.put("bot_state", JSON.stringify(state));
    }
  }
  if (text === "/status") {
    if (state.servers && state.servers.length > 0) {
      const server = state.servers[0];
      try {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, "\u062F\u0631 \u062D\u0627\u0644 \u0628\u0631\u0631\u0633\u06CC \u0648\u0636\u0639\u06CC\u062A \u0633\u0631\u0648\u0631 \u0627\u0632 \u0637\u0631\u06CC\u0642 X-UI...");
        const xuiData = await checkXUIStatus(server);
        await sendTelegramMessage(env.BOT_TOKEN, chatId, `\u0648\u0636\u0639\u06CC\u062A \u0633\u0631\u0648\u0631: ${JSON.stringify(xuiData)}`);
      } catch (e) {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, `\u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u067E\u0646\u0644 X-UI: ${e.message}`);
      }
    } else {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, "\u0647\u06CC\u0686 \u0633\u0631\u0648\u0631\u06CC \u062F\u0631 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 KV \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.");
    }
  }
}
__name(handleTelegramUpdate, "handleTelegramUpdate");
async function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    })
  });
}
__name(sendTelegramMessage, "sendTelegramMessage");
async function checkXUIStatus(server) {
  const loginRes = await fetch(`${server.url}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: server.username, password: server.password })
  });
  const setCookie = loginRes.headers.get("set-cookie");
  if (!loginRes.ok || !setCookie) {
    throw new Error("Login failed");
  }
  const statusRes = await fetch(`${server.url}/panel/api/inbounds/list`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Cookie": setCookie
      // ارسال کوکی سشن
    }
  });
  if (!statusRes.ok) {
    throw new Error("Failed to fetch inbounds");
  }
  return await statusRes.json();
}
__name(checkXUIStatus, "checkXUIStatus");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-unapkJ/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = cloudflare_worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-unapkJ/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=cloudflare-worker.js.map
