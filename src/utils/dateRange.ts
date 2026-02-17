import { format, subDays } from "date-fns";
import type { PeriodType, SelectedPeriod } from "../types/index.js";

function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function buildPeriod(periodType: PeriodType): SelectedPeriod {
  const now = new Date();

  if (periodType === "today") {
    const date = formatDate(now);
    return { type: periodType, since: date, until: date };
  }

  if (periodType === "yesterday") {
    const date = formatDate(subDays(now, 1));
    return { type: periodType, since: date, until: date };
  }

  if (periodType === "last_7_days") {
    return {
      type: periodType,
      since: formatDate(subDays(now, 6)),
      until: formatDate(now)
    };
  }

  return {
    type: "last_30_days",
    since: formatDate(subDays(now, 29)),
    until: formatDate(now)
  };
}

export function parseCustomPeriod(input: string): SelectedPeriod | null {
  const parts = input.trim().split(/\s+/);
  if (parts.length !== 2) {
    return null;
  }

  const [since, until] = parts;
  if (!isIsoDate(since) || !isIsoDate(until)) {
    return null;
  }

  if (new Date(since) > new Date(until)) {
    return null;
  }

  return {
    type: "custom",
    since,
    until
  };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
