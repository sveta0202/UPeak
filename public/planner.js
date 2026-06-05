(function () {
  var KEY = "pulseburn_planner_v3";
  var LEGACY_KEY = "pulseburn_planner_v2";
  var API_URL = "/api/events";
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
  // ID считается подтверждённым только после успешной проверки в таблице
  // participates. Без него планировщик работает локально, но не синхронизирует.
  var participantIdLocked = false;

  function t(key) {
    if (window.UpeakI18n && typeof window.UpeakI18n.t === "function") {
      return window.UpeakI18n.t(key);
    }
    return key;
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

        return Object.assign({}, task, formTask, { slotKey: nextSlotKey });
      });

      sync("task_edited", Object.assign({ id: editingTaskId }, formTask));
      resetTaskFormMode(event.target);
    } else {
      var task = Object.assign(
        {
          id: makeId(),
          done: false,
          order: nextOrder(),
          slotKey: formTask.routine ? SLOT_KEYS.morningRoutine : SLOT_KEYS.none
        },
        formTask
      );

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

  // Распределение по состоянию: учитываем срочность (приоритет), важность, сложность и
  // длительность. То, что не помещается в бюджет (или слишком сложное/длинное и при этом
  // не срочное), помечается как "перенести на завтра" и уходит в раздел "Запланированные".
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

      // Рутина всегда остаётся в дне и идёт в начало (утренний слот),
      // но её нагрузка тоже учитывается в бюджете дня — иначе распределение
      // по состоянию игнорирует базовые задачи.
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

    // Распределение задаёт новый порядок по слотам, поэтому сбрасываем
    // флаг ручной сортировки — после этого сортировка идёт по слотам.
    state.manualOrder = false;

    // After distribution, важные/срочные вверху, рутина — в начале дня.
    kept.sort(compareTasksForDisplay);
    kept.forEach(function (task, idx) { task.order = idx; });

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

    if (routineCount > 0) {
      sync("routine_activated", { count: routineCount });
    }
  }

  // Возвращает в основной список те запланированные задачи, чья дата возврата
  // совпадает с сегодняшним днём (или раньше — если день пропустили).
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
    if (!state.tasks.length) {
      el.taskTableBody.innerHTML =
        '<tr><td colspan="8" class="muted">' + escapeHtml(t("planner.tasks.empty")) + '</td></tr>';
      bindTaskActions();
      return;
    }

    var displayTasks = state.tasks.slice().sort(compareTasksForDisplay);

    el.taskTableBody.innerHTML = displayTasks.map(function (task, idx) {
      var isRoutine = isRoutineTask(task);
      var slotLabel = task.slotKey ? t(task.slotKey) : t(SLOT_KEYS.none);

      return (
        '<tr class="task-row" draggable="true" data-task-id="' + task.id + '">' +
          '<td class="order-cell">' +
            '<span class="order-index">' + (idx + 1) + '</span>' +
          '</td>' +
          '<td><input type="checkbox" data-id="' + task.id + '" ' + (task.done ? "checked" : "") + '></td>' +
          '<td class="' + (task.done ? "task-done" : "") + '">' +
            '<span class="drag-handle" role="img" title="' + escapeHtml(t("planner.tasks.dragHandle")) + '" aria-label="' + escapeHtml(t("planner.tasks.dragHandle")) + '">⋮⋮</span>' +
            '<span class="task-title">' + escapeHtml(cleanTaskTitle(task.title)) + '</span>' +
            (isRoutine ? ' <span class="routine-chip">' + escapeHtml(t("planner.tasks.routineChip")) + '</span>' : '') +
          '</td>' +
          '<td>' + task.difficulty + '</td>' +
          '<td>' + task.urgency + '</td>' +
          '<td>' + task.duration + '</td>' +
          '<td><span class="slot-chip">' + escapeHtml(slotLabel) + '</span></td>' +
          '<td class="actions-cell">' +
            '<button type="button" class="menu-btn" data-menu-id="' + task.id + '" aria-label="' + escapeHtml(t("planner.tasks.menu")) + '">' +
              '<svg class="sf-icon" aria-hidden="true"><use href="#sf-ellipsis"></use></svg>' +
            '</button>' +
            '<div class="row-menu hidden" data-menu-panel="' + task.id + '">' +
              '<button type="button" class="menu-item" data-action="edit" data-id="' + task.id + '">' + escapeHtml(t("planner.tasks.edit")) + '</button>' +
              '<button type="button" class="menu-item" data-action="postpone" data-id="' + task.id + '">' + escapeHtml(t("planner.tasks.postpone")) + '</button>' +
              '<button type="button" class="menu-item" data-action="delete" data-id="' + task.id + '">' + escapeHtml(t("planner.tasks.delete")) + '</button>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    }).join("");

    bindTaskActions();
    bindReorder();
  }

  function renderScheduled() {
    if (!el.scheduledTableBody) return;
    if (!Array.isArray(state.scheduled) || !state.scheduled.length) {
      el.scheduledTableBody.innerHTML =
        '<tr><td colspan="6" class="muted">' + escapeHtml(t("planner.scheduled.empty")) + '</td></tr>';
      return;
    }

    el.scheduledTableBody.innerHTML = state.scheduled.map(function (item) {
      return (
        '<tr data-sched-id="' + escapeHtml(item.id) + '">' +
          '<td>' + escapeHtml(cleanTaskTitle(item.title)) +
            (item.routine ? ' <span class="routine-chip">' + escapeHtml(t("planner.tasks.routineChip")) + '</span>' : '') +
          '</td>' +
          '<td>' + (item.difficulty || "—") + '</td>' +
          '<td>' + (item.urgency || "—") + '</td>' +
          '<td>' + (item.duration || "—") + '</td>' +
          '<td>' + escapeHtml(item.scheduledFor || "—") + '</td>' +
          '<td>' +
            '<button type="button" class="btn-icon edit" data-sched-action="restore" data-id="' + escapeHtml(item.id) + '">' +
              escapeHtml(t("planner.scheduled.restore")) +
            '</button> ' +
            '<button type="button" class="btn-icon" data-sched-action="delete" data-id="' + escapeHtml(item.id) + '">' +
              escapeHtml(t("planner.scheduled.delete")) +
            '</button>' +
          '</td>' +
        '</tr>'
      );
    }).join("");

    el.scheduledTableBody.querySelectorAll('button[data-sched-action]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        var action = btn.getAttribute("data-sched-action");
        var id = btn.getAttribute("data-id");
        var idx = state.scheduled.findIndex(function (item) { return item.id === id; });
        if (idx < 0) return;
        var item = state.scheduled[idx];
        if (action === "restore") {
          state.scheduled.splice(idx, 1);
          state.tasks.push({
            id: item.id,
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
          sync("scheduled_restored", { id: id, manual: true });
        } else if (action === "delete") {
          state.scheduled.splice(idx, 1);
          saveState();
          renderScheduled();
          sync("scheduled_deleted", { id: id });
        }
      });
    });
  }

  function bindTaskActions() {
    el.taskTableBody.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.getAttribute("data-id");

        state.tasks = state.tasks.map(function (task) {
          if (task.id === id) {
            return Object.assign({}, task, { done: cb.checked });
          }
          return task;
        });

        saveState();
        renderTasks();
        updateFact();
        sync("task_toggled", { id: id, done: cb.checked });
      });
    });

    el.taskTableBody.querySelectorAll("button[data-menu-id]").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        var menuId = btn.getAttribute("data-menu-id");
        var panel = el.taskTableBody.querySelector('div[data-menu-panel="' + menuId + '"]');
        if (!panel) return;

        var shouldOpen = panel.classList.contains("hidden");
        closeAllMenus();
        if (shouldOpen) {
          panel.classList.remove("hidden");
          var card = panel.closest(".card");
          if (card) card.classList.add("menu-open");
        }
      });
    });

    el.taskTableBody.querySelectorAll("button[data-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var action = btn.getAttribute("data-action");
        var id = btn.getAttribute("data-id");

        if (action === "edit") {
          startEditTask(id);
          closeAllMenus();
          return;
        }

        if (action === "postpone") {
          postponeTask(id);
          closeAllMenus();
          return;
        }

        if (action === "delete") {
          var removedTask = state.tasks.find(function (task) { return task.id === id; });
          state.tasks = state.tasks.filter(function (task) { return task.id !== id; });

          if (editingTaskId === id) {
            resetTaskFormMode(byId("taskForm"));
          }

          saveState();
          renderTasks();
          updateFact();

          sync("task_deleted", {
            id: id,
            title: removedTask ? removedTask.title : null
          });

          closeAllMenus();
        }
      });
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest("td.actions-cell")) {
        closeAllMenus();
      }
    }, { once: true });
  }

  // Drag-and-drop reorder for the main task list. Перетаскивание — единственный
  // способ менять порядок (кнопки-стрелки удалены). Позиция вставки зависит от
  // того, в верхнюю или нижнюю половину целевой строки навели курсор.
  function bindReorder() {
    var rows = el.taskTableBody.querySelectorAll("tr.task-row");
    var dragId = null;

    function clearTargets() {
      rows.forEach(function (r) {
        r.classList.remove("drop-before", "drop-after");
      });
    }

    rows.forEach(function (row) {
      row.addEventListener("dragstart", function (e) {
        dragId = row.getAttribute("data-task-id");
        row.classList.add("dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          try { e.dataTransfer.setData("text/plain", dragId); } catch (_e) {}
        }
      });
      row.addEventListener("dragend", function () {
        row.classList.remove("dragging");
        clearTargets();
        dragId = null;
      });
      row.addEventListener("dragover", function (e) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        var targetId = row.getAttribute("data-task-id");
        if (!dragId || dragId === targetId) return;
        clearTargets();
        row.classList.add(isBefore(e, row) ? "drop-before" : "drop-after");
      });
      row.addEventListener("dragleave", function () {
        row.classList.remove("drop-before", "drop-after");
      });
      row.addEventListener("drop", function (e) {
        e.preventDefault();
        var targetId = row.getAttribute("data-task-id");
        var before = isBefore(e, row);
        clearTargets();
        if (!dragId || dragId === targetId) return;
        reorderTask(dragId, targetId, before);
      });
    });
  }

  function isBefore(e, row) {
    var rect = row.getBoundingClientRect();
    return (e.clientY - rect.top) < rect.height / 2;
  }

  // Перестраиваем порядок по текущему отображаемому списку, затем
  // переписываем поле order для всех задач, чтобы ручной порядок сохранялся.
  function reorderTask(sourceId, targetId, insertBefore) {
    var displayed = state.tasks.slice().sort(compareTasksForDisplay);
    var fromIdx = displayed.findIndex(function (t) { return t.id === sourceId; });
    if (fromIdx < 0) return;

    var moved = displayed.splice(fromIdx, 1)[0];
    var toIdx = displayed.findIndex(function (t) { return t.id === targetId; });
    if (toIdx < 0) {
      displayed.push(moved);
    } else {
      displayed.splice(insertBefore ? toIdx : toIdx + 1, 0, moved);
    }

    displayed.forEach(function (task, idx) { task.order = idx; });
    state.manualOrder = true;
    state.tasks = displayed;
    saveState();
    renderTasks();
    sync("task_reordered", {
      id: sourceId,
      position: displayed.findIndex(function (t) { return t.id === sourceId; }),
      total: displayed.length
    });
  }

  function postponeTask(id) {
    var idx = state.tasks.findIndex(function (t) { return t.id === id; });
    if (idx < 0) return;
    var task = state.tasks[idx];
    state.tasks.splice(idx, 1);
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
    sync("scheduled_added", { id: task.id, scheduledFor: tomorrowISO(), manual: true });
  }

  function closeAllMenus() {
    el.taskTableBody.querySelectorAll("div[data-menu-panel]").forEach(function (panel) {
      panel.classList.add("hidden");
    });
    document.querySelectorAll(".card.menu-open").forEach(function (card) {
      card.classList.remove("menu-open");
    });
  }

  function startEditTask(id) {
    var task = state.tasks.find(function (item) { return item.id === id; });
    if (!task) return;

    byId("taskTitle").value = cleanTaskTitle(task.title);
    byId("taskDifficulty").value = String(task.difficulty);
    byId("taskUrgency").value = String(task.urgency);
    byId("taskDuration").value = String(task.duration);
    byId("taskRoutine").checked = isRoutineTask(task);

    editingTaskId = id;
    el.taskSubmitBtn.textContent = t("planner.tasks.saveEdit");
    el.cancelEditBtn.classList.remove("hidden");
    byId("taskTitle").focus();
  }

  function resetTaskFormMode(taskFormEl) {
    editingTaskId = null;
    taskFormEl.reset();
    byId("taskRoutine").checked = false;
    el.taskSubmitBtn.textContent = t("planner.tasks.add");
    el.cancelEditBtn.classList.add("hidden");
  }

  function calcReadiness(m) {
    var sleepScore = Math.min(100, (m.sleepHours / 8) * 100);
    var quality = (m.sleepQuality / 5) * 100;
    var energy = (m.energy / 5) * 100;
    var wellbeing = (m.wellbeing / 5) * 100;
    var stressPenalty = ((m.stress - 1) / 4) * 40;

    return Math.max(
      0,
      Math.round(0.30 * sleepScore + 0.25 * quality + 0.20 * energy + 0.25 * wellbeing - stressPenalty)
    );
  }

  // План-факт считается только по задачам на сегодня. Запланированные на завтра
  // в знаменатель не попадают, поэтому 3 исходных задачи → 1 перенесена = 2/2.
  function updateFact() {
    var completed = state.tasks.filter(function (t) { return t.done; }).length;
    el.factValue.textContent = t("planner.evening.fact") + ": " + completed + "/" + state.tasks.length + " " + t("planner.evening.completed");
  }

  function updateReadiness() {
    var value = state.readiness == null ? "—" : state.readiness;
    el.readinessValue.textContent = t("planner.readiness") + ": " + value;
  }

  function updateDayStatus() {
    if (!el.dayStatus) return;
    if (state.evening && state.evening.date === today) {
      el.dayStatus.textContent = t("planner.evening.dayClosed");
      return;
    }
    el.dayStatus.textContent = t("planner.evening.dayOpen");
  }

  function updateSyncStatus(status) {
    lastSyncStatus = status;
    if (!el.syncStatus) return;

    if (status === "syncing") el.syncStatus.textContent = t("planner.sync.syncing");
    if (status === "success") el.syncStatus.textContent = t("planner.sync.success");
    if (status === "error") el.syncStatus.textContent = t("planner.sync.error");
    if (status === "idle") el.syncStatus.textContent = "";
  }

  function sync(eventType, payload) {
    // Без подтверждённого ID участника данные не уходят в основную таблицу —
    // иначе строки нельзя отфильтровать по конкретному пользователю.
    if (!participantIdLocked || !state.participantId) {
      updateSyncStatus("idle");
      showParticipantIdStatus("info", t("planner.id.required"));
      return;
    }

    var body = {
      source: "pulseburn-planner",
      eventType: eventType,
      timestamp: new Date().toISOString(),
      date: today,
      sessionId: getSessionId(),
      participantId: state.participantId,
      userName: state.userName || "anonymous",
      readiness: state.readiness == null ? null : state.readiness,
      tasksCount: state.tasks.length,
      doneCount: state.tasks.filter(function (t) { return t.done; }).length,
      scheduledCount: Array.isArray(state.scheduled) ? state.scheduled.length : 0,
      language: (window.UpeakI18n && window.UpeakI18n.getLang && window.UpeakI18n.getLang()) || "ru",
      sourcePage: typeof location !== "undefined" ? location.pathname : "",
      payload: payload
    };

    updateSyncStatus("syncing");

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function () {
        updateSyncStatus("success");
        setTimeout(function () { updateSyncStatus("idle"); }, 2500);
      })
      .catch(function () {
        updateSyncStatus("error");
      });
  }

  // ===== ID участника =====

  function normalizeParticipantId(value) {
    return String(value || "").trim().toUpperCase().slice(0, 40);
  }

  function showParticipantIdStatus(kind, message) {
    if (!el.participantIdStatus) return;
    el.participantIdStatus.textContent = message || "";
    el.participantIdStatus.className = "participant-id-status" + (kind ? " is-" + kind : "");
  }

  function refreshParticipantIdStatus() {
    if (!el.participantIdStatus) return;
    if (participantIdLocked && state.participantId) {
      showParticipantIdStatus("ok", t("planner.id.saved"));
    } else if (state.participantId) {
      showParticipantIdStatus("info", t("planner.id.required"));
    } else {
      showParticipantIdStatus("", "");
    }
  }

  function applyParticipantIdLockUI() {
    if (!el.participantIdInput) return;
    if (participantIdLocked) {
      el.participantIdInput.value = state.participantId;
      el.participantIdInput.setAttribute("readonly", "readonly");
      el.participantIdSaveBtn.classList.add("hidden");
      el.participantIdChangeBtn.classList.remove("hidden");
    } else {
      el.participantIdInput.removeAttribute("readonly");
      el.participantIdSaveBtn.classList.remove("hidden");
      el.participantIdChangeBtn.classList.add("hidden");
    }
  }

  function setupParticipantId() {
    if (!el.participantIdForm) return;

    // Повторный заход / обновление: восстанавливаем сохранённый и подтверждённый ID.
    if (state.participantId) {
      participantIdLocked = true;
      el.participantIdInput.value = state.participantId;
    }
    applyParticipantIdLockUI();
    refreshParticipantIdStatus();

    el.participantIdForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (participantIdLocked) return;

      var id = normalizeParticipantId(el.participantIdInput.value);
      if (!id) {
        showParticipantIdStatus("err", t("planner.id.empty"));
        return;
      }

      el.participantIdSaveBtn.disabled = true;
      showParticipantIdStatus("info", t("planner.id.checking"));

      validateParticipantId(id)
        .then(function (result) {
          if (result && result.exists) {
            state.participantId = id;
            participantIdLocked = true;
            saveState();
            applyParticipantIdLockUI();
            showParticipantIdStatus("ok", t("planner.id.saved"));
          } else {
            showParticipantIdStatus("err", t("planner.id.notFound"));
          }
        })
        .catch(function () {
          showParticipantIdStatus("err", t("planner.id.error"));
        })
        .then(function () {
          el.participantIdSaveBtn.disabled = false;
        });
    });

    el.participantIdChangeBtn.addEventListener("click", function () {
      participantIdLocked = false;
      applyParticipantIdLockUI();
      showParticipantIdStatus("info", t("planner.id.locked"));
      el.participantIdInput.focus();
      el.participantIdInput.select();
    });
  }

  function validateParticipantId(id) {
    return fetch("/api/participant/lookup?id=" + encodeURIComponent(id), {
      method: "GET",
      headers: { "Accept": "application/json" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        return { exists: !!(data && (data.exists || (data.upstream && data.upstream.exists))) };
      });
  }

  function getSessionId() {
    if (state.sessionId) return state.sessionId;
    state.sessionId = "s_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    saveState();
    return state.sessionId;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) {
        // Try migrating from v2.
        var legacyRaw = localStorage.getItem(LEGACY_KEY);
        if (legacyRaw) {
          try {
            var legacy = JSON.parse(legacyRaw);
            if (!Array.isArray(legacy.tasks)) legacy.tasks = [];
            legacy.scheduled = [];
            legacy.tasks.forEach(function (task, idx) {
              if (task.order == null) task.order = idx;
            });
            return Object.assign(
              { userName: "", readiness: null, tasks: [], scheduled: [], lastRoutineResetDate: null, sessionId: null, manualOrder: false, participantId: "" },
              legacy
            );
          } catch (_e) {}
        }
        return {
          userName: "",
          readiness: null,
          tasks: [],
          scheduled: [],
          lastRoutineResetDate: null,
          sessionId: null,
          manualOrder: false,
          participantId: ""
        };
      }

      var parsed = JSON.parse(raw);
      if (!parsed.lastRoutineResetDate) parsed.lastRoutineResetDate = null;
      if (!Array.isArray(parsed.tasks)) parsed.tasks = [];
      if (!Array.isArray(parsed.scheduled)) parsed.scheduled = [];
      if (typeof parsed.manualOrder !== "boolean") parsed.manualOrder = false;
      if (typeof parsed.participantId !== "string") parsed.participantId = "";
      parsed.tasks.forEach(function (task, idx) { if (task.order == null) task.order = idx; });
      return parsed;
    } catch (e) {
      return {
        userName: "",
        readiness: null,
        tasks: [],
        scheduled: [],
        lastRoutineResetDate: null,
        sessionId: null,
        manualOrder: false,
        participantId: ""
      };
    }
  }

  function migrateSlots() {
    var legacyMap = {
      "Утро (рутина)": "planner.slot.morningRoutine",
      "Утро (фокус)": "planner.slot.morningFocus",
      "День (операционка)": "planner.slot.dayOps",
      "Вечер (лёгкие)": "planner.slot.eveningLight",
      "Без слота": "planner.slot.none",
      "Перенести на завтра": "planner.slot.postpone",
      "Перенести или упростить": "planner.slot.simplify"
    };
    var changed = false;
    state.tasks.forEach(function (task) {
      if (task.slotKey) return;
      if (task.slot && legacyMap[task.slot]) {
        task.slotKey = legacyMap[task.slot];
        delete task.slot;
        changed = true;
      } else {
        task.slotKey = SLOT_KEYS.none;
        if (task.slot) delete task.slot;
        changed = true;
      }
    });
    if (changed) saveState();
  }

  function saveState() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function byId(id) { return document.getElementById(id); }
  function getNum(id) { return Number(byId(id).value || 0); }
  function makeId() { return "t_" + Math.random().toString(36).slice(2, 10); }

  function nextOrder() {
    if (!state.tasks.length) return 0;
    return state.tasks.reduce(function (max, task) {
      return Math.max(max, Number(task.order) || 0);
    }, -1) + 1;
  }

  function tomorrowISO() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function parseTaskTitle(rawTitle) {
    return { title: cleanTaskTitle(rawTitle), routine: false };
  }
  function cleanTaskTitle(title) {
    return String(title || "").trim().slice(0, 140);
  }
  function isRoutineTask(task) {
    return Boolean(task && task.routine);
  }

  // Priority comparator used during distribution and display.
  // Срочность важнее остального, потом важность (по urgency и difficulty),
  // потом сложность, потом длительность.
  function comparePriority(a, b) {
    if (isRoutineTask(a) !== isRoutineTask(b)) return isRoutineTask(a) ? -1 : 1;
    var au = Number(a.urgency) || 0, bu = Number(b.urgency) || 0;
    if (au !== bu) return bu - au;
    var ai = importanceScore(a), bi = importanceScore(b);
    if (ai !== bi) return bi - ai;
    var ad = Number(a.difficulty) || 0, bd = Number(b.difficulty) || 0;
    if (ad !== bd) return bd - ad;
    var adur = Number(a.duration) || 0, bdur = Number(b.duration) || 0;
    if (adur !== bdur) return adur - bdur;
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  }

  function importanceScore(task) {
    return (Number(task.urgency) || 0) * 2 + (Number(task.difficulty) || 0);
  }

  // Display order:
  // 1) routine tasks first (start of day),
  // 2) если пользователь вручную перетаскивал задачи (state.manualOrder),
  //    ручной порядок важнее слотов — иначе перетаскивание «не работает»,
  //    потому что сортировка по слотам возвращала задачи на место;
  // 3) иначе — по слоту (утро/день/вечер), затем по order и срочности.
  function compareTasksForDisplay(a, b) {
    if (isRoutineTask(a) !== isRoutineTask(b)) return isRoutineTask(a) ? -1 : 1;

    var ao = Number(a.order); var bo = Number(b.order);
    if (state.manualOrder) {
      if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
      return (Number(b.urgency) || 0) - (Number(a.urgency) || 0);
    }

    var bySlot = getSlotRank(a.slotKey) - getSlotRank(b.slotKey);
    if (bySlot !== 0) return bySlot;
    if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
    return (Number(b.urgency) || 0) - (Number(a.urgency) || 0);
  }

  function getSlotRank(slotKey) {
    switch (slotKey) {
      case SLOT_KEYS.morningRoutine: return 0;
      case SLOT_KEYS.morningFocus: return 1;
      case SLOT_KEYS.dayOps: return 2;
      case SLOT_KEYS.eveningLight: return 3;
      case SLOT_KEYS.none: return 4;
      case SLOT_KEYS.postpone:
      case SLOT_KEYS.simplify: return 5;
      default: return 6;
    }
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
})();
