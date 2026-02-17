import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { AdAccount, Connection, SelectedPeriod, TokenStatus, UserState } from "../types/index.js";

interface UserRow {
  id: number;
  telegram_id: number;
  created_at: string;
}

interface ConnectionRow {
  user_id: number;
  encrypted_token: string;
  token_status: TokenStatus;
  updated_at: string;
}

interface UserStateRow {
  user_id: number;
  selected_account_id: string | null;
  selected_period: string | null;
  updated_at: string;
}

interface AdAccountRow {
  id: number;
  user_id: number;
  account_id: string;
  account_name: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

export class Db {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS connections (
        user_id INTEGER PRIMARY KEY,
        encrypted_token TEXT NOT NULL,
        token_status TEXT NOT NULL CHECK(token_status IN ('valid', 'invalid')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ad_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        account_id TEXT NOT NULL,
        account_name TEXT NOT NULL,
        currency TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, account_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_state (
        user_id INTEGER PRIMARY KEY,
        selected_account_id TEXT,
        selected_period TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  }

  upsertUser(telegramId: number): number {
    const existing = this.db
      .prepare("SELECT id FROM users WHERE telegram_id = ?")
      .get(telegramId) as { id: number } | undefined;

    if (existing) {
      return existing.id;
    }

    const result = this.db
      .prepare("INSERT INTO users (telegram_id) VALUES (?)")
      .run(telegramId);

    return Number(result.lastInsertRowid);
  }

  getUserIdByTelegramId(telegramId: number): number | null {
    const row = this.db
      .prepare("SELECT id FROM users WHERE telegram_id = ?")
      .get(telegramId) as { id: number } | undefined;

    return row?.id ?? null;
  }

  saveConnection(userId: number, encryptedToken: string, tokenStatus: TokenStatus): void {
    this.db
      .prepare(`
        INSERT INTO connections (user_id, encrypted_token, token_status, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          encrypted_token = excluded.encrypted_token,
          token_status = excluded.token_status,
          updated_at = datetime('now')
      `)
      .run(userId, encryptedToken, tokenStatus);
  }

  updateTokenStatus(userId: number, tokenStatus: TokenStatus): void {
    this.db
      .prepare("UPDATE connections SET token_status = ?, updated_at = datetime('now') WHERE user_id = ?")
      .run(tokenStatus, userId);
  }

  getConnection(userId: number): Connection | null {
    const row = this.db
      .prepare("SELECT user_id, encrypted_token, token_status, updated_at FROM connections WHERE user_id = ?")
      .get(userId) as ConnectionRow | undefined;

    if (!row) {
      return null;
    }

    return {
      userId: row.user_id,
      encryptedToken: row.encrypted_token,
      tokenStatus: row.token_status,
      updatedAt: row.updated_at
    };
  }

  replaceAdAccounts(userId: number, accounts: Array<{ accountId: string; accountName: string; currency: string }>): void {
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM ad_accounts WHERE user_id = ?").run(userId);

      const stmt = this.db.prepare(`
        INSERT INTO ad_accounts (user_id, account_id, account_name, currency, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `);

      for (const account of accounts) {
        stmt.run(userId, account.accountId, account.accountName, account.currency);
      }
    });

    tx();
  }

  getAdAccountsPage(userId: number, page: number, pageSize: number): { items: AdAccount[]; total: number } {
    const totalRow = this.db
      .prepare("SELECT COUNT(*) as count FROM ad_accounts WHERE user_id = ?")
      .get(userId) as { count: number };

    const offset = page * pageSize;

    const rows = this.db
      .prepare(`
        SELECT id, user_id, account_id, account_name, currency, created_at, updated_at
        FROM ad_accounts
        WHERE user_id = ?
        ORDER BY account_name ASC
        LIMIT ? OFFSET ?
      `)
      .all(userId, pageSize, offset) as AdAccountRow[];

    return {
      total: totalRow.count,
      items: rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        accountId: row.account_id,
        accountName: row.account_name,
        currency: row.currency,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    };
  }

  getAdAccount(userId: number, accountId: string): AdAccount | null {
    const row = this.db
      .prepare(`
        SELECT id, user_id, account_id, account_name, currency, created_at, updated_at
        FROM ad_accounts
        WHERE user_id = ? AND account_id = ?
      `)
      .get(userId, accountId) as AdAccountRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id,
      accountName: row.account_name,
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  setUserState(userId: number, patch: Partial<{ selectedAccountId: string | null; selectedPeriod: SelectedPeriod | null }>): void {
    const current = this.getUserState(userId);

    const nextAccountId = patch.selectedAccountId === undefined ? current?.selectedAccountId ?? null : patch.selectedAccountId;
    const nextPeriod = patch.selectedPeriod === undefined ? current?.selectedPeriod ?? null : patch.selectedPeriod;

    this.db
      .prepare(`
        INSERT INTO user_state (user_id, selected_account_id, selected_period, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          selected_account_id = excluded.selected_account_id,
          selected_period = excluded.selected_period,
          updated_at = datetime('now')
      `)
      .run(userId, nextAccountId, nextPeriod ? JSON.stringify(nextPeriod) : null);
  }

  getUserState(userId: number): UserState | null {
    const row = this.db
      .prepare("SELECT user_id, selected_account_id, selected_period, updated_at FROM user_state WHERE user_id = ?")
      .get(userId) as UserStateRow | undefined;

    if (!row) {
      return null;
    }

    return {
      userId: row.user_id,
      selectedAccountId: row.selected_account_id,
      selectedPeriod: row.selected_period ? (JSON.parse(row.selected_period) as SelectedPeriod) : null,
      updatedAt: row.updated_at
    };
  }
}
