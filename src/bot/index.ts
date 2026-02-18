import { Context, Telegraf } from "telegraf";
import type { InlineKeyboardMarkup } from "telegraf/types";
import { config } from "../config.js";
import { Db } from "../db/database.js";
import { MetaApiClient, MetaApiError } from "../services/metaApi.js";
import { mapInsightsToMetrics } from "../services/statsService.js";
import type { PeriodType, SelectedPeriod } from "../types/index.js";
import { buildPeriod, parseCustomPeriod } from "../utils/dateRange.js";
import { decrypt, encrypt } from "../utils/encryption.js";
import { formatStatsMessage } from "../utils/format.js";
import {
  accountSelectionKeyboard,
  connectTokenKeyboard,
  periodSelectionKeyboard,
  statsActionsKeyboard
} from "./keyboards.js";

const PAGE_SIZE = 8;

type PendingState =
  | { type: "await_token" }
  | { type: "await_custom_period" };

type KeyboardWithMarkup = { reply_markup: InlineKeyboardMarkup };

export function createBot(db: Db, metaApi: MetaApiClient): Telegraf {
  const bot = new Telegraf(config.telegramBotToken);
  const pendingInput = new Map<number, PendingState>();

  async function promptToken(ctx: Context, isReconnect = false): Promise<void> {
    const message = isReconnect
      ? "Токен истёк или невалиден. Отправьте новый Meta API token в чат."
      : "Отправьте ваш Meta API token в чат. Токен хранится на сервере в зашифрованном виде.";

    const from = ctx.from;
    if (!from) {
      return;
    }

    pendingInput.set(from.id, { type: "await_token" });
    await ctx.reply(message);
  }

  function getUserIdOrNull(ctx: Context): number | null {
    const from = ctx.from;
    if (!from) {
      return null;
    }

    return db.upsertUser(from.id);
  }

  function getDecryptedToken(userId: number): string | null {
    const connection = db.getConnection(userId);
    if (!connection || connection.tokenStatus !== "valid") {
      return null;
    }

    try {
      return decrypt(connection.encryptedToken, config.encryptionKey);
    } catch {
      db.updateTokenStatus(userId, "invalid");
      return null;
    }
  }

  async function sendOrEditMessage(
    ctx: Context,
    text: string,
    keyboard: KeyboardWithMarkup,
    preferEdit: boolean
  ): Promise<void> {
    if (preferEdit && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, {
          reply_markup: keyboard.reply_markup
        });
        return;
      } catch {
        // Fall back to a new message when Telegram cannot edit the original one.
      }
    }

    await ctx.reply(text, keyboard);
  }

  async function showAccountMenu(ctx: Context, userId: number, page: number, preferEdit = false): Promise<void> {
    const pageData = db.getAdAccountsPage(userId, page, PAGE_SIZE);

    if (!pageData.total) {
      await ctx.reply("У вас нет доступных рекламных кабинетов. Проверьте права токена.");
      return;
    }

    const keyboard = accountSelectionKeyboard({
      items: pageData.items,
      page,
      pageSize: PAGE_SIZE,
      total: pageData.total
    });

    await sendOrEditMessage(ctx, "Выберите рекламный кабинет:", keyboard, preferEdit);
  }

  async function showPeriodMenu(ctx: Context, userId: number, preferEdit = false): Promise<void> {
    const state = db.getUserState(userId);
    const keyboard = periodSelectionKeyboard(state?.selectedPeriod);
    await sendOrEditMessage(ctx, "Выберите период:", keyboard, preferEdit);
  }

  async function sendStats(ctx: Context, userId: number): Promise<void> {
    const token = getDecryptedToken(userId);
    if (!token) {
      await ctx.reply("Сначала подключите валидный token.", connectTokenKeyboard());
      return;
    }

    const state = db.getUserState(userId);
    if (!state?.selectedAccountId) {
      await showAccountMenu(ctx, userId, 0);
      return;
    }

    if (!state.selectedPeriod) {
      await showPeriodMenu(ctx, userId);
      return;
    }

    const account = db.getAdAccount(userId, state.selectedAccountId);
    if (!account) {
      await ctx.reply("Выбранный кабинет не найден. Выберите кабинет заново.");
      await showAccountMenu(ctx, userId, 0);
      return;
    }

    try {
      const insights = await metaApi.getAccountInsights({
        token,
        accountId: account.accountId,
        since: state.selectedPeriod.since,
        until: state.selectedPeriod.until
      });

      const metrics = mapInsightsToMetrics(insights);
      const message = formatStatsMessage({
        accountName: account.accountName,
        accountId: account.accountId,
        currency: account.currency,
        period: state.selectedPeriod,
        metrics
      });

      await ctx.reply(message, statsActionsKeyboard());
    } catch (error) {
      if (error instanceof MetaApiError && error.isTokenError()) {
        db.updateTokenStatus(userId, "invalid");
        await promptToken(ctx, true);
        return;
      }

      await ctx.reply("Не удалось получить статистику из Meta API. Попробуйте позже или обновите token.");
    }
  }

  async function processToken(ctx: Context, userId: number, token: string): Promise<void> {
    try {
      const accounts = await metaApi.validateTokenAndGetAdAccounts(token);

      const encrypted = encrypt(token, config.encryptionKey);
      db.saveConnection(userId, encrypted, "valid");
      db.replaceAdAccounts(
        userId,
        accounts.map((account) => ({
          accountId: account.account_id ?? account.id,
          accountName: account.name ?? `Account ${account.account_id ?? account.id}`,
          currency: account.currency ?? "USD"
        }))
      );

      db.setUserState(userId, {
        selectedPeriod: buildPeriod("today")
      });

      await ctx.reply("Token подключён. Теперь выберите рекламный кабинет.");
      await showAccountMenu(ctx, userId, 0);
    } catch (error) {
      db.saveConnection(userId, encrypt(token, config.encryptionKey), "invalid");
      if (error instanceof MetaApiError) {
        await ctx.reply("Token не прошёл проверку. Проверьте его и отправьте снова.");
        return;
      }

      await ctx.reply("Не удалось проверить token из-за временной ошибки. Попробуйте снова.");
    }
  }

  bot.start(async (ctx) => {
    const userId = getUserIdOrNull(ctx);
    if (!userId) {
      return;
    }

    const connection = db.getConnection(userId);
    if (!connection || connection.tokenStatus !== "valid") {
      await ctx.reply(
        "Привет! Это бот статистики Meta Ads. Нажмите кнопку ниже, чтобы подключить Meta API token.",
        connectTokenKeyboard()
      );
      return;
    }

    await ctx.reply("Вы уже подключены. Выберите действие:", statsActionsKeyboard());
  });

  bot.on("text", async (ctx) => {
    const userId = getUserIdOrNull(ctx);
    if (!userId) {
      return;
    }

    const pending = pendingInput.get(ctx.from!.id);
    if (!pending) {
      return;
    }

    const text = ctx.message.text.trim();

    if (pending.type === "await_token") {
      pendingInput.delete(ctx.from!.id);
      await processToken(ctx, userId, text);
      return;
    }

    if (pending.type === "await_custom_period") {
      const period = parseCustomPeriod(text);
      if (!period) {
        await ctx.reply("Неверный формат. Отправьте период в формате: YYYY-MM-DD YYYY-MM-DD");
        return;
      }

      pendingInput.delete(ctx.from!.id);
      db.setUserState(userId, { selectedPeriod: period });
      await sendStats(ctx, userId);
    }
  });

  bot.on("callback_query", async (ctx) => {
    const query = ctx.callbackQuery;
    if (!query || !("data" in query)) {
      return;
    }
    const data = query.data;
    const userId = getUserIdOrNull(ctx);
    if (!userId) {
      return;
    }

    if (data === "noop") {
      await ctx.answerCbQuery();
      return;
    }

    if (data === "connect_token") {
      await ctx.answerCbQuery();
      await promptToken(ctx);
      return;
    }

    if (data === "account_menu") {
      await ctx.answerCbQuery();
      await showAccountMenu(ctx, userId, 0, true);
      return;
    }

    if (data === "period_menu") {
      await ctx.answerCbQuery();
      await showPeriodMenu(ctx, userId, true);
      return;
    }

    if (data === "refresh") {
      await ctx.answerCbQuery("Обновляю...");
      await sendStats(ctx, userId);
      return;
    }

    if (data.startsWith("acc_page:")) {
      const page = Number(data.split(":")[1] ?? "0");
      await ctx.answerCbQuery();
      await showAccountMenu(ctx, userId, Number.isFinite(page) ? page : 0, true);
      return;
    }

    if (data.startsWith("acc_select:")) {
      const accountId = data.slice("acc_select:".length);
      db.setUserState(userId, { selectedAccountId: accountId });
      await ctx.answerCbQuery("Кабинет выбран");
      await showPeriodMenu(ctx, userId, true);
      return;
    }

    if (data.startsWith("period:")) {
      const type = data.slice("period:".length) as PeriodType;
      await ctx.answerCbQuery();

      if (type === "custom") {
        pendingInput.set(ctx.from!.id, { type: "await_custom_period" });
        await ctx.reply("Введите кастомный период в формате: YYYY-MM-DD YYYY-MM-DD");
        return;
      }

      if (!["today", "yesterday", "last_7_days", "last_30_days"].includes(type)) {
        await ctx.reply("Неизвестный тип периода.");
        return;
      }

      const period = buildPeriod(type);
      db.setUserState(userId, { selectedPeriod: period as SelectedPeriod });
      await sendStats(ctx, userId);
      return;
    }
  });

  bot.catch(async (_err, ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      pendingInput.delete(userId);
    }
    console.error("Bot error");
    await ctx.reply("Произошла непредвиденная ошибка. Попробуйте позже.");
  });

  return bot;
}
