(function (root) {
  "use strict";

  var PLAN_LABEL = "Сегодня стоит";

  var SECTION_LABELS = {
    today: "Что сегодня",
    meaning: "Что это значит",
    consequence: "Если не скорректировать",
    plan: PLAN_LABEL,
    reduce: "Уменьшить",
    leverage: "Использовать",
    why: "Почему",
    evidence: "Основано на"
  };

  var METRIC_LABELS = {
    sleep_hours: "сон (длительность)",
    sleep_quality: "качество сна",
    energy: "энергия",
    stress: "стресс"
  };

  var STATE_LABELS = {
    emergency_recovery: "Экстренное восстановление",
    recovery: "Восстановление",
    plateau: "Плато",
    normal: "Норма",
    normal_borderline: "Норма · пограничное",
    high_performance: "Высокая производительность",
    single_issue: "Одна проблема",
    mixed: "Смешанное состояние",
    mixed_severe: "Смешанное · тяжёлое"
  };

  var VISIBLE_BLOCKS = {
    emergency_recovery: ["today", "meaning", "consequence", "plan", "why", "evidence"],
    mixed_severe: ["today", "meaning", "consequence", "plan", "why", "evidence"],
    recovery: ["today", "meaning", "plan", "why", "evidence"],
    mixed: ["today", "meaning", "plan", "why", "evidence"],
    single_issue: ["today", "meaning", "plan", "why", "evidence"],
    normal: ["today", "plan"],
    normal_borderline: ["today", "plan"],
    plateau: ["today", "plan"],
    high_performance: ["today", "plan"]
  };

  var RECOMMENDATION_MATRIX = null;

  var STATE_OVERRIDES = {
    emergency_recovery: {
      today: "Сон, энергия и стресс сегодня очень низкие — ресурс на исходе.",
      meaning: "Концентрация, терпение и качество решений сегодня, скорее всего, заметно ниже обычного.",
      consequence: "Если не снизить нагрузку, к вечеру выше риск ошибок, раздражительности и срыва планов.",
      plan: {
        reduce: [
          "Оставь в списке только 1 важную задачу",
          "Отложи всё несрочное",
          "Ляг спать раньше обычного"
        ],
        leverage: []
      },
      why: "Когда несколько ресурсов истощены, падают самоконтроль и качество решений — восстановление важнее продуктивности.",
      evidence_level: "Высокая",
      sources: [
        {
          title: "The Role of Sleep and the Effects of Sleep Loss on Cognitive, Affective, and Behavioral Processes",
          year: null,
          url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12168795/"
        }
      ],
      limitations: ["Это общая рекомендация, а не медицинская оценка."]
    },
    mixed_severe: {
      today: "Одна зона в критическом минимуме и тянет остальное вниз.",
      meaning: "Фокус и точность сегодня будут хуже обычного — особенно на сложных задачах.",
      consequence: "Если не упростить план, накопишь ошибки и усталость быстрее, чем обычно.",
      plan: {
        reduce: [
          "Сократи список до 1–2 задач",
          "Не пытайся закрыть всё",
          "Добавь короткую паузу между блоками"
        ],
        leverage: []
      },
      why: "Когда один ресурс сильно просел, короткий список снижает нагрузку на внимание.",
      evidence_level: "Высокая",
      sources: [
        {
          title: "Decision-making under stress: A psychological and neurobiological integrative model",
          year: null,
          url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11061251/"
        }
      ],
      limitations: ["Реакция зависит от типа задач и контекста."]
    }
  };

  var METRIC_TO_AXIS = {
    sleep_hours: "sleep",
    sleep_quality: "sleep",
    energy: "energy",
    stress: "stress"
  };

  var METRIC_PRIORITY = ["sleep_hours", "sleep_quality", "energy", "stress"];
  var AXIS_PRIORITY = ["sleep", "energy", "stress"];
  var DEFAULT_FOCUS_METRIC = "energy";

  function setRecommendationMatrix(data) {
    RECOMMENDATION_MATRIX = data && typeof data === "object" ? data : null;
    if (RECOMMENDATION_MATRIX && RECOMMENDATION_MATRIX.meta && RECOMMENDATION_MATRIX.meta.plan_label) {
      PLAN_LABEL = RECOMMENDATION_MATRIX.meta.plan_label;
      SECTION_LABELS.plan = PLAN_LABEL;
    }
  }

  function metricToAxis(name) {
    return METRIC_TO_AXIS[name] || "energy";
  }

  function getMetricValue(dayState, metricName) {
    if (!dayState || !dayState.metrics || !metricName) return null;
    return Number(dayState.metrics[metricName]);
  }

  function axisWorstValue(dayState, axis) {
    if (!dayState || !dayState.metrics || !axis) return null;
    var metrics = dayState.metrics;
    var worst = null;
    METRIC_PRIORITY.forEach(function (name) {
      if (metricToAxis(name) !== axis) return;
      var value = Number(metrics[name]);
      if (!Number.isFinite(value)) return;
      if (worst === null || value < worst) worst = value;
    });
    return worst;
  }

  function resourceBandFromValue(value) {
    var v = Number(value);
    if (!Number.isFinite(v)) return "medium";
    if (v <= 2) return "min";
    if (v <= 3) return "medium";
    return "max";
  }

  function matrixBandKey(axis, resourceBand) {
    if (axis === "stress") {
      if (resourceBand === "min") return "high";
      if (resourceBand === "max") return "low";
      return "medium";
    }
    if (resourceBand === "min") return "low";
    if (resourceBand === "max") return "high";
    return "medium";
  }

  function getMatrixEntry(axis, resourceBand) {
    if (!RECOMMENDATION_MATRIX || !axis) return null;
    var axisBlock = RECOMMENDATION_MATRIX[axis];
    if (!axisBlock) return null;
    return axisBlock[matrixBandKey(axis, resourceBand)] || null;
  }

  function getSnippets() {
    if (RECOMMENDATION_MATRIX && RECOMMENDATION_MATRIX.meta && RECOMMENDATION_MATRIX.meta.snippets) {
      return RECOMMENDATION_MATRIX.meta.snippets;
    }
    return {
      sleep: { low: "сон короткий", medium: "сон средний", high: "сон хороший" },
      energy: { low: "мало энергии", medium: "энергии хватает", high: "много энергии" },
      stress: { low: "стресс низкий", medium: "стресс умеренный", high: "стресс высокий" }
    };
  }

  function axisSnippet(axis, resourceBand) {
    var snippets = getSnippets();
    var axisSnippets = snippets[axis] || {};
    var key = matrixBandKey(axis, resourceBand);
    return axisSnippets[key] || null;
  }

  function primarySource(sources) {
    if (!Array.isArray(sources) || !sources.length) return null;
    return sources[0];
  }

  function buildWhy(entry) {
    if (!entry || !entry.why) return null;
    var src = primarySource(entry.sources);
    return {
      text: entry.why,
      evidence_level: entry.evidence_level || null,
      limitations: Array.isArray(entry.limitations) ? entry.limitations.slice() : null,
      sources: Array.isArray(entry.sources) ? entry.sources.slice() : null,
      source: src
        ? src.title + (src.authors ? " — " + src.authors : "") + (src.year ? " (" + src.year + ")" : "")
        : null,
      url: src && src.url ? src.url : null
    };
  }

  function pickLowestMetric(metrics) {
    if (!metrics) return "energy";
    var min = 5;
    METRIC_PRIORITY.forEach(function (name) {
      var v = Number(metrics[name]);
      if (Number.isFinite(v) && v < min) min = v;
    });
    var tied = METRIC_PRIORITY.filter(function (name) {
      return Number(metrics[name]) === min;
    });
    return tied[0] || "energy";
  }

  function resolveTemplateKey(dayState) {
    if (!dayState) return null;
    if (dayState.sub_state === "mixed_severe") return "mixed_severe";
    if (dayState.sub_state === "borderline") return "normal_borderline";
    return dayState.state;
  }

  function resolveFocusMetric(dayState) {
    if (dayState.primary_issue) return dayState.primary_issue;
    if (dayState.target_metric) return dayState.target_metric;
    if (dayState.state === "high_performance") return DEFAULT_FOCUS_METRIC;
    if (dayState.state === "normal" && dayState.sub_state !== "borderline") {
      return DEFAULT_FOCUS_METRIC;
    }
    return pickLowestMetric(dayState.metrics);
  }

  function resolveContentMapping(dayState) {
    var focusMetric = resolveFocusMetric(dayState);
    var focusAxis = metricToAxis(focusMetric);
    var focusValue = axisWorstValue(dayState, focusAxis);
    if (focusValue === null) focusValue = getMetricValue(dayState, focusMetric);
    return {
      state: dayState.state,
      sub_state: dayState.sub_state,
      template_key: resolveTemplateKey(dayState),
      focus_metric: focusMetric,
      focus_axis: focusAxis,
      focus_value: focusValue,
      resource_band: resourceBandFromValue(focusValue),
      primary_issue: dayState.primary_issue || null,
      secondary_issue: dayState.secondary_issue || null,
      target_metric: dayState.target_metric || null
    };
  }

  function visibleBlocksFor(templateKey) {
    return (VISIBLE_BLOCKS[templateKey] || VISIBLE_BLOCKS.normal).slice();
  }

  function isAxisNotable(dayState, axis, map, leverageAxes) {
    var band = resourceBandFromValue(axisWorstValue(dayState, axis));
    leverageAxes = leverageAxes || [];
    if (band === "min") return true;
    if (leverageAxes.indexOf(axis) !== -1) return true;
    if (map.state === "plateau" && band === "medium") return true;
    if (map.state === "high_performance" && band === "max") return true;
    return false;
  }

  function buildTodaySummary(dayState, map, leverageAxes) {
    var parts = [];
    var notableCount = 0;

    AXIS_PRIORITY.forEach(function (axis) {
      if (!isAxisNotable(dayState, axis, map, leverageAxes)) return;
      var band = resourceBandFromValue(axisWorstValue(dayState, axis));
      var snippet = axisSnippet(axis, band);
      if (snippet) {
        parts.push(snippet);
        notableCount += 1;
      }
    });

    if (!parts.length) {
      return "Сон, энергия и стресс сегодня на среднем уровне.";
    }

    var summary = parts.join(", ");
    if (notableCount < AXIS_PRIORITY.length && map.state !== "plateau") {
      summary += " — остальное в норме";
    }
    return summary.charAt(0).toUpperCase() + summary.slice(1) + ".";
  }

  function collectLeverageAxes(dayState, map) {
    if (map.resource_band === "max") return [];
    if (map.focus_axis === "stress" && map.resource_band === "min") return [];

    var axes = [];
    AXIS_PRIORITY.forEach(function (axis) {
      if (axis === map.focus_axis) return;
      if (axis === "stress") return;
      var band = resourceBandFromValue(axisWorstValue(dayState, axis));
      if (band === "max") axes.push(axis);
    });
    return axes;
  }

  function uniqueList(items, limit) {
    var seen = {};
    var out = [];
    items.forEach(function (item) {
      if (!item || seen[item]) return;
      seen[item] = true;
      out.push(item);
    });
    return out.slice(0, limit || 4);
  }

  function composePlan(dayState, map, primaryEntry) {
    var reduce = [];
    var leverage = [];

    if (primaryEntry && primaryEntry.plan) {
      if (Array.isArray(primaryEntry.plan.reduce)) reduce = primaryEntry.plan.reduce.slice();
      if (Array.isArray(primaryEntry.plan.leverage)) leverage = primaryEntry.plan.leverage.slice();
    }

    collectLeverageAxes(dayState, map).forEach(function (axis) {
      var entry = getMatrixEntry(axis, "max");
      if (!entry || !entry.plan || !Array.isArray(entry.plan.leverage)) return;
      leverage = leverage.concat(entry.plan.leverage);
    });

    return {
      label: PLAN_LABEL,
      reduce: uniqueList(reduce, 4),
      leverage: uniqueList(leverage, 3)
    };
  }

  function flattenActions(plan, max) {
    if (!plan) return [];
    var items = [];
    if (Array.isArray(plan.reduce)) items = items.concat(plan.reduce);
    if (Array.isArray(plan.leverage)) items = items.concat(plan.leverage);
    return uniqueList(items, max || 3);
  }

  function shortHint(card, visible) {
    if (visible.indexOf("consequence") !== -1 && card.consequence) return card.consequence;
    if (visible.indexOf("meaning") !== -1 && card.meaning) {
      var m = String(card.meaning).trim();
      var dot = m.indexOf(".");
      return dot > 0 ? m.slice(0, dot + 1) : m;
    }
    return "";
  }

  function composeCard(dayState, map, override) {
    var visible = visibleBlocksFor(map.template_key);
    var primaryEntry = override || getMatrixEntry(map.focus_axis, map.resource_band);
    if (!primaryEntry && !override) return null;

    var leverageAxes = collectLeverageAxes(dayState, map);
    var plan = composePlan(dayState, map, primaryEntry);

    var consequence = primaryEntry && primaryEntry.consequence ? String(primaryEntry.consequence).trim() : "";
    if (visible.indexOf("consequence") === -1) consequence = "";

    var draft = {
      visible_blocks: visible,
      today: override ? override.today : buildTodaySummary(dayState, map, leverageAxes),
      meaning: primaryEntry ? primaryEntry.meaning || "" : "",
      consequence: consequence,
      plan: plan,
      why: buildWhy(primaryEntry || override),
      evidence_level: (primaryEntry || override) ? (primaryEntry || override).evidence_level || null : null,
      state_label: getStateLabel(dayState),
      focus_axis: map.focus_axis
    };

    var actions = flattenActions(plan, 3);

    return {
      visible_blocks: visible,
      today: draft.today,
      summary: draft.today,
      hint: visible.length <= 2 ? "" : shortHint(draft, visible),
      actions: actions,
      show_why: visible.indexOf("why") !== -1,
      why: draft.why,
      evidence_level: visible.indexOf("evidence") !== -1 ? draft.evidence_level : null,
      state_label: draft.state_label,
      text: draft.today
    };
  }

  function buildEmbedContext(dayState, options) {
    options = options || {};
    var sleepWorst = axisWorstValue(dayState, "sleep");
    var stressValue = getMetricValue(dayState, "stress");

    return {
      sleep_low: sleepWorst !== null && sleepWorst <= 2,
      stress_high: stressValue !== null && stressValue <= 2,
      decisions: options.decisions || {},
      existingIds: Array.isArray(options.existingIds) ? options.existingIds : []
    };
  }

  function matchesEmbedWhen(when, ctx) {
    if (!when || typeof when !== "object") return true;
    if (Array.isArray(when.any)) {
      return when.any.some(function (key) {
        return !!ctx[key];
      });
    }
    return Object.keys(when).every(function (key) {
      return !when[key] || !!ctx[key];
    });
  }

  function embedStatus(offerId, ctx) {
    if (ctx.decisions[offerId] === "added") return "added";
    if (ctx.existingIds.indexOf("morning:" + offerId) !== -1) return "added";
    if (ctx.decisions[offerId] === "later") return "later";
    return "pending";
  }

  function getMorningEmbeddable(embedId) {
    var embeddables = RECOMMENDATION_MATRIX && RECOMMENDATION_MATRIX.embeddables;
    if (!Array.isArray(embeddables)) return null;
    for (var i = 0; i < embeddables.length; i++) {
      if (embeddables[i].id === embedId) return embeddables[i];
    }
    return null;
  }

  function pickMorningEmbeddables(dayState, options) {
    var embeddables = RECOMMENDATION_MATRIX && RECOMMENDATION_MATRIX.embeddables;
    if (!Array.isArray(embeddables) || !embeddables.length || !dayState) return [];

    var ctx = buildEmbedContext(dayState, options);
    var maxOffers = 2;

    return embeddables
      .filter(function (offer) {
        if (!offer || !offer.id) return false;
        var status = embedStatus(offer.id, ctx);
        if (status === "later" || status === "added") return false;
        return matchesEmbedWhen(offer.when, ctx);
      })
      .sort(function (a, b) {
        return (a.priority || 99) - (b.priority || 99);
      })
      .slice(0, maxOffers)
      .map(function (offer) {
        return {
          id: offer.id,
          prompt: offer.prompt || "",
          detail: offer.detail || "",
          status: embedStatus(offer.id, ctx),
          task: offer.task ? Object.assign({}, offer.task) : null
        };
      });
  }

  function getRecommendations(dayState, options) {
    if (!dayState || !dayState.state) return [];

    var map = resolveContentMapping(dayState);
    var override = STATE_OVERRIDES[map.template_key];
    var card = composeCard(dayState, map, override || null);

    if (!card || !card.actions.length) return [];

    card.embedOffers = pickMorningEmbeddables(dayState, options);
    return [card];
  }

  function getStateLabel(dayState) {
    if (!dayState) return "";
    var key = resolveTemplateKey(dayState);
    return STATE_LABELS[key] || STATE_LABELS[dayState.state] || dayState.state;
  }

  root.UpeakDayRecommendations = {
    PLAN_LABEL: PLAN_LABEL,
    SECTION_LABELS: SECTION_LABELS,
    VISIBLE_BLOCKS: VISIBLE_BLOCKS,
    METRIC_LABELS: METRIC_LABELS,
    STATE_LABELS: STATE_LABELS,
    STATE_OVERRIDES: STATE_OVERRIDES,
    METRIC_TO_AXIS: METRIC_TO_AXIS,
    DEFAULT_FOCUS_METRIC: DEFAULT_FOCUS_METRIC,
    setRecommendationMatrix: setRecommendationMatrix,
    flattenActions: flattenActions,
    resourceBandFromValue: resourceBandFromValue,
    matrixBandKey: matrixBandKey,
    axisWorstValue: axisWorstValue,
    resolveContentMapping: resolveContentMapping,
    buildTodaySummary: buildTodaySummary,
    visibleBlocksFor: visibleBlocksFor,
    getRecommendations: getRecommendations,
    pickMorningEmbeddables: pickMorningEmbeddables,
    getMorningEmbeddable: getMorningEmbeddable,
    getStateLabel: getStateLabel
  };
})(typeof window !== "undefined" ? window : globalThis);
