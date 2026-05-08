
var SPREADSHEET_ID = "";
var SHEET_NAME = "Participants";


var HEADERS = [
  "Timestamp",
  "Name",
  "Phone",
  "Telegram",
  "Language",
  "Source Page",
  "User Agent",
  "Submitted At (client)",
  "Status"
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

function _normalizeTelegram_(value) {
  var v = _sanitize_(value, 64);
  if (!v) return "";
  if (v.charAt(0) === "@") v = v.substring(1);
  if (!v) return "";
  return "@" + v;
}

function _parsePayload_(e) {
  // Формат запроса: text/plain с JSON-телом (CORS-friendly для Apps Script).
  // Также поддерживаем application/x-www-form-urlencoded на случай резервного режима.
  if (e && e.postData && e.postData.contents) {
    var raw = e.postData.contents;
    try {
      return JSON.parse(raw);
    } catch (err) {
      // не JSON — пробуем как form-encoded
    }
  }
  if (e && e.parameter && Object.keys(e.parameter).length) {
    return e.parameter;
  }
  return {};
}

function doGet(e) {
  return _jsonOutput_({
    ok: true,
    service: "upeak-participants",
    version: 1,
    sheet: SHEET_NAME
  });
}

function doPost(e) {
  try {
    var data = _parsePayload_(e) || {};

    var name = _sanitize_(data.name, 120);
    var phone = _sanitize_(data.phone, 32);
    var telegram = _normalizeTelegram_(data.telegram);
    var language = _sanitize_(data.language, 8) || "ru";
    var sourcePage = _sanitize_(data.sourcePage, 500);
    var userAgent = _sanitize_(data.userAgent, 500);
    var submittedAt = _sanitize_(data.submittedAt, 64);

    if (!name) {
      return _jsonOutput_({ ok: false, error: "name_required" });
    }
    var phoneDigits = phone.replace(/\D+/g, "");
    if (phoneDigits.length < 7) {
      return _jsonOutput_({ ok: false, error: "phone_invalid" });
    }

    var sheet = _getSheet_();
    var row = [
      new Date(),
      name,
      phone,
      telegram,
      language,
      sourcePage,
      userAgent,
      submittedAt,
      "new"
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
  Logger.log("Sheet ready: " + sheet.getName() + " with " + sheet.getLastRow() + " rows.");
}
