import type { MetaInsightsRow, StatsMetrics } from "../types/index.js";

function toNumber(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }

  return numerator / denominator;
}

function sumByActionTypes(actions: Array<{ action_type: string; value: string }> | undefined, matcher: (type: string) => boolean): number {
  if (!actions?.length) {
    return 0;
  }

  return actions.reduce((acc, action) => {
    return matcher(action.action_type) ? acc + toNumber(action.value) : acc;
  }, 0);
}

function isLeadAction(actionType: string): boolean {
  const normalized = actionType.toLowerCase();
  return normalized.includes("lead");
}

function isPurchaseAction(actionType: string): boolean {
  const normalized = actionType.toLowerCase();
  return normalized.includes("purchase") || normalized.includes("omni_purchase");
}

export function mapInsightsToMetrics(row: MetaInsightsRow): StatsMetrics {
  const spend = toNumber(row.spend);
  const leads = sumByActionTypes(row.actions, isLeadAction);
  const purchases = sumByActionTypes(row.actions, isPurchaseAction);
  const purchaseValue = sumByActionTypes(row.action_values, isPurchaseAction);

  return {
    spend,
    reach: toNumber(row.reach),
    impressions: toNumber(row.impressions),
    frequency: toNumber(row.frequency),
    clicks: toNumber(row.clicks),
    ctr: toNumber(row.ctr),
    cpc: toNumber(row.cpc),
    leads,
    costPerLead: safeDivide(spend, leads),
    purchases,
    costPerPurchase: safeDivide(spend, purchases),
    roas: safeDivide(purchaseValue, spend),
    purchaseValue
  };
}
