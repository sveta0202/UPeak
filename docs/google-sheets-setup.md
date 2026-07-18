# Настройка Google Sheets + Apps Script (для чайника)

В проекте две отдельные таблицы и два деплоя:

| Назначение | Файл скрипта | Лист | Переменные в `.env` |
|---|---|---|---|
| Регистрация | `docs/CodeREG.gs` | `Participants` | `REGISTRATION_APPS_SCRIPT_URL`, `REGISTRATION_APPS_SCRIPT_TOKEN` |
| Планировщик | `docs/CodeAPP.gs` | `PlannerEvents` (+ нормализованные листы) | `PLANNER_APPS_SCRIPT_URL`, `PLANNER_APPS_SCRIPT_TOKEN` |

Браузер **не** ходит в Google напрямую. Он бьёт в локальный сервер (`/api/register`, `/api/events`, `/api/participant/lookup`), а сервер уже вызывает Apps Script.

---

## A) Регистрация (`CodeREG.gs`) — выдача ID и проверка ID

### 1. Открой таблицу участников

Создай Google Sheet (или открой существующую). Желательно назвать лист `Participants`.

### 2. Открой редактор скрипта

В таблице: **Расширения → Apps Script**.

### 3. Вставь код

1. Удали содержимое `Code.gs` (или создай файл).
2. Скопируй **весь** текст из `docs/CodeREG.gs` репозитория.
3. Вставь и сохрани (Ctrl/Cmd+S).

Опционально вверху файла:
- `SPREADSHEET_ID` — если скрипт не привязан к таблице;
- `SHARED_TOKEN` — тот же секрет, что `REGISTRATION_APPS_SCRIPT_TOKEN` в `.env`.

Если `SHARED_TOKEN` оставить пустым — проверка токена выключена (удобно для первого теста).

### 4. Задеплой как веб-приложение

1. **Deploy → New deployment** (или Manage deployments → Edit → New version).
2. Тип: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone** (иначе локальный сервер не достучится).
5. Deploy → скопируй **Web app URL** (`https://script.google.com/macros/s/.../exec`).

### 5. Пропиши URL в `.env`

```env
REGISTRATION_APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXX/exec
REGISTRATION_APPS_SCRIPT_TOKEN=твой_секрет
```

Если задал `SHARED_TOKEN` в Apps Script — токен в `.env` должен совпадать.

### 6. Перезапусти локальный сервер

```bash
npm start
```

### 7. Проверь

1. http://localhost:3000/participate.html — зарегистрируйся.
2. Должен показаться ID вида `UP-000001`.
3. В таблице `Participants` — новая строка, в первой колонке этот ID.
4. В планировщике вставь ID → **Сохранить** → статус «сохранён».

### Если таблица уже была со старыми колонками

Новый `CodeREG.gs` сам добавит колонку `Participant ID` слева и по возможности проставит ID старым строкам.  
Можно один раз вручную в Apps Script запустить функцию `setup`.

---

## B) Планировщик (`CodeAPP.gs`)

Аналогично:

1. Отдельная Google-таблица для событий.
2. Apps Script → вставить `docs/CodeAPP.gs`.
3. При необходимости задать `SPREADSHEET_ID` и `SHARED_TOKEN`.
4. Deploy → Web app → Anyone.
5. URL в `.env`:

```env
PLANNER_APPS_SCRIPT_URL=https://script.google.com/macros/s/YYYY/exec
PLANNER_APPS_SCRIPT_TOKEN=твой_секрет
```

Подробнее про листы и миграцию: [`planner-data-model.md`](planner-data-model.md).

---

## Частые ошибки деплоя

| Симптом | Причина | Что сделать |
|---|---|---|
| 500 / `ENOTFOUND script.google.com` | нет сети/DNS | VPN, интернет, перезапуск `npm start` |
| 503 `... is not configured` | пустой URL в `.env` | вписать URL деплоя |
| 502 Apps Script upstream | старый/битый деплой | New version + Deploy |
| Регистрация ok, но без ID | старый `CodeREG` без `participantId` | заново вставить код и задеплоить |
| ID не находится в планировщике | нет lookup / не тот деплой | задеплоить свежий `CodeREG`, проверить URL регистрации |
| unauthorized | токен не совпал | `SHARED_TOKEN` = токен в `.env` |
