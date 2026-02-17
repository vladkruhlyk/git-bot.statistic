import type { SelectedPeriod, StatsMetrics } from "../types/index.js";

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(value);
}

function formatMoney(value: number, currency?: string): string {
  if (currency) {
    try {
      return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    } catch {
      return `${formatNumber(value, 2)} ${currency}`;
    }
  }

  return formatNumber(value, 2);
}

export function formatPeriodLabel(period: SelectedPeriod): string {
  const labels: Record<SelectedPeriod["type"], string> = {
    today: "Сегодня",
    yesterday: "Вчера",
    last_7_days: "Последние 7 дней",
    last_30_days: "Последние 30 дней",
    custom: "Кастомный"
  };

  return `${labels[period.type]} (${period.since} - ${period.until})`;
}

export function formatStatsMessage(params: {
  accountName: string;
  accountId: string;
  currency: string;
  period: SelectedPeriod;
  metrics: StatsMetrics;
}): string {
  const { accountName, accountId, currency, period, metrics } = params;

  const cpl = metrics.costPerLead === null ? "-" : formatMoney(metrics.costPerLead, currency);
  const cpp = metrics.costPerPurchase === null ? "-" : formatMoney(metrics.costPerPurchase, currency);
  const roas = metrics.roas === null ? "-" : formatNumber(metrics.roas, 2);

  return [
    "📊 Статистика Meta Ads",
    "",
    `Кабинет: ${accountName} (${accountId})`,
    `Период: ${formatPeriodLabel(period)}`,
    "",
    `1) Затраты (Budget): ${formatMoney(metrics.spend, currency)}`,
    `2) Охват: ${formatNumber(metrics.reach, 0)}`,
    `3) Показы: ${formatNumber(metrics.impressions, 0)}`,
    `4) Частота: ${formatNumber(metrics.frequency, 2)}`,
    `5) Клики: ${formatNumber(metrics.clicks, 0)}`,
    `6) CTR: ${formatNumber(metrics.ctr, 2)}%`,
    `7) CPC: ${formatMoney(metrics.cpc, currency)}`,
    `8) Лиды: ${formatNumber(metrics.leads, 0)}`,
    `9) Стоимость лида: ${cpl}`,
    `10) Покупки: ${formatNumber(metrics.purchases, 0)}`,
    `11) Стоимость покупки: ${cpp}`,
    `12) ROAS: ${roas}`,
    `13) Ценность покупок: ${formatMoney(metrics.purchaseValue, currency)}`
  ].join("\n");
}
