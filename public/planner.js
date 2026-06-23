(function () {
  "use strict";

  var KEY = "pulseburn_planner_v3";
  var LEGACY_KEY = "pulseburn_planner_v2";
  var API_URL = "/api/events";
  var PARTICIPANT_LOOKUP_URL = "/api/participant/lookup";
  var today = new Date().toISOString().slice(0, 10);

  var state = loadState();

  var el = {
    readinessValue: byId("readinessValue"),
    factValue: byId("factValue"),
    taskTableBody: byId("taskTableBody"),
    scheduledTableBody: byId("scheduledTableBody"),
    dayStatus: byId("dayStatus"),
    taskSubmitBtn: byId("taskSubmitBtn"),
    cancelEditBtn: byId("cancelEditBtn"),
    syncStatus: byId("syncStatus"),
    participantIdForm: byId("participantIdForm"),
    participantIdInput: byId("participantIdInput"),
    participantIdSaveBtn: byId("participantIdSaveBtn"),
    participantIdChangeBtn: byId("participantIdChangeBtn"),
    participantIdStatus: byId("participantIdStatus")
  };

  var editingTaskId = null;
  var lastSyncStatus = "idle";

  // ID считается подтверждённым только после успешной проверки в таблице Participants.
  // Без него планировщик работает локально, но не отправляет данные в Google Sheets.
  var participantIdLocked = false;

  function t(key) {
    if (window.UpeakI18n && typeof window.UpeakI18n.t === "function") {
      return window.UpeakI18n.t(key);
    }
    return key;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function getNum(id) {
    var el = byId(id);
    return el ? Number(el.value) : 0;
  }

  function makeId() {
    return "task-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function sanitizeParticipantId(value) {
    return String(value || "").trim().toUpperCase();
  }

  function requireVerifiedParticipantId() {
    if (participantIdLocked && state && state.participantId) return true;
    alert(t("planner.participantId.required") || "Введите и подтвердите ID участника перед отправкой данных.");
    if (el.participantIdInput) el.participantIdInput.focus();
    updateSyncStatus("error");
    return false;
  }

  // Slot keys are stored canonically; localized labels come from i18n.
  var SLOT_KEYS = {
    morningRoutine: "planner.slot.morningRoutine",
    morningFocus: "planner.slot.morningFocus",
    dayOps: "planner.slot.dayOps",
    eveningLight: "planner.slot.eveningLight",
    none: "planner.slot.none",
    postpone: "planner.slot.postpone",
    simplify: "planner.slot.simplify"
  };

  migrateSlots();
  promoteScheduledForToday();
  renderTasks();
  renderScheduled();
  updateFact();
  updateReadiness();
  updateDayStatus();
  updateSyncStatus("idle");
  setupParticipantId();
  refreshParticipantIdStatus();

  if (window.UpeakI18n && typeof window.UpeakI18n.onChange === "function") {
    window.UpeakI18n.onChange(function () {
      renderTasks();
      renderScheduled();
      updateFact();
      updateReadiness();
      updateDayStatus();
      updateSyncStatus(lastSyncStatus);
      refreshParticipantIdStatus();
      el.taskSubmitBtn.textContent = editingTaskId ? t("planner.tasks.saveEdit") : t("planner.tasks.add");
    });
  }

  byId("morningForm").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!requireVerifiedParticipantId()) return;

    state.morning = {
      date: today,
      sleepHours: getNum("sleepHours"),
      sleepQuality: getNum("sleepQuality"),
      energy: getNum("energy"),
      wellbeing: getNum("wellbeing"),
      stress: getNum("stress"),
      note: byId("morningNote").value.trim()
    };

    state.readiness = calcReadiness(state.morning);
    activateDailyRoutine();
    promoteScheduledForToday();
    saveState();
    renderTasks();
    renderScheduled();
    updateFact();
    updateReadiness();
    sync("morning_checkin", state.morning);
  });

  byId("taskForm").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!requireVerifiedParticipantId()) return;

    var parsedTitle = parseTaskTitle(byId("taskTitle").value);
    var formTask = {
      title: parsedTitle.title,
      routine: byId("taskRoutine").checked,
      difficulty: getNum("taskDifficulty"),
      urgency: getNum("taskUrgency"),
      duration: getNum("taskDuration")
    };

    if (!formTask.title) {
      alert(t("planner.alerts.titleRequired"));
      return;
    }

    if (editingTaskId) {
      state.tasks = state.tasks.map(function (task) {
        if (task.id !== editingTaskId) return task;
        var nextSlotKey = formTask.routine
          ? SLOT_KEYS.morningRoutine
          : (task.slotKey === SLOT_KEYS.morningRoutine ? SLOT_KEYS.none : task.slotKey);

        return Object.assign({}, task, formTask, { slotKey: nextSlotKey });
      });

      sync("task_edited", Object.assign({ id: editingTaskId }, formTask));
      resetTaskFormMode(event.target);
    } else {
      var task = Object.assign({
        id: makeId(),
        done: false,
        order: nextOrder(),
        slotKey: formTask.routine ? SLOT_KEYS.morningRoutine : SLOT_KEYS.none
      }, formTask);

      state.tasks.push(task);
      event.target.reset();
      sync("task_created", task);
    }

    saveState();
    renderTasks();
    updateFact();
  });

  el.cancelEditBtn.addEventListener("click", function () {
    resetTaskFormMode(byId("taskForm"));
  });

  byId("planBtn").addEventListener("click", function () {
    if (!requireVerifiedParticipantId()) return;

    var moved = distributeTasks();
    saveState();
    renderTasks();
    renderScheduled();
    updateFact();

    sync("plan_generated", {
      readiness: state.readiness,
      movedToScheduled: moved,
      tasks: state.tasks,
      scheduled: state.scheduled
    });

    if (moved > 0) {
      sync("scheduled_added", { count: moved, scheduledFor: tomorrowISO() });
    }
  });

  byId("eveningForm").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!requireVerifiedParticipantId()) return;

    state.evening = {
      date: today,
      productivity: getNum("productivity"),
      fatigue: getNum("fatigue"),
      note: byId("eveningNote").value.trim(),
      completed: state.tasks.filter(function (t) { return t.done; }).length,
      total: state.tasks.length
    };

    state.dayClosedAt = new Date().toISOString();
    saveState();
    updateFact();
    updateDayStatus();
    sync("evening_checkout", state.evening);
  });

  function setupParticipantId() {
    if (!el.participantIdForm || !el.participantIdInput) return;

    if (state.participantId) {
      el.participantIdInput.value = state.participantId;
      participantIdLocked = !!state.participantIdVerified;
      setParticipantInputLocked(participantIdLocked);
    }

    el.participantIdForm.addEventListener("submit", function (event) {
      event.preventDefault();
      verifyAndSaveParticipantId();
    });

    if (el.participantIdSaveBtn) {
      el.participantIdSaveBtn.addEventListener("click", function (event) {
        event.preventDefault();
        verifyAndSaveParticipantId();
      });
    }

    if (el.participantIdChangeBtn) {
      el.participantIdChangeBtn.addEventListener("click", function (event) {
        event.preventDefault();
        participantIdLocked = false;
        state.participantIdVerified = false;
        setParticipantInputLocked(false);
        refreshParticipantIdStatus("idle");
        saveState();
        el.participantIdInput.focus();
      });
    }
  }

  function setParticipantInputLocked(locked) {
    if (!el.participantIdInput) return;
    el.participantIdInput.readOnly = !!locked;
    if (el.participantIdSaveBtn) el.participantIdSaveBtn.disabled = !!locked;
    if (el.participantIdChangeBtn) el.participantIdChangeBtn.disabled = !locked;
  }

  function refreshParticipantIdStatus(mode, text) {
    if (!el.participantIdStatus) return;

    var status = mode || (participantIdLocked ? "ok" : "idle");
    el.participantIdStatus.className = "participant-id-status";

    if (status === "ok") {
      el.participantIdStatus.classList.add("is-success");
      el.participantIdStatus.textContent = text || (t("planner.participantId.verified") || "ID подтверждён");
      return;
    }

    if (status === "loading") {
      el.participantIdStatus.classList.add("is-info");
      el.participantIdStatus.textContent = text || (t("planner.participantId.checking") || "Проверяем ID…");
      return;
    }

    if (status === "error") {
      el.participantIdStatus.classList.add("is-error");
      el.participantIdStatus.textContent = text || (t("planner.participantId.notFound") || "ID не найден");
      return;
    }

    el.participantIdStatus.textContent = text || (t("planner.participantId.idle") || "Введите ID участника");
  }

  function verifyAndSaveParticipantId() {
    var raw = sanitizeParticipantId(el.participantIdInput && el.participantIdInput.value);
    if (!raw) {
      participantIdLocked = false;
      state.participantId = "";
      state.participantIdVerified = false;
      saveState();
      refreshParticipantIdStatus("error", t("planner.participantId.required") || "Введите ID участника");
      return;
    }

    refreshParticipantIdStatus("loading");
    if (el.participantIdSaveBtn) el.participantIdSaveBtn.disabled = true;

    fetch(PARTICIPANT_LOOKUP_URL + "?id=" + encodeURIComponent(raw), {
      method: "GET",
      headers: { "Accept": "application/json" }
    })
      .then(function (response) {
        return response.text().then(function (text) {
          var parsed = {};
          try { parsed = JSON.parse(text); } catch (_e) {}
          return { ok: response.ok, parsed: parsed };
        });
      })
      .then(function (result) {
        if (result.ok && result.parsed && result.parsed.exists) {
          state.participantId = raw;
          state.participantIdVerified = true;
          participantIdLocked = true;
          saveState();
          if (el.participantIdInput) el.participantIdInput.value = raw;
          setParticipantInputLocked(true);
          refreshParticipantIdStatus("ok");
          updateSyncStatus("idle");
        } else {
          participantIdLocked = false;
          state.participantId = raw;
          state.participantIdVerified = false;
          saveState();
          setParticipantInputLocked(false);
          refreshParticipantIdStatus("error", t("planner.participantId.notFound") || "ID не найден в таблице Participants");
        }
      })
      .catch(function () {
        participantIdLocked = false;
        state.participantIdVerified = false;
        saveState();
        setParticipantInputLocked(false);
        refreshParticipantIdStatus("error", t("planner.participantId.networkError") || "Не удалось проверить ID");
      })
      .then(function () {
        if (el.participantIdSaveBtn && !participantIdLocked) {
          el.participantIdSaveBtn.disabled = false;
        }
      });
  }

  // Распределение по состоянию: учитываем срочность, важность, сложность и длительность.
  function distributeTasks() {
    var readiness = state.readiness || 50;
    var budget = readiness < 40 ? 7 : readiness < 70 ? 11 : 16;
    var slotKeys = [SLOT_KEYS.morningFocus, SLOT_KEYS.dayOps, SLOT_KEYS.eveningLight];
    var sorted = state.tasks.slice().sort(comparePriority);
    var remaining = budget;
    var movedToScheduled = 0;
    var carry = [];
    var kept = [];

    sorted.forEach(function (task) {
      var load = task.difficulty + Math.ceil(task.duration / 45);

      if (isRoutineTask(task)) {
        task.slotKey = SLOT_KEYS.morningRoutine;
        remaining -= load;
        kept.push(task);
        return;
      }

      var isUrgent = Number(task.urgency) >= 4;
      var tooHeavy = (readiness < 45 && task.difficulty >= 4) || task.duration >= 180;
      var noBudget = remaining < load;

      if (!isUrgent && (noBudget || tooHeavy)) {
        carry.push(task);
        return;
      }

      if (readiness < 45 && task.difficulty >= 4 && !isUrgent) {
        task.slotKey = SLOT_KEYS.simplify;
      } else if (load >= 6) {
        task.slotKey = slotKeys[0];
      } else if (load >= 4) {
        task.slotKey = slotKeys[1];
      } else {
        task.slotKey = slotKeys[2];
      }

      remaining -= load;
      kept.push(task);
    });

    state.manualOrder = false;
    kept.sort(compareTasksForDisplay);
    kept.forEach(function (task, idx) {
      task.order = idx;
    });

    var tomorrow = tomorrowISO();
    carry.forEach(function (task) {
      state.scheduled.push({
        id: task.id,
        title: task.title,
        difficulty: task.difficulty,
        urgency: task.urgency,
        duration: task.duration,
        routine: !!task.routine,
        scheduledFor: tomorrow,
        addedAt: new Date().toISOString()
      });
      movedToScheduled += 1;
    });

    state.tasks = kept;
    return movedToScheduled;
  }

  function activateDailyRoutine() {
    if (state.lastRoutineResetDate === today) return;
    var routineCount = 0;

    state.tasks = state.tasks.map(function (task) {
      if (!isRoutineTask(task)) return task;
      routineCount += 1;
      return Object.assign({}, task, { done: false, slotKey: SLOT_KEYS.morningRoutine });
    });

    state.lastRoutineResetDate = today;

    if (routineCount > 0) {
      sync("routine_activated", { count: routineCount });
    }
  }

  function promoteScheduledForToday() {
    if (!Array.isArray(state.scheduled) || !state.scheduled.length) return;

    var stillScheduled = [];
    var restored = [];

    state.scheduled.forEach(function (item) {
      if (item && item.scheduledFor && item.scheduledFor <= today) {
        restored.push(item);
      } else {
        stillScheduled.push(item);
      }
    });

    if (!restored.length) return;

    restored.forEach(function (item) {
      state.tasks.push({
        id: item.id || makeId(),
        title: item.title,
        difficulty: Number(item.difficulty) || 3,
        urgency: Number(item.urgency) || 3,
        duration: Number(item.duration) || 30,
        routine: !!item.routine,
        done: false,
        order: nextOrder(),
        slotKey: item.routine ? SLOT_KEYS.morningRoutine : SLOT_KEYS.none
      });
    });

    state.scheduled = stillScheduled;
    saveState();
    sync("scheduled_restored", { count: restored.length, date: today });
  }

  function renderTasks() {
    if (!el.taskTableBody) return;

    if (!state.tasks.length) {
      el.taskTableBody.innerHTML = "";
      return;
    }

    var tasks = state.manualOrder ? state.tasks.slice().sort(compareByOrder) : state.tasks.slice().sort(compareTasksForDisplay);

    el.taskTableBody.innerHTML = tasks.map(function (task, index) {
      return [
        "<tr data-task-id=\"" + escapeHtml(task.id) + "\">",
        "<td>" + (index + 1) + "</td>",
        "<td><input type=\"checkbox\" class=\"task-toggle\" " + (task.done ? "checked" : "") + " aria-label=\"done\"></td>",
        "<td>" + escapeHtml(task.title) + "</td>",
        "<td>" + escapeHtml(String(task.difficulty)) + "</td>",
        "<td>" + escapeHtml(String(task.urgency)) + "</td>",
        "<td>" + escapeHtml(String(task.duration)) + "</td>",
        "<td>" + escapeHtml(t(task.slotKey || SLOT_KEYS.none)) + "</td>",
        "<td>",
        "<button type=\"button\" class=\"task-edit\" data-task-action=\"edit\">" + escapeHtml(t("planner.tasks.edit") || "Изменить") + "</button> ",
        "<button type=\"button\" class=\"task-delete\" data-task-action=\"delete\">" + escapeHtml(t("planner.tasks.delete") || "Удалить") + "</button>",
        "</td>",
        "</tr>"
      ].join("");
    }).join("");

    Array.prototype.forEach.call(el.taskTableBody.querySelectorAll(".task-toggle"), function (checkbox) {
      checkbox.addEventListener("change", onToggleTask);
    });

    Array.prototype.forEach.call(el.taskTableBody.querySelectorAll("[data-task-action=\"edit\"]"), function (btn) {
      btn.addEventListener("click", onEditTask);
    });

    Array.prototype.forEach.call(el.taskTableBody.querySelectorAll("[data-task-action=\"delete\"]"), function (btn) {
      btn.addEventListener("click", onDeleteTask);
    });
  }

  function renderScheduled() {
    if (!el.scheduledTableBody) return;

    if (!state.scheduled.length) {
      el.scheduledTableBody.innerHTML = "";
      return;
    }

    el.scheduledTableBody.innerHTML = state.scheduled.map(function (task) {
      return [
        "<tr data-task-id=\"" + escapeHtml(task.id) + "\">",
        "<td>" + escapeHtml(task.title) + "</td>",
        "<td>" + escapeHtml(String(task.difficulty)) + "</td>",
        "<td>" + escapeHtml(String(task.urgency)) + "</td>",
        "<td>" + escapeHtml(String(task.duration)) + "</td>",
        "<td>" + escapeHtml(task.scheduledFor || "") + "</td>",
        "<td><button type=\"button\" class=\"scheduled-delete\">" + escapeHtml(t("planner.tasks.delete") || "Удалить") + "</button></td>",
        "</tr>"
      ].join("");
    }).join("");

    Array.prototype.forEach.call(el.scheduledTableBody.querySelectorAll(".scheduled-delete"), function (btn) {
      btn.addEventListener("click", onDeleteScheduled);
    });
  }

  function onToggleTask(event) {
    if (!requireVerifiedParticipantId()) {
      event.target.checked = !event.target.checked;
      return;
    }

    var row = event.target.closest("tr");
    if (!row) return;
    var id = row.getAttribute("data-task-id");

    state.tasks = state.tasks.map(function (task) {
      if (task.id !== id) return task;
      return Object.assign({}, task, { done: !!event.target.checked });
    });

    saveState();
    updateFact();
    updateDayStatus();
    sync("task_toggled", {
      id: id,
      done: !!event.target.checked
    });
  }

  function onEditTask(event) {
    var row = event.target.closest("tr");
    if (!row) return;
    var id = row.getAttribute("data-task-id");
    var task = state.tasks.find(function (item) { return item.id === id; });
    if (!task) return;

    editingTaskId = id;
    byId("taskTitle").value = task.title || "";
    byId("taskDifficulty").value = task.difficulty || 3;
    byId("taskUrgency").value = task.urgency || 3;
    byId("taskDuration").value = task.duration || 30;
    byId("taskRoutine").checked = !!task.routine;

    if (el.taskSubmitBtn) el.taskSubmitBtn.textContent = t("planner.tasks.saveEdit");
    if (el.cancelEditBtn) el.cancelEditBtn.hidden = false;
  }

  function onDeleteTask(event) {
    if (!requireVerifiedParticipantId()) return;

    var row = event.target.closest("tr");
    if (!row) return;
    var id = row.getAttribute("data-task-id");

    var removed = null;
    state.tasks = state.tasks.filter(function (task) {
      if (task.id === id) {
        removed = task;
        return false;
      }
      return true;
    });

    saveState();
    renderTasks();
    updateFact();

    if (removed) {
      sync("task_deleted", removed);
    }
  }

  function onDeleteScheduled(event) {
    if (!requireVerifiedParticipantId()) return;

    var row = event.target.closest("tr");
    if (!row) return;
    var id = row.getAttribute("data-task-id");

    var removed = null;
    state.scheduled = state.scheduled.filter(function (task) {
      if (task.id === id) {
        removed = task;
        return false;
      }
      return true;
    });

    saveState();
    renderScheduled();

    if (removed) {
      sync("scheduled_deleted", removed);
    }
  }

  function resetTaskFormMode(form) {
    editingTaskId = null;
    if (form) form.reset();
    if (el.taskSubmitBtn) el.taskSubmitBtn.textContent = t("planner.tasks.add");
    if (el.cancelEditBtn) el.cancelEditBtn.hidden = true;
  }

  function calcReadiness(morning) {
    if (!morning) return 50;

    var sleepHours = Number(morning.sleepHours) || 0;
    var sleepQuality = Number(morning.sleepQuality) || 0;
    var energy = Number(morning.energy) || 0;
    var wellbeing = Number(morning.wellbeing) || 0;
    var stress = Number(morning.stress) || 0;

    var sleepPart = Math.min(100, Math.max(0, (sleepHours / 8) * 100));
    var qualityPart = (sleepQuality / 5) * 100;
    var energyPart = (energy / 5) * 100;
    var wellbeingPart = (wellbeing / 5) * 100;
    var stressPenalty = ((5 - stress) / 5) * 100;

    return Math.round(
      sleepPart * 0.2 +
      qualityPart * 0.2 +
      energyPart * 0.25 +
      wellbeingPart * 0.2 +
      stressPenalty * 0.15
    );
  }

  function updateReadiness() {
    if (!el.readinessValue) return;
    el.readinessValue.textContent = String(state.readiness || 0);
  }

  function updateFact() {
    if (!el.factValue) return;
    var done = state.tasks.filter(function (task) { return task.done; }).length;
    var total = state.tasks.length;
    el.factValue.textContent = done + "/" + total;
  }

  function updateDayStatus() {
    if (!el.dayStatus) return;

    if (state.dayClosedAt) {
      el.dayStatus.textContent = t("planner.day.closed") || "День закрыт";
      return;
    }

    if (!state.tasks.length) {
      el.dayStatus.textContent = t("planner.day.empty") || "Добавьте задачи";
      return;
    }

    var done = state.tasks.filter(function (task) { return task.done; }).length;
    if (done === state.tasks.length) {
      el.dayStatus.textContent = t("planner.day.done") || "Все задачи выполнены";
    } else {
      el.dayStatus.textContent = t("planner.day.inProgress") || "День в процессе";
    }
  }

  function updateSyncStatus(status) {
    lastSyncStatus = status;
    if (!el.syncStatus) return;

    el.syncStatus.className = "sync-status";

    if (status === "ok") {
      el.syncStatus.classList.add("is-success");
      el.syncStatus.textContent = t("planner.sync.ok") || "Данные отправлены";
      return;
    }

    if (status === "syncing") {
      el.syncStatus.classList.add("is-info");
      el.syncStatus.textContent = t("planner.sync.syncing") || "Синхронизация…";
      return;
    }

    if (status === "error") {
      el.syncStatus.classList.add("is-error");
      el.syncStatus.textContent = t("planner.sync.error") || "Ошибка синхронизации";
      return;
    }

    if (!participantIdLocked) {
      el.syncStatus.textContent = t("planner.sync.waitingId") || "Введите ID участника для отправки данных";
      return;
    }

    el.syncStatus.textContent = t("planner.sync.idle") || "Готово к синхронизации";
  }

  function sync(eventType, payload) {
    if (!participantIdLocked || !state.participantId) {
      updateSyncStatus("error");
      return Promise.resolve({ ok: false, skipped: true, error: "participantId_required" });
    }

    updateSyncStatus("syncing");

    var body = {
      source: "pulseburn_planner",
      eventType: eventType,
      timestamp: new Date().toISOString(),
      date: today,
      sessionId: state.sessionId,
      participantId: state.participantId || "",
      userName: state.participantId || "",
      language: getLang(),
      sourcePage: window.location.pathname || "/planner.html",
      readiness: state.readiness == null ? "" : state.readiness,
      tasksCount: state.tasks.length,
      doneCount: state.tasks.filter(function (task) { return task.done; }).length,
      scheduledCount: state.scheduled.length,
      payload: payload || {}
    };

    return fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (response) {
        return response.text().then(function (text) {
          var parsed = {};
          try { parsed = JSON.parse(text); } catch (_e) {}
          return { ok: response.ok, parsed: parsed };
        });
      })
      .then(function (result) {
        updateSyncStatus(result.ok ? "ok" : "error");
        return result;
      })
      .catch(function () {
        updateSyncStatus("error");
        return { ok: false, error: "network_error" };
      });
  }

  function getLang() {
    if (window.UpeakI18n && typeof window.UpeakI18n.getLang === "function") {
      return window.UpeakI18n.getLang();
    }
    return document.documentElement.getAttribute("lang") || "ru";
  }

  function loadState() {
    var base = {
      sessionId: generateSessionId(),
      participantId: "",
      participantIdVerified: false,
      morning: null,
      evening: null,
      readiness: 0,
      tasks: [],
      scheduled: [],
      manualOrder: false,
      lastRoutineResetDate: "",
      dayClosedAt: ""
    };

    try {
      var raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
      if (!raw) return base;
      var parsed = JSON.parse(raw);
      return Object.assign(base, parsed || {});
    } catch (_e) {
      return base;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_e) {}
  }

  function generateSessionId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch (_e) {}
    return "sid-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function nextOrder() {
    if (!state.tasks.length) return 0;
    return Math.max.apply(null, state.tasks.map(function (task) {
      return Number(task.order) || 0;
    })) + 1;
  }

  function comparePriority(a, b) {
    var ap = (Number(b.urgency) || 0) - (Number(a.urgency) || 0);
    if (ap !== 0) return ap;
    var ad = (Number(a.difficulty) || 0) - (Number(b.difficulty) || 0);
    if (ad !== 0) return ad;
    return (Number(a.duration) || 0) - (Number(b.duration) || 0);
  }

  function compareTasksForDisplay(a, b) {
    var slotOrder = {};
    slotOrder[SLOT_KEYS.morningRoutine] = 0;
    slotOrder[SLOT_KEYS.morningFocus] = 1;
    slotOrder[SLOT_KEYS.dayOps] = 2;
    slotOrder[SLOT_KEYS.eveningLight] = 3;
    slotOrder[SLOT_KEYS.simplify] = 4;
    slotOrder[SLOT_KEYS.none] = 5;

    var sa = slotOrder[a.slotKey] == null ? 99 : slotOrder[a.slotKey];
    var sb = slotOrder[b.slotKey] == null ? 99 : slotOrder[b.slotKey];
    if (sa !== sb) return sa - sb;

    var pr = comparePriority(a, b);
    if (pr !== 0) return pr;

    return (Number(a.order) || 0) - (Number(b.order) || 0);
  }

  function compareByOrder(a, b) {
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  }

  function isRoutineTask(task) {
    return !!(task && task.routine);
  }

  function parseTaskTitle(value) {
    return { title: String(value || "").trim() };
  }

  function tomorrowISO() {
    var date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  function migrateSlots() {
    if (!Array.isArray(state.tasks)) state.tasks = [];
    if (!Array.isArray(state.scheduled)) state.scheduled = [];
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();