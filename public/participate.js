(function () {
  "use strict";

  var form = document.getElementById("participateForm");
  if (!form) return;

  var nameInput = document.getElementById("nameInput");
  var phoneInput = document.getElementById("phoneInput");
  var telegramInput = document.getElementById("telegramInput");
  var emailInput = document.getElementById("emailInput");
  var telegramField = document.getElementById("telegramField");
  var emailField = document.getElementById("emailField");
  var submitButton = document.getElementById("submitButton");
  var statusBanner = document.getElementById("statusBanner");

  var nameError = document.getElementById("nameError");
  var phoneError = document.getElementById("phoneError");
  var telegramError = document.getElementById("telegramError");
  var emailError = document.getElementById("emailError");

  function getLang() {
    if (window.UpeakI18n && typeof window.UpeakI18n.getLang === "function") {
      return window.UpeakI18n.getLang();
    }
    return document.documentElement.getAttribute("lang") || "ru";
  }

  function t(key, fallback) {
    if (window.UpeakI18n && typeof window.UpeakI18n.t === "function") {
      var v = window.UpeakI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function setFieldError(input, errorEl, key, fallback) {
    if (!input || !errorEl) return;
    if (key) {
      errorEl.setAttribute("data-i18n", key);
      errorEl.textContent = t(key, fallback || "");
      errorEl.classList.add("is-visible");
      input.classList.add("is-invalid");
      input.setAttribute("aria-invalid", "true");
    } else {
      errorEl.classList.remove("is-visible");
      input.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
    }
  }

  function clearFieldErrors() {
    setFieldError(nameInput, nameError, null);
    setFieldError(phoneInput, phoneError, null);
    setFieldError(telegramInput, telegramError, null);
    setFieldError(emailInput, emailError, null);
  }

  function showBanner(kind, key, fallback) {
    if (!statusBanner) return;
    statusBanner.classList.remove("is-success", "is-error", "is-info");
    statusBanner.classList.add("is-visible");
    statusBanner.classList.add("is-" + kind);
    statusBanner.setAttribute("data-i18n", key);
    statusBanner.textContent = t(key, fallback);
  }

  function hideBanner() {
    if (!statusBanner) return;
    statusBanner.classList.remove("is-visible", "is-success", "is-error", "is-info");
    statusBanner.removeAttribute("data-i18n");
    statusBanner.textContent = "";
  }

  function normalizePhone(value) {
    return String(value || "").trim();
  }

  function phoneDigits(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function normalizeTelegram(value) {
    var v = String(value || "").trim();
    if (!v) return "";
    if (v.charAt(0) === "@") v = v.slice(1);
    return v ? "@" + v : "";
  }

  function normalizeEmail(value) {
    return String(value || "").trim();
  }

  var TELEGRAM_USERNAME_RE = /^[A-Za-z0-9_]{3,32}$/;
  // Pragmatic email regex: local@domain.tld with allowed local chars.
  var EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

  function applyLangVisibility() {
    var lang = getLang();
    var isEn = lang === "en";
    if (telegramField) telegramField.style.display = isEn ? "none" : "";
    if (emailField) emailField.style.display = isEn ? "" : "none";
    // Clear errors on the hidden field so they don't linger on next language switch.
    if (isEn) {
      setFieldError(telegramInput, telegramError, null);
    } else {
      setFieldError(emailInput, emailError, null);
    }
  }

  function validate() {
    clearFieldErrors();
    var ok = true;
    var lang = getLang();

    var name = (nameInput.value || "").trim();
    if (!name) {
      setFieldError(nameInput, nameError, "participate.error.name", "Пожалуйста, укажите имя");
      ok = false;
    }

    var phoneRaw = normalizePhone(phoneInput.value);
    var digits = phoneDigits(phoneRaw);
    if (!phoneRaw || digits.length < 7) {
      setFieldError(phoneInput, phoneError, "participate.error.phone", "Укажите корректный телефон (минимум 7 цифр)");
      ok = false;
    }

    if (lang === "en") {
      var emailRaw = normalizeEmail(emailInput && emailInput.value);
      if (emailRaw) {
        if (!EMAIL_RE.test(emailRaw) || emailRaw.length > 120) {
          setFieldError(emailInput, emailError, "participate.error.email", "Please enter a valid email address");
          ok = false;
        }
      }
    } else {
      var tgRaw = (telegramInput && telegramInput.value || "").trim();
      if (tgRaw) {
        var tgBare = tgRaw.charAt(0) === "@" ? tgRaw.slice(1) : tgRaw;
        if (!TELEGRAM_USERNAME_RE.test(tgBare)) {
          setFieldError(telegramInput, telegramError, "participate.error.telegram", "Имя пользователя Telegram содержит недопустимые символы");
          ok = false;
        }
      }
    }

    return ok;
  }

  function getScriptUrl() {
  var url = (form.getAttribute("data-script-url") || "").trim();
  return url === "https://script.google.com/macros/s/AKfycby_2gYWEsq8Jg5GmKKbZzMvLibtaV2GFBp3N_mKAcgfKxJK7O9iMozxgEiMwCzQvJnc/exec"
    ? url
    : "";
  }

  function buildPayload() {
    var lang = getLang();
    var telegramVal = "";
    var emailVal = "";
    var contactType = "";
    var contactValue = "";

    if (lang === "en") {
      emailVal = normalizeEmail(emailInput && emailInput.value);
      if (emailVal) {
        contactType = "email";
        contactValue = emailVal;
      }
    } else {
      telegramVal = normalizeTelegram(telegramInput && telegramInput.value);
      if (telegramVal) {
        contactType = "telegram";
        contactValue = telegramVal;
      }
    }

    return {
      name: (nameInput.value || "").trim(),
      phone: normalizePhone(phoneInput.value),
      telegram: telegramVal,
      email: emailVal,
      contactType: contactType,
      contactValue: contactValue,
      language: lang,
      sourcePage: window.location.href,
      userAgent: navigator.userAgent || "",
      submittedAt: new Date().toISOString()
    };
  }

  function postForm(url, payload) {
    // Apps Script web apps accept text/plain as a "simple" CORS POST without preflight.
    // The payload is a JSON string; doPost reads it via e.postData.contents.
    return fetch(url, {
      method: "POST",
      mode: "cors",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
  }

  function setSubmitting(isSubmitting) {
    if (!submitButton) return;
    submitButton.disabled = !!isSubmitting;
    submitButton.setAttribute("aria-busy", isSubmitting ? "true" : "false");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideBanner();

    if (!validate()) {
      showBanner("error", "participate.status.invalid", "Проверьте правильность заполнения полей.");
      return;
    }

    var url = getScriptUrl();
    if (!url) {
      showBanner("error", "participate.status.noUrl", "Форма не настроена: укажите URL Google Apps Script.");
      return;
    }

    var payload = buildPayload();
    setSubmitting(true);
    showBanner("info", "participate.status.sending", "Отправляем заявку…");

    postForm(url, payload)
      .then(function (response) {
        return response.text().then(function (text) {
          var parsed = null;
          try { parsed = JSON.parse(text); } catch (_e) {}
          return { ok: response.ok, parsed: parsed, status: response.status };
        });
      })
      .then(function (result) {
        if (result.ok && (!result.parsed || result.parsed.ok !== false)) {
          showBanner("success", "participate.status.success", "Спасибо! Мы получили вашу заявку.");
          form.reset();
        } else {
          var serverMsg = result.parsed && result.parsed.error ? String(result.parsed.error) : "";
          showBanner("error", "participate.status.error", "Не удалось отправить заявку. Попробуйте ещё раз.");
          if (serverMsg && statusBanner) {
            statusBanner.textContent = statusBanner.textContent + " (" + serverMsg + ")";
          }
        }
      })
      .catch(function () {
        showBanner("error", "participate.status.network", "Ошибка сети. Проверьте соединение и повторите попытку.");
      })
      .then(function () {
        setSubmitting(false);
      });
  });

  [nameInput, phoneInput, telegramInput, emailInput].forEach(function (input) {
    if (!input) return;
    input.addEventListener("input", function () {
      if (input.classList.contains("is-invalid")) {
        var errId = input.id === "nameInput" ? nameError
          : input.id === "phoneInput" ? phoneError
          : input.id === "telegramInput" ? telegramError
          : emailError;
        setFieldError(input, errId, null);
      }
    });
  });

  applyLangVisibility();

  if (window.UpeakI18n && typeof window.UpeakI18n.onChange === "function") {
    window.UpeakI18n.onChange(function () {
      applyLangVisibility();
      if (statusBanner && statusBanner.hasAttribute("data-i18n")) {
        statusBanner.textContent = t(statusBanner.getAttribute("data-i18n"), statusBanner.textContent);
      }
    });
  }
})();
