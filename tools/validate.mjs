/**
 * Валидатор компендиумов darpg против НАСТОЯЩИХ моделей данных системы и документов ядра.
 *
 *   node tools/validate.mjs <pack|all> [--src DIR | --db DIR] [--json FILE] [--verbose]
 *
 * Источник: YAML пака (по умолчанию DARPG/packs/<pack>/*.yaml), --src DIR → DIR/<pack>/*.yaml,
 * --db DIR → собранная LevelDB DIR/<pack> (читается из временной копии).
 *
 * Каждый документ конструируется как foundry.documents.BaseItem / BaseActor / BaseRollTable
 * (со встроенными документами) с {strict: true}; собираются все ошибки валидации. Правила:
 *   schema   — ошибки моделей системы / схем ядра;
 *   dropped  — ключ, которого нет в схеме: очистка ядра молча его отбросит;
 *   (a) header   — первая строка "# packs/<pack>/<file>";
 *   (b) filename — имя файла = slug(name) или slug(name)-N;
 *   (c) id       — формат _id и уникальность во всей системе (вложенные — внутри родителя);
 *   (d) type     — подтип есть в system.json documentTypes и в flags.darpg.types пака;
 *   (e) migrate  — migrateData модели не должен менять данные (иначе YAML в старой форме);
 *   (f) html     — в HTML-полях нет Markdown (**, __, ведущий #, "\n\n") и сырых переводов строк;
 *   (g) cyrillic — кириллица где угодно в файле;
 *   (h) enricher — [[/test <сокр> …]] с допустимым сокращением характеристики (CONFIG.DARPG.
 *                  abilityAbbreviations или «wp»); focus=<имя> должен быть фокусом из packs/focuses
 *                  (предупреждение, если у пака фокусов есть YAML);
 *   deprecated — ядро сообщило об устаревшем API при обработке документа (запрет пользователя);
 *   db       — (--db) висячие _id вложенных документов или ключи-сироты в LevelDB.
 *   coerced  — очистка схемы меняет значение (обрезка по min/max, приведение типа и т.п.).
 * Предупреждения (не ошибки): focus, log (прочий лог ядра), markdown-эвристики (*курсив*, [ссылка](url)).
 * Код выхода 1 при любой ошибке; --json пишет полный отчёт.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { captureLogs, documentClass, flattenValidationError, loadSystem } from "./lib/foundry-harness.mjs";
import {
  ID_PATTERN, PACKS_ROOT, clone, deepEqual, displayPath, embeddedCollections, entriesToDocuments, fileStemOf, firstLine,
  getPacks, hasLevelDb, headerFor, isPlainObject, isValidFileStem, parseArgs, readLevelDb, readYamlDir, yamlDirOf
} from "./packs.mjs";

/** Опции очистки, как при конструировании документа (DataModel#_initializeSource). */
const CLEAN_OPTIONS = Object.freeze({
  addTypes: false, expand: true, migrate: true, model: true, partial: false, prune: true, persisted: true,
  sanitize: false
});

/** Сокращения характеристик из SCHEMA.md §2 — запасной список, если CONFIG.DARPG их не задаёт. */
const FALLBACK_ABBREVIATIONS = {
  com: "communication", con: "constitution", cun: "cunning", dex: "dexterity",
  mag: "magic", per: "perception", str: "strength", wil: "willpower", wp: "willpower"
};

/** Кириллица (основной блок, дополнение, расширения A/B/C). */
const CYRILLIC = /[\u0400-\u052F\u1C80-\u1C8F\u2DE0-\u2DFF\uA640-\uA69F]/;

/** Энричер теста системы (тот же шаблон, что в module/enrichers.mjs). */
const TEST_ENRICHER = /\[\[\/test\s+([^\]]+)\]\](?!\])/gi;

/** Максимум примеров в одном сообщении. */
const MAX_SAMPLES = 3;

/* -------------------------------------------- */
/*  Помощники                                   */
/* -------------------------------------------- */

/**
 * Обойти все строки значения с путями.
 * @param {any} value
 * @param {string} at
 * @param {(path: string, text: string) => void} fn
 */
