"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var dayState = require("../lib/day-state");

require("../public/day-recommendations.js");

var dr = globalThis.UpeakDayRecommendations;
var decisionMatrix = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../public/day-decision-matrix.json"), "utf8")
);
var recommendationMatrix = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../public/day-recommendation-matrix.json"), "utf8")
);

dr.setDecisionMatrix(decisionMatrix);
dr.setRecommendationMatrix(recommendationMatrix);

function morningFromCheckin(sleepHours, sleepQuality, fatigue, stress) {
  return dayState.computeDayStateFromMorning({
    sleepHours: sleepHours,
    sleepQuality: sleepQuality,
    energy: fatigue,
    stress: stress
  });
}

test("morning 7h, quality 4, fatigue 1, stress 1 → high_performance + high card", function () {
  var ds = morningFromCheckin(7, 4, 1, 1);
  assert.equal(ds.state, "high_performance");
  assert.equal(ds.metrics.sleep_hours, 4);
  assert.equal(ds.metrics.energy, 5);
  assert.equal(ds.metrics.stress, 5);
  assert.equal(dr.resolveDecisionKey(ds), "high");

  var cards = dr.getRecommendations(ds);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].decision_key, "high");
  assert.match(cards[0].actions[0], /сложн/i);

  var embedIds = (cards[0].embedOffers || []).map(function (o) { return o.id; });
  assert.equal(embedIds.indexOf("tiny_first_step"), -1);
  assert.ok(embedIds.indexOf("evening_tune_walk") !== -1);
  assert.ok(embedIds.indexOf("evening_tune_sleep") !== -1);
  assert.match(cards[0].result, /Сегодня:.*10–20/);
  assert.match(cards[0].result, /Завтра:/);
  assert.ok(cards[0].result.indexOf("20–35") === -1);
});

test("growth: mild sleep gap still suggests hard block, not tiny step embed", function () {
  var ds = morningFromCheckin(7, 4, 2, 1);
  assert.equal(ds.state, "high_performance");
  assert.equal(dr.resolveDecisionKey(ds), "growth");

  var cards = dr.getRecommendations(ds);
  assert.equal(cards[0].decision_key, "growth");
  assert.match(cards[0].actions[0], /сложн|deep work/i);
  var embedIds = (cards[0].embedOffers || []).map(function (o) { return o.id; });
  assert.equal(embedIds.indexOf("tiny_first_step"), -1);
  assert.ok(embedIds.indexOf("evening_tune_walk") !== -1);
  assert.ok(embedIds.indexOf("evening_tune_sleep") !== -1);
  cards[0].actions.forEach(function (action) {
    assert.equal(/прогулк/i.test(action) && /раньше/i.test(action), false);
  });
});

test("high: 2×5 + 2×4 (сон+качество 4, энергия+стресс 5)", function () {
  assert.ok(dr.qualifiesForHighDecision({ sleep_hours: 4, sleep_quality: 4, energy: 5, stress: 5 }));
  var ds = dayState.computeDayStateFromMetrics({ sleep_hours: 4, sleep_quality: 4, energy: 5, stress: 5 });
  assert.equal(dr.resolveDecisionKey(ds), "high");
});

test("high: 5,4,5,4 — две пятёрки, остальное 4", function () {
  assert.ok(dr.qualifiesForHighDecision({ sleep_hours: 5, sleep_quality: 4, energy: 5, stress: 4 }));
  var ds = dayState.computeDayStateFromMetrics({ sleep_hours: 5, sleep_quality: 4, energy: 5, stress: 4 });
  assert.equal(dr.resolveDecisionKey(ds), "high");
});

test("not high: все четвёрки без пятёрок", function () {
  assert.equal(dr.qualifiesForHighDecision({ sleep_hours: 4, sleep_quality: 4, energy: 4, stress: 4 }), false);
  var ds = dayState.computeDayStateFromMetrics({ sleep_hours: 4, sleep_quality: 4, energy: 4, stress: 4 });
  assert.equal(dr.resolveDecisionKey(ds), "growth");
});

test("card_id: high + сон ниже идеала → high:sleep_tune", function () {
  var ds = morningFromCheckin(7, 4, 1, 1);
  var cards = dr.getRecommendations(ds);
  assert.equal(cards[0].decision_key, "high");
  assert.equal(cards[0].card_id, "high:sleep_tune");
});

test("card_id: high без пробелов в сне → просто high", function () {
  var ds = dayState.computeDayStateFromMetrics({ sleep_hours: 5, sleep_quality: 5, energy: 5, stress: 5 });
  var cards = dr.getRecommendations(ds);
  assert.equal(cards[0].decision_key, "high");
  assert.equal(cards[0].card_id, "high");
});

test("card_id: growth → уточняет ось (например growth:sleep_hours)", function () {
  var ds = morningFromCheckin(7, 4, 2, 1);
  var cards = dr.getRecommendations(ds);
  assert.equal(cards[0].decision_key, "growth");
  assert.match(cards[0].card_id, /^growth:/);
});

test("card_id: single_issue → уточняет проблему (например single_issue:stress)", function () {
  var ds = dayState.computeDayStateFromMetrics({ sleep_hours: 5, sleep_quality: 5, energy: 5, stress: 2 });
  assert.equal(dr.resolveDecisionKey(ds), "single_issue");
  var cards = dr.getRecommendations(ds);
  assert.equal(cards[0].card_id, "single_issue:" + ds.primary_issue);
});
