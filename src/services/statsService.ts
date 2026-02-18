import type { MetaInsightsRow, StatsMetrics } from "../types/index.js";

const LEAD_ACTION_TYPES_PRIORITY: string[] = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "omni_lead",
  "onsite_web_lead",
  "qualified_lead"
];

const PURCHASE_ACTION_TYPES_PRIORITY: string[] = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_conversion.purchase",
  "web_purchase"
];

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

function sumByActionType(
  actions: Array<{ action_type: string; value: string }> | undefined,
  actionType: string
): number {
  if (!actions?.length) {
    return 0;
  }

  const normalizedTarget = actionType.toLowerCase();
  return actions.reduce((acc, action) => {
    const currentType = action.action_type.toLowerCase();
    return currentType === normalizedTarget ? acc + toNumber(action.value) : acc;
  }, 0);
}

function pickMetricValue(
  actions: Array<{ action_type: string; value: string }> | undefined,
  priorities: string[]
): number {
  for (const actionType of priorities) {
    const value = sumByActionType(actions, actionType);
    if (value > 0) {
      return value;
    }
  }

  return 0;
}

export function mapInsightsToMetrics(row: MetaInsightsRow): StatsMetrics {
  const spend = toNumber(row.spend);
  const leads = pickMetricValue(row.actions, LEAD_ACTION_TYPES_PRIORITY);
  const purchases = pickMetricValue(row.actions, PURCHASE_ACTION_TYPES_PRIORITY);
  const purchaseValue = pickMetricValue(row.action_values, PURCHASE_ACTION_TYPES_PRIORITY);

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
