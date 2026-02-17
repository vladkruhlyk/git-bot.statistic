import axios, { AxiosError } from "axios";
import type { MetaAdAccount, MetaInsightsRow } from "../types/index.js";

interface MetaGraphError {
  error?: {
    code?: number;
    message?: string;
    error_subcode?: number;
    type?: string;
  };
}

interface AdAccountsResponse {
  data?: MetaAdAccount[];
  paging?: { next?: string };
}

interface InsightsResponse {
  data?: MetaInsightsRow[];
}

export class MetaApiError extends Error {
  statusCode?: number;
  code?: number;

  constructor(message: string, opts?: { statusCode?: number; code?: number }) {
    super(message);
    this.name = "MetaApiError";
    this.statusCode = opts?.statusCode;
    this.code = opts?.code;
  }

  isTokenError(): boolean {
    return this.code === 190 || this.statusCode === 401;
  }
}

export class MetaApiClient {
  private readonly baseUrl: string;

  constructor(apiVersion: string) {
    this.baseUrl = `https://graph.facebook.com/${apiVersion}`;
  }

  async validateTokenAndGetAdAccounts(token: string): Promise<MetaAdAccount[]> {
    return this.fetchAllAdAccounts(token);
  }

  async fetchAllAdAccounts(token: string): Promise<MetaAdAccount[]> {
    const accounts: MetaAdAccount[] = [];
    let nextUrl: string | null = `${this.baseUrl}/me/adaccounts?fields=id,account_id,name,currency&limit=100&access_token=${encodeURIComponent(token)}`;

    while (nextUrl) {
      const payload: AdAccountsResponse = await this.getJson<AdAccountsResponse>(nextUrl, token, false);

      if (payload.data?.length) {
        accounts.push(...payload.data);
      }

      nextUrl = payload.paging?.next ?? null;
    }

    return accounts;
  }

  async getAccountInsights(params: {
    token: string;
    accountId: string;
    since: string;
    until: string;
  }): Promise<MetaInsightsRow> {
    const normalizedAccountId = params.accountId.startsWith("act_") ? params.accountId : `act_${params.accountId}`;

    const url = `${this.baseUrl}/${normalizedAccountId}/insights`;
    const payload: InsightsResponse = await this.getJson<InsightsResponse>(url, params.token, true, {
      fields: "spend,reach,impressions,frequency,clicks,ctr,cpc,actions,action_values",
      level: "account",
      limit: 1,
      time_range: JSON.stringify({ since: params.since, until: params.until })
    });

    return payload.data?.[0] ?? {};
  }

  private async getJson<T>(
    url: string,
    token: string,
    withAuthInParams: boolean,
    params: Record<string, string | number> = {}
  ): Promise<T> {
    try {
      const response = await axios.get<T>(url, {
        params: withAuthInParams
          ? {
              ...params,
              access_token: token
            }
          : params,
        timeout: 20_000
      });

      return response.data;
    } catch (error) {
      const err = error as AxiosError<MetaGraphError>;
      const statusCode = err.response?.status;
      const code = err.response?.data?.error?.code;
      const message = err.response?.data?.error?.message ?? err.message;
      throw new MetaApiError(message, { statusCode, code });
    }
  }
}
