(function () {
  var KEY = "pulseburn_planner_v1";
  var DEFAULT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwB1lvN-ONVhMjUgkF0SK7QUjp7ANAjSIcLqlXGPFTV-117XVO8VsI78ilHyyYa1Ew1/exec";
  var today = new Date().toISOString().slice(0, 10);
  var state = loadState();

  var el = {
    readinessValue: byId("readinessValue"),
    factValue: byId("factValue"),
    taskTableBody: byId("taskTableBody"),
    dayStatus: byId("dayStatus"),
    taskSubmitBtn: byId("taskSubmitBtn"),
    cancelEditBtn: byId("cancelEditBtn"),
  };
  var editingTaskId = null;

  renderTasks();
  updateFact();
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
        slot: formTask.routine ? "Утро (рутина)" : "Без слота"
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
    distributeTasks();
    saveState();
    renderTasks();
    sync("plan_generated", { readiness: state.readiness, tasks: state.tasks });
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

  function distributeTasks() {
    var readiness = state.readiness || 50;
    var budget = readiness < 40 ? 7 : readiness < 70 ? 11 : 16;
    var slots = ["Утро (фокус)", "День (операционка)", "Вечер (лёгкие)"];
    var remaining = budget;

    var sorted = state.tasks.slice().sort(function (a, b) {
      var aScore = a.urgency * 2 + a.difficulty;
      var bScore = b.urgency * 2 + b.difficulty;
      return bScore - aScore;
    });

    sorted.forEach(function (task) {
      if (isRoutineTask(task)) {
        task.slot = "Утро (рутина)";
        return;
      }
      var load = task.difficulty + Math.ceil(task.duration / 45);
      if (remaining <= 0) {
        task.slot = "Перенести на завтра";
        return;
      }
      if (readiness < 45 && task.difficulty >= 4) {
        task.slot = "Перенести или упростить";
        return;
      }
      task.slot = load >= 6 ? slots[0] : load >= 4 ? slots[1] : slots[2];
      remaining -= load;
    });

    state.tasks = sorted;
  }

  function activateDailyRoutine() {
    if (state.lastRoutineResetDate === today) {
      return;
    }
    var routineCount = 0;
    state.tasks = state.tasks.map(function (task) {
      if (!isRoutineTask(task)) {
        return task;
      }
      routineCount += 1;
      return Object.assign({}, task, {
        done: false,
        slot: "Утро (рутина)"
      });
    });
    state.lastRoutineResetDate = today;
    if (routineCount > 0) {
      sync("routine_activated", { count: routineCount });
    }
  }

  function renderTasks() {
    if (!state.tasks.length) {
      el.taskTableBody.innerHTML = "<tr><td colspan='7' class='muted'>Пока нет задач</td></tr>";
      return;
    }
    var displayTasks = state.tasks.slice().sort(compareTasksForDisplay);
    el.taskTableBody.innerHTML = displayTasks.map(function (task) {
      var isRoutine = isRoutineTask(task);
      return "<tr>" +
        "<td><input type='checkbox' data-id='" + task.id + "' " + (task.done ? "checked" : "") + " /></td>" +
        "<td class='" + (task.done ? "task-done" : "") + "'><span class='task-title'>" + escapeHtml(cleanTaskTitle(task.title)) + (isRoutine ? "<span class='routine-chip'>Рутина</span>" : "") + "</span></td>" +
        "<td>" + task.difficulty + "</td>" +
        "<td>" + task.urgency + "</td>" +
        "<td>" + task.duration + "</td>" +
        "<td><span class='slot-chip'>" + escapeHtml(task.slot || "Без слота") + "</span></td>" +
        "<td class='actions-cell'>" +
          "<button type='button' class='menu-btn' data-menu-id='" + task.id + "' aria-label='Действия'>⋯</button>" +
          "<div class='row-menu hidden' data-menu-panel='" + task.id + "'>" +
            "<button type='button' class='menu-item' data-action='edit' data-id='" + task.id + "'>Редактировать</button>" +
            "<button type='button' class='menu-item' data-action='delete' data-id='" + task.id + "'>Удалить</button>" +
          "</div>" +
        "</td>" +
      "</tr>";
    }).join("");

    el.taskTableBody.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
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
      btn.addEventListener("click", function () {
        var menuId = btn.getAttribute("data-menu-id");
        var panel = el.taskTableBody.querySelector("div[data-menu-panel='" + menuId + "']");
        if (!panel) return;
        var shouldOpen = panel.classList.contains("hidden");
        closeAllMenus();
        if (shouldOpen) {
          panel.classList.remove("hidden");
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
          return;
        }
      });
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest("td.actions-cell")) {
        closeAllMenus();
      }
    }, { once: true });
  }

  function closeAllMenus() {
    el.taskTableBody.querySelectorAll("div[data-menu-panel]").forEach(function (panel) {
      if (!panel.classList.contains("hidden")) {
        panel.classList.add("hidden");
      }
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

  function updateFact() {
    var completed = state.tasks.filter(function (t) { return t.done; }).length;
    el.factValue.textContent = "Факт: " + completed + "/" + state.tasks.length + " выполнено";
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
    if (!state.webhookUrl) {
      return;
    }

    var body = {
      source: "pulseburn_planner",
      eventType: eventType,
      timestamp: new Date().toISOString(),
      date: today,
      userName: state.userName || "anonymous",
      readiness: state.readiness || null,
      payload: payload
    };

    fetch(state.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
    }).catch(function () {
      // Silent fail in prototype mode: keep UX clean for testers.
    });
  }

  function loadState() {
    var raw = localStorage.getItem(KEY);
    if (!raw) {
      return { userName: "", webhookUrl: DEFAULT_WEBHOOK_URL, readiness: null, tasks: [], lastRoutineResetDate: null };
    }
    var parsed = JSON.parse(raw);
    if (!parsed.webhookUrl) {
      parsed.webhookUrl = DEFAULT_WEBHOOK_URL;
    }
    if (!parsed.lastRoutineResetDate) {
      parsed.lastRoutineResetDate = null;
    }
    return parsed;
  }

  function saveState() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function byId(id) { return document.getElementById(id); }
  function getNum(id) { return Number(byId(id).value || 0); }
  function makeId() { return "t_" + Math.random().toString(36).slice(2, 10); }
  function parseTaskTitle(rawTitle) {
    var cleanTitle = cleanTaskTitle(rawTitle);
    return {
      title: cleanTitle || "Без названия",
      routine: false
    };
  }
  function cleanTaskTitle(title) {
    return String(title || "").trim();
  }
  function isRoutineTask(task) {
    return Boolean(task && task.routine);
  }
  function compareTasksForDisplay(a, b) {
    var bySlot = getSlotRank(a.slot) - getSlotRank(b.slot);
    if (bySlot !== 0) return bySlot;
    return b.urgency - a.urgency;
  }
  function getSlotRank(slot) {
    var value = String(slot || "");
    if (value.indexOf("Утро") === 0) return 0;
    if (value.indexOf("День") === 0) return 1;
    if (value.indexOf("Вечер") === 0) return 2;
    if (value === "Без слота") return 3;
    if (value.indexOf("Перенести") === 0) return 4;
    return 5;
  }
  function escapeHtml(text) {
    return text.replace(/[&<>'"]/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
    });
  }
})();
