# PulseBurn Planner Prototype

Это исследовательский прототип планировщика задач по состоянию.

## Что уже умеет

- Утренний чек-ин (сон, энергия, самочувствие, стресс).
- Список задач (сложность, срочность, длительность).
- Распределение задач по состоянию (утро/день/вечер/перенос).
- Факт выполнения (закрыл/не закрыл).
- Вечерний чек-аут.
- Синхронизация событий в Google Sheets через Apps Script URL.

## Быстрый запуск

1. Запустить локальный сервер:
   - двойной клик `start-server.cmd`
2. Открыть:
   - `http://127.0.0.1:8080/planner.html`

## Настройка Google Sheets

1. Открой нужную Google Sheet (таблица уже может существовать).
2. Открой `Extensions -> Apps Script`.
3. Вставь код из `docs/google-apps-script.gs`.
4. В начале файла проверь `SPREADSHEET_ID` — это ID из ссылки на таблицу.
5. Нажми `Deploy -> New deployment`.
6. Тип: `Web app`.
7. Execute as: `Me`.
8. Who has access: `Anyone`.
9. Скопируй URL вида `https://script.google.com/macros/s/.../exec`.
10. Вставь этот URL в дефолтный webhook в `app/planner.js` (или временно верни поле URL в UI).

## Формат события, которое отправляется

```json
{
  "source": "pulseburn_planner",
  "eventType": "morning_checkin",
  "timestamp": "2026-04-18T18:00:00.000Z",
  "date": "2026-04-18",
  "userName": "Alex",
  "readiness": 67,
  "payload": { "sleepHours": 7.5 }
}
```

## Замечания по прототипу

- Это MVP для проверки гипотезы, не медицинский инструмент.
- В проде стоит добавить авторизацию, роли, и отдельный API.
- Для нескольких пользователей в реальном времени нужен сервер и база (например, Supabase/Firebase/Postgres).
- "hello world"gi
