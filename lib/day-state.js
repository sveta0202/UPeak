"use strict";

// --- Пороги (тюнинг после пилота) ---
var THRESHOLD_LOW = 2;
var THRESHOLD_HIGH = 4;
var PLATEAU_VALUE = 3;
var THRESHOLD_MAX = 5;

var MEAN_EMERGENCY_MAX = 2;
var MEAN_RECOVERY_MAX = 3;
var PLATEAU_MEAN_MIN = 2.5;
var PLATEAU_MEAN_MAX = 3.8;
var MEAN_HIGH_PERF_MIN = 4;

var SPREAD_PLATEAU_MAX = 1;
var SPREAD_MIXED_MIN = 2;

var COUNT_LOW_EMERGENCY = 3;
var COUNT_LOW_SINGLE = 1;
var COUNT_LOW_MIXED = 2;

var METRIC_NAMES = ["sleep_hours", "sleep_quality", "energy", "stress"];
var METRIC_PRIORITY = ["sleep_hours", "sleep_quality", "energy", "stress"];

function clampMetric(value) {
  var n = Number(value);
  if (!Number.isFinite(n)) return PLATEAU_VALUE;
  return Math.max(1, Math.min(THRESHOLD_MAX, Math.round(n)));
}

function average(values) {
  if (!values.length) return PLATEAU_VALUE;
  var sum = 0;
  for (var i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
}

function metricsFromRawInput(input) {
  input = input || {};
  var fatigue_raw = clampMetric(input.fatigue_raw);
  var stress_raw = clampMetric(input.stress_raw);

  return {
    sleep_hours: clampMetric(input.sleep_hours),
    sleep_quality: clampMetric(input.sleep_quality),
    energy: 6 - fatigue_raw,
    stress: 6 - stress_raw
  };
}

function metricsList(metrics) {
  return METRIC_NAMES.map(function (name) {
    return { name: name, value: metrics[name] };
  });
}

function pickMetricByPriority(candidates, priority) {
  for (var i = 0; i < priority.length; i++) {
    var name = priority[i];
    for (var j = 0; j < candidates.length; j++) {
      if (candidates[j].name === name) return name;
    }
  }
  return candidates.length ? candidates[0].name : null;
}

function pickLowestMetric(entries) {
  var minValue = Math.min.apply(
    null,
    entries.map(function (e) { return e.value; })
  );
  var tied = entries.filter(function (e) { return e.value === minValue; });
  return pickMetricByPriority(tied, METRIC_PRIORITY);
}

function countWhere(values, predicate) {
  var count = 0;
  for (var i = 0; i < values.length; i++) {
    if (predicate(values[i])) count += 1;
  }
  return count;
}

function buildModifiers(metrics) {
  var modifiers = [];

  if (metrics.sleep_hours <= THRESHOLD_LOW) modifiers.push("sleep_low");
  if (metrics.sleep_quality <= THRESHOLD_LOW) modifiers.push("clarity_low");
  if (metrics.energy <= THRESHOLD_LOW) modifiers.push("energy_low");
  if (metrics.stress <= THRESHOLD_LOW) modifiers.push("stress_high");

  return modifiers;
}

function buildIssues(entries, values) {
  var max = Math.max.apply(null, values);
  var lowEntries = entries.filter(function (e) {
    return e.value <= THRESHOLD_LOW;
  });

  if (!lowEntries.length) {
    return {
      primary_issue: pickLowestMetric(entries),
      secondary_issue: null
    };
  }

  var ranked = lowEntries.map(function (e) {
    return {
      name: e.name,
      value: e.value,
      gap: max - e.value
    };
  });

  ranked.sort(function (a, b) {
    if (b.gap !== a.gap) return b.gap - a.gap;
    return METRIC_PRIORITY.indexOf(a.name) - METRIC_PRIORITY.indexOf(b.name);
  });

  return {
    primary_issue: ranked[0].name,
    secondary_issue: ranked[1] ? ranked[1].name : null
  };
}

// Часы сна (ввод) → шкала 1–5: ~5→1, 6→2, 6:30→3, 7→4, 7:30+→5
function sleepHoursToScale(hours) {
  var h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return PLATEAU_VALUE;
  if (h < 5.75) return 1;
  if (h < 6.25) return 2;
  if (h < 6.75) return 3;
  if (h < 7.25) return 4;
  return 5;
}

function morningCheckinToDayStateInput(morning) {
  morning = morning || {};
  return {
    sleep_hours: sleepHoursToScale(morning.sleepHours),
    sleep_quality: clampMetric(morning.sleepQuality),
    fatigue_raw: clampMetric(morning.energy),
    stress_raw: clampMetric(morning.stress)
  };
}

function evaluateDayState(metrics) {
  var entries = metricsList(metrics);
  var values = entries.map(function (e) { return e.value; });
  var mean = average(values);
  var min = Math.min.apply(null, values);
  var max = Math.max.apply(null, values);
  var spread = max - min;
  var low_count = countWhere(values, function (v) { return v <= THRESHOLD_LOW; });
  var high_count = countWhere(values, function (v) { return v >= THRESHOLD_HIGH; });

  var state;
  var sub_state = null;
  var primary_issue = null;
  var secondary_issue = null;
  var target_metric = null;
  var issues;

  if (low_count >= COUNT_LOW_EMERGENCY || mean <= MEAN_EMERGENCY_MAX) {
    state = "emergency_recovery";
  } else if (
    (low_count === COUNT_LOW_MIXED && spread < SPREAD_MIXED_MIN) ||
    mean < MEAN_RECOVERY_MAX
  ) {
    state = "recovery";
  } else if (spread <= SPREAD_PLATEAU_MAX && mean >= PLATEAU_MEAN_MIN && mean <= PLATEAU_MEAN_MAX) {
    state = "plateau";
    target_metric = pickLowestMetric(entries);
  } else if (mean >= MEAN_HIGH_PERF_MIN && low_count === 0) {
    state = "high_performance";
  } else if (spread >= SPREAD_MIXED_MIN && low_count === COUNT_LOW_SINGLE) {
    state = "single_issue";
    issues = buildIssues(entries, values);
    primary_issue = issues.primary_issue;
    secondary_issue = issues.secondary_issue;
  } else if (spread >= SPREAD_MIXED_MIN && low_count === COUNT_LOW_MIXED) {
    state = "mixed";
    // mixed_severe: хотя бы одна метрика критично низкая (<=2), не bad_count==3
    if (min <= THRESHOLD_LOW) sub_state = "mixed_severe";
    issues = buildIssues(entries, values);
    primary_issue = issues.primary_issue;
    secondary_issue = issues.secondary_issue;
  } else {
    state = "normal";
    sub_state = "borderline";
    target_metric = pickLowestMetric(entries);
  }

  return {
    state: state,
    sub_state: sub_state,
    modifiers: buildModifiers(metrics),
    primary_issue: primary_issue,
    secondary_issue: secondary_issue,
    target_metric: target_metric,
    metrics: {
      sleep_hours: metrics.sleep_hours,
      sleep_quality: metrics.sleep_quality,
      energy: metrics.energy,
      stress: metrics.stress
    },
    spread: spread,
    mean: Math.round(mean * 100) / 100,
    _debug: {
      low_count: low_count,
      high_count: high_count,
      min: min,
      max: max
    }
  };
}

function computeDayState(input) {
  return evaluateDayState(metricsFromRawInput(input));
}

function computeDayStateFromMetrics(metrics) {
  return evaluateDayState({
    sleep_hours: clampMetric(metrics.sleep_hours),
    sleep_quality: clampMetric(metrics.sleep_quality),
    energy: clampMetric(metrics.energy),
    stress: clampMetric(metrics.stress)
  });
}

function computeDayStateFromMorning(morning) {
  return computeDayState(morningCheckinToDayStateInput(morning));
}

module.exports = {
  THRESHOLD_LOW: THRESHOLD_LOW,
  THRESHOLD_HIGH: THRESHOLD_HIGH,
  PLATEAU_VALUE: PLATEAU_VALUE,
  MEAN_EMERGENCY_MAX: MEAN_EMERGENCY_MAX,
  MEAN_RECOVERY_MAX: MEAN_RECOVERY_MAX,
  PLATEAU_MEAN_MIN: PLATEAU_MEAN_MIN,
  PLATEAU_MEAN_MAX: PLATEAU_MEAN_MAX,
  MEAN_HIGH_PERF_MIN: MEAN_HIGH_PERF_MIN,
  SPREAD_PLATEAU_MAX: SPREAD_PLATEAU_MAX,
  SPREAD_MIXED_MIN: SPREAD_MIXED_MIN,
  COUNT_LOW_EMERGENCY: COUNT_LOW_EMERGENCY,
  METRIC_NAMES: METRIC_NAMES,
  METRIC_PRIORITY: METRIC_PRIORITY,
  sleepHoursToScale: sleepHoursToScale,
  morningCheckinToDayStateInput: morningCheckinToDayStateInput,
  metricsFromRawInput: metricsFromRawInput,
  evaluateDayState: evaluateDayState,
  computeDayState: computeDayState,
  computeDayStateFromMetrics: computeDayStateFromMetrics,
  computeDayStateFromMorning: computeDayStateFromMorning
};
