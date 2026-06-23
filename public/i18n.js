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

      "planner.id.label": "Мой ID",
      "planner.id.placeholder": "Например, UP-000001",
      "planner.id.save": "Сохранить",
      "planner.id.change": "Изменить ID",
      "planner.id.checking": "Проверяем ID…",
      "planner.id.saved": "ID сохранён. Данные синхронизируются под этим ID.",
      "planner.id.notFound": "Такой ID не найден в списке