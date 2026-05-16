(function () {
  var STORAGE_KEY = "upeak_lang";
  var DEFAULT_LANG = "ru";

  var DICT = {
    ru: {
      "meta.landing.title": "Upeak — Исследование продуктивности",
      "meta.landing.description": "14-дневный эксперимент о состоянии и нагрузке",
      "meta.planner.title": "PulseBurn Planner — Прототип",
      "meta.participate.title": "Upeak — Участие в эксперименте",
      "meta.participate.description": "Оставьте заявку на участие в 14-дневном эксперименте Upeak",

      "nav.research": "Исследование",
      "nav.experiment": "Эксперимент",
      "nav.results": "Результаты",
      "nav.join": "Участвовать",
      "nav.lang.aria": "Язык интерфейса",

      "hero.eyebrow": "Исследовательский прототип",
      "hero.brand": "Upeak",
      "hero.title.line1": "Почему ты не успеваешь,",
      "hero.title.line2": "даже когда планируешь хорошо?",
      "hero.subtitle": "Мы проводим 14-дневный эксперимент, чтобы понять как состояние влияет на твою нагрузку и выполнение задач",
      "hero.cta.join": "Участвовать в эксперименте",
      "hero.cta.more": "Узнать больше",
      "hero.logo.alt": "Логотип Upeak",

      "problem.title.line1": "Люди планируют день одинаково,",
      "problem.title.line2": "но их состояние постоянно меняется",
      "problem.plan.title": "План",
      "problem.plan.desc": "Одинаковый каждый день",
      "problem.real.title": "Реальность",
      "problem.real.desc": "Разная энергия и стресс",
      "problem.result.title": "Результат",
      "problem.result.desc": "Перегруз и усталость",
      "problem.gap": "Из-за этого возникает разрыв между планом и возможностями",
      "problem.aim": "Мы хотим понять этот механизм",

      "research.title": "Что мы исследуем",
      "research.sleep": "Сон",
      "research.sleep.arrow": "→ Продуктивность",
      "research.stress": "Стресс",
      "research.stress.arrow": "→ Перегруз",
      "research.energy": "Энергия",
      "research.energy.arrow": "→ Выполнение задач",
      "research.plan": "План",
      "research.plan.arrow": "→ Реальность выполнения",

      "experiment.title": "Как проходит эксперимент",
      "experiment.duration": "14 дней",
      "experiment.duration.note": "для исследования твоих паттернов",
      "experiment.week1.title": "Неделя 1",
      "experiment.week1.head": "Обычная жизнь",
      "experiment.week1.desc": "Ты живёшь как обычно, мы просто собираем данные о состоянии и выполнении задач",
      "experiment.week2.title": "Неделя 2",
      "experiment.week2.head": "С трекингом",
      "experiment.week2.desc": "Ты отслеживаешь состояние и получаешь рекомендации по нагрузке",
      "experiment.note": "Мы сравниваем поведение и ищем закономерности",

      "results.title": "В конце ты увидишь",
      "results.patterns": "Свои паттерны нагрузки",
      "results.overload": "Когда ты перегружаешь себя",
      "results.influence": "Как состояние влияет на выполнение задач",
      "results.real": "Как ты реально работаешь",

      "disclaimer.title": "Важное пояснение",
      "disclaimer.text1": "Это не готовый продукт, который уже всё решает.",
      "disclaimer.text2": "Это исследование, которое помогает нам понять поведение и построить более точную систему в будущем.",

      "cta.title": "Присоединиться к исследованию",
      "cta.subtitle": "Помоги нам понять, как люди работают на самом деле",

      "planner.eyebrow": "Исследовательский прототип",
      "planner.title": "Планировщик задач по состоянию",
      "planner.home": "На лендинг",

      "planner.morning.title": "1) Утренний чек-ин состояния",
      "planner.morning.sleepHours": "Сон, часов",
      "planner.morning.sleepQuality": "Качество сна (1-5)",
      "planner.morning.energy": "Энергия утром (1-5)",
      "planner.morning.wellbeing": "Самочувствие (1-5)",
      "planner.morning.stress": "Стресс (1-5)",
      "planner.morning.note": "Комментарий",
      "planner.morning.notePh": "Коротко: как вы себя чувствуете",
      "planner.morning.save": "Сохранить чек-ин",
      "planner.readiness": "Готовность",

      "planner.tasks.title": "2) Задачи на день",
      "planner.tasks.task": "Задача",
      "planner.tasks.taskPh": "Например, подготовить презентацию",
      "planner.tasks.difficulty": "Сложность (1-5)",
      "planner.tasks.urgency": "Срочность (1-5)",
      "planner.tasks.duration": "Оценка, мин",
      "planner.tasks.routine": "Рутина (базовая задача дня)",
      "planner.tasks.add": "Добавить задачу",
      "planner.tasks.saveEdit": "Сохранить изменения",
      "planner.tasks.cancelEdit": "Отменить редактирование",
      "planner.tasks.distribute": "Распределить по состоянию",

      "planner.tasks.col.status": "Статус",
      "planner.tasks.col.title": "Задача",
      "planner.tasks.col.diff": "Сложн.",
      "planner.tasks.col.urg": "Срочн.",
      "planner.tasks.col.min": "Мин",
      "planner.tasks.col.slot": "Рекомендованный слот",
      "planner.tasks.col.actions": "Действия",
      "planner.tasks.empty": "Пока нет задач на день",
      "planner.tasks.menu": "Меню задачи",
      "planner.tasks.edit": "Редактировать",
      "planner.tasks.delete": "Удалить",
      "planner.tasks.routineChip": "рутина",

      "planner.evening.title": "3) Вечерний итог дня",
      "planner.evening.productivity": "Продуктивность (1-5)",
      "planner.evening.fatigue": "Усталость к вечеру (1-5)",
      "planner.evening.note": "Комментарий",
      "planner.evening.notePh": "Что помогло/мешало",
      "planner.evening.save": "Закрыть день",
      "planner.evening.fact": "Факт",
      "planner.evening.completed": "выполнено",
      "planner.evening.dayClosed": "День закрыт",
      "planner.evening.dayOpen": "День не закрыт",

      "planner.sync.syncing": "Синхронизация…",
      "planner.sync.success": "Данные сохранены",
      "planner.sync.error": "Ошибка синхронизации",

      "planner.alerts.titleRequired": "Введите название задачи",

      "planner.slot.morningRoutine": "Утро (рутина)",
      "planner.slot.morningFocus": "Утро (фокус)",
      "planner.slot.dayOps": "День (операционка)",
      "planner.slot.eveningLight": "Вечер (лёгкие)",
      "planner.slot.none": "Без слота",
      "planner.slot.postpone": "Перенести на завтра",
      "planner.slot.simplify": "Перенести или упростить",

      "participate.back": "← На главную",
      "participate.title": "Участие в эксперименте",
      "participate.subtitle": "Оставьте свои контакты — мы свяжемся с вами и пришлём детали 14-дневного эксперимента",
      "participate.field.name": "Имя",
      "participate.field.phone": "Телефон",
      "participate.field.telegram": "Telegram",
      "participate.field.email": "Email",
      "participate.optional": "(необязательно)",
      "participate.placeholder.name": "Например, Анна",
      "participate.placeholder.phone": "+7 999 123-45-67",
      "participate.placeholder.telegram": "@username",
      "participate.placeholder.email": "you@example.com",
      "participate.hint.telegram": "Можно с @ или без — например, @ivanov или ivanov",
      "participate.hint.email": "Используем только для связи по эксперименту.",
      "participate.error.name": "Пожалуйста, укажите имя",
      "participate.error.phone": "Укажите корректный телефон (минимум 7 цифр)",
      "participate.error.telegram": "Имя пользователя Telegram должно содержать 3–32 символа: латиница, цифры или _",
      "participate.error.email": "Укажите корректный email",
      "participate.submit": "Отправить заявку",
      "participate.privacy": "Отправляя форму, вы соглашаетесь с тем, что мы используем эти данные только для связи по эксперименту.",
      "participate.status.sending": "Отправляем заявку…",
      "participate.status.success": "Спасибо! Мы получили вашу заявку и скоро свяжемся с вами.",
      "participate.status.error": "Не удалось отправить заявку. Попробуйте ещё раз.",
      "participate.status.network": "Ошибка сети. Проверьте соединение и повторите попытку.",
      "participate.status.invalid": "Проверьте правильность заполнения полей.",
      "participate.status.noUrl": "Форма ещё не настроена: укажите URL Google Apps Script."
    },
    en: {
      "meta.landing.title": "Upeak — Productivity Research",
      "meta.landing.description": "A 14-day experiment about state and workload",
      "meta.planner.title": "PulseBurn Planner — Prototype",
      "meta.participate.title": "Upeak — Join the experiment",
      "meta.participate.description": "Sign up for Upeak's 14-day productivity experiment",

      "nav.research": "Research",
      "nav.experiment": "Experiment",
      "nav.results": "Results",
      "nav.join": "Join",
      "nav.lang.aria": "Interface language",

      "hero.eyebrow": "Research prototype",
      "hero.brand": "Upeak",
      "hero.title.line1": "Why don't you keep up,",
      "hero.title.line2": "even when you plan well?",
      "hero.subtitle": "We are running a 14-day experiment to understand how your state affects workload and task completion",
      "hero.cta.join": "Join the experiment",
      "hero.cta.more": "Learn more",
      "hero.logo.alt": "Upeak logo",

      "problem.title.line1": "People plan their days the same way,",
      "problem.title.line2": "but their state changes constantly",
      "problem.plan.title": "Plan",
      "problem.plan.desc": "Same every day",
      "problem.real.title": "Reality",
      "problem.real.desc": "Different energy and stress",
      "problem.result.title": "Result",
      "problem.result.desc": "Overload and fatigue",
      "problem.gap": "This creates a gap between the plan and what you can actually do",
      "problem.aim": "We want to understand this mechanism",

      "research.title": "What we research",
      "research.sleep": "Sleep",
      "research.sleep.arrow": "→ Productivity",
      "research.stress": "Stress",
      "research.stress.arrow": "→ Overload",
      "research.energy": "Energy",
      "research.energy.arrow": "→ Task completion",
      "research.plan": "Plan",
      "research.plan.arrow": "→ Reality of execution",

      "experiment.title": "How the experiment works",
      "experiment.duration": "14 days",
      "experiment.duration.note": "to study your patterns",
      "experiment.week1.title": "Week 1",
      "experiment.week1.head": "Normal life",
      "experiment.week1.desc": "You live as usual; we just collect data about your state and task completion",
      "experiment.week2.title": "Week 2",
      "experiment.week2.head": "With tracking",
      "experiment.week2.desc": "You track your state and receive workload recommendations",
      "experiment.note": "We compare behavior and look for patterns",

      "results.title": "By the end you will see",
      "results.patterns": "Your workload patterns",
      "results.overload": "When you overload yourself",
      "results.influence": "How state affects task completion",
      "results.real": "How you really work",

      "disclaimer.title": "Important note",
      "disclaimer.text1": "This is not a finished product that solves everything.",
      "disclaimer.text2": "It is a study that helps us understand behavior and build a more accurate system in the future.",

      "cta.title": "Join the study",
      "cta.subtitle": "Help us understand how people actually work",

      "planner.eyebrow": "Research prototype",
      "planner.title": "State-aware task planner",
      "planner.home": "Back to landing",

      "planner.morning.title": "1) Morning state check-in",
      "planner.morning.sleepHours": "Sleep, hours",
      "planner.morning.sleepQuality": "Sleep quality (1-5)",
      "planner.morning.energy": "Morning energy (1-5)",
      "planner.morning.wellbeing": "Wellbeing (1-5)",
      "planner.morning.stress": "Stress (1-5)",
      "planner.morning.note": "Comment",
      "planner.morning.notePh": "Briefly: how do you feel",
      "planner.morning.save": "Save check-in",
      "planner.readiness": "Readiness",

      "planner.tasks.title": "2) Tasks for today",
      "planner.tasks.task": "Task",
      "planner.tasks.taskPh": "E.g., prepare a presentation",
      "planner.tasks.difficulty": "Difficulty (1-5)",
      "planner.tasks.urgency": "Urgency (1-5)",
      "planner.tasks.duration": "Estimate, min",
      "planner.tasks.routine": "Routine (baseline daily task)",
      "planner.tasks.add": "Add task",
      "planner.tasks.saveEdit": "Save changes",
      "planner.tasks.cancelEdit": "Cancel editing",
      "planner.tasks.distribute": "Distribute by state",

      "planner.tasks.col.status": "Status",
      "planner.tasks.col.title": "Task",
      "planner.tasks.col.diff": "Diff.",
      "planner.tasks.col.urg": "Urg.",
      "planner.tasks.col.min": "Min",
      "planner.tasks.col.slot": "Recommended slot",
      "planner.tasks.col.actions": "Actions",
      "planner.tasks.empty": "No tasks for today yet",
      "planner.tasks.menu": "Task menu",
      "planner.tasks.edit": "Edit",
      "planner.tasks.delete": "Delete",
      "planner.tasks.routineChip": "routine",

      "planner.evening.title": "3) Evening summary",
      "planner.evening.productivity": "Productivity (1-5)",
      "planner.evening.fatigue": "Evening fatigue (1-5)",
      "planner.evening.note": "Comment",
      "planner.evening.notePh": "What helped / hindered",
      "planner.evening.save": "Close the day",
      "planner.evening.fact": "Fact",
      "planner.evening.completed": "completed",
      "planner.evening.dayClosed": "Day closed",
      "planner.evening.dayOpen": "Day not closed",

      "planner.sync.syncing": "Syncing…",
      "planner.sync.success": "Saved",
      "planner.sync.error": "Sync error",

      "planner.alerts.titleRequired": "Please enter a task title",

      "planner.slot.morningRoutine": "Morning (routine)",
      "planner.slot.morningFocus": "Morning (focus)",
      "planner.slot.dayOps": "Day (operations)",
      "planner.slot.eveningLight": "Evening (light)",
      "planner.slot.none": "Unscheduled",
      "planner.slot.postpone": "Postpone to tomorrow",
      "planner.slot.simplify": "Postpone or simplify",

      "participate.back": "← Back to home",
      "participate.title": "Join the experiment",
      "participate.subtitle": "Leave your contact details — we'll reach out and share the 14-day experiment plan",
      "participate.field.name": "Name",
      "participate.field.phone": "Phone",
      "participate.field.telegram": "Telegram",
      "participate.field.email": "Email",
      "participate.optional": "(optional)",
      "participate.placeholder.name": "e.g., Anna",
      "participate.placeholder.phone": "+1 555 123-4567",
      "participate.placeholder.telegram": "@username",
      "participate.placeholder.email": "you@example.com",
      "participate.hint.telegram": "With or without @ — e.g., @ivanov or ivanov",
      "participate.hint.email": "We'll only use it to send you the experiment details.",
      "participate.error.name": "Please enter your name",
      "participate.error.phone": "Please enter a valid phone (at least 7 digits)",
      "participate.error.telegram": "Telegram username must be 3–32 chars: letters, digits or underscore",
      "participate.error.email": "Please enter a valid email address",
      "participate.submit": "Send request",
      "participate.privacy": "By submitting this form you agree we use these details only to contact you about the experiment.",
      "participate.status.sending": "Sending your request…",
      "participate.status.success": "Thanks! We received your request and will be in touch soon.",
      "participate.status.error": "Couldn't submit your request. Please try again.",
      "participate.status.network": "Network error. Check your connection and try again.",
      "participate.status.invalid": "Please double-check the form fields.",
      "participate.status.noUrl": "The form isn't configured yet: please set the Google Apps Script URL."
    }
  };

  function detectInitial() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "ru" || saved === "en") return saved;
    } catch (e) {}
    var nav = (navigator.language || navigator.userLanguage || "").toLowerCase();
    if (nav.indexOf("ru") === 0) return "ru";
    if (nav.indexOf("en") === 0) return "en";
    return DEFAULT_LANG;
  }

  var current = detectInitial();
  var listeners = [];

  function t(key) {
    var dict = DICT[current] || DICT[DEFAULT_LANG];
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    var fallback = DICT[DEFAULT_LANG];
    return Object.prototype.hasOwnProperty.call(fallback, key) ? fallback[key] : key;
  }

  function applyDom(root) {
    var scope = root || document;

    scope.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });

    scope.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      el.setAttribute("placeholder", t(key));
    });

    scope.querySelectorAll("[data-i18n-aria-label]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria-label");
      el.setAttribute("aria-label", t(key));
    });

    scope.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-alt");
      el.setAttribute("alt", t(key));
    });

    scope.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-title");
      el.setAttribute("title", t(key));
    });

    var titleEl = document.querySelector("title[data-i18n]");
    if (titleEl) document.title = t(titleEl.getAttribute("data-i18n"));

    var descEl = document.querySelector('meta[name="description"][data-i18n]');
    if (descEl) descEl.setAttribute("content", t(descEl.getAttribute("data-i18n")));

    document.documentElement.setAttribute("lang", current);
  }

  function setLang(lang) {
    if (lang !== "ru" && lang !== "en") return;
    current = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    applyDom();
    listeners.forEach(function (cb) { try { cb(lang); } catch (e) {} });
    var toggles = document.querySelectorAll("[data-lang-toggle]");
    toggles.forEach(function (btn) {
      var btnLang = btn.getAttribute("data-lang-toggle");
      btn.setAttribute("aria-pressed", btnLang === current ? "true" : "false");
      if (btnLang === current) btn.classList.add("is-active");
      else btn.classList.remove("is-active");
    });
  }

  function getLang() { return current; }

  function onChange(cb) { if (typeof cb === "function") listeners.push(cb); }

  function init() {
    document.querySelectorAll("[data-lang-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLang(btn.getAttribute("data-lang-toggle"));
      });
    });
    setLang(current);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.UpeakI18n = {
    t: t,
    setLang: setLang,
    getLang: getLang,
    onChange: onChange,
    apply: applyDom
  };
})();
