/**
 * Upeak — Planner prototype Apps Script.
 *
 * Этот скрипт обслуживает ДРУГУЮ Google-таблицу, в которую стекаются события
 * прототипа-планировщика (страница /planner.html). Регистрационная форма
 * (страница /participate.html) пишет в другую таблицу со своим скриптом —
 * не путайте их.
 *
 * Куда уходит каждое поле — описано в HEADERS ниже. Каждая строка — это одно
 * событие пользователя: чек-ин, создание/изменение/перенос/удаление задачи,
 * распределение по состоянию, возврат из «Запланированных», закрытие дня.
 */

// Если скрипт привязан к таблице (Extensions → Apps Script), можно оставить пустым.
// Иначе вставьте ID таблицы между кавычками.
var SPREADSHEET_ID = "";
var SHEET_NAME = "PlannerEvents";

// Необязательный общий токен между Railway-прокси и скриптом.
// Если задан, отвечаем 403 без правильного токена.
var SHARED_TOKEN = "";

var HEADERS = [
  "Timestamp (server)",     // когда строка попала в таблицу
  "Received At (proxy)",    // когда прокси UPeak принял событие
  "Client Timestamp",       // время с устройства пользователя (ISO)
  "Date",                   // дата задачи/события у пользователя (YYYY-MM-DD)
  "Session ID",             // стабильный идентификатор браузерной сессии пользователя
  "User Name",              // имя, если пользователь его ввёл; иначе "anonymous"
  "Source Page",            // путь страницы (например /planner.html)
  "Language",               // язык интерфейса (ru/en)
  "Event Type",             // morning_checkin / task_created / task_edited / task_toggled
                            //  / task_reordered / task_deleted / scheduled_added
                            //  / scheduled_restored / scheduled_deleted
                            //  / routine_activated / plan_generated / evening_checkout
  "Readiness",              // расчётная готовность 0..100
  "Tasks Count",            // всего задач в основном блоке (сегодня)
  "Done Count",             // выполненные сегодня
  "Scheduled Count",        // сколько задач лежит в «Запланированных»
  "Task ID",                // id задачи, если событие про конкретную задачу
  "Task Title",             // название задачи
  "Difficulty",             // 1..5
  "Urgency",                // 1..5
  "Duration (min)",         // оценка длительности в минутах
  "Routine",                // TRUE/FALSE — рутина по умолчанию в начало дня
  "Slot Key",               // recommended slot (morningFocus, dayOps, ...)
  "Order",                  // позиция в основном списке после ручной сортировки
  "Scheduled For",          // дата возврата для «Запланированных» (YYYY-MM-DD)
  "Plan-Fact",              // строка "выполнено/всего сегодня" (например "2/2")
  "User Agent",             // браузер
  "IP (proxy)",             // IP, как видит его прокси
  "Raw Payload"             // JSON с исходным payload события
];

function _getSheet_() {
  var ss;
  if (SPREADSHEET_ID && SPREADSHEET_ID.length > 0) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("No active spreadsheet. Set SPREADSHEET_ID or bind the script to a sheet.");
    }
  }
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.autoResizeColumns(1, HEADERS.length);
  }
  return sheet;
}

function _jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _sanitize_(value, maxLen) {
  if (value === null || value === undefined) return "";
  var s = String(value).trim();
  if (maxLen && s.length > maxLen) s = s.substring(0, maxLen);
  return s;
}

function _safeJson_(value) {
  try {
    return JSON.stringify(value).slice(0, 5000);
  } catch (_e) {
    return "";
  }
}

function _parsePayload_(e) {
  if (e && e.postData && e.postData.contents) {
    var raw = e.postData.contents;
    try {
      return JSON.parse(raw);
    } catch (_err) {}
  }
  if (e && e.parameter && Object.keys(e.parameter).length) {
    return e.parameter;
  }
  return {};
}

var ALLOWED_EVENTS = {
  morning_checkin: true,
  task_created: true,
  task_edited: true,
  task_deleted: true,
  task_toggled: true,
  task_reordered: true,
  scheduled_added: true,
  scheduled_restored: true,
  scheduled_deleted: true,
  plan_generated: true,
  routine_activated: true,
  evening_checkout: true
};

function doGet(_e) {
  return _jsonOutput_({
    ok: true,
    service: "upeak-planner-events",
    version: 1,
    sheet: SHEET_NAME
  });
}

function doPost(e) {
  try {
    var data = _parsePayload_(e) || {};

    if (SHARED_TOKEN && _sanitize_(data.proxyToken, 200) !== SHARED_TOKEN) {
      return _jsonOutput_({ ok: false, error: "forbidden" });
    }

    var eventType = _sanitize_(data.eventType, 64);
    if (!eventType || !ALLOWED_EVENTS[eventType]) {
      return _jsonOutput_({ ok: false, error: "invalid_event_type" });
    }

    var clientTs = _sanitize_(data.timestamp, 64);
    var date = _sanitize_(data.date, 32);
    if (!clientTs || !date) {
      return _jsonOutput_({ ok: false, error: "timestamp_and_date_required" });
    }

    var payload = (data.payload && typeof data.payload === "object") ? data.payload : {};

    var taskId = _sanitize_(payload.id || payload.taskId, 64);
    var taskTitle = _sanitize_(payload.title, 200);
    var difficulty = Number(payload.difficulty);
    var urgency = Number(payload.urgency);
    var duration = Number(payload.duration);
    var routine = payload.routine === true ? "TRUE" : (payload.routine === false ? "FALSE" : "");
    var slotKey = _sanitize_(payload.slotKey, 64);
    var order = (payload.order == null || payload.order === "") ? "" : Number(payload.order);
    var scheduledFor = _sanitize_(payload.scheduledFor, 32);

    var tasksCount = Number(data.tasksCount);
    var doneCount = Number(data.doneCount);
    var scheduledCount = Number(data.scheduledCount);
    var planFact = (isFinite(doneCount) && isFinite(tasksCount))
      ? (doneCount + "/" + tasksCount)
      : "";

    var sheet = _getSheet_();
    var row = [
      new Date(),
      _sanitize_(data.receivedAt, 64),
      clientTs,
      date,
      _sanitize_(data.sessionId, 64),
      _sanitize_(data.userName, 120) || "anonymous",
      _sanitize_(data.sourcePage, 200),
      _sanitize_(data.language, 8),
      eventType,
      data.readiness == null ? "" : Number(data.readiness),
      isFinite(tasksCount) ? tasksCount : "",
      isFinite(doneCount) ? doneCount : "",
      isFinite(scheduledCount) ? scheduledCount : "",
      taskId,
      taskTitle,
      isFinite(difficulty) ? difficulty : "",
      isFinite(urgency) ? urgency : "",
      isFinite(duration) ? duration : "",
      routine,
      slotKey,
      isFinite(order) ? order : "",
      scheduledFor,
      planFact,
      _sanitize_(data.userAgent, 500),
      _sanitize_(data.ip, 64),
      _safeJson_(payload)
    ];
    sheet.appendRow(row);

    return _jsonOutput_({ ok: true });
  } catch (err) {
    return _jsonOutput_({
      ok: false,
      error: "internal_error",
      message: String(err && err.message ? err.message : err)
    });
  }
}

function setup() {
  var sheet = _getSheet_();
  Logger.log("Planner sheet ready: " + sheet.getName() + " with " + sheet.getLastRow() + " rows.");
}
