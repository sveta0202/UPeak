"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

require("../public/evening-recommendations.js");

var er = globalThis.UpeakEveningRecommendations;
var decisionMatrix = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../public/evening-decision-matrix.json"), "utf8")
);

er.setDecisionMatrix(decisionMatrix);

// fatigue, taskStart, procrastination, detachment — совпадает с формой чек-ина.
function evening(fatigue, taskStart, procrastination, detachment) {
  return {
    fatigue: fatigue,
    taskStart: taskStart,
    procrastination: procrastination,
    detachment: detachment
  };
}

function recs(morningScore, completed, total, ev, embedOptions) {
  return er.getRecommendations({
    morningScore: morningScore,
    completedTasks: completed,
    totalTasks: total,
    evening: ev,
    embedOptions: embedOptions || { decisions: {}, existingIds: [] }
  });
}

test("S1 fatigue_high: усталость 4, план 70% → fatigue_high + E1", function () {
  var cards = recs(60, 7, 10, evening(4, 2, 2, 4));
  assert.equal(cards[0].decision_key, "fatigue_high");
  assert.match(cards[0].narrative, /70%/);
  assert.match(cards[0].narrative, /восстановление/);
  assert.ok(cards[0].actions.length >= 1);
  assert.equal(cards[0].plan_label, "Завтра");
  var ids = cards[0].embedOffers.map(function (o) { return o.id; });
  assert.ok(ids.indexOf("evening_early_sleep") !== -1);
});

test("S2 detachment_low: усталость 2, отключение 1, план 50% → detachment_low + E2", function () {
  var cards = recs(60, 5, 10, evening(2, 2, 2, 1));
  assert.equal(cards[0].decision_key, "detachment_low");
  assert.match(cards[0].narrative, /мозг всё ещё остаётся в рабочих задачах/);
  var ids = cards[0].embedOffers.map(function (o) { return o.id; });
  assert.ok(ids.indexOf("evening_phone_away") !== -1);
});

test("S3 start_hard (прокрастинация): усталость 2, прокрастинация 5, план 40% → start_hard + E3", function () {
  var cards = recs(60, 4, 10, evening(2, 2, 5, 4));
  assert.equal(cards[0].decision_key, "start_hard");
  assert.match(cards[0].narrative, /начало работы/);
  assert.ok(cards[0].actions.some(function (a) { return /один первый шаг/.test(a); }));
  var ids = cards[0].embedOffers.map(function (o) { return o.id; });
  assert.ok(ids.indexOf("evening_tiny_start") !== -1);
});

test("S3 start_hard (трудно начать): усталость 2, трудно начать 4, план 40% → start_hard", function () {
  var cards = recs(60, 4, 10, evening(2, 4, 2, 4));
  assert.equal(cards[0].decision_key, "start_hard");
});

test("S4 completion_high: спокойный вечер, план 80% → completion_high, без плашек", function () {
  var cards = recs(60, 8, 10, evening(2, 2, 2, 4));
  assert.equal(cards[0].decision_key, "completion_high");
  assert.equal(cards[0].tone, "high");
  assert.match(cards[0].narrative, /большая часть плана выполнена/);
  assert.equal(cards[0].embedOffers.length, 0);
});

test("S5 completion_low: спокойный вечер, план 25% → completion_low", function () {
  var cards = recs(60, 2, 8, evening(2, 2, 2, 4));
  assert.equal(cards[0].decision_key, "completion_low");
  assert.equal(cards[0].tone, "recovery");
  assert.match(cards[0].narrative, /слишком тяжёлым/);
});

test("S6 completion_mid: спокойный вечер, план 50% → completion_mid", function () {
  var cards = recs(60, 5, 10, evening(2, 2, 2, 4));
  assert.equal(cards[0].decision_key, "completion_mid");
  assert.equal(cards[0].tone, "steady");
  assert.match(cards[0].narrative, /прошёл стабильно/);
});

test("усталость 5 + плохое отключение → карточка fatigue_high, плашка одна (высший приоритет — сон)", function () {
  var cards = recs(60, 3, 10, evening(5, 2, 2, 1));
  assert.equal(cards[0].decision_key, "fatigue_high");
  var ids = cards[0].embedOffers.map(function (o) { return o.id; });
  assert.deepEqual(ids, ["evening_early_sleep"]);
});

