# Локальный запуск UPeak (для чайника)

Пошагово: как поднять прототип на своём компьютере и что делать, если что-то сломалось.

## Что нужно заранее

1. Установленный [Node.js](https://nodejs.org/) (LTS).
2. Скопированный проект UPeak.
3. Файл `.env` в корне проекта (образец — `.env.example`).

## Запуск за 3 шага

```bash
cd /путь/к/UPeak
npm install
npm start
```

В терминале должно появиться что-то вроде: `Server started on port 3000`.

Открой в браузере:

| Страница | Адрес |
|---|---|
| Лендинг | http://localhost:3000/ |
| Регистрация | http://localhost:3000/participate.html |
| Планировщик | http://localhost:3000/planner.html |
| Проверка сервера | http://localhost:3000/api/health |

Важно: открывай именно через `http://localhost:3000/...`, а не файл с диска (`file://...`).

## Проверка, что всё настроено

Открой http://localhost:3000/api/health

Нормальный ответ:

```json
{
  "ok": true,
  "service": "upeak-proxy",
  "plannerConfigured": true,
  "registrationConfigured": true
}
```

Если `registrationConfigured: false` или `plannerConfigured: false` — в `.env` не хватает URL Apps Script. См. [`google-sheets-setup.md`](google-sheets-setup.md).

## Типичный путь участника

1. Зарегистрироваться на `/participate.html` → получить ID вида `UP-000001`.
2. Открыть `/planner.html`.
3. В поле **Мой ID** вставить ID → **Сохранить**.
4. Утро: чек-ин → рекомендации.
5. День: задачи → **Распределить по состоянию**.
6. Вечер: итог → **Закрыть день**.

Подробнее про исследование: [`../Userflow.md`](../Userflow.md).

## Если ошибка — что делать

### «Не удалось отправить заявку… (Internal server error)»

Чаще всего сервер не достучался до Google.

1. Убедись, что `npm start` запущен.
2. Проверь интернет / VPN / DNS.
3. В терминале сервера ищи строку вроде `ENOTFOUND script.google.com`.
4. Перезапусти сервер: останови (Ctrl+C) → снова `npm start`.

### Регистрация прошла, но ID не показали

Значит в Google не задеплоена свежая версия `docs/CodeREG.gs` (с генерацией `participantId`).  
См. [`google-sheets-setup.md`](google-sheets-setup.md) → раздел «Регистрация».

### В планировщике «ID не найден»

1. Скопируй ID точно (`UP-000001`).
2. Проверь, что строка есть в таблице `Participants`.
3. Передеплой `CodeREG.gs` (нужен lookup).

### «Ошибка синхронизации» в планировщике

1. Сначала сохрани **Мой ID**.
2. Проверь `/api/health` → `plannerConfigured: true`.
3. Проверь URL/токен планировщика в `.env`.

### Порт 3000 занят

```bash
# macOS / Linux: кто слушает 3000
lsof -i :3000
# остановить старый процесс и снова
npm start
```

Или в `.env` поставь другой порт, например `PORT=3001`.

## Что чинится в коде, а что только руками

| Проблема | Кто чинит |
|---|---|
| Формулы, UI, логика планировщика | код в репо |
| Выдача ID / lookup участника | код `docs/CodeREG.gs` **+ ручной деплой в Google** |
| Пустые URL в `.env` | ты: скопировать из деплоя Apps Script |
| Сеть до `script.google.com` | интернет / VPN на машине |
