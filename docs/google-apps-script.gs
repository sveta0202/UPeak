var SPREADSHEET_ID = "PASTE_YOUR_SHEET_ID_HERE";
var SHARED_TOKEN = "PASTE_THE_SAME_SECRET_AS_IN_RAILWAY";

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(raw);

    if (!data.proxyToken || data.proxyToken !== SHARED_TOKEN) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var eventsSheet = getOrCreateSheet(ss, "events");
    var tasksSheet = getOrCreateSheet(ss, "tasks");

    ensureHeaders(eventsSheet, tasksSheet);

    eventsSheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.date || "",
      data.source || "pulseburn-planner",
      data.userName || "anonymous",
      data.eventType || "unknown",
      data.readiness || "",
      JSON.stringify(data.payload || {}),
      data.ip || "",
      data.userAgent || "",
      data.receivedAt || new Date().toISOString()
    ]);

    if (isTaskEvent(data.eventType)) {
      var p = data.payload || {};
      tasksSheet.appendRow([
        data.timestamp || new Date().toISOString(),
        data.date || "",
        data.source || "pulseburn-planner",
        data.userName || "anonymous",
        data.eventType || "unknown",
        p.id || "",
        p.title || "",
        String(Boolean(p.routine)),
        p.difficulty || "",
        p.urgency || "",
        p.duration || "",
        String(Boolean(p.done)),
        p.slot || "",
        data.receivedAt || new Date().toISOString()
      ]);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

function doGet() {
  return jsonResponse({ ok: true, service: "upeak-apps-script" });
}

function isTaskEvent(eventType) {
  return [
    "task_created",
    "task_edited",
    "task_deleted",
    "task_toggled"
  ].indexOf(String(eventType)) !== -1;
}

function getOrCreateSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders(eventsSheet, tasksSheet) {
  if (eventsSheet.getLastRow() === 0) {
    eventsSheet.appendRow([
      "timestamp",
      "date",
      "source",
      "userName",
      "eventType",
      "readiness",
      "payloadJson",
      "ip",
      "userAgent",
      "receivedAt"
    ]);
  }

  if (tasksSheet.getLastRow() === 0) {
    tasksSheet.appendRow([
      "timestamp",
      "date",
      "source",
      "userName",
      "eventType",
      "taskId",
      "title",
      "routine",
      "difficulty",
      "urgency",
      "duration",
      "done",
      "slot",
      "receivedAt"
    ]);
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}