function walkStrings(value, at, fn) {
  if ( typeof value === "string" ) fn(at, value);
  else if ( Array.isArray(value) ) value.forEach((v, i) => walkStrings(v, `${at}[${i}]`, fn));
  else if ( isPlainObject(value) ) {
    for ( const [k, v] of Object.entries(value) ) walkStrings(v, at ? `${at}.${k}` : k, fn);
  }
}

/**
 * Обойти HTML-поля документа по схеме (ядро → TypeDataField → модель подтипа → вложенные документы).
 * @param {object} doc
 * @param {object} schema     Схема (SchemaField) уровня
 * @param {string} at
 * @param {string} type       Подтип документа этого уровня
 * @param {(path: string, html: string) => void} fn
 */
function walkHtmlFields(doc, schema, at, type, fn) {
  const F = foundry.data.fields;
  const visit = (value, field, p) => {
    if ( value === undefined || value === null ) return;
    if ( field instanceof F.HTMLField ) {
      if ( typeof value === "string" ) fn(p, value);
    }
    else if ( field instanceof F.TypeDataField ) {
      const model = field.getModelForType(type);
      let fields = null;
      try {
        fields = model?.schema;
      } catch {}
      if ( fields && isPlainObject(value) ) walkHtmlFields(value, fields, p, type, fn);
    }
    else if ( field instanceof F.EmbeddedCollectionField ) {
      if ( !Array.isArray(value) ) return;
      value.forEach((child, i) => {
        if ( isPlainObject(child) ) walkHtmlFields(child, field.element.schema, `${p}[${i}]`, child.type, fn);
      });
    }
    else if ( field instanceof F.SchemaField ) {
      if ( isPlainObject(value) ) walkHtmlFields(value, field, p, type, fn);
    }
    else if ( field instanceof F.ArrayField ) {
      if ( Array.isArray(value) ) value.forEach((v, i) => visit(v, field.element, `${p}[${i}]`));
    }
    else if ( field instanceof F.TypedObjectField ) {
      if ( isPlainObject(value) ) for ( const [k, v] of Object.entries(value) ) visit(v, field.element, `${p}.${k}`);
    }
  };
  for ( const [key, field] of Object.entries(schema.fields) ) {
    if ( key in doc ) visit(doc[key], field, at ? `${at}.${key}` : key);
  }
}

/**
 * Найти проблемы оформления HTML-строки.
 * @param {string} html
 * @returns {{errors: string[], warnings: string[]}}
 */