test("усталость + прокрастинация одновременно → детач. побеждает fatigue, E3 не показывается", function () {
  var cards = recs(60, 5, 10, evening(2, 2, 4, 4));
  assert.equal(cards[0].decision_key, "start_hard");

  var tiredAndProcrastinating = recs(60, 2, 10, evening(4, 5, 5, 1));
  assert.equal(tiredAndProcrastinating[0].decision_key, "fatigue_high");
  var ids = tiredAndProcrastinating[0].embedOffers.map(function (o) { return o.id; });
  assert.equal(ids.indexOf("evening_tiny_start"), -1);
});

test("отключение 1 + прокрастинация 5 (без усталости) → detachment_low, плашка одна (телефон)", function () {
  var cards = recs(60, 5, 10, evening(2, 5, 5, 1));
  assert.equal(cards[0].decision_key, "detachment_low");
  var ids = cards[0].embedOffers.map(function (o) { return o.id; });
  assert.deepEqual(ids, ["evening_phone_away"]);
});

test("план 0% (есть задачи, но не начаты) без других сигналов → completion_low", function () {
  var cards = recs(60, 0, 5, evening(2, 2, 2, 4));
  assert.equal(cards[0].decision_key, "completion_low");
  assert.equal(cards[0].completionRate, 0);
});

test("0 задач в плане и спокойный вечер → ничего не показываем", function () {
  var cards = recs(60, 0, 0, evening(2, 2, 2, 4));
  assert.deepEqual(cards, []);
});

test("0 задач в плане, но усталость ≥4 → карточка всё равно показывается", function () {
  var cards = recs(60, 0, 0, evening(4, 2, 2, 4));
  assert.equal(cards.length, 1);
  assert.equal(cards[0].decision_key, "fatigue_high");
  assert.equal(cards[0].completionRate, null);
});

test("completionBand thresholds — 70% high, 50% medium, 49% low", function () {
  assert.equal(er.completionBand(7, 10), "high");
  assert.equal(er.completionBand(5, 10), "medium");
  assert.equal(er.completionBand(49, 100), "low");
  assert.equal(er.completionBand(0, 0), null);
});

test("evening: hide sleep embed if already in plan", function () {
  var cards = recs(60, 1, 5, evening(5, 2, 2, 4), {
    decisions: {},
    existingIds: [],
    existingTitles: ["раньше ко сну"]
  });
  var ids = cards[0].embedOffers.map(function (o) { return o.id; });
  assert.equal(ids.indexOf("evening_early_sleep"), -1);
});

test("completion_high + слабое утро → упоминает утренний ресурс («немного»)", function () {
  var cards = recs(30, 8, 10, evening(2, 2, 2, 4));
  assert.equal(cards[0].decision_key, "completion_high");
  assert.match(cards[0].narrative, /С утра ресурса было немного/);
});

test("completion_high + сильное утро → без упоминания утра (обычный текст)", function () {
  var cards = recs(80, 8, 10, evening(2, 2, 2, 4));
  assert.equal(cards[0].decision_key, "completion_high");
  assert.doesNotMatch(cards[0].narrative, /С утра/);
});

test("completion_low + сильное утро → упоминает, что дело не в силах, а в объёме", function () {
  var cards = recs(80, 2, 8, evening(2, 2, 2, 4));
  assert.equal(cards[0].decision_key, "completion_low");
  assert.match(cards[0].narrative, /дело не в силах/);
});

test("completion_low + слабое утро → без упоминания утра (обычный текст)", function () {
  var cards = recs(30, 2, 8, evening(2, 2, 2, 4));
  assert.equal(cards[0].decision_key, "completion_low");
  assert.doesNotMatch(cards[0].narrative, /дело не в силах/);
});

test("fatigue_high + сильное утро → упоминает, что ресурса хватало", function () {
  var cards = recs(80, 7, 10, evening(4, 2, 2, 4));
  assert.equal(cards[0].decision_key, "fatigue_high");
  assert.match(cards[0].narrative, /с утра ресурса хватало/);
});

test("evening: hide sleep embed if morning already added evening_wind_down", function () {
  var cards = recs(60, 1, 5, evening(5, 2, 2, 4), {
    decisions: {},
    existingIds: ["morning:evening_wind_down"],
    morningDecisions: { evening_wind_down: "added" }
  });
  var ids = cards[0].embedOffers.map(function (o) { return o.id; });
  assert.equal(ids.indexOf("evening_early_sleep"), -1);
});
