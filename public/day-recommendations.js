(function (root) {
  "use strict";

  // ===================================================================
  // РЕДАКТИРУЙ ТОЛЬКО ЭТОТ БЛОК — тексты, подписи, матрица карточек
  // Логику распределения ниже не трогай, если не меняешь правила
  // ===================================================================

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

  // Формат карточки: { text, action?, why: { text, source, url } | null }

  var STATE_OVERRIDES = {
    emergency_recovery: {
      text: "Сильный перегруз по всем метрикам.",
      action: "Оставь 1–2 простые задачи, убери сложные решения, добавь отдых.",
      why: {
        text: "После сильного проседания метрик падают внимание и самоконтроль — восстановление важнее продуктивности.",
        source: "Sleep and self-control (meta-analysis)",
        url: "https://doi.org/10.1016/j.smrv.2015.01.001"
      }
    },
    mixed_severe: {
      text: "Сильный разброс состояния — несколько зон на минимуме.",
      action: "Минимальный план, максимум отдыха, без геройства.",
      why: {
        text: "При сильном дисбалансе метрик форсированная продуктивность ухудшает восстановление.",
        source: "Recovery from work meta-analysis",
        url: "https://doi.org/10.1037/0021-9010.92.6.1458"
      }
    }
  };

  var CARD_MATRIX = {
    min: {
      sleep: {
        text: "Сон ниже целевого уровня.",
        action: "Снизь нагрузку: 1–2 простые задачи и более ранний отход ко сну.",
        why: null
      },
      stress: {
        text: "Стресс высокий при низком ресурсе.",
        action: "1 главная задача + 1 лёгкая, убери лишние дедлайны и шум.",
        why: null
      },
      energy: {
        text: "Энергия на нуле.",
        action: "Короткие блоки по 15–20 мин, длинные задачи перенеси.",
        why: null
      }
    },
    medium: {
      sleep: {
        text: "Сон ниже нормы, но день рабочий.",
        action: "2–3 задачи, сложное — только в первый продуктивный слот.",
        why: null
      },
      stress: {
        text: "Стресс повышен — работай через приоритет.",
        action: "Топ-2 задачи на сегодня, пауза каждые 60–90 мин.",
        why: null
      },
      energy: {
        text: "Энергия средняя — бережный фокус.",
        action: "Начни с разогревающей задачи, потом 1 важная.",
        why: null
      }
    },
    max: {
      sleep: {
        text: "Ресурс высокий, но сон — зона контроля.",
        action: "Можно нагрузку, но без ночного овертайма.",
        why: null
      },
      stress: {
        text: "Ресурс высокий — держи стресс под контролем.",
        action: "Deep work + ограничь переключения и уведомления.",
        why: {
          text: "При хорошем сне и низком стрессе проще удерживать фокус.",
          source: "Sleep and self-control (meta-analysis)",
          url: "https://doi.org/10.1016/j.smrv.2015.01.001"
        }
      },
      energy: {
        text: "Высокая энергия — время для сложного.",
        action: "1–2 deep-work блока на ключевую цель в первой половине дня.",
        why: {
          text: "При хорошем ресурсе проще доводить сложные задачи до конца.",
          source: "Sleep and self-control (meta-analysis)",
          url: "https://doi.org/10.1016/j.smrv.2015.01.001"
        }
      }
    }
  };

  // clarity_low = sleep_quality просел (генерится движком)
  var MODIFIER_TEXTS = {
    sleep_low: {
      text: "Лучше сегодня не перегружать вечер и лечь раньше.",
      why: {
        text: "Недостаток сна снижает активность префронтальной коры — страдают память и контроль импульсов.",
        source: "PMC — Role of Sleep and Effects of Sleep Loss",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12168795/"
      }
    },
    clarity_low: {
      text: "Качество сна низкое — сначала рутинные задачи, важное позже.",
      why: {
        text: "Недостаток сна снижает активность префронтальной коры — страдают память и контроль импульсов.",
        source: "PMC — Role of Sleep and Effects of Sleep Loss",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12168795/"
      }
    },
    energy_low: {
      text: "Начни с небольшой задачи, чтобы войти в день мягко.",
      why: {
        text: "Долгая нагрузка истощает ресурс внимания — так называемый vigilance decrement.",
        source: "PMC — Vigilance Decrement Task Requirements",
        url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6109784/"
      }
    },
    stress_high: {
      text: "Сними лишнее напряжение: меньше спешки, больше спокойного темпа.",
      why: {
        text: "Кортизол нарушает работу префронтальной коры и переключает мозг на быстрые шаблонные реакции.",
        source: "PMC — Decision-making under stress",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11061251/"
      }
    }
  };

  var LINE_TEMPLATES = {
    growth: "Зона роста на сегодня: {metric}.",
    focus: "Главный фокус: {metric}.",
    priority: "В приоритете: {primary}{secondary}.",
    secondary: "Вторая зона: {metric} — учти, но не перегружайся.",
    recovery: "Режим восстановления: 2–3 задачи средней сложности, один короткий перерыв.",
    plateau: "Стабильный день — выбери одну зону роста и не распыляйся.",
    borderline: "Пограничное состояние — оставь запас по времени, не закладывай плотный план.",
    mixed: "Несколько зон просели — сократи план и начни с простых шагов."
  };

  // ===================================================================
  // МАППИНГ: dayState (движок) → контент
  // Контентный слой НЕ пересчитывает state/mean/low_count.
  // ===================================================================

  var METRIC_TO_AXIS = {
    sleep_hours: "sleep",
    sleep_quality: "sleep",
    energy: "energy",
    stress: "stress"
  };

  var METRIC_TO_MODIFIER = {
    sleep_hours: "sleep_low",
    sleep_quality: "clarity_low",
    energy: "energy_low",
    stress: "stress_high"
  };

  var METRIC_PRIORITY = ["sleep_hours", "sleep_quality", "energy", "stress"];

  function cloneWhy(why) {
    if (!why) return null;
    return { text: why.text, source: why.source, url: why.url };
  }

  function cloneRec(template) {
    var parts = [];
    if (template.text) parts.push(template.text);
    if (template.action) parts.push(template.action);
    return {
      text: parts.join(" "),
      why: cloneWhy(template.why)
    };
  }

  function fillTemplate(tpl, vars) {
    var out = tpl;
    Object.keys(vars).forEach(function (key) {
      out = out.split("{" + key + "}").join(vars[key] || "");
    });
    return out;
  }

  function metricLabel(name) {
    return METRIC_LABELS[name] || name;
  }

  function metricToAxis(name) {
    return METRIC_TO_AXIS[name] || "energy";
  }

  function metricToModifier(name) {
    return METRIC_TO_MODIFIER[name] || null;
  }

  function getMetricValue(dayState, metricName) {
    if (!dayState || !dayState.metrics || !metricName) return null;
    return Number(dayState.metrics[metricName]);
  }

  // Батарейка только по значению метрики, не по state
  function resourceBandFromValue(value) {
    var v = Number(value);
    if (!Number.isFinite(v)) return "medium";
    if (v <= 2) return "min";
    if (v <= 3) return "medium";
    return "max";
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
    if (dayState.state === "high_performance") return "energy";
    return pickLowestMetric(dayState.metrics);
  }

  function resolveContentMapping(dayState) {
    var focusMetric = resolveFocusMetric(dayState);
    var focusValue = getMetricValue(dayState, focusMetric);
    return {
      state: dayState.state,
      sub_state: dayState.sub_state,
      template_key: resolveTemplateKey(dayState),
      focus_metric: focusMetric,
      focus_axis: metricToAxis(focusMetric),
      focus_value: focusValue,
      resource_band: resourceBandFromValue(focusValue),
      primary_issue: dayState.primary_issue || null,
      secondary_issue: dayState.secondary_issue || null,
      target_metric: dayState.target_metric || null,
      modifiers: Array.isArray(dayState.modifiers) ? dayState.modifiers.slice() : []
    };
  }

  function pickMatrixCard(band, axis) {
    var row = CARD_MATRIX[band] || CARD_MATRIX.medium;
    var card = row[axis] || row.energy;
    return cloneRec(card);
  }

  function addLine(recs, text, why) {
    if (!text) return;
    recs.push({ text: text, why: why || null });
  }

  function addModifierLine(recs, modifierKey) {
    var tpl = MODIFIER_TEXTS[modifierKey];
    if (!tpl) return;
    var duplicate = recs.some(function (r) { return r.text === tpl.text; });
    if (!duplicate) addLine(recs, tpl.text, cloneWhy(tpl.why));
  }

  function getRecommendations(dayState) {
    if (!dayState || !dayState.state) return [];

    var recs = [];
    var map = resolveContentMapping(dayState);
    var override = STATE_OVERRIDES[map.template_key];

    // 1) Критичные override — матрицу не берём
    if (override) {
      recs.push(cloneRec(override));
    } else {
      recs.push(pickMatrixCard(map.resource_band, map.focus_axis));
    }

    // 2) Строки по state (из движка, без пересчёта порогов)
    if (map.state === "plateau") {
      addLine(recs, LINE_TEMPLATES.plateau, null);
      if (map.target_metric) {
        addLine(
          recs,
          fillTemplate(LINE_TEMPLATES.growth, { metric: metricLabel(map.target_metric) }),
          null
        );
      }
    }

    if (map.template_key === "normal_borderline") {
      addLine(recs, LINE_TEMPLATES.borderline, null);
    }

    if (map.state === "recovery") {
      addLine(recs, LINE_TEMPLATES.recovery, {
        text: "Умеренная нагрузка поддерживает ресурс лучше, чем постоянный перегруз.",
        source: "Task completion and mental energy replenishment",
        url: "https://pubmed.ncbi.nlm.nih.gov/22905855/"
      });
    }

    if (map.state === "mixed") {
      addLine(recs, LINE_TEMPLATES.mixed, {
        text: "Короткие восстановительные перерывы помогают снизить перегруз.",
        source: "Recovery experiences meta-analysis",
        url: "https://doi.org/10.1037/0021-9010.92.6.1458"
      });
      if (map.primary_issue) {
        addLine(
          recs,
          fillTemplate(LINE_TEMPLATES.priority, {
            primary: metricLabel(map.primary_issue),
            secondary: map.secondary_issue ? " и " + metricLabel(map.secondary_issue) : ""
          }),
          null
        );
      }
    }

    if (map.state === "single_issue" && map.primary_issue) {
      addLine(
        recs,
        fillTemplate(LINE_TEMPLATES.focus, { metric: metricLabel(map.primary_issue) }),
        null
      );
    }

    // 3) secondary_issue → modifier-текст
    if (map.secondary_issue) {
      addModifierLine(recs, metricToModifier(map.secondary_issue));
      if (map.state === "single_issue") {
        addLine(
          recs,
          fillTemplate(LINE_TEMPLATES.secondary, { metric: metricLabel(map.secondary_issue) }),
          null
        );
      }
    }

    // 4) modifiers из движка — только для других осей, не дублируя primary
    var primaryModifier = metricToModifier(map.focus_metric);
    map.modifiers.forEach(function (mod) {
      if (mod === primaryModifier) return;
      addModifierLine(recs, mod);
    });

    return recs;
  }

  function getStateLabel(dayState) {
    if (!dayState) return "";
    var key = resolveTemplateKey(dayState);
    return STATE_LABELS[key] || STATE_LABELS[dayState.state] || dayState.state;
  }

  root.UpeakDayRecommendations = {
    METRIC_LABELS: METRIC_LABELS,
    STATE_LABELS: STATE_LABELS,
    STATE_OVERRIDES: STATE_OVERRIDES,
    CARD_MATRIX: CARD_MATRIX,
    MODIFIER_TEXTS: MODIFIER_TEXTS,
    LINE_TEMPLATES: LINE_TEMPLATES,
    METRIC_TO_AXIS: METRIC_TO_AXIS,
    METRIC_TO_MODIFIER: METRIC_TO_MODIFIER,
    resourceBandFromValue: resourceBandFromValue,
    resolveContentMapping: resolveContentMapping,
    getRecommendations: getRecommendations,
    getStateLabel: getStateLabel
  };
})(typeof window !== "undefined" ? window : globalThis);
