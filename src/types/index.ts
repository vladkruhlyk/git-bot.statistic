export type TokenStatus = "valid" | "invalid";

export interface User {
  id: number;
  telegramId: number;
  createdAt: string;
}

export interface Connection {
  userId: number;
  encryptedToken: string;
  tokenStatus: TokenStatus;
  updatedAt: string;
}

export interface AdAccount {
  id: number;
  userId: number;
  accountId: string;
  accountName: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export type PeriodType = "today" | "yesterday" | "last_7_days" | "last_30_days" | "custom";

export interface SelectedPeriod {
  type: PeriodType;
  since: string;
  until: string;
}

export interface UserState {
  userId: number;
  selectedAccountId: string | null;
  selectedPeriod: SelectedPeriod | null;
  updatedAt: string;
}

export interface MetaAdAccount {
  id: string;
  account_id?: string;
  name?: string;
  currency?: string;
}

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaInsightsRow {
  spend?: string;
  reach?: string;
  impressions?: string;
  frequency?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
}

export interface StatsMetrics {
  spend: number;
  reach: number;
  impressions: number;
  frequency: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  costPerLead: number | null;
  purchases: number;
  costPerPurchase: number | null;
  roas: number | null;
  purchaseValue: number;
}
