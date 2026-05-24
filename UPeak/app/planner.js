(function () {
  var KEY = "upeak_planner_v1";
  var DEFAULT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwB1lvN-ONVhMjUgkF0SK7QUjp7ANAjSIcLqlXGPFTV-117XVO8VsI78ilHyyYa1Ew1/exec";
  var today = new Date().toISOString().slice(0, 10);
  var state = loadState();
  var dragTaskId = null;

  var el = {
    readinessValue: byId("readinessValue"),
    factValue: byId("factValue"),
    taskBlocks: byId("taskBlocks"),
    planSummary: byId("planSummary"),
    dayStatus: byId("dayStatus"),
    taskSubmitBtn: byId("taskSubmitBtn"),
    cancelEditBtn: byId("cancelEditBtn"),
  };
  var editingTaskId = null;

  renderTasks();
  updateFact();
  updatePlanSummary();
  updateReadiness();
  updateDayStatus();

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
    saveState();
    renderTasks();
    updateFact();
    updatePlanSummary();
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
      duration: getNum("taskDuration"),
    };

    if (editingTaskId) {
      state.tasks = state.tasks.map(function (task) {
        if (task.id !== editingTaskId) return task;
        var nextSlot = formTask.routine ? "Утро (рутина)" : (task.slot === "Утро (рутина)" ? "Без слота" : task.slot);
        return Object.assign({}, task, formTask, { slot: nextSlot });
      });
      sync("task_edited", Object.assign({ id: editingTaskId }, formTask));
      resetTaskFormMode(event.target);
    } else {
      var task = Object.assign({
        id: makeId(),
        done: false,
        slot: formTask.routine ? "Утро (рутина)" : "Без слота",
        subtasks: [],
        order: state.tasks.length
      }, formTask);
      state.tasks.push(task);
      event.target.reset();
      sync("task_created", task);
    }

    saveState();
    renderTasks();
    updateFact();
    updatePlanSummary();
  });

  el.cancelEditBtn.addEventListener("click", function () {
    resetTaskFormMode(byId("taskForm"));
  });

  byId("planBtn").addEventListener("click", function () {
    distributeTasks();
    state.planDistributed = true;
    saveState();
    renderTasks();
    updateFact();
    updatePlanSummary();
    var stats = getPlanStats();
    sync("plan_generated", {
      readiness: state.readiness,
      plannedToday: stats.planned,
      postponed: stats.postponed,
      tasks: state.tasks
    });
  });

  byId("eveningForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var stats = getPlanStats();
    state.evening = {
      date: today,
      productivity: getNum("productivity"),
      fatigue: getNum("fatigue"),
      note: byId("eveningNote").value.trim(),
      completed: stats.completed,
      total: stats.planned,
      planDistributed: state.planDistributed,
      totalWritten: state.tasks.length
    };
    state.dayClosedAt = new Date().toISOString();
    saveState();
    updateFact();
    updateDayStatus();
    sync("evening_checkout", state.evening);
  });

  function distributeTasks() {
    var readiness = state.readiness || 50;
    var budget = readiness < 40 ? 7 : readiness < 70 ? 11 : 16;
    var slots = ["Утро (фокус)", "День (операционка)", "Вечер (лёгкие)"];
    var remaining = budget;

    var routines = [];
    var regular = [];
    state.tasks.forEach(function (task) {
      if (isRoutineTask(task)) routines.push(task);
      else regular.push(task);
    });

    routines.sort(function (a, b) { return taskPriorityScore(b) - taskPriorityScore(a); });
    regular.sort(function (a, b) { return taskPriorityScore(b) - taskPriorityScore(a); });

    var sorted = routines.concat(regular);

    sorted.forEach(function (task) {
      if (isRoutineTask(task)) {
        task.slot = "Утро (рутина)";
        task.planBucket = "today";
        var load = taskLoad(task);
        remaining -= load;
        return;
      }
      var load = taskLoad(task);
      if (remaining <= 0 || (readiness < 45 && task.difficulty >= 4 && task.urgency < 4)) {
        task.slot = "Перенести на завтра";
        task.planBucket = "postpone";
        return;
      }
      task.slot = load >= 6 ? slots[0] : load >= 4 ? slots[1] : slots[2];
      task.planBucket = "today";
      remaining -= load;
    });

    state.tasks = sorted.map(function (t, i) {
      t.order = i;
      return t;
    });
  }

  function activateDailyRoutine() {
    if (state.lastRoutineResetDate === today) return;
    var routineCount = 0;
    state.tasks = state.tasks.map(function (task) {
      if (!isRoutineTask(task)) return task;
      routineCount += 1;
      return Object.assign({}, task, {
        done: false,
        slot: "Утро (рутина)",
        planBucket: state.planDistributed ? "today" : task.planBucket
      });
    });
    state.lastRoutineResetDate = today;
    if (routineCount > 0) sync("routine_activated", { count: routineCount });
  }

  function renderTasks() {
    if (!state.tasks.length) {
      el.taskBlocks.innerHTML = "<p class='muted'>Пока нет задач</p>";
      return;
    }

    var groups = getTaskGroups();
    var html = "";

    groups.forEach(function (group) {
      html += "<section class='task-block' data-bucket='" + group.key + "'>";
      html += "<h3 class='block-title'>" + escapeHtml(group.title) + " <span class='block-count'>" + group.tasks.length + "</span></h3>";
      html += "<div class='block-list' data-drop-bucket='" + group.key + "'>";
      group.tasks.forEach(function (task) {
        html += renderTaskRow(task);
      });
      html += "</div></section>";
    });

    el.taskBlocks.innerHTML = html;
    bindTaskEvents();
  }

  function renderTaskRow(task) {
    var isRoutine = isRoutineTask(task);
    var subtasksHtml = "";
    if (task.subtasks && task.subtasks.length) {
      subtasksHtml = "<ul class='subtask-list'>" + task.subtasks.map(function (st) {
        return "<li class='subtask-item'>" +
          "<input type='checkbox' data-subtask-id='" + st.id + "' data-parent-id='" + task.id + "' " + (st.done ? "checked" : "") + " />" +
          "<span class='" + (st.done ? "task-done" : "") + "'>" + escapeHtml(st.title) + "</span>" +
          "</li>";
      }).join("") + "</ul>";
    }

    return "<article class='task-row' draggable='true' data-id='" + task.id + "' data-bucket='" + (task.planBucket || "pool") + "'>" +
      "<span class='drag-handle' title='Перетащить'>⠿</span>" +
      "<input type='checkbox' class='task-check' data-id='" + task.id + "' " + (isTaskDone(task) ? "checked" : "") + " />" +
      "<div class='task-main'>" +
        "<div class='task-title-line'>" +
          "<span class='" + (isTaskDone(task) ? "task-done" : "") + "'>" + escapeHtml(cleanTaskTitle(task.title)) + "</span>" +
          (isRoutine ? "<span class='routine-chip'>Рутина</span>" : "") +
        "</div>" +
        "<div class='task-meta muted'>" +
          "Сложн. " + task.difficulty + " · Срочн. " + task.urgency + " · " + task.duration + " мин" +
        "</div>" +
        subtasksHtml +
      "</div>" +
      "<span class='slot-chip'>" + escapeHtml(task.slot || "Без слота") + "</span>" +
      "<div class='actions-cell'>" +
        "<button type='button' class='menu-btn' data-menu-id='" + task.id + "' aria-label='Действия'>⋯</button>" +
        "<div class='row-menu hidden' data-menu-panel='" + task.id + "'>" +
          "<button type='button' class='menu-item' data-action='edit' data-id='" + task.id + "'>Редактировать</button>" +
          "<button type='button' class='menu-item' data-action='subtask' data-id='" + task.id + "'>Добавить подзадачу</button>" +
          "<button type='button' class='menu-item' data-action='move-today' data-id='" + task.id + "'>В план на сегодня</button>" +
          "<button type='button' class='menu-item' data-action='move-postpone' data-id='" + task.id + "'>Перенести на завтра</button>" +
          "<button type='button' class='menu-item danger' data-action='delete' data-id='" + task.id + "'>Удалить</button>" +
        "</div>" +
      "</div>" +
    "</article>";
  }

  function bindTaskEvents() {
    el.taskBlocks.querySelectorAll(".task-check").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.getAttribute("data-id");
        state.tasks = state.tasks.map(function (task) {
          if (task.id !== id) return task;
          return Object.assign({}, task, { done: cb.checked });
        });
        saveState();
        renderTasks();
        updateFact();
        sync("task_toggled", { id: id, done: cb.checked });
      });
    });

    el.taskBlocks.querySelectorAll("input[data-subtask-id]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var parentId = cb.getAttribute("data-parent-id");
        var subId = cb.getAttribute("data-subtask-id");
        state.tasks = state.tasks.map(function (task) {
          if (task.id !== parentId) return task;
          var subtasks = (task.subtasks || []).map(function (st) {
            if (st.id !== subId) return st;
            return Object.assign({}, st, { done: cb.checked });
          });
          var allDone = subtasks.length > 0 && subtasks.every(function (s) { return s.done; });
          return Object.assign({}, task, { subtasks: subtasks, done: subtasks.length ? allDone : task.done });
        });
        saveState();
        renderTasks();
        updateFact();
      });
    });

    el.taskBlocks.querySelectorAll("button[data-menu-id]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var menuId = btn.getAttribute("data-menu-id");
        var panel = el.taskBlocks.querySelector("div[data-menu-panel='" + menuId + "']");
        if (!panel) return;
        var shouldOpen = panel.classList.contains("hidden");
        closeAllMenus();
        if (shouldOpen) panel.classList.remove("hidden");
      });
    });

    el.taskBlocks.querySelectorAll("button[data-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var action = btn.getAttribute("data-action");
        var id = btn.getAttribute("data-id");
        if (action === "edit") { startEditTask(id); closeAllMenus(); return; }
        if (action === "subtask") { addSubtask(id); closeAllMenus(); return; }
        if (action === "move-today") { moveTaskBucket(id, "today"); closeAllMenus(); return; }
        if (action === "move-postpone") { moveTaskBucket(id, "postpone"); closeAllMenus(); return; }
        if (action === "delete") { deleteTask(id); closeAllMenus(); return; }
      });
    });

    el.taskBlocks.querySelectorAll(".task-row").forEach(function (row) {
      row.addEventListener("dragstart", function (e) {
        dragTaskId = row.getAttribute("data-id");
        row.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      row.addEventListener("dragend", function () {
        row.classList.remove("dragging");
        dragTaskId = null;
        el.taskBlocks.querySelectorAll(".block-list").forEach(function (l) { l.classList.remove("drag-over"); });
      });
    });

    el.taskBlocks.querySelectorAll(".block-list").forEach(function (list) {
      list.addEventListener("dragover", function (e) {
        e.preventDefault();
        list.classList.add("drag-over");
        var after = getDragAfterElement(list, e.clientY);
        var dragging = el.taskBlocks.querySelector(".task-row.dragging");
        if (!dragging) return;
        if (after == null) list.appendChild(dragging);
        else list.insertBefore(dragging, after);
      });
      list.addEventListener("dragleave", function () {
        list.classList.remove("drag-over");
      });
      list.addEventListener("drop", function (e) {
        e.preventDefault();
        list.classList.remove("drag-over");
        if (!dragTaskId) return;
        var bucket = list.getAttribute("data-drop-bucket");
        applyDropOrder(list, bucket);
      });
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest(".actions-cell")) closeAllMenus();
    }, { once: true });
  }

  function applyDropOrder(listEl, bucket) {
    var ids = [];
    listEl.querySelectorAll(".task-row").forEach(function (row, index) {
      var id = row.getAttribute("data-id");
      ids.push({ id: id, order: index });
    });
    state.tasks = state.tasks.map(function (task) {
      var found = ids.find(function (x) { return x.id === task.id; });
      if (!found) return task;
      var updated = Object.assign({}, task, { order: found.order });
      if (state.planDistributed) {
        updated.planBucket = bucket;
        if (bucket === "postpone") updated.slot = "Перенести на завтра";
        else if (bucket === "today" && isPostponedSlot(task.slot)) {
          updated.slot = isRoutineTask(task) ? "Утро (рутина)" : "День (операционка)";
        }
      }
      return updated;
    });
    saveState();
    renderTasks();
    updateFact();
    updatePlanSummary();
  }

  function getDragAfterElement(container, y) {
    var elements = [].slice.call(container.querySelectorAll(".task-row:not(.dragging)"));
    return elements.reduce(function (closest, child) {
      var box = child.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  function moveTaskBucket(id, bucket) {
    state.tasks = state.tasks.map(function (task) {
      if (task.id !== id) return task;
      var slot = bucket === "postpone" ? "Перенести на завтра" :
        (isRoutineTask(task) ? "Утро (рутина)" : "День (операционка)");
      return Object.assign({}, task, { planBucket: bucket, slot: slot });
    });
    if (!state.planDistributed) state.planDistributed = true;
    saveState();
    renderTasks();
    updateFact();
    updatePlanSummary();
  }

  function addSubtask(parentId) {
    var title = window.prompt("Название подзадачи:");
    if (!title || !title.trim()) return;
    state.tasks = state.tasks.map(function (task) {
      if (task.id !== parentId) return task;
      var subtasks = (task.subtasks || []).slice();
      subtasks.push({ id: makeId(), title: title.trim(), done: false });
      return Object.assign({}, task, { subtasks: subtasks, done: false });
    });
    saveState();
    renderTasks();
    updateFact();
  }

  function deleteTask(id) {
    var removedTask = state.tasks.find(function (t) { return t.id === id; });
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    if (editingTaskId === id) resetTaskFormMode(byId("taskForm"));
    saveState();
    renderTasks();
    updateFact();
    updatePlanSummary();
    sync("task_deleted", { id: id, title: removedTask ? removedTask.title : null });
  }

  function getTaskGroups() {
    var sorted = state.tasks.slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    });

    if (!state.planDistributed) {
      return [{ key: "pool", title: "Все задачи", tasks: sorted }];
    }

    var today = sorted.filter(function (t) { return getEffectiveBucket(t) === "today"; });
    var postpone = sorted.filter(function (t) { return getEffectiveBucket(t) === "postpone"; });

    var groups = [];
    if (today.length) groups.push({ key: "today", title: "Сегодня (план алгоритма)", tasks: today });
    if (postpone.length) groups.push({ key: "postpone", title: "Перенести на завтра", tasks: postpone });
    if (!today.length && !postpone.length) groups.push({ key: "pool", title: "Все задачи", tasks: sorted });
    return groups;
  }

  function getEffectiveBucket(task) {
    if (task.planBucket === "today" || task.planBucket === "postpone") return task.planBucket;
    if (isPostponedSlot(task.slot)) return "postpone";
    if (state.planDistributed) return "today";
    return "pool";
  }

  function getPlanStats() {
    var plannedTasks = state.planDistributed
      ? state.tasks.filter(function (t) { return getEffectiveBucket(t) === "today"; })
      : state.tasks.slice();

    var completed = plannedTasks.filter(function (t) { return isTaskDone(t); }).length;
    return {
      planned: plannedTasks.length,
      completed: completed,
      postponed: state.planDistributed
        ? state.tasks.filter(function (t) { return getEffectiveBucket(t) === "postpone"; }).length
        : 0,
      written: state.tasks.length
    };
  }

  function updateFact() {
    var stats = getPlanStats();
    if (!state.planDistributed) {
      el.factValue.textContent = "Факт: " + stats.completed + "/" + stats.written + " (все задачи, план не распределён)";
      return;
    }
    el.factValue.textContent = "Факт: " + stats.completed + "/" + stats.planned + " по плану · написано " + stats.written + " · перенос " + stats.postponed;
  }

  function updatePlanSummary() {
    var stats = getPlanStats();
    if (!state.planDistributed) {
      el.planSummary.textContent = "План не распределён — в факте учитываются все " + stats.written + " задач.";
      return;
    }
    el.planSummary.textContent = "План на сегодня: " + stats.planned + " задач · перенос: " + stats.postponed + " · всего написано: " + stats.written;
  }

  function closeAllMenus() {
    el.taskBlocks.querySelectorAll("div[data-menu-panel]").forEach(function (panel) {
      panel.classList.add("hidden");
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
    el.taskSubmitBtn.textContent = "Сохранить изменения";
    el.cancelEditBtn.classList.remove("hidden");
    byId("taskTitle").focus();
  }

  function resetTaskFormMode(taskFormEl) {
    editingTaskId = null;
    taskFormEl.reset();
    byId("taskRoutine").checked = false;
    el.taskSubmitBtn.textContent = "Добавить задачу";
    el.cancelEditBtn.classList.add("hidden");
  }

  function calcReadiness(m) {
    var sleepScore = Math.min(100, (m.sleepHours / 8) * 100);
    var quality = (m.sleepQuality / 5) * 100;
    var energy = (m.energy / 5) * 100;
    var wellbeing = (m.wellbeing / 5) * 100;
    var stressPenalty = ((m.stress - 1) / 4) * 40;
    return Math.max(0, Math.round(0.30 * sleepScore + 0.25 * quality + 0.20 * energy + 0.25 * wellbeing - stressPenalty));
  }

  function updateReadiness() {
    el.readinessValue.textContent = "Готовность: " + (state.readiness || "—");
  }

  function updateDayStatus() {
    if (!el.dayStatus) return;
    if (state.evening && state.evening.date === today) {
      el.dayStatus.textContent = "День закрыт: данные сохранены.";
      return;
    }
    el.dayStatus.textContent = "День не закрыт";
  }

  function sync(eventType, payload) {
    if (!state.webhookUrl) return;
    fetch(state.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "upeak_planner",
        eventType: eventType,
        timestamp: new Date().toISOString(),
        date: today,
        userName: state.userName || "anonymous",
        readiness: state.readiness || null,
        payload: payload
      })
    }).catch(function () {});
  }

  function loadState() {
    var raw = localStorage.getItem(KEY) || localStorage.getItem("pulseburn_planner_v1");
    if (!raw) {
      return defaultState();
    }
    var parsed = JSON.parse(raw);
    if (!parsed.webhookUrl) parsed.webhookUrl = DEFAULT_WEBHOOK_URL;
    if (!parsed.lastRoutineResetDate) parsed.lastRoutineResetDate = null;
    if (parsed.planDistributed === undefined) parsed.planDistributed = false;
    parsed.tasks = (parsed.tasks || []).map(function (t, i) {
      return Object.assign({
        subtasks: [],
        order: i,
        planBucket: t.planBucket || null
      }, t);
    });
    return parsed;
  }

  function defaultState() {
    return {
      userName: "",
      webhookUrl: DEFAULT_WEBHOOK_URL,
      readiness: null,
      tasks: [],
      lastRoutineResetDate: null,
      planDistributed: false
    };
  }

  function saveState() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function taskPriorityScore(task) {
    return task.urgency * 3.5 + task.difficulty * 1.2 + Math.ceil(task.duration / 30) * 0.4;
  }

  function taskLoad(task) {
    var subLoad = (task.subtasks || []).length * 0.5;
    return task.difficulty + Math.ceil(task.duration / 45) + subLoad;
  }

  function isTaskDone(task) {
    if (task.subtasks && task.subtasks.length) {
      return task.subtasks.every(function (s) { return s.done; });
    }
    return Boolean(task.done);
  }

  function isPostponedSlot(slot) {
    return String(slot || "").indexOf("Перенести") === 0;
  }

  function isRoutineTask(task) {
    return Boolean(task && task.routine);
  }

  function byId(id) { return document.getElementById(id); }
  function getNum(id) { return Number(byId(id).value || 0); }
  function makeId() { return "t_" + Math.random().toString(36).slice(2, 10); }
  function parseTaskTitle(rawTitle) {
    var cleanTitle = cleanTaskTitle(rawTitle);
    return { title: cleanTitle || "Без названия", routine: false };
  }
  function cleanTaskTitle(title) { return String(title || "").trim(); }
  function escapeHtml(text) {
    return text.replace(/[&<>'"]/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
    });
  }
})();
