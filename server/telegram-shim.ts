import { Buffer } from "node:buffer";
export default class TelegramBot {
  token: string;
  handlers: { message: Function[], callback_query: Function[] } = { message: [], callback_query: [] };
  textRegexpCallbacks: { regexp: RegExp, callback: Function }[] = [];

  constructor(token: string, options: any) {
    this.token = token;
  }

  on(event: 'message' | 'callback_query' | 'polling_error' | 'webhook_error' | 'error', listener: Function) {
    if (this.handlers[event]) {
      this.handlers[event].push(listener);
    }
  }

  onText(regexp: RegExp, callback: Function) {
    this.textRegexpCallbacks.push({ regexp, callback });
  }

  processUpdate(update: any) {
    if (update.message) {
      if (update.message.text) {
        let matched = false;
        for (const trc of this.textRegexpCallbacks) {
          const match = trc.regexp.exec(update.message.text);
          if (match) {
            matched = true;
            trc.callback(update.message, match);
          }
        }
      }
      this.handlers.message.forEach(h => h(update.message));
    }
    if (update.callback_query) {
      this.handlers.callback_query.forEach(h => h(update.callback_query));
    }
  }

  async _request(method: string, data: any = {}) {
    const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.ok) {
      console.error(`Telegram API Error (${method}):`, json.description);
      throw new Error(json.description);
    }
    return json.result;
  }

  async sendMessage(chatId: string | number, text: string, options?: any) {
    return this._request('sendMessage', { chat_id: chatId, text, ...options });
  }

  async sendPhoto(chatId: string | number, photo: any, options?: any) {
    // Basic shim: assuming photo is a file_id string or URL.
    return this._request('sendPhoto', { chat_id: chatId, photo, ...options });
  }

  async sendDocument(chatId: string | number, document: any, options?: any, fileOptions?: any) {
    // If document is a Buffer, we need multipart/form-data.
    if (document instanceof Buffer || document?.constructor?.name === 'Buffer' || document instanceof Uint8Array) {
      const formData = new FormData();
      formData.append('chat_id', String(chatId));
      
      // options like caption, parse_mode
      if (options) {
        for (const key of Object.keys(options)) {
          if (options[key] !== undefined) formData.append(key, String(options[key]));
        }
      }

      let filename = 'document.file';
      if (fileOptions && fileOptions.filename) filename = fileOptions.filename;
      
      const blob = new Blob([document], { type: fileOptions?.contentType || 'application/octet-stream' });
      formData.append('document', blob, filename);

      const res = await fetch(`https://api.telegram.org/bot${this.token}/sendDocument`, {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.description);
      return json.result;
    }
    // If it's a string (file_id or url)
    return this._request('sendDocument', { chat_id: chatId, document, ...options });
  }

  async answerCallbackQuery(callbackQueryId: string, options?: any) {
    return this._request('answerCallbackQuery', { callback_query_id: callbackQueryId, ...options });
  }

  async getChatMember(chatId: string | number, userId: string | number) {
    return this._request('getChatMember', { chat_id: chatId, user_id: userId });
  }

  async getFile(fileId: string) {
    return this._request('getFile', { file_id: fileId });
  }

  async getMe() {
    return this._request('getMe');
  }

  async setWebHook(url: string) {
    return this._request('setWebhook', { url });
  }

  async deleteWebHook() {
    return this._request('deleteWebhook');
  }

  async setMyCommands(commands: any[]) {
    return this._request('setMyCommands', { commands });
  }

  async stopPolling() {}
  removeAllListeners() {
    this.handlers = { message: [], callback_query: [] };
    this.textRegexpCallbacks = [];
  }
}
