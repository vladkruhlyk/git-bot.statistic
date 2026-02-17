import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  encryptionKey: requireEnv("ENCRYPTION_KEY"),
  databasePath: process.env.DATABASE_PATH ?? "./data/bot.sqlite",
  metaGraphApiVersion: process.env.META_GRAPH_API_VERSION ?? "v21.0"
};
