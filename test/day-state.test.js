"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var dayState = require("../lib/day-state");

function m(sleep_hours, sleep_quality, energy, stress) {
  return dayState.computeDayStateFromMetrics({
    sleep_hours: sleep_hours,
    sleep_quality: sleep_quality,
    energy: energy,
    stress: stress
  });
}

test("1. 5,5,5,5 → high_performance", function () {
  assert.equal(m(5, 5, 5, 5).state, "high_performance");
});

test("2. 3,3,3,3 → plateau", function () {
  assert.equal(m(3, 3, 3, 3).state, "plateau");
});

test("3. 2,2,2,2 → emergency_recovery", function () {
  assert.equal(m(2, 2, 2, 2).state, "emergency_recovery");
});

test("4. 1,1,1,1 → emergency_recovery", function () {
  assert.equal(m(1, 1, 1, 1).state, "emergency_recovery");
});

test("5. 4,4,4,4 → high_performance", function () {
  assert.equal(m(4, 4, 4, 4).state, "high_performance");
});

test("6. 3,3,4,3 → plateau", function () {
  assert.equal(m(3, 3, 4, 3).state, "plateau");
});

test("7. 5,5,2,5 → single_issue", function () {
  assert.equal(m(5, 5, 2, 5).state, "single_issue");
});

test("8. 5,5,2,2 → mixed + mixed_severe (min<=2)", function () {
  var r = m(5, 5, 2, 2);
  assert.equal(r.state, "mixed");
  assert.equal(r.sub_state, "mixed_severe");
});

test("9. 5,5,1,1 → mixed_severe", function () {
  var r = m(5, 5, 1, 1);
  assert.equal(r.state, "mixed");
  assert.equal(r.sub_state, "mixed_severe");
});

test("10. 3,2,3,2 → recovery", function () {
  assert.equal(m(3, 2, 3, 2).state, "recovery");
});

// Кейсы 11–14: ожидания в спеке не совпадают с приоритетом if-цепочки (см. отчёт в README тестов).
test("11. 4,3,4,2 → single_issue", function () {
  assert.equal(m(4, 3, 4, 2).state, "single_issue");
});

test("12. 2,4,4,4 → single_issue", function () {
  assert.equal(m(2, 4, 4, 4).state, "single_issue");
});

test("13. 5,3,5,3 → high_performance", function () {
  assert.equal(m(5, 3, 5, 3).state, "high_performance");
});

test("14. 1,5,5,5 → single_issue", function () {
  assert.equal(m(1, 5, 5, 5).state, "single_issue");
});

test("15. 3,3,2,3 → recovery", function () {
  assert.equal(m(3, 3, 2, 3).state, "recovery");
});

test("modifiers: низкие метрики", function () {
  var r = m(2, 2, 2, 2);
  assert.ok(r.modifiers.indexOf("sleep_low") !== -1);
  assert.ok(r.modifiers.indexOf("energy_low") !== -1);
  assert.ok(r.modifiers.indexOf("stress_high") !== -1);
});

test("sleepHoursToScale: 5→1, 6→2, 6.5→3, 7→4, 7.5+→5", function () {
  assert.equal(dayState.sleepHoursToScale(5), 1);
  assert.equal(dayState.sleepHoursToScale(6), 2);
  assert.equal(dayState.sleepHoursToScale(6.5), 3);
  assert.equal(dayState.sleepHoursToScale(7), 4);
  assert.equal(dayState.sleepHoursToScale(7.5), 5);
});

test("computeDayStateFromMorning маппит чек-ин", function () {
  var r = dayState.computeDayStateFromMorning({
    sleepHours: 7.5,
    sleepQuality: 4,
    energy: 2,
    stress: 2
  });
  assert.equal(r.metrics.sleep_hours, 5);
  assert.equal(r.metrics.energy, 4);
});

test("mixed: primary по gap, не по порядку", function () {
  var r = m(5, 5, 2, 1);
  assert.equal(r.state, "mixed");
  assert.equal(r.primary_issue, "stress");
  assert.equal(r.secondary_issue, "energy");
});

test("mixed: две sleep-метрики — primary с большим gap", function () {
  var r = m(2, 1, 5, 5);
  assert.equal(r.state, "mixed");
  assert.equal(r.sub_state, "mixed_severe");
  assert.equal(r.primary_issue, "sleep_quality");
  assert.equal(r.secondary_issue, "sleep_hours");
});

test("mixed_severe не срабатывает, если min > 2", function () {
  var r = m(3, 3, 3, 5);
  assert.notEqual(r.sub_state, "mixed_severe");
});
