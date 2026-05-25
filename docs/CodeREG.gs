
var SPREADSHEET_ID = "";
var SHEET_NAME = "Participants";


var Q1_TEXT_RU = "Следите ли вы за своим состоянием или здоровьем?";
var Q2_TEXT_RU = "Используете ли вы что-то для отслеживания: сна, тренировок, нагрузки, продуктивности, самочувствия?";
var Q3_TEXT_RU = "Насколько вам знакомы такие проблемы: перегруз, усталость к концу дня, сложности с планированием, переоценка своих сил?";

var HEADERS = [
  "Timestamp",
  "Session ID",
  "Name",
  "Phone",
  "Telegram",
  "Email",
  "Contact Type",
  "Contact Value",
  "Language",
  "Source Page",
  "User Agent",
  "Submitted At (client)",
  "Q1: " + Q1_TEXT_RU,
  "Q1 Answer",
  "Q1 Answer (label)",
  "Q2: " + Q2_TEXT_RU,
  "Q2 Answer",
  "Q2 Answer (label)",
  "Q3: " + Q3_TEXT_RU,
  "Q3 Answer",
  "Q3 Answer (label)",
  "Status"
];

var Q1_VALID = { "yes_regularly": true, "sometimes": true, "no": true };
var Q2_VALID = { "yes": true, "no": true };
var Q3_VALID = { "often": true, "sometimes": true, "rarely": true, "almost_never": true };

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

var EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

function _normalizeEmail_(value) {
  var v = _sanitize_(value, 120);
  if (!v) return "";
  if (!EMAIL_RE.test(v)) return "";
  return v;
}

function _parsePayload_(e) {
  // Запрос: text/plain с JSON-телом (CORS-friendly для Apps Script).
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

function _readSurveyEntry_(survey, key) {
  if (!survey || typeof survey !== "object") return { question: "", answer: "", label: "" };
  var entry = survey[key];
  if (!entry || typeof entry !== "object") return { question: "", answer: "", label: "" };
  return {
    question: _sanitize_(entry.question, 500),
    answer: _sanitize_(entry.answer, 64),
    label: _sanitize_(entry.answerLabel, 200)
  };
}

function doGet(e) {
  return _jsonOutput_({
    ok: true,
    service: "upeak-participants",
    version: 3,
    sheet: SHEET_NAME,
    columns: HEADERS.length
  });
}

function doPost(e) {
  try {
    var data = _parsePayload_(e) || {};

    var sessionId = _sanitize_(data.sessionId, 64);
    var name = _sanitize_(data.name, 120);
    var phone = _sanitize_(data.phone, 32);
    var telegram = _normalizeTelegram_(data.telegram);
    var email = _normalizeEmail_(data.email);
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

    var survey = data.survey;
    var q1 = _readSurveyEntry_(survey, "q1");
    var q2 = _readSurveyEntry_(survey, "q2");
    var q3 = _readSurveyEntry_(survey, "q3");

    if (!q1.answer || !Q1_VALID[q1.answer]) {
      return _jsonOutput_({ ok: false, error: "survey_q1_required" });
    }
    if (!q2.answer || !Q2_VALID[q2.answer]) {
      return _jsonOutput_({ ok: false, error: "survey_q2_required" });
    }
    if (!q3.answer || !Q3_VALID[q3.answer]) {
      return _jsonOutput_({ ok: false, error: "survey_q3_required" });
    }

    // Derive contactType/contactValue. Prefer client-provided values, else infer.
    var contactType = _sanitize_(data.contactType, 16);
    var contactValue = _sanitize_(data.contactValue, 200);
    if (!contactType) {
      if (language === "en" && email) {
        contactType = "email";
        contactValue = email;
      } else if (telegram) {
        contactType = "telegram";
        contactValue = telegram;
      }
    } else if (!contactValue) {
      contactValue = contactType === "email" ? email : telegram;
    }

    var sheet = _getSheet_();
    var row = [
      new Date(),
      sessionId,
      name,
      phone,
      telegram,
      email,
      contactType,
      contactValue,
      language,
      sourcePage,
      userAgent,
      submittedAt,
      q1.question || Q1_TEXT_RU,
      q1.answer,
      q1.label,
      q2.question || Q2_TEXT_RU,
      q2.answer,
      q2.label,
      q3.question || Q3_TEXT_RU,
      q3.answer,
      q3.label,
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
