# Telegram bot for Meta Ads statistics (MVP)

Мультипользовательский Telegram-бот на `Node.js + TypeScript + Telegraf`.
Каждый пользователь подключает свой Meta API token, выбирает рекламный кабинет и период, после чего получает статистику.

## Что реализовано

- `/start` и onboarding подключения токена
- Валидация токена через Meta Graph API
- Хранение токена только в зашифрованном виде (AES-256-GCM)
- Мультипользовательский режим (раздельные пользователи/токены/кабинеты/состояния)
- Выбор кабинета через inline-кнопки + пагинация
- Выбор периода через inline-кнопки (`Сегодня`, `Вчера`, `7 дней`, `30 дней`, `Кастомный`)
- Кнопка `Обновить` для пересчёта с теми же параметрами
- Обработка невалидного/просроченного токена с предложением переподключения
- 13 обязательных метрик и безопасные вычисления при делении на 0

## Технологии

- Node.js + TypeScript
- Telegraf
- SQLite (`better-sqlite3`) для MVP
- Meta Marketing API (Graph API)

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните:

```bash
TELEGRAM_BOT_TOKEN=...
ENCRYPTION_KEY=...
DATABASE_PATH=./data/bot.sqlite
META_GRAPH_API_VERSION=v21.0
```

`ENCRYPTION_KEY` должен быть длинной секретной строкой.

## Запуск

```bash
npm install
npm run dev
```

Для production:

```bash
npm run build
npm start
```

## Схема данных (SQLite)

- `users`: `telegram_id`, `created_at`
- `connections`: `user_id`, `encrypted_token`, `token_status`, `updated_at`
- `ad_accounts`: `user_id`, `account_id`, `account_name`, `currency`
- `user_state`: `user_id`, `selected_account_id`, `selected_period`

## Метрики

Бот возвращает:

1. Затраты (Budget = spend)
2. Охват
3. Показы
4. Частота
5. Клики
6. CTR
7. CPC
8. Лиды
9. Стоимость лида
10. Покупки
11. Стоимость покупки
12. ROAS
13. Ценность покупок

### Формулы

- Стоимость лида = `spend / leads` (если `leads > 0`, иначе `-`)
- Стоимость покупки = `spend / purchases` (если `purchases > 0`, иначе `-`)
- ROAS = `purchase_value / spend` (если `spend > 0`, иначе `-`)

## Важно по безопасности

- Токены не выводятся в логи
- Токены хранятся только в зашифрованном виде
- При ошибке токена статус помечается как `invalid`, пользователю предлагается переподключение

## Ограничения MVP

- Кастомный период вводится текстом в формате `YYYY-MM-DD YYYY-MM-DD`
- Используется SQLite; для production рекомендуется PostgreSQL
