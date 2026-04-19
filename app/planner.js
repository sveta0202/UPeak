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
  };

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
    saveState();
    updateReadiness();
    sync("morning_checkin", state.morning);
  });

  byId("taskForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var task = {
      id: makeId(),
      title: byId("taskTitle").value.trim(),
      difficulty: getNum("taskDifficulty"),
      urgency: getNum("taskUrgency"),
      duration: getNum("taskDuration"),
      done: false,
      slot: "Без слота"
    };
    state.tasks.push(task);
    saveState();
    renderTasks();
    updateFact();
    sync("task_created", task);
    event.target.reset();
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

  function renderTasks() {
    if (!state.tasks.length) {
      el.taskTableBody.innerHTML = "<tr><td colspan='6' class='muted'>Пока нет задач</td></tr>";
      return;
    }
    el.taskTableBody.innerHTML = state.tasks.map(function (task) {
      return "<tr>" +
        "<td><input type='checkbox' data-id='" + task.id + "' " + (task.done ? "checked" : "") + " /></td>" +
        "<td class='" + (task.done ? "task-done" : "") + "'>" + escapeHtml(task.title) + "</td>" +
        "<td>" + task.difficulty + "</td>" +
        "<td>" + task.urgency + "</td>" +
        "<td>" + task.duration + "</td>" +
        "<td><span class='slot-chip'>" + escapeHtml(task.slot || "Без слота") + "</span></td>" +
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
      return { userName: "", webhookUrl: DEFAULT_WEBHOOK_URL, readiness: null, tasks: [] };
    }
    var parsed = JSON.parse(raw);
    if (!parsed.webhookUrl) {
      parsed.webhookUrl = DEFAULT_WEBHOOK_URL;
    }
    return parsed;
  }

  function saveState() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function byId(id) { return document.getElementById(id); }
  function getNum(id) { return Number(byId(id).value || 0); }
  function makeId() { return "t_" + Math.random().toString(36).slice(2, 10); }
  function escapeHtml(text) {
    return text.replace(/[&<>'"]/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
    });
  }
})();
