# UPeak Prototype

Это исследовательский прототип планировщика задач по состоянию.

## Что уже умеет

- Утренний чек-ин (сон, энергия, самочувствие, стресс).
- Список задач (сложность, срочность, длительность).
- Распределение задач по состоянию (утро/день/вечер/перенос).
- Факт выполнения (закрыл/не закрыл).
- Вечерний чек-аут.
- Синхронизация событий в Google Sheets через Apps Script URL.


## Локальный запуск

См. подробную инструкцию: [`docs/localhost-setup.md`](docs/localhost-setup.md).

```
npm install
npm start    # http://localhost:3000
```

Страницы: `/` (лендинг), `/participate.html` (регистрация), `/planner.html`
(планировщик), `/api/health` (проверка).

## Настройка Google Sheets

См. [`docs/google-sheets-setup.md`](docs/google-sheets-setup.md)
(деплой `CodeREG.gs` / `CodeAPP.gs`, выдача `UP-…` ID, lookup).

В проекте две таблицы со своими Apps Script деплоями:

- регистрация — `docs/CodeREG.gs` (таблица `Participants`);
- планировщик — `docs/CodeAPP.gs` (таблица `PlannerEvents`).

URL деплоев задаются переменными окружения `REGISTRATION_APPS_SCRIPT_URL` и
`PLANNER_APPS_SCRIPT_URL` (см. `.env.example`). Браузер обращается не напрямую к
Apps Script, а к прокси (`/api/register`, `/api/events`,
`/api/participant/lookup`).

## Привязка ID участника

После регистрации участнику присваивается ID (`UP-000001`) — он показывается на
странице и хранится в первом столбце таблицы `Participants`. В шапке планировщика
есть поле «Мой ID» с кнопками «Сохранить» и «Изменить ID»: после проверки ID в
таблице регистрации все события планировщика пишутся в `PlannerEvents` с этим
`Participant ID`, и таблицу можно фильтровать по пользователю.

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