export function htmlProblems(html) {
  const errors = [];
  const warnings = [];
  if ( html.includes("\n\n") ) errors.push("Markdown-абзац \"\\n\\n\"");
  else if ( /[\r\n]/.test(html) ) errors.push("сырой перевод строки");
  if ( html.includes("**") ) errors.push("Markdown **");
  if ( html.includes("__") ) errors.push("Markdown __");
  if ( /(^|[\r\n]|>)[ \t]*#{1,6}[ \t]/.test(html) ) errors.push("Markdown-заголовок #");
  const text = html.replace(/\[\[[\s\S]*?\]\]/g, "");
  if ( /(^|[\s>(])\*[^\s*][^*\r\n]*?\*(?=[\s<.,;:!?)]|$)/.test(text) ) warnings.push("похоже на Markdown *курсив*");
  if ( /\[[^\]\r\n]+\]\((?:https?:|\/|#)[^)\s]*\)/.test(text) ) warnings.push("похоже на Markdown-ссылку [текст](url)");
  return { errors, warnings };
}

/**
 * Разобрать хвост энричера `key=value` (как parseArgs в module/enrichers.mjs).
 * @param {string} str
 * @returns {Record<string, string>}
 */
function parseEnricherArgs(str) {
  const out = {};
  for ( const m of String(str ?? "").matchAll(/(\w+)=("([^"]*)"|'([^']*)'|(\S+))/g) ) out[m[1]] = m[3] ?? m[4] ?? m[5];
  return out;
}

/**
 * Сокращения характеристик → ключ характеристики по CONFIG.DARPG.abilityAbbreviations
 * (поддерживаются формы {сокр: ключ} и {ключ: сокр}) плюс синоним «wp».
 * @param {object} config  CONFIG.DARPG
 * @returns {{map: Map<string, string|null>, fallback: boolean}}
 */
function abilityAbbreviationMap(config) {
  const abilities = Object.keys(config?.abilities ?? {});
  const source = config?.abilityAbbreviations;
  const map = new Map();
  const fallback = !source || (typeof source !== "object");
  for ( const [k, v] of Object.entries(fallback ? FALLBACK_ABBREVIATIONS : source) ) {
    if ( abilities.includes(k) && (typeof v === "string") && /^[a-z]{2,4}$/i.test(v) ) map.set(v.toLowerCase(), k);
    else map.set(k.toLowerCase(), abilities.includes(v) ? v : null);
  }
  if ( !map.has("wp") ) map.set("wp", abilities.includes("willpower") ? "willpower" : null);
  return { map, fallback };
}

/**
 * Разница двух JSON-деревьев: пути, исчезнувшие в b, появившиеся в b и изменённые.
 * Массивы сравниваются поэлементно.
 * @param {any} a
 * @param {any} b
 * @param {string} [at]
 * @param {object} [out]
 * @returns {{removed: string[], added: string[], changed: string[], values: Array<{path: string, before: any, after: any}>}}
 */
export function jsonDiff(a, b, at = "", out = { removed: [], added: [], changed: [], values: [] }) {
  const join = (k, arr) => (arr ? `${at}[${k}]` : (at ? `${at}.${k}` : k));
  if ( isPlainObject(a) && isPlainObject(b) ) {
    for ( const k of Object.keys(a) ) {
      if ( !(k in b) ) out.removed.push(join(k));
      else jsonDiff(a[k], b[k], join(k), out);
    }
    for ( const k of Object.keys(b) ) if ( !(k in a) ) out.added.push(join(k));
  }
  else if ( Array.isArray(a) && Array.isArray(b) ) {
    const n = Math.max(a.length, b.length);
    for ( let i = 0; i < n; i++ ) {
      if ( i >= b.length ) out.removed.push(join(i, true));
      else if ( i >= a.length ) out.added.push(join(i, true));
      else jsonDiff(a[i], b[i], join(i, true), out);
    }
  }
  else if ( !deepEqual(a, b) ) {
    out.changed.push(at || "(корень)");
    out.values.push({ path: at || "(корень)", before: a, after: b });
  }
  return out;
}

/**
 * Краткая запись значения для сообщений.
 * @param {any} value
 * @returns {string}
 */
function brief(value) {
  const text = (value === undefined) ? "undefined" : JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/**
 * Текст HTML/Markdown без разметки — для сравнения строк до и после миграции.
 * @param {string} html
 * @returns {string}
 */
function plainText(html) {
  return String(html).replace(/<[^>]*>/g, " ").replace(/[*_#]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Короткий фрагмент строки вокруг позиции.
 * @param {string} text
 * @param {number} index
 * @returns {string}
 */
function snippet(text, index) {
  const start = Math.max(0, index - 15);
  return text.slice(start, start + 50).replace(/\s+/g, " ").trim();
}

/**
 * Свести список к короткой строке.
 * @param {string[]} list
 * @returns {string}
 */
function sample(list) {
  const shown = list.slice(0, MAX_SAMPLES).join(", ");
  return list.length > MAX_SAMPLES ? `${shown} … (+${list.length - MAX_SAMPLES})` : shown;
}

/* -------------------------------------------- */
/*  Источники                                   */
/* -------------------------------------------- */

/**
 * Загрузить документы паков. Для проверяемых паков — основной источник; для остальных паков
 * (индекс _id, имена фокусов) — основной источник, а при его отсутствии YAML из DARPG/packs.
 * @param {object} options
 * @returns {Promise<Map<string, {pack: object, origin: string, primary: boolean, entries: object[], notes: string[]}>>}
 */
async function loadSources({ src, db }) {
  const sources = new Map();
  for ( const pack of getPacks("all") ) {
    const notes = [];
    let entries = [];
    let origin = null;
    let primary = true;
    if ( db ) {
      const dir = path.resolve(db, pack.name);
      if ( hasLevelDb(dir) ) {
        origin = dir;
        const ldb = await readLevelDb(dir);
        const collection = documentClass(pack.type).metadata.collection;
        entries = entriesToDocuments(ldb, pack.type, notes).map(data => ({
          label: `!${collection}!${data?._id}`, file: null, text: null, data, error: null
        }));
      }
    }
    else {
      const dir = yamlDirOf(pack, src);
      const files = readYamlDir(dir);
      if ( files.length ) {
        origin = dir;
        entries = files.map(f => ({ label: f.file, ...f }));
      }
    }
    if ( !origin ) {
      // Запасной источник только для индексов (не проверяется).
      primary = false;
      const files = (db || src) ? readYamlDir(pack.dir) : [];
      if ( files.length ) {
        origin = pack.dir;
        entries = files.map(f => ({ label: f.file, ...f }));
      }
    }
    sources.set(pack.name, { pack, origin, primary, entries, notes });
  }
  return sources;
}

/* -------------------------------------------- */
/*  Проверка документа                          */
/* -------------------------------------------- */

/**
 * Проверить один документ (YAML-файл или запись LevelDB).
 * @param {object} entry   {label, file, text, data, error}
 * @param {object} pack    PackInfo
 * @param {object} ctx     Общий контекст проверки
 * @returns {object}       Результат {file, id, name, type, errors, warnings}
 */
function validateEntry(entry, pack, ctx) {
  const result = {
    file: entry.label, id: entry.data?._id ?? null, name: entry.data?.name ?? null, type: entry.data?.type ?? null,
    errors: [], warnings: []
  };
  const error = (rule, at, message) => result.errors.push({ rule, path: at, message });
  const warn = (rule, at, message) => result.warnings.push({ rule, path: at, message });

  // YAML
  if ( entry.error ) {
    error("yaml", "", firstLine(entry.error.message));
    return result;
  }
  const data = entry.data;
  if ( !isPlainObject(data) ) {
    error("yaml", "", "документ не является отображением");
    return result;
  }

  // (a) заголовок и (b) имя файла — только для YAML
  if ( entry.file ) {
    const expected = headerFor(pack.name, entry.file);
    const first = entry.text.split(/\r?\n/, 1)[0];
    if ( first !== expected ) error("header", "", `первая строка «${first.slice(0, 80)}», ожидается «${expected}»`);
    const stem = entry.file.replace(/\.yaml$/, "");
    if ( !isValidFileStem(stem, data) ) {
      error("filename", "", `имя файла «${entry.file}», ожидается «${fileStemOf(data)}.yaml» (или -2, -3…)`);
    }
  }

  // (c) _id: формат и уникальность в системе; (d) подтип
  checkIdentity(data, pack.type, "", { top: true, pack, ctx, error });

  // Конструирование документа ядра (strict) — все ошибки моделей и схем
  const cls = documentClass(pack.type);
  const built = captureLogs(() => new cls(clone(data), { strict: true }));
  if ( built.error ) {
    const failures = flattenValidationError(built.error);
    for ( const f of failures ) error("schema", f.path, f.message);
    if ( !failures.length ) error("schema", "", built.error.message);
  }
  classifyLogs(built.logs, "", error, warn);

  // (e) migrateData не должен менять system (рекурсивно — и у вложенных предметов).
  // Возвращает копию документа с мигрированным system — база для сравнения с очисткой.
  const migrated = checkMigration(data, pack.type, "", error, warn);

  // Ключи вне схемы (очистка ядра их молча отбросит) и значения, изменённые очисткой.
  // Сравнение с мигрированными данными: то, что переносит migrateData, уже отражено в (e).
  const cleaned = captureLogs(() => cls.cleanData(clone(data), { ...CLEAN_OPTIONS }));
  if ( !cleaned.error && isPlainObject(cleaned.result) ) {
    const diff = jsonDiff(migrated, cleaned.result);
    for ( const p of diff.removed ) error("dropped", p, "ключа нет в схеме — будет отброшен при загрузке");
    for ( const v of diff.values ) {
      error("coerced", v.path, `очистка схемы меняет значение: ${brief(v.before)} → ${brief(v.after)}`);
    }
  }

  // (f) HTML-поля: по схеме (как есть), по htmlFields из system.json (старые строковые поля)
  // и по схеме после миграции; одинаковые строки проверяются один раз.
  const htmlStrings = new Map();
  const addHtml = (at, html) => {
    if ( !htmlStrings.has(html) ) htmlStrings.set(html, at);
  };
  walkHtmlFields(data, cls.schema, "", data.type, addHtml);
  walkDeclaredHtmlFields(data, pack.type, "", ctx.manifest, addHtml);
  if ( !cleaned.error && isPlainObject(cleaned.result) ) {
    // После миграции текст мог обернуться в <p> и т.п. — повтор уже найденной строки не считаем.
    const seen = [...htmlStrings.keys()].map(plainText).filter(Boolean);
    walkHtmlFields(cleaned.result, cls.schema, "", data.type, (at, html) => {
      const text = plainText(html);
      if ( text && seen.some(t => t.includes(text) || text.includes(t)) ) return;
      addHtml(`${at} (после миграции)`, html);
    });
  }
  for ( const [html, at] of htmlStrings ) {
    const { errors, warnings } = htmlProblems(html);
    if ( errors.length ) error("html", at, errors.join("; "));
    if ( warnings.length ) warn("html", at, warnings.join("; "));
  }

  // (g) кириллица
  if ( entry.text ) {
    const lines = [];
    entry.text.split(/\r?\n/).forEach((line, i) => {
      const m = CYRILLIC.exec(line);
      if ( m ) lines.push(`L${i + 1} «${snippet(line, m.index)}»`);
    });
    if ( lines.length ) error("cyrillic", "", `кириллица в ${lines.length} строк(ах): ${sample(lines)}`);
  }
  else {
    const paths = [];
    walkStrings(data, "", (at, text) => {
      if ( CYRILLIC.test(text) ) paths.push(at);
    });
    if ( paths.length ) error("cyrillic", "", `кириллица в ${paths.length} пол(ях): ${sample(paths)}`);
  }

  // (h) энричеры [[/test …]]
  walkStrings(data, "", (at, text) => {
    for ( const m of text.matchAll(TEST_ENRICHER) ) checkTestEnricher(m, at, ctx, error, warn);
  });
  return result;
}

/**
 * (c) и (d) для документа и его вложенных документов.
 * @param {object} doc
 * @param {string} documentName
 * @param {string} at
 * @param {object} options
 */
function checkIdentity(doc, documentName, at, { top, pack, ctx, error }) {
  const id = doc?._id;
  const where = at || "_id";
  if ( (typeof id !== "string") || !ID_PATTERN.test(id) ) {
    error("id", where, id === undefined ? "нет _id" : `_id «${id}» — нужно 16 латинских букв/цифр`);
  }
  else if ( top ) {
    const places = (ctx.idIndex.get(id) ?? []).filter(p => p !== ctx.current);
    if ( places.length ) error("id", where, `_id ${id} повторяется: ${sample(places)}`);
  }

  // (d) подтипы Item/Actor: system.json documentTypes и flags.darpg.types пака
  if ( (documentName === "Item") || (documentName === "Actor") ) {
    const allowed = Object.keys(ctx.manifest.documentTypes?.[documentName] ?? {});
    const typePath = at ? `${at}.type` : "type";
    if ( doc.type !== undefined ) {
      if ( !allowed.includes(doc.type) ) {
        error("type", typePath, `подтип «${doc.type}» не объявлен в system.json documentTypes.${documentName}`);
      }
      else if ( top && pack.types && !pack.types.includes(doc.type) ) {
        error("type", typePath, `подтип «${doc.type}» не разрешён паку ${pack.name} (flags.darpg.types: ${pack.types.join(", ")})`);
      }
    }
  }

  // Вложенные документы: свой _id, уникальность внутри коллекции родителя, подтипы
  for ( const [field, childName] of embeddedCollections(documentName) ) {
    if ( !Array.isArray(doc?.[field]) ) continue;
    const seen = new Map();
    doc[field].forEach((child, i) => {
      const childAt = `${at ? `${at}.` : ""}${field}[${i}]`;
      if ( !isPlainObject(child) ) return;   // форму элемента проверит схема
      if ( child._id && seen.has(child._id) ) {
        error("id", `${childAt}._id`, `_id ${child._id} повторяется в ${field} (уже в [${seen.get(child._id)}])`);
      }
      else seen.set(child._id, i);
      checkIdentity(child, childName, childAt, { top: false, pack, ctx, error });
    });
  }
}

/**
 * (e) Прогнать migrateData модели подтипа на копии system и сравнить (рекурсивно по вложенным).
 * @param {object} doc
 * @param {string} documentName
 * @param {string} at
 * @param {Function} error
 * @param {Function} warn
 * @returns {object}  Копия документа с мигрированным system (там, где миграция удалась)
 */
function checkMigration(doc, documentName, at, error, warn) {
  const out = clone(doc);
  const model = globalThis.CONFIG?.[documentName]?.dataModels?.[doc?.type];
  const systemPath = at ? `${at}.system` : "system";
  if ( model && isPlainObject(doc.system) ) {
    const run = captureLogs(() => model.migrateData(clone(doc.system), { ...CLEAN_OPTIONS }));
    classifyLogs(run.logs, systemPath, error, warn);
    if ( run.error ) error("migrate", systemPath, `migrateData бросил исключение: ${run.error.message}`);
    else if ( run.result === undefined ) error("migrate", systemPath, "migrateData вернул undefined (в v14 устарело)");
    else {
      out.system = run.result;
      const diff = jsonDiff(doc.system, run.result);
      const parts = [];
      if ( diff.removed.length ) parts.push(`убирает ${sample(diff.removed)}`);
      if ( diff.added.length ) parts.push(`добавляет ${sample(diff.added)}`);
      if ( diff.changed.length ) parts.push(`меняет ${sample(diff.changed)}`);
      if ( parts.length ) error("migrate", systemPath, `данные в старой форме — migrateData ${parts.join("; ")}`);
    }
  }
  for ( const [field, childName] of embeddedCollections(documentName) ) {
    if ( !Array.isArray(doc?.[field]) ) continue;
    out[field] = doc[field].map((child, i) => {
      if ( !isPlainObject(child) ) return clone(child);
      return checkMigration(child, childName, `${at ? `${at}.` : ""}${field}[${i}]`, error, warn);
    });
  }
  return out;
}

/**
 * HTML-поля, объявленные в system.json (documentTypes.<Документ>.<подтип>.htmlFields, пути
 * относительно system) — ловит Markdown и в старых строковых полях, которых уже нет в схеме.
 * @param {object} doc
 * @param {string} documentName
 * @param {string} at
 * @param {object} manifest
 * @param {(path: string, html: string) => void} fn
 */
function walkDeclaredHtmlFields(doc, documentName, at, manifest, fn) {
  const declared = manifest.documentTypes?.[documentName]?.[doc?.type]?.htmlFields;
  if ( Array.isArray(declared) && isPlainObject(doc.system) ) {
    for ( const p of declared ) {
      const value = foundry.utils.getProperty(doc.system, p);
      if ( typeof value === "string" ) fn(`${at ? `${at}.` : ""}system.${p}`, value);
    }
  }
  for ( const [field, childName] of embeddedCollections(documentName) ) {
    if ( !Array.isArray(doc?.[field]) ) continue;
    doc[field].forEach((child, i) => {
      if ( isPlainObject(child) ) walkDeclaredHtmlFields(child, childName, `${at ? `${at}.` : ""}${field}[${i}]`, manifest, fn);
    });
  }
}

/**
 * Разложить перехваченный лог ядра: устаревшие API и сбои миграции — ошибки, прочее — предупреждения.
 * @param {Array<{level: string, message: string}>} logs
 * @param {string} at
 * @param {Function} error
 * @param {Function} warn
 */
function classifyLogs(logs, at, error, warn) {
  for ( const { level, message } of logs ) {
    const text = message.split("\n").slice(0, 3).join(" ").slice(0, 300);
    if ( /Deprecated since|deprecated/i.test(message) ) error("deprecated", at, text);
    else if ( /Failed data migration/.test(message) ) error("migrate", at, text);
    else if ( (level === "warn") || (level === "error") ) warn("log", at, text);
  }
}

/**
 * (h) Проверить один [[/test …]].
 * @param {RegExpMatchArray} match
 * @param {string} at
 * @param {object} ctx
 * @param {Function} error
 * @param {Function} warn
 */
function checkTestEnricher(match, at, ctx, error, warn) {
  const [abilToken = "", ...rest] = match[1].trim().split(/\s+/);
  const abbr = abilToken.toLowerCase();
  const short = match[0].length > 60 ? `${match[0].slice(0, 57)}…` : match[0];
  if ( !ctx.abbreviations.has(abbr) ) {
    error("enricher", at, `${short}: «${abilToken}» — не сокращение характеристики (${[...ctx.abbreviations.keys()].join(", ")})`);
    return;
  }
  if ( abilToken !== abbr ) warn("enricher", at, `${short}: сокращение не в нижнем регистре`);
  const args = parseEnricherArgs(rest.join(" "));
  if ( (args.focus === undefined) || !ctx.focuses ) return;
  const focus = ctx.focuses.get(args.focus);
  if ( !focus ) {
    const similar = [...ctx.focuses.keys()].find(n => n.toLowerCase() === args.focus.toLowerCase());
    // Имя из нескольких слов без кавычек: энричер берёт только первое слово.
    const tail = rest.join(" ").match(/focus=(?!["'])(\S+(?:\s+[^\s=]+)*)/)?.[1] ?? "";
    const words = tail.split(/\s+/);
    let quoted = null;
    for ( let n = words.length; n > 1; n-- ) {
      const candidate = words.slice(0, n).join(" ");
      if ( ctx.focuses.has(candidate) ) {
        quoted = candidate;
        break;
      }
    }
    const hint = quoted ? ` (имя из нескольких слов нужно в кавычках: focus="${quoted}")`
      : (similar ? ` (есть «${similar}»)` : "");
    warn("focus", at, `${short}: фокуса «${args.focus}» нет в packs/focuses${hint}`);
    return;
  }
  const ability = ctx.abbreviations.get(abbr);
  if ( ability && focus.ability && (focus.ability !== ability) ) {
    warn("focus", at, `${short}: фокус «${args.focus}» относится к ${focus.ability}, тест — ${ability}`);
  }
}

/* -------------------------------------------- */
/*  Прогон                                      */
/* -------------------------------------------- */

/**
 * Проверить паки.
 * @param {string} selector
 * @param {{src?: string, db?: string}} [options]
 * @returns {Promise<object>}  Полный отчёт
 */
export async function validatePacks(selector, { src, db } = {}) {
  const system = await loadSystem();
  const packs = getPacks(selector);
  const sources = await loadSources({ src, db });
  const { map: abbreviations, fallback } = abilityAbbreviationMap(system.config);
  const notes = [...system.notes];
  if ( fallback ) notes.push("CONFIG.DARPG.abilityAbbreviations не задан — сокращения из SCHEMA.md §2");

  // Индекс _id верхнего уровня по всей системе
  const idIndex = new Map();
  for ( const { pack, entries } of sources.values() ) {
    for ( const e of entries ) {
      const id = e.data?._id;
      if ( typeof id !== "string" ) continue;
      if ( !idIndex.has(id) ) idIndex.set(id, []);
      idIndex.get(id).push(`${pack.name}/${e.label}`);
    }
  }

  // Имена фокусов (если у пака фокусов есть YAML/база)
  let focuses = null;
  const focusSource = sources.get("focuses");
  if ( focusSource?.entries.length ) {
    focuses = new Map();
    for ( const e of focusSource.entries ) {
      if ( (e.data?.type === "focus") && (typeof e.data.name === "string") ) {
        focuses.set(e.data.name, { ability: e.data.system?.ability ?? null });
      }
    }
  }
  else notes.push("у пака focuses нет YAML — проверка focus= пропущена");

  const report = {
    generatedAt: new Date().toISOString(),
    mode: db ? "db" : "yaml",
    source: db ? path.resolve(db) : (src ? path.resolve(src) : PACKS_ROOT),
    harness: {
      strategy: system.strategy,
      dataModels: Object.fromEntries(Object.entries(system.dataModels).map(([d, m]) => [d, Object.keys(m)])),
      notes
    },
    packs: {},
    totals: { packs: 0, documents: 0, errors: 0, warnings: 0, documentsWithErrors: 0 }
  };

  for ( const pack of packs ) {
    const source = sources.get(pack.name);
    const packReport = {
      type: pack.type, origin: source.origin && source.primary ? source.origin : null,
      documents: 0, errors: 0, warnings: 0, documentsWithErrors: 0, byRule: {}, sourceNotes: source.notes, results: []
    };
    report.packs[pack.name] = packReport;
    if ( !source.primary || !source.origin ) continue;
    // Целостность LevelDB (висячие/осиротевшие вложенные ключи) — ошибки уровня пака.
    packReport.errors += source.notes.length;
    if ( source.notes.length ) packReport.byRule.db = source.notes.length;
    for ( const entry of source.entries ) {
      const ctx = {
        manifest: system.manifest, idIndex, abbreviations, focuses, current: `${pack.name}/${entry.label}`
      };
      const result = validateEntry(entry, pack, ctx);
      packReport.results.push(result);
      packReport.documents++;
      packReport.errors += result.errors.length;
      packReport.warnings += result.warnings.length;
      if ( result.errors.length ) packReport.documentsWithErrors++;
      for ( const e of result.errors ) packReport.byRule[e.rule] = (packReport.byRule[e.rule] ?? 0) + 1;
      for ( const w of result.warnings ) packReport.byRule[`${w.rule}?`] = (packReport.byRule[`${w.rule}?`] ?? 0) + 1;
    }
    const t = report.totals;
    t.packs++;
    t.documents += packReport.documents;
    t.errors += packReport.errors;
    t.warnings += packReport.warnings;
    t.documentsWithErrors += packReport.documentsWithErrors;
  }
  return report;
}

/**
 * Печать краткой сводки.
 * @param {object} report
 * @param {{verbose?: boolean, log?: Function}} [options]
 */
export function printSummary(report, { verbose = false, log = console.log } = {}) {
  log(`darpg validate — ${report.mode === "db" ? "LevelDB" : "YAML"}: ${displayPath(report.source)}`);
  const models = Object.entries(report.harness.dataModels).map(([d, t]) => `${d} ${t.length}`).join(", ");
  log(`модели: ${models} (регистрация: ${report.harness.strategy})`);
  for ( const n of report.harness.notes ) log(`  ! ${n}`);
  const pad = (s, n) => String(s).padEnd(n);
  log(`${pad("pack", 16)}${pad("docs", 6)}${pad("bad", 5)}${pad("errors", 8)}${pad("warn", 6)}правила (ошибки / предупреждения?)`);
  const missing = Object.entries(report.packs).filter(([, p]) => !p.origin).map(([name]) => name);
  for ( const [name, p] of Object.entries(report.packs) ) {
    if ( !p.origin ) continue;
    const rules = Object.entries(p.byRule).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r}:${n}`).join(" ");
    log(`${pad(name, 16)}${pad(p.documents, 6)}${pad(p.documentsWithErrors, 5)}${pad(p.errors, 8)}${pad(p.warnings, 6)}${rules}`);
    for ( const n of p.sourceNotes ) log(`  ✗ [db] ${n}`);
    if ( !verbose ) continue;
    for ( const r of p.results ) {
      for ( const e of r.errors ) log(`  ✗ ${r.file} [${e.rule}] ${e.path ? `${e.path}: ` : ""}${e.message}`);
      for ( const w of r.warnings ) log(`  ? ${r.file} [${w.rule}] ${w.path ? `${w.path}: ` : ""}${w.message}`);
    }
  }
  if ( missing.length ) log(`нет источника (не проверялись): ${missing.join(", ")}`);
  const t = report.totals;
  log(`ИТОГО: паков ${t.packs}, документов ${t.documents}, с ошибками ${t.documentsWithErrors}, ошибок ${t.errors}, предупреждений ${t.warnings}`);
}

/**
 * Точка входа CLI.
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
export async function main(argv) {
  const usage = "Использование: node tools/validate.mjs <pack|all> [--src DIR | --db DIR] [--json FILE] [--verbose]";
  let args;
  try {
    args = parseArgs(argv, ["src", "db", "json"]);
  } catch(err) {
    console.error(`${err.message}\n${usage}`);
    return 2;
  }
  const [selector] = args._;
  if ( args.help || !selector ) {
    console.log(usage);
    return args.help ? 0 : 2;
  }
  if ( args.src && args.db ) {
    console.error("--src и --db взаимоисключающие");
    return 2;
  }
  let report;
  try {
    report = await validatePacks(selector, { src: args.src, db: args.db });
  } catch(err) {
    console.error(`validate: ${err.stack ?? err.message}`);
    return 1;
  }
  printSummary(report, { verbose: !!(args.verbose || args.v) });
  if ( args.json ) {
    fs.mkdirSync(path.dirname(path.resolve(args.json)), { recursive: true });
    fs.writeFileSync(path.resolve(args.json), JSON.stringify(report, null, 1), "utf8");
    console.log(`полный отчёт: ${path.resolve(args.json)}`);
  }
  return report.totals.errors ? 1 : 0;
}

if ( process.argv[1] && (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) ) {
  process.exitCode = await main(process.argv.slice(2));
}
