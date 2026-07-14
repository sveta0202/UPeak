"use strict";

// Собирает статичный справочник "card_id → человекочитаемое название" из
// JSON-матриц (утро + вечер, карточки + плашки), чтобы не парсить JSON руками
// при анализе Google Sheets.
//
// Результат:
//   output/recommendations-catalog.csv        — для просмотра/импорта
//   output/recommendations-catalog-seed.txt    — JS-массив для вставки в
//                                                 docs/CodeAPP.gs (сид листа
//                                                 Recommendations_Catalog)
//
// Запуск: npm run recommendations-catalog

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "output");
const OUT_CSV = path.join(OUT_DIR, "recommendations-catalog.csv");
const OUT_SEED = path.join(OUT_DIR, "recommendations-catalog-seed.txt");

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", relPath), "utf8"));
}

function pushRow(rows, cardId, scope, kind, title) {
  rows.push({ card_id: cardId, scope: scope, kind: kind, title: title });
}

function collectMorningCardRows(dayMatrix, rows) {
  const decisions = (dayMatrix && dayMatrix.decisions) || {};

  Object.keys(decisions).forEach(function (key) {
    const base = decisions[key];
    const title = base.state || key;
    pushRow(rows, key, "morning", "card", title);

    if (key === "single_issue" && base.by_issue) {
      Object.keys(base.by_issue).forEach(function (issue) {
        pushRow(rows, key + ":" + issue, "morning", "card", title + " — " + issue);
      });
    }

    if (key === "growth" && base.by_axis) {
      Object.keys(base.by_axis).forEach(function (axis) {
        const axisBlock = base.by_axis[axis];
        if (axis === "sleep" && axisBlock.by_metric) {
          Object.keys(axisBlock.by_metric).forEach(function (metric) {
            pushRow(rows, key + ":" + metric, "morning", "card", title + " — " + metric);
          });
        } else {
          pushRow(rows, key + ":" + axis, "morning", "card", title + " — " + axis);
        }
      });
    }

    if (key === "high" && base.by_profile) {
      Object.keys(base.by_profile).forEach(function (profile) {
        pushRow(rows, key + ":" + profile, "morning", "card", title + " — " + profile);
      });
    }
  });
}

function collectEveningCardRows(eveningMatrix, rows) {
  const decisions = (eveningMatrix && eveningMatrix.decisions) || {};
  Object.keys(decisions).forEach(function (key) {
    const base = decisions[key];
    pushRow(rows, key, "evening", "card", base.state || key);
  });
}

function collectEmbedRows(matrix, scope, rows) {
  const embeddables = (matrix && matrix.embeddables) || [];
  embeddables.forEach(function (embed) {
    if (!embed || !embed.id) return;
    pushRow(rows, embed.id, scope, "embed", embed.prompt || embed.id);
  });
}

function escapeCsv(value) {
  const s = String(value == null ? "" : value);
  if (s.indexOf(",") !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(rows) {
  const header = ["card_id", "scope", "kind", "title"];
  const lines = [header.join(",")];
  rows.forEach(function (row) {
    lines.push(header.map(function (col) { return escapeCsv(row[col]); }).join(","));
  });
  return lines.join("\n");
}

// JS-литерал массива массивов [card_id, scope, kind, title] — вставляется в
// docs/CodeAPP.gs как значение RECOMMENDATIONS_CATALOG_SEED.
function toSeedLiteral(rows) {
  const lines = rows.map(function (row) {
    return "  [" +
      JSON.stringify(row.card_id) + ", " +
      JSON.stringify(row.scope) + ", " +
      JSON.stringify(row.kind) + ", " +
      JSON.stringify(row.title) +
      "]";
  });
  return "var RECOMMENDATIONS_CATALOG_SEED = [\n" + lines.join(",\n") + "\n];\n";
}

function main() {
  const dayMatrix = readJson("public/day-decision-matrix.json");
  const dayRecommendationMatrix = readJson("public/day-recommendation-matrix.json");
  const eveningMatrix = readJson("public/evening-decision-matrix.json");

  const rows = [];
  collectMorningCardRows(dayMatrix, rows);
  collectEmbedRows(dayRecommendationMatrix, "morning", rows);
  collectEveningCardRows(eveningMatrix, rows);
  collectEmbedRows(eveningMatrix, "evening", rows);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_CSV, toCsv(rows), "utf8");
  fs.writeFileSync(OUT_SEED, toSeedLiteral(rows), "utf8");

  console.log("Recommendations catalog: " + rows.length + " rows");
  console.log("CSV: " + OUT_CSV);
  console.log("Seed for Apps Script: " + OUT_SEED);
}

main();
