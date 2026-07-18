export interface PanelConfig { url?: string; username?: string; password?: string; inboundId?: number | string; inboundIds?: (number | string)[]; apiKey?: string; subUrlBase?: string; }
export interface Category { id: string; name: string; disabled?: boolean; }
export interface Product { id: string; name: string; price: number; volumeGb: number; durationDays: number; categoryId?: string; inboundId?: number | string; inboundIds?: (number | string)[]; limitIp?: number; disabled?: boolean; isPayAsYouGo?: boolean; }
export interface SellerDiscountRule { type: 'global' | 'category' | 'product'; targetId?: string; percent: number; }
export interface Purchase { id: string; name: string; price: number; subUrl: string; volumeGb: number; durationDays: number; createdAt: string; isPayAsYouGo?: boolean; pricePerGb?: number; lastUsedBytes?: number; paygDisabled?: boolean; warnedPayg?: boolean; warnedData?: boolean; warnedTime?: boolean; originalPrice?: number; discountPercent?: number; discountAmount?: number; expiredAt?: number; }
export interface User { chatId: number; username?: string; nickname?: string; balance: number; testUsed: boolean; registeredAt: string; referredBy?: number; referralsMade?: number; isSeller?: boolean; sellerDiscount?: number; sellerDiscounts?: SellerDiscountRule[]; debt?: number; debtVolume?: number; debtLimit?: number; totalSales?: number; purchases?: Purchase[]; }
export interface Coupon { code: string; discountPercent: number; maxUsage?: number; usedCount?: number; expirationDate?: string; maxUsagePerUser?: number; usedBy?: Record<string, number>; }
export interface PendingPayment { id: string; chatId: number; amount: number; fileId?: string; timestamp: number; }
export interface AppState { botToken?: string; panel: PanelConfig; categories?: Category[]; products: Product[]; users: User[]; pendingPayments?: PendingPayment[]; freeTestVolumeGb: number; freeTestDurationDays: number; freeTestEnabled: boolean; freeTestInboundId?: number | string; freeTestInboundIds?: (number | string)[]; forceJoinEnabled?: boolean; forceJoinChannels?: { id: string; name: string; url: string }[]; adminIds: number[]; referralRewardToman: number; cardNumber?: string; cardHolder?: string; supportUsername?: string; coupons: Coupon[]; autoBackupIntervalHours?: number; autoBackupPassword?: string; lastAutoBackupSent?: number; }

const defaultState: AppState = { botToken: '', panel: {}, products: [], users: [], freeTestVolumeGb: 1, freeTestDurationDays: 3, freeTestEnabled: true, adminIds: [], referralRewardToman: 0, cardNumber: '۶۰۳۷۹۹۷۹۱۲۳۴۵۶۷۸', cardHolder: 'نام مدیر حساب', supportUsername: '', coupons: [] };

class Database {
  private state: AppState;
  public onStateChange?: () => void;
  public dirty = false;

  constructor() {
    this.state = { ...defaultState };
  }

  public async initFromKV(kv: any) {
    try {
      const data = await kv.get('db_state');
      if (data) {
        this.state = { ...defaultState, ...JSON.parse(data) };
      }
    } catch (e) {
      console.error('Failed to load db_state from KV', e);
    }
  }

  public async flushToKV(kv: any) {
    if (this.dirty) {
      try {
        await kv.put('db_state', JSON.stringify(this.state));
        this.dirty = false;
      } catch (e) {
        console.error('Failed to flush db_state to KV', e);
      }
    }
  }

  private save() {
    this.dirty = true;
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  public getState() { return this.state; }
  
  public updateState(partial: Partial<AppState>) {
    this.state = { ...this.state, ...partial };
    this.save();
  }

  public saveUser(user: User) {
    const idx = this.state.users.findIndex(u => u.chatId === user.chatId);
    if (idx >= 0) {
      this.state.users[idx] = user;
    } else {
      this.state.users.push(user);
    }
    this.save();
  }

  public getUser(chatId: number): User | undefined {
    return this.state.users.find(u => u.chatId === chatId);
  }

  public getUserByUsername(username: string): User | undefined {
    const cleanUsername = username.replace('@', '').toLowerCase();
    return this.state.users.find(u => u.username?.toLowerCase() === cleanUsername);
  }
}

export const db = new Database();
