(function () {
  var KEY = "pulseburn_planner_v3";
  var LEGACY_KEY = "pulseburn_planner_v2";
  var API_URL = "/api/events";
  var PARTICIPANT_LOOKUP_URL = "/api/participant/lookup";
  var today = new Date().toISOString().slice(0, 10);

  function hasMorningCheckinToday() {
    return !!(
      state.morning &&
      state.morning.date === today &&
      state.readiness != null &&
      state.dayState &&
      state.dayState.state
    );
  }

  function resetMorningDerivedState() {
    state.readiness = null;
    state.dayState = null;
    state.morningRecommendations = [];
    state.morningEmbedDecisions = {};
    state.morningEmbedDate = "";
  }

  function sanitizeMorningSession() {
    if (!state.morning || state.morning.date !== today) {
      resetMorningDerivedState();
    }
  }

  var FALLBACK_I18N = {
    ru: {
      "planner.tasks.add": "Добавить задачу",
      "planner.tasks.saveEdit": "Сохранить изменения",
      "planner.tasks.cancelEdit": "Отменить редактирование",
      "planner.tasks.empty": "Пока нет задач на день",
      "planner.tasks.edit": "Редактировать задачу",
      "planner.tasks.delete": "Удалить задачу",
      "planner.tasks.postpone": "Перенести задачу на завтра",
      "planner.tasks.routineChip": "Рутина",
      "planner.tasks.dragHandle": "Перетащите, чтобы изменить порядок",
      "planner.scheduled.empty": "Список запланированного пуст",
      "planner.scheduled.restore": "Вернуть задачу на сегодня",
      "planner.scheduled.delete": "Удалить задачу",
      "planner.sync.syncing": "Синхронизация…",
      "planner.sync.success": "Данные сохранены",
      "planner.sync.error": "Ошибка синхронизации",
      "planner.evening.dayClosed": "День закрыт",
      "planner.evening.dayOpen": "День не закрыт",
      "planner.alerts.titleRequired": "Введите название задачи",
      "planner.id.required": "Сохраните «Мой ID», чтобы данные попадали в основную таблицу.",
      "planner.id.empty": "Введите ID участника.",
      "planner.id.checking": "Проверяем ID…",
      "planner.id.saved": "ID сохранён. Данные синхронизируются под этим ID.",
      "planner.id.notFound": "Такой ID не найден в списке зарегистрированных участников.",
      "planner.id.error": "Не удалось проверить ID. Попробуйте позже.",
      "planner.id.locked": "ID зафиксирован. Нажмите «Изменить ID», чтобы поменять.",
      "planner.slot.morningRoutine": "Утренняя рутина",
      "planner.slot.morningFocus": "Утренний фокус",
      "planner.slot.dayOps": "Дневная операционка",
      "planner.slot.eveningLight": "Лёгкие задачи на вечер",
      "planner.slot.none": "Без рекомендаций",
      "planner.slot.postpone": "Перенести на завтра",
      "planner.slot.simplify": "Упростить или перенести",
      "planner.morning.embedAdd": "Добавить в план",
      "planner.morning.embedLater": "Позже",
      "planner.morning.embedAdded": "Добавлено в план"
    },
    en: {
      "planner.tasks.add": "Add task",
      "planner.tasks.saveEdit": "Save changes",
      "planner.tasks.cancelEdit": "Cancel editing",
      "planner.tasks.empty": "No tasks for today yet",
      "planner.tasks.edit": "Edit task",
      "planner.tasks.delete": "Delete task",
      "planner.tasks.postpone": "Move task to tomorrow",
      "planner.tasks.routineChip": "Routine",
      "planner.tasks.dragHandle": "Drag to reorder",
      "planner.scheduled.empty": "Nothing scheduled yet",
      "planner.scheduled.restore": "Bring task to today",
      "planner.scheduled.delete": "Delete task",
      "planner.sync.syncing": "Syncing…",
      "planner.sync.success": "Saved",
      "planner.sync.error": "Sync error",
      "planner.evening.dayClosed": "Day closed",
      "planner.evening.dayOpen": "Day not closed",
      "planner.alerts.titleRequired": "Please enter a task title",
      "planner.id.required": "Save \"My ID\" so your data reaches the main data sheet.",
      "planner.id.empty": "Enter a participant ID.",
      "planner.id.checking": "Checking ID…",
      "planner.id.saved": "ID saved. Data syncs under this ID.",
      "planner.id.notFound": "This ID was not found among registered participants.",
      "planner.id.error": "Could not verify the ID. Try again later.",
      "planner.id.locked": "ID is locked. Click \"Change ID\" to edit it.",
      "planner.slot.morningRoutine": "Morning routine",
      "planner.slot.morningFocus": "Morning focus",
      "planner.slot.dayOps": "Day operations",
      "planner.slot.eveningLight": "Light tasks for evening",
      "planner.slot.none": "No recommendation",
      "planner.slot.postpone": "Postpone to tomorrow",
      "planner.slot.simplify": "Simplify or postpone",
      "planner.morning.embedAdd": "Add to plan",
      "planner.morning.embedLater": "Later",
      "planner.morning.embedAdded": "Added to plan"
    }
  };

  var state = loadState();
  sanitizeMorningSession();

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
    participantIdStatus: byId("participantIdStatus"),
    morningRecommendations: byId("morningRecommendations"),
    eveningReview: byId("eveningReview")
  };

  var editingTaskId = null;
  var lastSyncStatus = "idle";
  var participantIdLocked = false;

  function getLang() {
    if (window.UpeakI18n && typeof window.UpeakI18n.getLang === "function") {
      return window.UpeakI18n.getLang();
    }
    return "ru";
  }

  function t(key) {
    if (window.UpeakI18n && typeof window.UpeakI18n.t === "function") {
      var translated = window.UpeakI18n.t(key);
      if (translated && translated !== key) return translated;
    }
    var lang = getLang();
    var dict = FALLBACK_I18N[lang] || FALLBACK_I18N.ru;
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
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

  function bootPlanner() {
    migrateSlots();
    promoteScheduledForToday();
    renderTasks();
    renderScheduled();
    updateFact();
    updateReadiness();
    updateDayStatus();
    updateSyncStatus("idle");
    setupParticipantId();
    if (state.dayState && window.UpeakDayRecommendations) {
      state.morningRecommendations = buildMorningRecommendations();
    }
    if (state.evening && state.evening.date === today) {
      refreshEveningReview();
    }
    refreshInterventionBlocks();
  }

  function loadRecommendationMatrix(done) {
    var morningReady = false;
    var eveningReady = false;

    function finish() {
      if (!morningReady || !eveningReady) return;
      done();
    }

    fetch("./day-recommendation-matrix.json")
      .then(function (res) {
        if (!res.ok) throw new Error("matrix fetch failed");
        return res.json();
      })
      .then(function (data) {
        if (window.UpeakDayRecommendations && typeof window.UpeakDayRecommendations.setRecommendationMatrix === "function") {
          window.UpeakDayRecommendations.setRecommendationMatrix(data);
        }
        return fetch("./day-decision-matrix.json");
      })
      .then(function (res) {
        if (!res || !res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (data && window.UpeakDayRecommendations &&
            typeof window.UpeakDayRecommendations.setDecisionMatrix === "function") {
          window.UpeakDayRecommendations.setDecisionMatrix(data);
        }
      })
      .catch(function () {})
      .then(function () {
        morningReady = true;
        finish();
      });

    fetch("./evening-recommendation-matrix.json")
      .then(function (res) {
        if (!res.ok) throw new Error("evening matrix fetch failed");
        return res.json();
      })
      .then(function (data) {
        if (window.UpeakEveningRecommendations && typeof window.UpeakEveningRecommendations.setEveningMatrix === "function") {
          window.UpeakEveningRecommendations.setEveningMatrix(data);
        }
      })
      .catch(function () {})
      .then(function () {
        eveningReady = true;
        finish();
      });
  }

  loadRecommendationMatrix(bootPlanner);

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
      refreshInterventionBlocks();
    });
  }

  byId("morningForm").addEventListener("submit", function (event) {
    event.preventDefault();

    state.morning = {
      date: today,
      sleepHours: getSleepHours(),
      sleepQuality: getNum("sleepQuality"),
      energy: getNum("energy"),
      stress: getNum("stress"),
      note: byId("morningNote").value.trim()
    };

    state.readiness = calcReadiness(state.morning);
    state.dayState = window.UpeakDayState.computeDayStateFromMorning(state.morning);
    state.morningEmbedDecisions = {};
    state.morningEmbedDate = today;
    state.morningRecommendations = buildMorningRecommendations();
    activateDailyRoutine();
    promoteScheduledForToday();
    saveState();
    renderTasks();
    renderScheduled();
    updateFact();
    updateReadiness();
    renderMorningRecommendations();

    if (!requireVerifiedParticipantId()) return;
    sync("morning_checkin", Object.assign({}, state.morning, {
      dayState: state.dayState
    }));
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
      fatigue: getNum("fatigue"),
      taskStart: getNum("eveningTaskStart"),
      procrastination: getNum("eveningProcrastination"),
      detachment: getNum("eveningDetachment"),
      note: byId("eveningNote").value.trim(),
      completed: state.tasks.filter(function (task) { return task.done; }).length,
      total: state.tasks.length
    };

    state.eveningReview = buildEveningReview();

    state.dayClosedAt = new Date().toISOString();
    saveState();
    updateFact();
    updateDayStatus();
    renderEveningReview();

    if (!requireVerifiedParticipantId()) return;
    sync("evening_checkout", state.evening);
  });

  // Распределение по состоянию: учитываем срочность (приоритет), важность, сложность и
  // длительность. Рутина всегда остаётся в дне (утренний слот) и сначала резервирует
  // часть дневного бюджета. То, что не помещается в остаток бюджета (или слишком
  // сложное/длинное и при этом не срочное), уходит в «Запланированные».
  function getTaskLoad(task) {
    return (Number(task.difficulty) || 0) + Math.ceil((Number(task.duration) || 0) / 45);
  }

  function getRoutineBudgetLoad(task, readiness) {
    var load = getTaskLoad(task);
    // На низком состоянии рутина «легче» для плана — её как раз рекомендуют в первую очередь.
    if (readiness < 40) return Math.max(1, load * 0.7);
    if (readiness < 70) return Math.max(1, load * 0.85);
    return load;
  }

  function distributeTasks() {
    var readiness = state.readiness || 50;
    var budget = getDailyBudget(readiness, state.dayState);
    var slotKeys = [SLOT_KEYS.morningFocus, SLOT_KEYS.dayOps, SLOT_KEYS.eveningLight];

    var routines = [];
    var regular = [];
    state.tasks.forEach(function (task) {
      if (isRoutineTask(task)) routines.push(task);
      else regular.push(task);
    });

    var remaining = budget;
    var movedToScheduled = 0;
    var carry = [];
    var kept = [];

    routines.sort(function (a, b) {
      return (Number(a.order) || 0) - (Number(b.order) || 0);
    });

    routines.forEach(function (task) {
      task.slotKey = SLOT_KEYS.morningRoutine;
      remaining -= getRoutineBudgetLoad(task, readiness);
      kept.push(task);
    });

    var sorted = regular.slice().sort(comparePriority);

    sorted.forEach(function (task) {
      if (task.recommendationId && String(task.recommendationId).indexOf("morning:") === 0) {
        if (!task.slotKey || task.slotKey === SLOT_KEYS.none) {
          task.slotKey = SLOT_KEYS.eveningLight;
        }
        remaining -= getTaskLoad(task);
        kept.push(task);
        return;
      }

      var load = getTaskLoad(task);
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
      if (isRoutineTask(task)) return;
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

  function isMorningRecommendationTask(task) {
    return !!(task && task.recommendationId && String(task.recommendationId).indexOf("morning:") === 0);
  }

  function isPinnedRecommendationTask(task) {
    return isMorningRecommendationTask(task);
  }

  function compareRecommendationTasks(a, b) {
    var aMorning = a.slotKey === SLOT_KEYS.morningFocus || a.slotKey === SLOT_KEYS.morningRoutine;
    var bMorning = b.slotKey === SLOT_KEYS.morningFocus || b.slotKey === SLOT_KEYS.morningRoutine;
    if (aMorning !== bMorning) return aMorning ? -1 : 1;
    return Number(a.order || 0) - Number(b.order || 0);
  }

  function resolveRecommendationSlotKey(taskDef) {
    var raw = taskDef && taskDef.slotKey ? String(taskDef.slotKey) : "eveningLight";
    if (raw === SLOT_KEYS.morningFocus || raw === "morningFocus") return SLOT_KEYS.morningFocus;
    if (raw === SLOT_KEYS.morningRoutine || raw === "morningRoutine") return SLOT_KEYS.morningRoutine;
    if (raw === SLOT_KEYS.dayOps || raw === "dayOps") return SLOT_KEYS.dayOps;
    if (raw === SLOT_KEYS.eveningLight || raw === "eveningLight") return SLOT_KEYS.eveningLight;
    return SLOT_KEYS.eveningLight;
  }

  function renderTaskRow(task, index, isRecommendation) {
    var slotLabel = t(task.slotKey || SLOT_KEYS.none);
    var title = escapeHtml(task.title || "");
    var slot = escapeHtml(slotLabel || "");
    var routineChip = isRoutineTask(task)
      ? '<span class="routine-chip">' + escapeHtml(t("planner.tasks.routineChip")) + "</span>"
      : "";
    var rowClass = "task-row" + (isRecommendation ? " task-row-recommendation" : "");

    return [
      '<tr class="' + rowClass + '" data-task-id="' + escapeAttr(task.id) + '">',
        '<td class="order-cell">',
          '<span class="drag-handle" title="' + escapeAttr(t("planner.tasks.dragHandle")) + '">⋮⋮</span>',
          '<span class="order-index">' + index + "</span>",
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
  }

  function renderTasks() {
    if (!state.tasks.length) {
      el.taskTableBody.innerHTML =
        '<tr><td colspan="8" class="muted">' + escapeHtml(t("planner.tasks.empty")) + "</td></tr>";
      return;
    }

    var sortedTasks = state.tasks.slice().sort(compareTasksForDisplay);
    var recommendationTasks = sortedTasks.filter(isPinnedRecommendationTask).sort(compareRecommendationTasks);
    var mainTasks = sortedTasks.filter(function (task) {
      return !isPinnedRecommendationTask(task);
    });
    var htmlParts = [];
    var rowIndex = 0;

    recommendationTasks.forEach(function (task) {
      rowIndex += 1;
      htmlParts.push(renderTaskRow(task, rowIndex, true));
    });

    if (recommendationTasks.length && mainTasks.length) {
      htmlParts.push('<tr class="task-group-spacer" aria-hidden="true"><td colspan="8"></td></tr>');
    }

    mainTasks.forEach(function (task) {
      rowIndex += 1;
      htmlParts.push(renderTaskRow(task, rowIndex, false));
    });

    el.taskTableBody.innerHTML = htmlParts.join("");

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

  function calcReadiness(m) {
    var sleepScore = Math.min(100, (m.sleepHours / 8) * 100);
    var quality = (m.sleepQuality / 5) * 100;
    // Поле energy: шкала усталости/мало энергии (1 — мало, 5 — сильно).
    var fatigueLevel = Number(m.energy);
    if (!Number.isFinite(fatigueLevel)) fatigueLevel = 3;
    var vitality = ((6 - fatigueLevel) / 5) * 100;
    var stressPenalty = ((m.stress - 1) / 4) * 40;

    // Старые чек-ины с полем wellbeing сохраняем совместимыми.
    if (m.wellbeing != null && Number.isFinite(Number(m.wellbeing))) {
      var wellbeing = (Number(m.wellbeing) / 5) * 100;
      return Math.max(
        0,
        Math.round(0.30 * sleepScore + 0.25 * quality + 0.20 * vitality + 0.25 * wellbeing - stressPenalty)
      );
    }

    return Math.max(
      0,
      Math.round(0.35 * sleepScore + 0.30 * quality + 0.35 * vitality - stressPenalty)
    );
  }

  function getReadinessLevel(readiness) {
    if (readiness < 40) return "low";
    if (readiness < 70) return "medium";
    return "high";
  }

  var SELF_CONTROL_STORAGE_KEY = "upeak_self_control_trait";

  function getSelfControlTrait() {
    var fromState = Number(state.selfControlTrait);
    if (Number.isFinite(fromState) && fromState >= 1 && fromState <= 5) {
      return fromState;
    }
    try {
      var stored = Number(localStorage.getItem(SELF_CONTROL_STORAGE_KEY));
      if (Number.isFinite(stored) && stored >= 1 && stored <= 5) return stored;
    } catch (_e) {}
    return 3;
  }

  function getDailyBudget(readiness, dayState) {
    var level = getReadinessLevelFromDayState(dayState) || getReadinessLevel(readiness);
    var budget = level === "low" ? 7 : level === "medium" ? 11 : 16;
    var selfControlTrait = getSelfControlTrait();
    if (selfControlTrait < 3 && readiness < 40) {
      budget = Math.round(budget * 0.85);
    }
    return budget;
  }

  function getReadinessLevelFromDayState(dayState) {
    if (!dayState || !dayState.state) return null;
    if (dayState.state === "emergency_recovery" || dayState.sub_state === "mixed_severe") {
      return "low";
    }
    if (dayState.state === "high_performance") return "high";
    return "medium";
  }

  function getDayStateLabel(dayState) {
    if (window.UpeakDayRecommendations && typeof window.UpeakDayRecommendations.getStateLabel === "function") {
      return window.UpeakDayRecommendations.getStateLabel(dayState);
    }
    return dayState && dayState.state ? dayState.state : "";
  }

  function updateReadiness() {
    if (!el.readinessValue) return;
    if (state.readiness == null) {
      el.readinessValue.textContent = "—";
      return;
    }
    var label = getDayStateLabel(state.dayState);
    el.readinessValue.textContent = label
      ? state.readiness + " · " + label
      : String(state.readiness);
  }

  function buildEveningReview() {
    if (!state.evening || !window.UpeakEveningRecommendations) return null;
    var recs = window.UpeakEveningRecommendations.getRecommendations({
      morningScore: state.readiness == null ? 0 : state.readiness,
      completedTasks: state.evening.completed,
      totalTasks: state.evening.total,
      evening: state.evening
    });
    return recs.length ? recs[0] : null;
  }

  function refreshEveningReview() {
    if (state.evening && state.evening.date === today) {
      state.eveningReview = buildEveningReview();
    }
  }

  function renderWhyHtml(why) {
    if (!why) return "";
    if (typeof why === "string") {
      return '<p class="intervention-why-text">' + escapeHtml(why) + "</p>";
    }
    var html = '<div class="intervention-why-inner">';
    if (why.text) {
      html += '<p class="intervention-why-text">' + escapeHtml(why.text) + "</p>";
    }
    if (why.evidence_level) {
      html += '<p class="intervention-why-meta">Доказательность: ' + escapeHtml(why.evidence_level) + "</p>";
    }
    if (Array.isArray(why.sources) && why.sources.length) {
      why.sources.forEach(function (src) {
        if (!src || !src.title) return;
        var label = src.title +
          (src.authors ? " — " + src.authors : "") +
          (src.year ? " (" + src.year + ")" : "");
        html += '<p class="intervention-why-source">';
        if (src.url) {
          html += '<a href="' + escapeHtml(src.url) + '" target="_blank" rel="noopener noreferrer">' +
            escapeHtml(label) + "</a>";
        } else {
          html += escapeHtml(label);
        }
        html += "</p>";
      });
    } else if (why.source) {
      html += '<p class="intervention-why-source">';
      if (why.url) {
        html += '<a href="' + escapeHtml(why.url) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(why.source) + "</a>";
      } else {
        html += escapeHtml(why.source);
      }
      html += "</p>";
    }
    if (Array.isArray(why.limitations) && why.limitations.length) {
      html += '<ul class="intervention-why-list">';
      why.limitations.forEach(function (item) {
        html += "<li>" + escapeHtml(item) + "</li>";
      });
      html += "</ul>";
    }
    html += "</div>";
    return html;
  }

  function renderEveningRecommendationCard(rec, idx) {
    var html = '<article class="intervention-card intervention-summary">';
    html += '<h3 class="intervention-title">' + escapeHtml(rec.title || "Итог дня") + "</h3>";
    html += '<p class="intervention-meta">Выполнено: ' + escapeHtml(rec.completionRate) + "%</p>";
    html += '<p class="intervention-text">' + escapeHtml(rec.summary || "") + "</p>";

    if (rec.hint) {
      html += '<p class="intervention-meta">' + escapeHtml(rec.hint) + "</p>";
    }

    if (Array.isArray(rec.actions) && rec.actions.length) {
      html += '<p class="intervention-rec"><strong>' + escapeHtml(rec.planLabel || "Завтра стоит") + ":</strong></p>";
      html += '<ul class="intervention-list">';
      rec.actions.forEach(function (item) {
        html += "<li>" + escapeHtml(item) + "</li>";
      });
      html += "</ul>";
    }

    if (rec.show_why && rec.why && rec.why.text) {
      html += '<button type="button" class="intervention-why-btn" data-why-target="eveningWhy' + idx +
        '" aria-expanded="false">Почему?</button>';
      html += '<div class="intervention-why hidden" id="eveningWhy' + idx + '">' +
        renderWhyHtml(rec.why) + "</div>";
    }

    html += "</article>";
    return html;
  }

  function getMorningEmbedContext() {
    var decisions = {};
    if (hasMorningCheckinToday() && state.morningEmbedDecisions) {
      decisions = state.morningEmbedDecisions;
    }
    var existingIds = [];
    if (Array.isArray(state.tasks)) {
      state.tasks.forEach(function (task) {
        if (task && task.recommendationId) existingIds.push(task.recommendationId);
      });
    }
    return { decisions: decisions, existingIds: existingIds };
  }

  function buildMorningRecommendations() {
    if (!state.dayState || !window.UpeakDayRecommendations) return [];
    return window.UpeakDayRecommendations.getRecommendations(state.dayState, getMorningEmbedContext());
  }

  function findMorningEmbedOffer(embedId) {
    if (!window.UpeakDayRecommendations || typeof window.UpeakDayRecommendations.getMorningEmbeddable !== "function") {
      return null;
    }
    var def = window.UpeakDayRecommendations.getMorningEmbeddable(embedId);
    if (!def || !def.task) return null;
    return {
      id: def.id,
      task: Object.assign({}, def.task)
    };
  }

  function ensureMorningEmbedState() {
    if (!state.morningEmbedDecisions || typeof state.morningEmbedDecisions !== "object") {
      state.morningEmbedDecisions = {};
    }
    if (!state.morningEmbedDate) state.morningEmbedDate = today;
  }

  function addMorningEmbedToPlan(embedId) {
    var offer = findMorningEmbedOffer(embedId);
    if (!offer || !offer.task) return;

    ensureMorningEmbedState();
    var recId = "morning:" + embedId;
    if (state.morningEmbedDecisions[embedId] === "added" ||
        state.morningEmbedDecisions[embedId] === "later") {
      return;
    }
    if (state.tasks.some(function (task) { return task.recommendationId === recId; })) {
      state.morningEmbedDecisions[embedId] = "added";
      state.morningEmbedDate = today;
      saveState();
      state.morningRecommendations = buildMorningRecommendations();
      renderMorningRecommendations();
      return;
    }

    var taskDef = offer.task;
    var slotKey = resolveRecommendationSlotKey(taskDef);
    state.tasks.push({
      id: makeId(),
      title: taskDef.title,
      duration: Number(taskDef.duration) || 15,
      difficulty: Number(taskDef.difficulty) || 5,
      urgency: Number(taskDef.urgency) || 5,
      routine: false,
      done: false,
      order: -1,
      slotKey: slotKey,
      recommendationId: recId
    });

    distributeTasks();

    state.morningEmbedDecisions[embedId] = "added";
    state.morningEmbedDate = today;
    saveState();
    renderTasks();
    state.morningRecommendations = buildMorningRecommendations();
    renderMorningRecommendations();
    updateFact();

    var tasksSection = el.taskTableBody && el.taskTableBody.closest("section");
    if (tasksSection) {
      tasksSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    if (requireVerifiedParticipantId(false)) {
      sync("morning_embed_added", { embedId: embedId, title: taskDef.title });
    }
  }

  function deferMorningEmbed(embedId) {
    ensureMorningEmbedState();
    state.morningEmbedDecisions[embedId] = "later";
    state.morningEmbedDate = today;
    saveState();
    state.morningRecommendations = buildMorningRecommendations();
    renderMorningRecommendations();
  }

  function renderMorningEmbedOffer(offer) {
    if (!offer || offer.status !== "pending") return "";

    var html = '<div class="intervention-embed" data-embed-id="' + escapeAttr(offer.id) + '">';
    html += '<p class="intervention-embed-text">' + escapeHtml(offer.prompt) + "</p>";
    if (offer.detail) {
      html += '<p class="intervention-meta">' + escapeHtml(offer.detail) + "</p>";
    }
    html += '<div class="intervention-embed-actions">';
    html += '<button type="button" class="btn intervention-embed-btn" data-morning-embed-add="' +
      escapeAttr(offer.id) + '">' + escapeHtml(t("planner.morning.embedAdd")) + "</button>";
    html += '<button type="button" class="btn secondary intervention-embed-btn" data-morning-embed-later="' +
      escapeAttr(offer.id) + '">' + escapeHtml(t("planner.morning.embedLater")) + "</button>";
    html += "</div>";
    html += "</div>";
    return html;
  }

  function bindMorningEmbedActions(container) {
    container.querySelectorAll("[data-morning-embed-add]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var embedId = btn.getAttribute("data-morning-embed-add");
        if (embedId) addMorningEmbedToPlan(embedId);
      });
    });
    container.querySelectorAll("[data-morning-embed-later]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var embedId = btn.getAttribute("data-morning-embed-later");
        if (embedId) deferMorningEmbed(embedId);
      });
    });
  }

  function renderRecommendationCard(rec, idx) {
    var html = '<article class="intervention-card">';
    var tone = rec.tone || "steady";
    var emoji = tone === "growth" || tone === "high" ? "🟢" : tone === "recovery" ? "🔴" : "🟡";
    var stateText = rec.state || rec.diagnosis || rec.summary || rec.today || rec.text || "";
    var planLabel = rec.plan_label || "Сегодня";
    var proof = rec.proof || rec.why;
    var showProof = rec.show_proof || rec.show_why;

    if (rec.state_title) {
      html += '<p class="intervention-state-badge">' + escapeHtml(rec.state_title) + "</p>";
    }
    html += '<p class="intervention-diagnosis">' + emoji + " " + escapeHtml(stateText) + "</p>";

    if (rec.decision) {
      html += '<p class="intervention-decision">' + escapeHtml(rec.decision) + "</p>";
    }

    if (Array.isArray(rec.actions) && rec.actions.length) {
      html += '<p class="intervention-rec"><strong>' + escapeHtml(planLabel) + "</strong></p>";
      html += '<ul class="intervention-list">';
      rec.actions.forEach(function (item) {
        html += "<li>" + escapeHtml(item) + "</li>";
      });
      html += "</ul>";
    }

    if (Array.isArray(rec.avoid) && rec.avoid.length) {
      html += '<p class="intervention-avoid-label"><strong>Избегай</strong></p>';
      html += '<ul class="intervention-avoid-list">';
      rec.avoid.forEach(function (item) {
        html += "<li>" + escapeHtml(item) + "</li>";
      });
      html += "</ul>";
    }

    if (rec.move_to_max) {
      html += '<p class="intervention-move-label"><strong>Как выйти на максимум</strong></p>';
      html += '<p class="intervention-move">' + escapeHtml(rec.move_to_max) + "</p>";
    }

    if (rec.benefit) {
      html += '<p class="intervention-benefit-label"><strong>Почему это важно</strong></p>';
      html += '<p class="intervention-benefit">' + escapeHtml(rec.benefit) + "</p>";
    }

    if (rec.result) {
      html += '<p class="intervention-result-label"><strong>Потенциальный эффект</strong></p>';
      if (rec.result_condition) {
        html += '<p class="intervention-result-condition">' + escapeHtml(rec.result_condition) + "</p>";
      }
      html += '<p class="intervention-result">' + escapeHtml(rec.result) + "</p>";
      if (rec.result_disclaimer) {
        html += '<p class="intervention-result-disclaimer">' + escapeHtml(rec.result_disclaimer) + "</p>";
      }
    }

    if (showProof && proof && (proof.text || (proof.sources && proof.sources.length))) {
      html += '<button type="button" class="intervention-why-btn" data-why-target="morningWhy' + idx +
        '" aria-expanded="false">Почему?</button>';
      html += '<div class="intervention-why hidden" id="morningWhy' + idx + '">' +
        renderWhyHtml(proof) + "</div>";
    }

    html += "</article>";
    return html;
  }

  function refreshInterventionBlocks() {
    if (hasMorningCheckinToday()) {
      if (state.dayState && window.UpeakDayRecommendations) {
        state.morningRecommendations = buildMorningRecommendations();
      }
      renderMorningRecommendations();
    } else {
      renderMorningRecommendations();
    }

    if (state.evening && state.evening.date === today) {
      refreshEveningReview();
      renderEveningReview();
    } else {
      renderEveningReview();
    }
  }

  function renderMorningRecommendations() {
    var container = el.morningRecommendations;
    if (!container) return;

    if (hasMorningCheckinToday() && state.dayState && window.UpeakDayRecommendations) {
      state.morningRecommendations = buildMorningRecommendations();
    }

    var recs = state.morningRecommendations;
    var show = hasMorningCheckinToday() &&
      Array.isArray(recs) && recs.length > 0;

    if (!show) {
      container.classList.add("hidden");
      container.innerHTML = "";
      return;
    }

    container.classList.remove("hidden");
    var stateLine = state.dayState
      ? ' <span class="intervention-meta">' + escapeHtml(getDayStateLabel(state.dayState)) + "</span>"
      : "";
    var embedHtml = "";
    if (recs[0] && Array.isArray(recs[0].embedOffers) && recs[0].embedOffers.length) {
      embedHtml = recs[0].embedOffers.map(function (offer) {
        return renderMorningEmbedOffer(offer);
      }).join("");
    }

    container.innerHTML =
      '<h3 class="intervention-title">Рекомендации на сегодня' + stateLine + "</h3>" +
      recs.map(function (rec, idx) {
        return renderRecommendationCard(rec, idx);
      }).join("") +
      embedHtml;

    bindWhyToggles(container);
    bindMorningEmbedActions(container);
  }

  function renderEveningReview() {
    var container = el.eveningReview;
    if (!container) return;

    var review = state.eveningReview;
    var show = review && state.evening && state.evening.date === today;

    if (!show) {
      container.classList.add("hidden");
      container.innerHTML = "";
      return;
    }

    container.classList.remove("hidden");
    container.innerHTML = renderEveningRecommendationCard(review, 0);
    bindWhyToggles(container);
  }

  function bindWhyToggles(container) {
    container.querySelectorAll(".intervention-why-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-why-target");
        var whyEl = targetId ? document.getElementById(targetId) : null;
        if (!whyEl) return;
        whyEl.classList.toggle("hidden");
        btn.setAttribute("aria-expanded", whyEl.classList.contains("hidden") ? "false" : "true");
      });
    });
  }

  // План-факт считается только по задачам на сегодня. Запланированные на завтра
  // в знаменатель не попадают, поэтому 3 исходных задачи → 1 перенесена = 2/2.
  function updateFact() {
    var done = state.tasks.filter(function (task) { return task.done; }).length;
    var total = state.tasks.length;
    if (el.factValue) {
      el.factValue.textContent = done + "/" + total;
    }
  }

  function updateDayStatus() {
    if (!el.dayStatus) return;
    var closedToday = !!(state.dayClosedAt && state.evening && state.evening.date === today);
    el.dayStatus.textContent = closedToday ? t("planner.evening.dayClosed") : t("planner.evening.dayOpen");
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

  function compareTasksForDisplay(a, b) {
    if (state.manualOrder) {
      return Number(a.order || 0) - Number(b.order || 0);
    }

    var aPinned = isPinnedRecommendationTask(a);
    var bPinned = isPinnedRecommendationTask(b);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) return compareRecommendationTasks(a, b);

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

  function tomorrowISO() {
    var date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  function parseTaskTitle(rawTitle) {
    return { title: cleanTaskTitle(rawTitle), routine: false };
  }

  function cleanTaskTitle(title) {
    return String(title || "").trim().slice(0, 140);
  }

  function isRoutineTask(task) {
    return Boolean(
      task && (task.routine || task.slotKey === SLOT_KEYS.morningRoutine)
    );
  }

  // Priority comparator used during distribution and display.
  // Срочность важнее остального, потом важность (urgency×2.5 + difficulty×1.5 + duration_hours×0.5),
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
    var urgency = Number(task.urgency) || 0;
    var difficulty = Number(task.difficulty) || 0;
    var durationHours = (Number(task.duration) || 0) / 60;
    return (urgency * 2.5) + (difficulty * 1.5) + (durationHours * 0.5);
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

  function getSleepHours() {
    var node = byId("sleepHours");
    if (!node) return 0;
    var raw = String(node.value || "").trim().replace(",", ".");
    var value = Number(raw);
    if (!Number.isFinite(value)) return 0;
    var clamped = Math.max(0, Math.min(14, value));
    // Нормализуем к шагу в 30 минут.
    var snapped = Math.round(clamped * 2) / 2;
    node.value = snapped % 1 === 0 ? String(snapped) : snapped.toFixed(1);
    return snapped;
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
      readiness: null,
      tasks: [],
      scheduled: [],
      dayClosedAt: "",
      manualOrder: false,
      lastRoutineResetDate: "",
      morningEmbedDecisions: {},
      morningEmbedDate: ""
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