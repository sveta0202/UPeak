"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");

// Зеркало public/planner.js → getTaskLoad. Держим в синхроне при смене формулы.
function getTaskLoad(task) {
  var difficulty = Number(task.difficulty) || 0;
  var durationUnits = Math.ceil((Number(task.duration) || 0) / 45);
  return difficulty + durationUnits * (difficulty / 3);
}

test("1 / 90 → ~1.67 (лёгкая длинная не жрёт бюджет)", function () {
  var load = getTaskLoad({ difficulty: 1, duration: 90 });
  assert.ok(Math.abs(load - (1 + 2 * (1 / 3))) < 1e-9);
  assert.ok(load < 2);
});

test("3 / 45 → 4", function () {
  assert.equal(getTaskLoad({ difficulty: 3, duration: 45 }), 3 + 1 * (3 / 3));
});

test("5 / 90 → ~8.33", function () {
  var load = getTaskLoad({ difficulty: 5, duration: 90 });
  assert.ok(Math.abs(load - (5 + 2 * (5 / 3))) < 1e-9);
  assert.ok(load > 8);
});

test("5 / 45 → ~6.67", function () {
  var load = getTaskLoad({ difficulty: 5, duration: 45 });
  assert.ok(Math.abs(load - (5 + 1 * (5 / 3))) < 1e-9);
});

test("1 / 45 → ~1.33", function () {
  var load = getTaskLoad({ difficulty: 1, duration: 45 });
  assert.ok(Math.abs(load - (1 + 1 * (1 / 3))) < 1e-9);
});
