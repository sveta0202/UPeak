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
    var node = byId(id);
    return node ? Number(node.value) : 0;
  }

  function makeId() {
    return "task-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function sanitizeParticipantId(value) {
    return String(value || "").trim().toUpperCase();
  }

  function ensureSessionId() {
    if (state.sessionId) return state.sessionId;
    state.sessionId = "sess-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    saveState();
    return state.sessionId;
  }

  function requireVerifiedParticipantId() {
    if (participantIdLocked && state && state.participantId) return true;
    alert(t("planner.id.required") || "Сохраните «Мой ID», чтобы данные попадали в основную таблицу.");
    if (el.participantIdInput) el.participantIdInput.focus();
    updateSyncStatus("error");
    return false;
  }

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

  if (window.UpeakI18n && typeof window.UpeakI18n.onChange === "function") {
    window.UpeakI18n.onChange(function () {
      renderTasks();
      renderScheduled();
      updateFact();
      updateReadiness();
      updateDayStatus();
      updateSyncStatus(lastSyncStatus);
      refreshParticipantIdStatus();
      if (el.taskSubmitBtn) {
        el.taskSubmitBtn.textContent = editingTaskId ? t("planner.tasks.saveEdit") : t("planner.tasks.add");
      }
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

  function setParticipantIdLocked(locked) {
    participantIdLocked = !!locked;

    if (el.participantIdInput) {
      el.participantIdInput.readOnly = participantIdLocked;
      el.participantIdInput.disabled = false;
    }

    if (el.participantIdSaveBtn) {
      el.participantIdSaveBtn.disabled = participantIdLocked;
      el.participantIdSaveBtn.style.display = participantIdLocked ? "none" : "";
    }

    if (el.participantIdChangeBtn) {
      el.participantIdChangeBtn.disabled = false;
      el.participantIdChangeBtn.style.display = participantIdLocked ? "" : "none";
    }
  }

  function setParticipantIdStatus(kind, text) {
    if (!el.participantIdStatus) return;
    el.participantIdStatus.className = "planner-id-status";
    if (kind) el.participantIdStatus.classList.add("is-" + kind);
    el.participantIdStatus.textContent = text || "";
  }

  function refreshParticipantIdStatus() {
    if (!el.participantIdInput) return;

    if (participantIdLocked && state.participantId) {
      setParticipantIdStatus("success", t("planner.id.locked") || "ID зафиксирован. Нажмите «Изменить ID», чтобы поменять.");
    } else if (state.participantId) {
      setParticipantIdStatus("info", t("planner.id.empty") || "Введите ID участника.");
    } else {
      setParticipantIdStatus("info", t("planner.id.empty") || "Введите ID участника.");
    }

    setParticipantIdLocked(participantIdLocked);
  }

  function enableParticipantIdEditing() {
    participantIdLocked = false;
    saveState();
    setParticipantIdLocked(false);

    if (el.participantIdInput) {
      el.participantIdInput.readOnly = false;
      el.participantIdInput.focus();
      el.participantIdInput.select();
    }

    setParticipantIdStatus("info", t("planner.id.empty") || "Введите ID участника.");
    updateSyncStatus("idle");
  }

  function setupParticipantId() {
    if (!state.participantId) state.participantId = "";

    if (el.participantIdInput) {
      el.participantIdInput.value = state.participantId || "";
    }

    participantIdLocked = !!state.participantId;
    setParticipantIdLocked(participantIdLocked);
    refreshParticipantIdStatus();

    if (el.participantIdInput) {
      el.participantIdInput.addEventListener("input", function () {
        var normalized = sanitizeParticipantId(el.participantIdInput.value);
        if (normalized !== (state.participantId || "")) {
          participantIdLocked = false;
          state.participantId = normalized;
          saveState();
          refreshParticipantIdStatus();
        }
      });
    }

    if (el.participantIdForm) {
      el.participantIdForm.addEventListener("submit", function (event) {
        event.preventDefault();

        var participantId = sanitizeParticipantId(el.participantIdInput && el.participantIdInput.value);
        if (!participantId) {
          setParticipantIdStatus("error", t("planner.id.empty") || "Введите ID участника.");
          if (el.participantIdInput) el.participantIdInput.focus();
          return;
        }

        setParticipantIdStatus("info", t("planner.id.checking") || "Проверяем ID…");

        fetch(PARTICIPANT_LOOKUP_URL + "?id=" + encodeURIComponent(participantId), {
          method: "GET",
          headers: { "Accept": "application/json" }
        })
          .then(function (response) {
            return response.text().then(function (text) {
              var parsed = null;
              try { parsed = JSON.parse(text); } catch (_e) {}
              return { ok: response.ok, parsed: parsed, status: response.status };
            });
          })
          .then(function (result) {
            var exists = !!(result.parsed && result.parsed.exists);

            if (!result.ok) {
              participantIdLocked = false;
              refreshParticipantIdStatus();
              setParticipantIdStatus("error", t("planner.id.error") || "Не удалось проверить ID. Попробуйте позже.");
              return;
            }

            if (!exists) {
              participantIdLocked = false;
              state.participantId = participantId;
              saveState();
              setParticipantIdStatus("error", t("planner.id.notFound") || "Такой ID не найден в списке зарегистрированных участников.");
              refreshParticipantIdStatus();
              return;
            }

            state.participantId = participantId;
            participantIdLocked = true;
            saveState();
            setParticipantIdLocked(true);
            setParticipantIdStatus("success", t("planner.id.saved") || "ID сохранён. Данные синхронизируются под этим ID.");
            updateSyncStatus("success");
          })
          .catch(function () {
            participantIdLocked = false;
            refreshParticipantIdStatus();
            setParticipantIdStatus("error", t("planner.id.error") || "Не удалось проверить ID. Попробуйте позже.");
          });
      });
    }

    if (el.participantIdChangeBtn) {
      el.participantIdChangeBtn.addEventListener("click", function (event) {
        event.preventDefault();
        enableParticipantIdEditing();
      });
    }
  }

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
      el.taskTableBody.innerHTML =
        '<tr><td colspan="8" class="table-empty">' + (t("planner.tasks.empty") || "Пока нет задач на день") + '</td></tr>';
      return;
    }

    el.taskTableBody.innerHTML = state.tasks.map(function (task, index) {
      return [
        '<tr data-task-id="' + escapeHtml(task.id) + '">',
        '<td>' + (index + 1) + '</td>',
        '<td><input type="checkbox" class="task-done-toggle" data-id="' + escapeHtml(task.id) + '"' + (task.done ? ' checked' : '') + '></td>',
        '<td>' + escapeHtml(task.title) + (task.routine ? ' <span class="chip">' + escapeHtml(t("planner.tasks.routineChip") || "рутина") + '</span>' : '') + '</td>',
        '<td>' + escapeHtml(String(task.difficulty)) + '</td>',
        '<td>' + escapeHtml(String(task.urgency)) + '</td>',
        '<td>' + escapeHtml(String(task.duration)) + '</td>',
        '<td>' + escapeHtml(slotLabel(task.slotKey)) + '</td>',
        '<td>' +
          '<button type="button" class="task-edit-btn" data-id="' + escapeHtml(task.id) + '">' + escapeHtml(t("planner.tasks.edit") || "Редактировать") + '</button> ' +
          '<button type="button" class="task-delete-btn" data-id="' + escapeHtml(task.id) + '">' + escapeHtml(t("planner.tasks.delete") || "Удалить") + '</button> ' +
          '<button type="button" class="task-postpone-btn" data-id="' + escapeHtml(task.id) + '">' + escapeHtml(t("planner.tasks.postpone") || "Перенести на завтра") + '</button>' +
        '</td>',
        '</tr>'
      ].join("");
    }).join("");

    bindTaskRowActions();
  }

  function renderScheduled() {
    if (!el.scheduledTableBody) return;

    if (!state.scheduled.length) {
      el.scheduledTableBody.innerHTML =
        '<tr><td colspan="6" class="table-empty">' + (t("planner.scheduled.empty") || "Список запланированного пуст") + '</td></tr>';
      return;
    }

    el.scheduledTableBody.innerHTML = state.scheduled.map(function (task) {
      return [
        '<tr>',
        '<td>' + escapeHtml(task.title) + '</td>',
        '<td>' + escapeHtml(String(task.difficulty)) + '</td>',
        '<td>' + escapeHtml(String(task.urgency)) + '</td>',
        '<td>' + escapeHtml(String(task.duration)) + '</td>',
        '<td>' + escapeHtml(task.scheduledFor || "") + '</td>',
        '<td>' +
          '<button type="button" class="scheduled-restore-btn" data-id="' + escapeHtml(task.id) + '">' + escapeHtml(t("planner.scheduled.restore") || "Вернуть сегодня") + '</button> ' +
          '<button type="button" class="scheduled-delete-btn" data-id="' + escapeHtml(task.id) + '">' + escapeHtml(t("planner.scheduled.delete") || "Удалить") + '</button>' +
        '</td>',
        '</tr>'
      ].join("");
    }).join("");

    bindScheduledRowActions();
  }

  function bindTaskRowActions() {
    Array.prototype.forEach.call(document.querySelectorAll(".task-done-toggle"), function (node) {
      node.addEventListener("change", function () {
        if (!requireVerifiedParticipantId()) {
          node.checked = !node.checked;
          return;
        }

        var id = node.getAttribute("data-id");
        state.tasks = state.tasks.map(function (task) {
          return task.id === id ? Object.assign({}, task, { done: !!node.checked }) : task;
        });
        saveState();
        renderTasks();
        updateFact();
        sync("task_toggled", { id: id, done: !!node.checked });
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll(".task-edit-btn"), function (node) {
      node.addEventListener("click", function () {
        var id = node.getAttribute("data-id");
        startTaskEdit(id);
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll(".task-delete-btn"), function (node) {
      node.addEventListener("click", function () {
        if (!requireVerifiedParticipantId()) return;
        var id = node.getAttribute("data-id");
        state.tasks = state.tasks.filter(function (task) { return task.id !== id; });
        saveState();
        renderTasks();
        updateFact();
        sync("task_deleted", { id: id });
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll(".task-postpone-btn"), function (node) {
      node.addEventListener("click", function () {
        if (!requireVerifiedParticipantId()) return;
        var id = node.getAttribute("data-id");
        postponeTask(id);
      });
    });
  }

  function bindScheduledRowActions() {
    Array.prototype.forEach.call(document.querySelectorAll(".scheduled-restore-btn"), function (node) {
      node.addEventListener("click", function () {
        if (!requireVerifiedParticipantId()) return;
        var id = node.getAttribute("data-id");
        restoreScheduledTask(id);
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll(".scheduled-delete-btn"), function (node) {
      node.addEventListener("click", function () {
        if (!requireVerifiedParticipantId()) return;
        var id = node.getAttribute("data-id");
        state.scheduled = state.scheduled.filter(function (task) { return task.id !== id; });
        saveState();
        renderScheduled();
        sync("scheduled_deleted", { id: id });
      });
    });
  }

  function startTaskEdit(id) {
    var task = state.tasks.find(function (item) { return item.id === id; });
    if (!task) return;

    editingTaskId = id;
    byId("taskTitle").value = task.title || "";
    byId("taskDifficulty").value = Number(task.difficulty) || 3;
    byId("taskUrgency").value = Number(task.urgency) || 3;
    byId("taskDuration").value = Number(task.duration) || 30;
    byId("taskRoutine").checked = !!task.routine;

    if (el.taskSubmitBtn) el.taskSubmitBtn.textContent = t("planner.tasks.saveEdit") || "Сохранить изменения";
    if (el.cancelEditBtn) el.cancelEditBtn.hidden = false;
  }

  function resetTaskFormMode(form) {
    editingTaskId = null;
    if (form) form.reset();
    if (el.taskSubmitBtn) el.taskSubmitBtn.textContent = t("planner.tasks.add") || "Добавить задачу";
    if (el.cancelEditBtn) el.cancelEditBtn.hidden = true;
  }

  function postponeTask(id) {
    var task = state.tasks.find(function (item) { return item.id === id; });
    if (!task) return;

    state.tasks = state.tasks.filter(function (item) { return item.id !== id; });
    state.scheduled.push({
      id: task.id,
      title: task.title,
      difficulty: task.difficulty,
      urgency: task.urgency,
      duration: task.duration,
      routine: !!task.routine,
      scheduledFor: tomorrowISO(),
      addedAt: new Date().toISOString()
    });

    saveState();
    renderTasks();
    renderScheduled();
    updateFact();
    sync("scheduled_added", { id: id, scheduledFor: tomorrowISO() });
  }

  function restoreScheduledTask(id) {
    var item = state.scheduled.find(function (task) { return task.id === id; });
    if (!item) return;

    state.scheduled = state.scheduled.filter(function (task) { return task.id !== id; });
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

    saveState();
    renderTasks();
    renderScheduled();
    updateFact();
    sync("scheduled_restored", { id: id, date: today });
  }

  function slotLabel(slotKey) {
    return t(slotKey || SLOT_KEYS.none) || slotKey || "";
  }

  function comparePriority(a, b) {
    var pa = Number(a.urgency || 0) * 10 + Number(a.difficulty || 0);
    var pb = Number(b.urgency || 0) * 10 + Number(b.difficulty || 0);
    return pb - pa;
  }

  function compareTasksForDisplay(a, b) {
    var orderA = Number(a.order || 0);
    var orderB = Number(b.order || 0);
    return orderA - orderB;
  }

  function isRoutineTask(task) {
    return !!(task && task.routine);
  }

  function nextOrder() {
    if (!state.tasks.length) return 1;
    return Math.max.apply(null, state.tasks.map(function (task) {
      return Number(task.order || 0);
    })) + 1;
  }

  function parseTaskTitle(value) {
    return { title: String(value || "").trim() };
  }

  function calcReadiness(morning) {
    var sleepHours = Number(morning.sleepHours || 0);
    var sleepQuality = Number(morning.sleepQuality || 0);
    var energy = Number(morning.energy || 0);
    var wellbeing = Number(morning.wellbeing || 0);
    var stress = Number(morning.stress || 0);

    var score =
      Math.min(100, Math.max(0,
        sleepHours * 8 +
        sleepQuality * 10 +
        energy * 12 +
        wellbeing * 10 -
        stress * 8
      ));

    return Math.round(score);
  }

  function updateFact() {
    if (!el.factValue) return;
    var done = state.tasks.filter(function (task) { return task.done; }).length;
    var total = state.tasks.length;
    el.factValue.textContent = done + "/" + total + " " + (t("planner.evening.completed") || "выполнено");
  }

  function updateReadiness() {
    if (!el.readinessValue) return;
    el.readinessValue.textContent = String(state.readiness == null ? "—" : state.readiness);
  }

  function updateDayStatus() {
    if (!el.dayStatus) return;
    el.dayStatus.textContent = state.dayClosedAt
      ? (t("planner.evening.dayClosed") || "День закрыт")
      : (t("planner.evening.dayOpen") || "День не закрыт");
  }

  function updateSyncStatus(status) {
    lastSyncStatus = status;
    if (!el.syncStatus) return;

    var text = "";
    if (status === "syncing") text = t("planner.sync.syncing") || "Синхронизация…";
    else if (status === "success") text = t("planner.sync.success") || "Данные сохранены";
    else if (status === "error") text = t("planner.sync.error") || "Ошибка синхронизации";

    el.syncStatus.textContent = text;
    el.syncStatus.setAttribute("data-status", status || "idle");
  }

  function sync(eventType, payload) {
    if (!participantIdLocked || !state.participantId) {
      updateSyncStatus("idle");
      return Promise.resolve({ skipped: true });
    }

    updateSyncStatus("syncing");

    return fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "pulseburn-planner",
        eventType: eventType,
        timestamp: new Date().toISOString(),
        date: today,
        sessionId: ensureSessionId(),
        participantId: state.participantId || "",
        userName: state.participantId || "",
        language: document.documentElement.getAttribute("lang") || "ru",
        sourcePage: window.location.pathname || "/planner.html",
        readiness: state.readiness == null ? "" : state.readiness,
        tasksCount: Array.isArray(state.tasks) ? state.tasks.length : 0,
        doneCount: Array.isArray(state.tasks) ? state.tasks.filter(function (t) { return t.done; }).length : 0,
        scheduledCount: Array.isArray(state.scheduled) ? state.scheduled.length : 0,
        payload: payload || {}
      })
    })
      .then(function (response) {
        if (!response.ok) throw new Error("sync_failed");
        return response.json();
      })
      .then(function (data) {
        updateSyncStatus("success");
        return data;
      })
      .catch(function (error) {
        updateSyncStatus("error");
        throw error;
      });
  }

  function migrateSlots() {
    if (!Array.isArray(state.tasks)) state.tasks = [];
    if (!Array.isArray(state.scheduled)) state.scheduled = [];
  }

  function tomorrowISO() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        return Object.assign({
          morning: null,
          evening: null,
          readiness: null,
          tasks: [],
          scheduled: [],
          manualOrder: false,
          lastRoutineResetDate: "",
          dayClosedAt: "",
          participantId: "",
          sessionId: ""
        }, parsed || {});
      }
    } catch (_e) {}

    return {
      morning: null,
      evening: null,
      readiness: null,
      tasks: [],
      scheduled: [],
      manualOrder: false,
      lastRoutineResetDate: "",
      dayClosedAt: "",
      participantId: "",
      sessionId: ""
    };
  }

  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_e) {}
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