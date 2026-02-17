import { config } from "./config.js";
import { createBot } from "./bot/index.js";
import { Db } from "./db/database.js";
import { MetaApiClient } from "./services/metaApi.js";

async function main(): Promise<void> {
  const db = new Db(config.databasePath);
  const metaApi = new MetaApiClient(config.metaGraphApiVersion);
  const bot = createBot(db, metaApi);

  await bot.launch();
  console.log("Bot started");

  const shutdown = async () => {
    await bot.stop();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`Startup error: ${message}`);
  process.exit(1);
});
