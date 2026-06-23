(function () {
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
      el.taskSubmitBtn.textContent = editingTaskId ? t("planner.tasks.saveEdit") : t("planner.tasks.add");
    });
  }

  byId("morningForm").addEventListener("submit", function (event) {
    event.preventDefault();

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

    if (!requireVerifiedParticipantId()) return;
    sync("morning_checkin", state.morning);
  });

  byId("taskForm").addEventListener("submit", function (event) {
    event.preventDefault();

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

        return Object.assign({}, task, formTask, {
          slotKey: nextSlotKey
        });
      });

      if (requireVerifiedParticipantId()) {
        sync("task_edited", Object.assign({ id: editingTaskId }, formTask));
      }

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

      if (requireVerifiedParticipantId()) {
        sync("task_created", task);
      }
    }

    saveState();
    renderTasks();
    updateFact();
  });

  el.cancelEditBtn.addEventListener("click", function () {
    resetTaskFormMode(byId("taskForm"));
  });

  byId("planBtn").addEventListener("click", function () {
    var moved = distributeTasks();
    saveState();
    renderTasks();
    renderScheduled();
    updateFact();

    if (!requireVerifiedParticipantId()) return;

    sync("plan_generated", {
      readiness: state.readiness,
      movedToScheduled: moved,
      tasks: state.tasks,
      scheduled: state.scheduled
    });

    if (moved > 0) {
      sync("scheduled_added", {
        count: moved,
        scheduledFor: tomorrowISO()
      });
    }
  });

  byId("eveningForm").addEventListener("submit", function (event) {
    event.preventDefault();

    state.evening = {
      date: today,
      productivity: getNum("productivity"),
      fatigue: getNum("fatigue"),
      note: byId("eveningNote").value.trim(),
      completed: state.tasks.filter(function (task) { return task.done; }).length,
      total: state.tasks.length
    };

    state.dayClosedAt = new Date().toISOString();
    saveState();
    updateFact();
    updateDayStatus();

    if (!requireVerifiedParticipantId()) return;
    sync("evening_checkout", state.evening);
  });

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
      var load = Number(task.difficulty || 0) + Math.ceil(Number(task.duration || 0) / 45);

      if (isRoutineTask(task)) {
        task.slotKey = SLOT_KEYS.morningRoutine;
        remaining -= load;
        kept.push(task);
        return;
      }

      var isUrgent = Number(task.urgency) >= 4;
      var tooHeavy = (readiness < 45 && Number(task.difficulty) >= 4) || Number(task.duration) >= 180;
      var noBudget = remaining < load;

      if (!isUrgent && (noBudget || tooHeavy)) {
        carry.push(task);
        return;
      }

      if (readiness < 45 && Number(task.difficulty) >= 4 && !isUrgent) {
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
      return Object.assign({}, task, {
        done: false,
        slotKey: SLOT_KEYS.morningRoutine
      });
    });

    state.lastRoutineResetDate = today;

    if (routineCount > 0 && requireVerifiedParticipantId(false)) {
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

    if (requireVerifiedParticipantId(false)) {
      sync("scheduled_restored", { count: restored.length, date: today });
    }
  }

  function renderTasks() {
    if (!state.tasks.length) {
      el.taskTableBody.innerHTML =
        '<tr><td colspan="8" class="muted">' + escapeHtml(t("planner.tasks.empty")) + "</td></tr>";
      return;
    }

    var sortedTasks = state.tasks.slice().sort(compareTasksForDisplay);

    el.taskTableBody.innerHTML = sortedTasks.map(function (task, index) {
      var slotLabel = t(task.slotKey || SLOT_KEYS.none);
      var title = escapeHtml(task.title || "");
      var slot = escapeHtml(slotLabel || "");
      var routineChip = isRoutineTask(task)
        ? '<span class="routine-chip">' + escapeHtml(t("planner.tasks.routineChip")) + "</span>"
        : "";

      return [
        '<tr class="task-row" data-task-id="' + escapeAttr(task.id) + '">',
          '<td class="order-cell">',
            '<span class="drag-handle" title="' + escapeAttr(t("planner.tasks.dragHandle")) + '">⋮⋮</span>',
            '<span class="order-index">' + (index + 1) + "</span>",
          "</td>",
          '<td><input type="checkbox" class="task-toggle" data-task-id="' + escapeAttr(task.id) + '"' + (task.done ? " checked" : "") + "></td>",
          "<td>",
            '<span class="task-title' + (task.done ? " task-done" : "") + '">',
              title,
              routineChip,
            "</span>",
          "</td>",
          "<td>" + Number(task.difficulty || 0) + "</td>",
          "<td>" + Number(task.urgency || 0) + "</td>",
          "<td>" + Number(task.duration || 0) + "</td>",
          '<td><span class="slot-chip">' + slot + "</span></td>",
          '<td class="actions-cell">',
            '<div class="table-actions">',
              '<button type="button" class="table-action edit" data-action="edit" data-task-id="' + escapeAttr(task.id) + '">',
                escapeHtml(t("planner.tasks.edit")),
              "</button>",
              '<button type="button" class="table-action danger" data-action="delete" data-task-id="' + escapeAttr(task.id) + '">',
                escapeHtml(t("planner.tasks.delete")),
              "</button>",
              '<button type="button" class="table-action ghost" data-action="postpone" data-task-id="' + escapeAttr(task.id) + '">',
                escapeHtml(t("planner.tasks.postpone")),
              "</button>",
            "</div>",
          "</td>",
        "</tr>"
      ].join("");
    }).join("");

    bindTaskRowActions();
    bindTaskDragAndDrop();
  }

  function renderScheduled() {
    if (!state.scheduled.length) {
      el.scheduledTableBody.innerHTML =
        '<tr><td colspan="6" class="muted">' + escapeHtml(t("planner.scheduled.empty")) + "</td></tr>";
      return;
    }

    el.scheduledTableBody.innerHTML = state.scheduled.map(function (task) {
      return [
        '<tr data-scheduled-id="' + escapeAttr(task.id || "") + '">',
          "<td>" + escapeHtml(task.title || "") + "</td>",
          "<td>" + Number(task.difficulty || 0) + "</td>",
          "<td>" + Number(task.urgency || 0) + "</td>",
          "<td>" + Number(task.duration || 0) + "</td>",
          "<td>" + escapeHtml(task.scheduledFor || "") + "</td>",
          '<td class="actions-cell">',
            '<div class="table-actions">',
              '<button type="button" class="table-action edit" data-scheduled-action="restore" data-scheduled-id="' + escapeAttr(task.id || "") + '">',
                escapeHtml(t("planner.scheduled.restore")),
              "</button>",
              '<button type="button" class="table-action danger" data-scheduled-action="delete" data-scheduled-id="' + escapeAttr(task.id || "") + '">',
                escapeHtml(t("planner.scheduled.delete")),
              "</button>",
            "</div>",
          "</td>",
        "</tr>"
      ].join("");
    }).join("");

    bindScheduledActions();
  }

  function bindTaskRowActions() {
    el.taskTableBody.querySelectorAll("[data-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var action = button.getAttribute("data-action");
        var id = button.getAttribute("data-task-id");
        if (!id) return;

        if (action === "edit") {
          startTaskEdit(id);
          return;
        }
        if (action === "delete") {
          deleteTask(id);
          return;
        }
        if (action === "postpone") {
          postponeTask(id);
        }
      });
    });

    el.taskTableBody.querySelectorAll(".task-toggle").forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        toggleTask(checkbox.getAttribute("data-task-id"));
      });
    });
  }

  function bindScheduledActions() {
    el.scheduledTableBody.querySelectorAll("[data-scheduled-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var action = button.getAttribute("data-scheduled-action");
        var id = button.getAttribute("data-scheduled-id");
        if (!id) return;

        if (action === "restore") {
          restoreScheduledTask(id);
          return;
        }
        if (action === "delete") {
          deleteScheduledTask(id);
        }
      });
    });
  }

  function startTaskEdit(id) {
    var task = state.tasks.find(function (item) { return item.id === id; });
    if (!task) return;

    editingTaskId = id;
    byId("taskTitle").value = task.title || "";
    byId("taskDifficulty").value = Number(task.difficulty) || 1;
    byId("taskUrgency").value = Number(task.urgency) || 1;
    byId("taskDuration").value = Number(task.duration) || 30;
    byId("taskRoutine").checked = !!task.routine;

    el.taskSubmitBtn.textContent = t("planner.tasks.saveEdit");
    el.cancelEditBtn.classList.remove("hidden");
  }

  function resetTaskFormMode(form) {
    editingTaskId = null;
    if (form && typeof form.reset === "function") form.reset();
    el.taskSubmitBtn.textContent = t("planner.tasks.add");
    el.cancelEditBtn.classList.add("hidden");
  }

  function deleteTask(id) {
    var task = state.tasks.find(function (item) { return item.id === id; });
    state.tasks = state.tasks.filter(function (item) { return item.id !== id; });
    saveState();
    renderTasks();
    updateFact();

    if (requireVerifiedParticipantId(false)) {
      sync("task_deleted", task || { id: id });
    }
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

    if (requireVerifiedParticipantId(false)) {
      sync("scheduled_added", {
        id: task.id,
        title: task.title,
        difficulty: task.difficulty,
        urgency: task.urgency,
        duration: task.duration,
        routine: !!task.routine,
        scheduledFor: tomorrowISO()
      });
    }
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

    if (requireVerifiedParticipantId(false)) {
      sync("scheduled_restored", {
        id: item.id,
        title: item.title,
        scheduledFor: item.scheduledFor
      });
    }
  }

  function deleteScheduledTask(id) {
    var item = state.scheduled.find(function (task) { return task.id === id; });
    state.scheduled = state.scheduled.filter(function (task) { return task.id !== id; });
    saveState();
    renderScheduled();

    if (requireVerifiedParticipantId(false)) {
      sync("scheduled_deleted", item || { id: id });
    }
  }

  function toggleTask(id) {
    var payload = null;

    state.tasks = state.tasks.map(function (task) {
      if (task.id !== id) return task;
      var updated = Object.assign({}, task, { done: !task.done });
      payload = updated;
      return updated;
    });

    saveState();
    renderTasks();
    updateFact();

    if (payload && requireVerifiedParticipantId(false)) {
      sync("task_toggled", payload);
    }
  }

  function bindTaskDragAndDrop() {
    var rows = Array.prototype.slice.call(el.taskTableBody.querySelectorAll("tr.task-row"));
    var draggedId = null;

    rows.forEach(function (row) {
      row.draggable = true;

      row.addEventListener("dragstart", function () {
        draggedId = row.getAttribute("data-task-id");
        row.classList.add("dragging");
      });

      row.addEventListener("dragend", function () {
        row.classList.remove("dragging");
        rows.forEach(function (r) {
          r.classList.remove("drop-before");
          r.classList.remove("drop-after");
        });
      });

      row.addEventListener("dragover", function (event) {
        event.preventDefault();
        var rect = row.getBoundingClientRect();
        var midpoint = rect.top + rect.height / 2;
        row.classList.toggle("drop-before", event.clientY < midpoint);
        row.classList.toggle("drop-after", event.clientY >= midpoint);
      });

      row.addEventListener("dragleave", function () {
        row.classList.remove("drop-before");
        row.classList.remove("drop-after");
      });

      row.addEventListener("drop", function (event) {
        event.preventDefault();

        var targetId = row.getAttribute("data-task-id");
        var before = row.classList.contains("drop-before");

        rows.forEach(function (r) {
          r.classList.remove("drop-before");
          r.classList.remove("drop-after");
        });

        if (!draggedId || !targetId || draggedId === targetId) return;
        reorderTasks(draggedId, targetId, before);
      });
    });
  }

  function reorderTasks(draggedId, targetId, before) {
    var list = state.tasks.slice();
    var fromIndex = list.findIndex(function (task) { return task.id === draggedId; });
    var targetIndex = list.findIndex(function (task) { return task.id === targetId; });

    if (fromIndex < 0 || targetIndex < 0) return;

    var moved = list.splice(fromIndex, 1)[0];
    var insertIndex = targetIndex;

    if (!before && fromIndex < targetIndex) {
      insertIndex = targetIndex;
    } else if (!before && fromIndex > targetIndex) {
      insertIndex = targetIndex + 1;
    } else if (before && fromIndex < targetIndex) {
      insertIndex = targetIndex - 1;
    }

    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > list.length) insertIndex = list.length;

    list.splice(insertIndex, 0, moved);

    list.forEach(function (task, index) {
      task.order = index;
    });

    state.tasks = list;
    state.manualOrder = true;
    saveState();
    renderTasks();

    if (requireVerifiedParticipantId(false)) {
      sync("task_reordered", {
        id: draggedId,
        order: insertIndex
      });
    }
  }

  function updateFact() {
    var done = state.tasks.filter(function (task) { return task.done; }).length;
    var total = state.tasks.length;
    if (el.factValue) {
      el.factValue.textContent = done + "/" + total;
    }
  }

  function updateReadiness() {
    if (el.readinessValue) {
      el.readinessValue.textContent = String(state.readiness == null ? "—" : state.readiness);
    }
  }

  function updateDayStatus() {
    if (!el.dayStatus) return;
    el.dayStatus.textContent = state.dayClosedAt ? t("planner.evening.dayClosed") : t("planner.evening.dayOpen");
  }

  function updateSyncStatus(status) {
    lastSyncStatus = status;
    if (!el.syncStatus) return;

    el.syncStatus.className = "status sync-status";

    if (status === "syncing") {
      el.syncStatus.textContent = t("planner.sync.syncing");
      return;
    }
    if (status === "success") {
      el.syncStatus.textContent = t("planner.sync.success");
      el.syncStatus.classList.add("ok");
      return;
    }
    if (status === "error") {
      el.syncStatus.textContent = t("planner.sync.error");
      el.syncStatus.classList.add("err");
      return;
    }

    el.syncStatus.textContent = "";
  }

  function setupParticipantId() {
    if (!el.participantIdForm || !el.participantIdInput) return;

    state.participantId = sanitizeParticipantId(state.participantId || "");
    participantIdLocked = !!state.participantId;
    el.participantIdInput.value = state.participantId || "";

    applyParticipantIdLockState();
    refreshParticipantIdStatus();

    el.participantIdForm.addEventListener("submit", function (event) {
      event.preventDefault();
      verifyAndSaveParticipantId();
    });

    if (el.participantIdChangeBtn) {
      el.participantIdChangeBtn.addEventListener("click", function () {
        participantIdLocked = false;
        applyParticipantIdLockState();
        setParticipantIdStatus("info", t("planner.id.locked"));
        el.participantIdInput.focus();
        el.participantIdInput.select();
      });
    }
  }

  function applyParticipantIdLockState() {
    if (!el.participantIdInput) return;
    el.participantIdInput.readOnly = participantIdLocked;

    if (el.participantIdSaveBtn) {
      el.participantIdSaveBtn.classList.toggle("hidden", participantIdLocked);
    }
    if (el.participantIdChangeBtn) {
      el.participantIdChangeBtn.classList.toggle("hidden", !participantIdLocked);
    }
  }

  function refreshParticipantIdStatus() {
    if (!el.participantIdStatus) return;
    if (!state.participantId) {
      setParticipantIdStatus("", t("planner.id.required"));
      return;
    }
    if (participantIdLocked) {
      setParticipantIdStatus("ok", t("planner.id.saved"));
      return;
    }
    setParticipantIdStatus("info", t("planner.id.locked"));
  }

  function setParticipantIdStatus(kind, message) {
    if (!el.participantIdStatus) return;
    el.participantIdStatus.className = "participant-id-status";
    if (kind === "ok") el.participantIdStatus.classList.add("is-ok");
    if (kind === "err") el.participantIdStatus.classList.add("is-err");
    if (kind === "info") el.participantIdStatus.classList.add("is-info");
    el.participantIdStatus.textContent = message || "";
  }

  function sanitizeParticipantId(value) {
    return String(value || "").trim().toUpperCase();
  }

  function verifyAndSaveParticipantId() {
    var participantId = sanitizeParticipantId(el.participantIdInput.value);
    if (!participantId) {
      setParticipantIdStatus("err", t("planner.id.empty"));
      return;
    }

    setParticipantIdStatus("info", t("planner.id.checking"));

    fetch(PARTICIPANT_LOOKUP_URL + "?id=" + encodeURIComponent(participantId), {
      method: "GET",
      headers: { "Accept": "application/json" }
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result && result.ok && result.exists) {
          state.participantId = participantId;
          saveState();
          participantIdLocked = true;
          applyParticipantIdLockState();
          setParticipantIdStatus("ok", t("planner.id.saved"));
          updateSyncStatus("idle");
        } else {
          participantIdLocked = false;
          applyParticipantIdLockState();
          setParticipantIdStatus("err", t("planner.id.notFound"));
        }
      })
      .catch(function () {
        participantIdLocked = false;
        applyParticipantIdLockState();
        setParticipantIdStatus("err", t("planner.id.error"));
      });
  }

  function requireVerifiedParticipantId(showAlert) {
    if (participantIdLocked && state && state.participantId) return true;
    if (showAlert !== false) {
      alert(t("planner.id.required"));
    }
    if (el.participantIdInput) el.participantIdInput.focus();
    updateSyncStatus("error");
    return false;
  }

  function sync(eventType, payload) {
    if (!requireVerifiedParticipantId(false)) return Promise.resolve({ skipped: true });

    updateSyncStatus("syncing");

    var body = {
      source: "pulseburn-planner",
      eventType: eventType,
      timestamp: new Date().toISOString(),
      date: today,
      sessionId: state.sessionId,
      participantId: state.participantId || "",
      userId: state.participantId || "",
      userName: state.participantId || "",
      language: getLang(),
      sourcePage: location.pathname,
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
        if (!response.ok) throw new Error("sync_failed");
        return response.json();
      })
      .then(function (result) {
        if (!result || result.ok === false) throw new Error("sync_failed");
        updateSyncStatus("success");
        return result;
      })
      .catch(function (error) {
        updateSyncStatus("error");
        return Promise.reject(error);
      });
  }

  function getLang() {
    if (window.UpeakI18n && typeof window.UpeakI18n.getLang === "function") {
      return window.UpeakI18n.getLang();
    }
    return "ru";
  }

  function parseTaskTitle(value) {
    return {
      title: String(value || "").trim()
    };
  }

  function comparePriority(a, b) {
    var scoreA = Number(a.urgency || 0) * 10 + Number(a.difficulty || 0);
    var scoreB = Number(b.urgency || 0) * 10 + Number(b.difficulty || 0);
    return scoreB - scoreA;
  }

  function compareTasksForDisplay(a, b) {
    if (state.manualOrder) {
      return Number(a.order || 0) - Number(b.order || 0);
    }

    var orderMap = {};
    orderMap[SLOT_KEYS.morningRoutine] = 0;
    orderMap[SLOT_KEYS.morningFocus] = 1;
    orderMap[SLOT_KEYS.dayOps] = 2;
    orderMap[SLOT_KEYS.eveningLight] = 3;
    orderMap[SLOT_KEYS.simplify] = 4;
    orderMap[SLOT_KEYS.postpone] = 5;
    orderMap[SLOT_KEYS.none] = 6;

    var slotDiff = (orderMap[a.slotKey] || 99) - (orderMap[b.slotKey] || 99);
    if (slotDiff !== 0) return slotDiff;

    var doneDiff = Number(!!a.done) - Number(!!b.done);
    if (doneDiff !== 0) return doneDiff;

    return Number(a.order || 0) - Number(b.order || 0);
  }

  function isRoutineTask(task) {
    return !!(task && task.routine);
  }

  function calcReadiness(morning) {
    if (!morning) return 50;

    var sleepHours = Number(morning.sleepHours || 0);
    var sleepQuality = Number(morning.sleepQuality || 0);
    var energy = Number(morning.energy || 0);
    var wellbeing = Number(morning.wellbeing || 0);
    var stress = Number(morning.stress || 0);

    var score =
      Math.min(10, sleepHours) * 5 +
      sleepQuality * 10 +
      energy * 20 +
      wellbeing * 15 -
      stress * 10;

    score = Math.max(0, Math.min(100, Math.round(score)));
    return score;
  }

  function tomorrowISO() {
    var date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  function nextOrder() {
    if (!state.tasks.length) return 0;
    return Math.max.apply(null, state.tasks.map(function (task) {
      return Number(task.order || 0);
    })) + 1;
  }

  function makeId() {
    return "task_" + Math.random().toString(36).slice(2, 10);
  }

  function getNum(id) {
    var node = byId(id);
    return Number(node && node.value ? node.value : 0);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function loadState() {
    var empty = {
      sessionId: "sess_" + Math.random().toString(36).slice(2, 10),
      participantId: "",
      morning: null,
      evening: null,
      readiness: 50,
      tasks: [],
      scheduled: [],
      dayClosedAt: "",
      manualOrder: false,
      lastRoutineResetDate: ""
    };

    try {
      var saved = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
      if (!saved) return empty;
      return Object.assign({}, empty, JSON.parse(saved));
    } catch (_e) {
      return empty;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_e) {}
  }

  function migrateSlots() {
    if (!Array.isArray(state.tasks)) state.tasks = [];
    state.tasks = state.tasks.map(function (task) {
      if (!task || typeof task !== "object") return task;

      var slotKey = task.slotKey || task.slot || SLOT_KEYS.none;

      if (slotKey === "morningRoutine") slotKey = SLOT_KEYS.morningRoutine;
      if (slotKey === "morningFocus") slotKey = SLOT_KEYS.morningFocus;
      if (slotKey === "dayOps") slotKey = SLOT_KEYS.dayOps;
      if (slotKey === "eveningLight") slotKey = SLOT_KEYS.eveningLight;
      if (slotKey === "none") slotKey = SLOT_KEYS.none;
      if (slotKey === "postpone") slotKey = SLOT_KEYS.postpone;
      if (slotKey === "simplify") slotKey = SLOT_KEYS.simplify;

      return Object.assign({}, task, { slotKey: slotKey });
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();