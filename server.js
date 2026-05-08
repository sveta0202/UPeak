const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const APPS_SCRIPT_SHARED_TOKEN = process.env.APPS_SCRIPT_SHARED_TOKEN || "";

const ALLOWED_EVENT_TYPES = new Set([
  "morning_checkin",
  "task_created",
  "task_edited",
  "task_deleted",
  "task_toggled",
  "plan_generated",
  "routine_activated",
  "evening_checkout"
]);

app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public")));

function sanitizeString(value, max = 5000) {
  if (value == null) return "";
  return String(value).trim().slice(0, max);
}

function sanitizeEvent(input) {
  return {
    source: sanitizeString(input.source || "pulseburn-planner", 100),
    eventType: sanitizeString(input.eventType, 100),
    timestamp: sanitizeString(input.timestamp, 100),
    date: sanitizeString(input.date, 50),
    userName: sanitizeString(input.userName || "anonymous", 120),
    readiness: Number.isFinite(Number(input.readiness)) ? Number(input.readiness) : null,
    payload: typeof input.payload === "object" && input.payload !== null ? input.payload : {}
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "upeak-railway-proxy" });
});

app.post("/api/events", async (req, res) => {
  try {
    if (!APPS_SCRIPT_URL) {
      return res.status(500).json({ ok: false, error: "APPS_SCRIPT_URL is not configured" });
    }

    const event = sanitizeEvent(req.body || {});

    if (!event.eventType || !ALLOWED_EVENT_TYPES.has(event.eventType)) {
      return res.status(400).json({ ok: false, error: "Invalid eventType" });
    }

    if (!event.timestamp || !event.date) {
      return res.status(400).json({ ok: false, error: "timestamp and date are required" });
    }

    const body = {
      ...event,
      proxyToken: APPS_SCRIPT_SHARED_TOKEN,
      receivedAt: new Date().toISOString(),
      ip: req.ip || "",
      userAgent: sanitizeString(req.get("user-agent"), 500)
    };

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "Apps Script upstream error",
        status: response.status,
        body: text.slice(0, 500)
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_e) {
      parsed = { raw: text };
    }

    return res.status(200).json({ ok: true, upstream: parsed });
  } catch (error) {
    console.error("POST /api/events failed", error);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/planner", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "planner.html"));
});

app.get("/participate", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "participate.html"));
});

app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});