(function (root) {
  "use strict";

  var PLAN_LABEL = "Завтра стоит";
  var MAX_ACTIONS = 3;

  var EVENING_MATRIX = null;

  function setEveningMatrix(data) {
    EVENING_MATRIX = data && typeof data === "object" ? data : null;
    if (EVENING_MATRIX && EVENING_MATRIX.meta && EVENING_MATRIX.meta.plan_label) {
      PLAN_LABEL = EVENING_MATRIX.meta.plan_label;
    }
  }

  function morningBand(score) {
    var s = Number(score);
    if (!Number.isFinite(s)) return "medium";
    if (s < 40) return "low";
    if (s < 70) return "medium";
    return "high";
  }

  function completionBand(completed, total) {
    var rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    if (rate >= 70) return "high";
    if (rate >= 60) return "medium";
    return "low";
  }

  function completionRate(completed, total) {
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  function getCell(morningKey, completionKey) {
    if (!EVENING_MATRIX || !EVENING_MATRIX.matrix) return null;
    var row = EVENING_MATRIX.matrix[morningKey];
    if (!row) return null;
    return row[completionKey] || row.medium || null;
  }

  function uniqueList(items, limit) {
    var seen = {};
    var out = [];
    items.forEach(function (item) {
      if (!item || seen[item]) return;
      seen[item] = true;
      out.push(item);
    });
    return out.slice(0, limit || MAX_ACTIONS);
  }

  function flattenPlan(plan) {
    if (!plan) return [];
    var items = [];
    if (Array.isArray(plan.reduce)) items = items.concat(plan.reduce);
    if (Array.isArray(plan.leverage)) items = items.concat(plan.leverage);
    return items;
  }

  function activeModifiers(evening) {
    if (!evening || !EVENING_MATRIX || !EVENING_MATRIX.modifiers) return [];

    var mods = EVENING_MATRIX.modifiers;
    var active = [];

    if (Number(evening.fatigue) >= 4 && mods.fatigue_high) {
      active.push({ key: "fatigue_high", mod: mods.fatigue_high });
    }
    if (Number(evening.detachment) <= 2 && mods.detachment_low) {
      active.push({ key: "detachment_low", mod: mods.detachment_low });
    }
    if (
      (Number(evening.procrastination) >= 4 || Number(evening.taskStart) >= 4) &&
      mods.start_hard
    ) {
      active.push({ key: "start_hard", mod: mods.start_hard });
    }

    active.sort(function (a, b) {
      return (a.mod.priority || 99) - (b.mod.priority || 99);
    });

    return active;
  }

  function pickModifierAction(active, used) {
    for (var i = 0; i < active.length; i++) {
      var actions = active[i].mod.actions || [];
      for (var j = 0; j < actions.length; j++) {
        if (used[actions[j]]) continue;
        return { action: actions[j], mod: active[i].mod };
      }
    }
    return null;
  }

  function buildWhy(mod) {
    if (!mod || !mod.why) return null;
    return { text: mod.why, evidence_level: null, source: null, url: null };
  }

  function getRecommendations(input) {
    input = input || {};
    var morningScore = input.morningScore;
    var completed = Number(input.completedTasks) || 0;
    var total = Number(input.totalTasks) || 0;
    var evening = input.evening || {};

    var mBand = morningBand(morningScore);
    var cBand = completionBand(completed, total);
    var cell = getCell(mBand, cBand);

    if (!cell) return [];

    var actions = uniqueList(flattenPlan(cell.plan), MAX_ACTIONS);
    var used = {};
    actions.forEach(function (a) { used[a] = true; });

    var active = activeModifiers(evening);
    var why = null;

    if (actions.length < MAX_ACTIONS) {
      var picked = pickModifierAction(active, used);
      if (picked) {
        actions.push(picked.action);
        why = buildWhy(picked.mod);
      }
    }

    if (!actions.length) return [];

    return [{
      title: cell.title || "Итог дня",
      completionRate: completionRate(completed, total),
      summary: cell.summary || "",
      hint: "",
      actions: actions,
      planLabel: PLAN_LABEL,
      show_why: !!why,
      why: why
    }];
  }

  root.UpeakEveningRecommendations = {
    PLAN_LABEL: PLAN_LABEL,
    MAX_ACTIONS: MAX_ACTIONS,
    setEveningMatrix: setEveningMatrix,
    morningBand: morningBand,
    completionBand: completionBand,
    getRecommendations: getRecommendations
  };
})(typeof window !== "undefined" ? window : globalThis);
