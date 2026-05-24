// ID таблицы из URL:
// https://docs.google.com/spreadsheets/d/<THIS_PART>/edit
var SPREADSHEET_ID = "1bHzW_tvbNZY33tEJhdPqsNDbDL37OnYUzowlwPhMPhI";

function doPost(e) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var raw = e.postData && e.postData.contents ? e.postData.contents : "{}";
  var data = JSON.parse(raw);

  var eventsSheet = getOrCreateSheet_(ss, "events");
  var tasksSheet = getOrCreateSheet_(ss, "tasks");

  if (eventsSheet.getLastRow() === 0) {
    eventsSheet.appendRow(["timestamp", "date", "userName", "eventType", "readiness", "payload_json"]);
  }
  if (tasksSheet.getLastRow() === 0) {
    tasksSheet.appendRow(["timestamp", "date", "userName", "taskId", "title", "difficulty", "urgency", "duration", "done", "slot"]);
  }

  eventsSheet.appendRow([
    data.timestamp || new Date().toISOString(),
    data.date || "",
    data.userName || "anonymous",
    data.eventType || "unknown",
    data.readiness || "",
    JSON.stringify(data.payload || {})
  ]);

  if (data.eventType === "task_created" || data.eventType === "task_toggled") {
    var p = data.payload || {};
    tasksSheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.date || "",
      data.userName || "anonymous",
      p.id || "",
      p.title || "",
      p.difficulty || "",
      p.urgency || "",
      p.duration || "",
      String(p.done || false),
      p.slot || ""
    ]);
  }

  return jsonResponse_({ ok: true });
}

function doGet() {
  return jsonResponse_({ ok: true, service: "upeak_planner_webhook" });
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
