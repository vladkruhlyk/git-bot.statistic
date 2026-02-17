import { Markup } from "telegraf";
import type { AdAccount, SelectedPeriod } from "../types/index.js";

export function connectTokenKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("Подключить Meta token", "connect_token")]]);
}

export function accountSelectionKeyboard(params: {
  items: AdAccount[];
  page: number;
  pageSize: number;
  total: number;
}) {
  const { items, page, pageSize, total } = params;
  const rows = items.map((account) => [Markup.button.callback(account.accountName, `acc_select:${account.accountId}`)]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pager: ReturnType<typeof Markup.button.callback>[] = [];

  if (page > 0) {
    pager.push(Markup.button.callback("⬅️", `acc_page:${page - 1}`));
  }

  pager.push(Markup.button.callback(`${page + 1}/${totalPages}`, "noop"));

  if (page < totalPages - 1) {
    pager.push(Markup.button.callback("➡️", `acc_page:${page + 1}`));
  }

  if (pager.length > 0) {
    rows.push(pager);
  }

  rows.push([Markup.button.callback("Выбрать период", "period_menu")]);

  return Markup.inlineKeyboard(rows);
}

export function periodSelectionKeyboard(current?: SelectedPeriod | null) {
  const label = (value: string, key: SelectedPeriod["type"]) => (current?.type === key ? `✅ ${value}` : value);

  return Markup.inlineKeyboard([
    [Markup.button.callback(label("Сегодня", "today"), "period:today")],
    [Markup.button.callback(label("Вчера", "yesterday"), "period:yesterday")],
    [Markup.button.callback(label("Последние 7 дней", "last_7_days"), "period:last_7_days")],
    [Markup.button.callback(label("Последние 30 дней", "last_30_days"), "period:last_30_days")],
    [Markup.button.callback(label("Кастомный период", "custom"), "period:custom")]
  ]);
}

export function statsActionsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Сменить кабинет", "account_menu")],
    [Markup.button.callback("Сменить период", "period_menu")],
    [Markup.button.callback("Обновить", "refresh")]
  ]);
}
