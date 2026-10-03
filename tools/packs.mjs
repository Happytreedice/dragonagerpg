/**
 * Компендиумы darpg: YAML-исходники ⇄ LevelDB.
 *
 *   node tools/packs.mjs build   <pack|all> [--src DIR] [--out DIR]
 *   node tools/packs.mjs extract <pack|all> --out DIR [--src DIR] [--clean] | --in-place [--clean]
 *   node tools/packs.mjs format  <pack|all> [--src DIR] [--rename] [--check]
 *
 * Список паков (имя, путь, тип документа Item/Actor/RollTable) берётся из system.json → packs.
 * YAML лежит рядом с файлами LevelDB: packs/<pack>/<slug>.yaml (SCHEMA.md §5), один документ
 * на файл, вложенные документы — массивами объектов (items/effects/results).
 *
 *  build   — читает <src>/<pack>/*.yaml (по умолчанию каталог самого пака) и пишет LevelDB в
 *            каталог пака либо в <out>/<pack>/ (staging). Файлы, не относящиеся к LevelDB
 *            (в т.ч. *.yaml), не трогаются. Пак без YAML пропускается — его LevelDB не стирается.
 *  extract — LevelDB (каталог пака либо <src>/<pack>) → канонические YAML в <out>/<pack>/.
 *            База читается из временной копии: исходные файлы LevelDB не открываются и не меняются.
 *            Запись в DARPG/packs — только с --in-place. Пак с записями, которых формат YAML не
 *            хранит (папки компендиума !folders!, чужие ключи), не извлекается — это ошибка.
 *  format  — переписать YAML пака в каноническом виде (SCHEMA.md §5); --rename — переименовать
 *            файлы в slug(name) (+ "-2", "-3" при совпадениях); --check — только проверить.
 *
 * Модуль импортируем: validate.mjs берёт отсюда slugify, порядок ключей, чтение YAML/LevelDB.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import { ClassicLevel } from "classic-level";
import {
  DARPG_ROOT, coreVersion, documentClass, loadCore, loadSystem, readSystemManifest
} from "./lib/foundry-harness.mjs";

/** Каталог паков системы. */
export const PACKS_ROOT = path.join(DARPG_ROOT, "packs");

/** Формат _id документа Foundry. */
export const ID_PATTERN = /^[A-Za-z0-9]{16}$/;

/** Опции js-yaml 5 (quoteStyle "double" = прежний quotingType '"'). */
export const YAML_DUMP_OPTIONS = Object.freeze({
  indent: 2,
  lineWidth: -1,
  quoteStyle: "double",
  forceQuotes: true,
  noRefs: true
});

/** Порядок ключей верхнего уровня документа в YAML. */
const TOP_LEVEL_ORDER = ["_id", "name", "type", "img", "system", "items", "results", "effects", "prototypeToken"];

/** Файлы, которые принадлежат LevelDB (всё прочее в каталоге пака не трогаем). */
const LEVELDB_FILE = /^(CURRENT|LOCK|LOG|LOG\.old|MANIFEST-\d+|\d+\.(ldb|log|sst|dbtmp))$/;

/* -------------------------------------------- */
/*  Общие помощники                             */
/* -------------------------------------------- */

/**
 * Простой объект (не массив, не null, не экземпляр класса).
 * @param {any} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
  if ( !value || (typeof value !== "object") ) return false;
  const proto = Object.getPrototypeOf(value);
  return (proto === Object.prototype) || (proto === null);
}

/**
 * Глубокая копия JSON-совместимых данных.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function clone(value) {
  return structuredClone(value);
}

/**
 * Глубокое сравнение JSON-совместимых значений (порядок ключей объектов не важен).
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export function deepEqual(a, b) {
  if ( a === b ) return true;
  if ( (typeof a !== typeof b) || (a === null) || (b === null) || (typeof a !== "object") ) {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  if ( Array.isArray(a) !== Array.isArray(b) ) return false;
  if ( Array.isArray(a) ) return (a.length === b.length) && a.every((v, i) => deepEqual(v, b[i]));
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if ( ka.length !== kb.length ) return false;
  return ka.every(k => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}

/**
 * Первая строка сообщения (ошибки js-yaml многострочные: текст, затем фрагмент файла).
 * @param {string} message
 * @returns {string}
 */
export function firstLine(message) {
  return String(message ?? "").split("\n")[0];
}

/**
 * Лежит ли путь child внутри parent (или совпадает с ним).
 * @param {string} child
 * @param {string} parent
 * @returns {boolean}
 */
export function isInside(child, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return (rel === "") || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Путь для сообщений: относительно корня системы, если внутри него.
 * @param {string} p
 * @returns {string}
 */
export function displayPath(p) {
  return isInside(p, DARPG_ROOT) ? (path.relative(DARPG_ROOT, p) || ".") : p;
}

/* -------------------------------------------- */
/*  Паки и документы                            */
/* -------------------------------------------- */

/**
 * Описатели паков из system.json.
 * @param {string} [selector="all"]  Имя пака или "all"
 * @returns {PackInfo[]}
 *
 * @typedef {object} PackInfo
 * @property {string} name          Имя пака
 * @property {string} label         Подпись
 * @property {string} type          Тип документа: Item | Actor | RollTable
 * @property {string} path          Путь из system.json (packs/<name>)
 * @property {string} dir           Абсолютный путь каталога пака
 * @property {string[]|null} types  flags.darpg.types (допустимые подтипы) или null
 */
export function getPacks(selector = "all") {
  const manifest = readSystemManifest();
  const packs = (manifest.packs ?? []).map(p => ({
    name: p.name,
    label: p.label,
    type: p.type,
    path: p.path,
    dir: path.resolve(DARPG_ROOT, p.path),
    types: Array.isArray(p.flags?.darpg?.types) ? p.flags.darpg.types : null
  }));
  if ( (selector === "all") || !selector ) return packs;
  const pack = packs.find(p => p.name === selector);
  if ( !pack ) throw new Error(`Пак «${selector}» не объявлен в system.json (есть: ${packs.map(p => p.name).join(", ")})`);
  return [pack];
}

/**
 * Каталог YAML-исходников пака: <src>/<pack> или сам каталог пака.
 * @param {PackInfo} pack
 * @param {string} [src]
 * @returns {string}
 */
export function yamlDirOf(pack, src) {
  return src ? path.resolve(src, pack.name) : pack.dir;
}

/**
 * Вложенные коллекции документа по метаданным ядра: [[поле, тип вложенного документа], ...].
 * Item → [["effects","ActiveEffect"]], Actor → [["items","Item"],["effects","ActiveEffect"]],
 * RollTable → [["results","TableResult"]].
 * @param {string} documentName
 * @returns {Array<[string, string]>}
 */
export function embeddedCollections(documentName) {
  const embedded = documentClass(documentName).metadata.embedded ?? {};
  return Object.entries(embedded).map(([childName, field]) => [field, childName]);
}

/* -------------------------------------------- */
/*  Имена файлов                                */
/* -------------------------------------------- */

/**
 * Slug: ASCII kebab-case в нижнем регистре (диакритика снимается, не-алфавитно-цифровое → "-").
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Основа имени файла документа: slug(name), а если он пуст (напр. кириллица) — _id.
 * @param {object} doc
 * @returns {string}
 */
export function fileStemOf(doc) {
  return slugify(doc?.name) || String(doc?._id ?? "document");
}

/**
 * Подходит ли основа имени файла документу: slug(name) или slug(name)-N (N ≥ 2).
 * @param {string} stem  Имя файла без .yaml
 * @param {object} doc
 * @returns {boolean}
 */
export function isValidFileStem(stem, doc) {
  const base = fileStemOf(doc);
  if ( stem === base ) return true;
  if ( !stem.startsWith(`${base}-`) ) return false;
  return /^([2-9]|[1-9]\d+)$/.test(stem.slice(base.length + 1));
}

/**
 * Назначить имена файлов набору документов. Текущие подходящие имена сохраняются,
 * остальным — slug(name), при совпадении "-2", "-3"… (порядок: slug, затем _id).
 * @param {Array<{doc: object, current?: string}>} entries
 * @param {string[]} [reserved]  Имена файлов вне набора, которые нельзя назначать (напр. неразобранные YAML)
 * @returns {string[]}  Имена файлов (с .yaml) в порядке entries
 */
export function assignFileNames(entries, reserved = []) {
  const taken = new Set(reserved.map(file => file.replace(/\.yaml$/, "")));
  const result = new Array(entries.length);
  entries.forEach((entry, i) => {
    if ( !entry.current ) return;
    const stem = entry.current.replace(/\.yaml$/, "");
    if ( isValidFileStem(stem, entry.doc) && !taken.has(stem) ) {
      taken.add(stem);
      result[i] = `${stem}.yaml`;
    }
  });
  const stems = entries.map(e => fileStemOf(e.doc));
  const rest = entries.map((e, i) => i).filter(i => !result[i]).sort((a, b) => {
    return stems[a].localeCompare(stems[b]) || String(entries[a].doc?._id).localeCompare(String(entries[b].doc?._id));
  });
  for ( const i of rest ) {
    let stem = stems[i];
    for ( let n = 2; taken.has(stem); n++ ) stem = `${stems[i]}-${n}`;
    taken.add(stem);
    result[i] = `${stem}.yaml`;
  }
  return result;
}

/* -------------------------------------------- */
/*  YAML                                        */
/* -------------------------------------------- */

/**
 * Комментарий-заголовок файла.
 * @param {string} packName
 * @param {string} fileName  С расширением .yaml
 * @returns {string}
 */
export function headerFor(packName, fileName) {
  return `# packs/${packName}/${fileName}`;
}

/**
 * Разобрать YAML одного документа (схема CORE YAML 1.2; ошибка — исключение с позицией).
 * @param {string} text
 * @param {string} [filename]
 * @returns {object}
 */
export function parseYaml(text, filename) {
  const data = yaml.load(text, { filename });
  if ( !isPlainObject(data) ) throw new Error("корень YAML должен быть отображением (mapping) документа");
  return data;
}

/**
 * Сериализовать документ в канонический YAML с заголовком.
 * @param {object} doc         Уже упорядоченный документ
 * @param {string} packName
 * @param {string} fileName
 * @returns {string}
 */
export function dumpYaml(doc, packName, fileName) {
  return `${headerFor(packName, fileName)}\n${yaml.dump(doc, YAML_DUMP_OPTIONS)}`;
}

/**
 * Прочитать все *.yaml каталога (без разбора ошибок наружу).
 * @param {string} dir
 * @returns {Array<{file: string, path: string, text: string, data: object|null, error: Error|null}>}
 */
export function readYamlDir(dir) {
  if ( !fs.existsSync(dir) ) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith(".yaml")).sort().map(file => {
    const full = path.join(dir, file);
    const text = fs.readFileSync(full, "utf8");
    try {
      return { file, path: full, text, data: parseYaml(text, full), error: null };
    } catch(error) {
      return { file, path: full, text, data: null, error };
    }
  });
}

/* -------------------------------------------- */
/*  Канонический порядок ключей                 */
/* -------------------------------------------- */

/**
 * Упорядочить значение по полю схемы: SchemaField — в порядке полей схемы (неизвестные
 * ключи после), массивы — поэлементно, прочее — как есть.
 * @param {any} value
 * @param {object} [field]  Экземпляр foundry.data.fields.DataField
 * @returns {any}
 */
export function orderBySchemaField(value, field) {
  if ( !field ) return value;
  const F = foundry.data.fields;
  if ( (field instanceof F.SchemaField) && isPlainObject(value) ) {
    const out = {};
    for ( const [key, sub] of Object.entries(field.fields) ) {
      if ( key in value ) out[key] = orderBySchemaField(value[key], sub);
    }
    for ( const key of Object.keys(value) ) if ( !(key in out) ) out[key] = value[key];
    return out;
  }
  if ( (field instanceof F.ArrayField) && !(field instanceof F.EmbeddedCollectionField) && Array.isArray(value) ) {
    return value.map(v => orderBySchemaField(v, field.element));
  }
  if ( (field instanceof F.TypedObjectField) && isPlainObject(value) ) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, orderBySchemaField(v, field.element)]));
  }
  return value;
}

/**
 * Поля схемы модели подтипа (или null, если модели нет или схема не строится).
 * @param {string} documentName
 * @param {string} type
 * @returns {Record<string, object>|null}
 */
export function systemFieldsOf(documentName, type) {
  const model = globalThis.CONFIG?.[documentName]?.dataModels?.[type];
  if ( !model ) return null;
  try {
    return model.schema.fields;
  } catch {
    return null;
  }
}

/**
 * Упорядочить system: description первым, затем поля в порядке defineSchema() модели,
 * затем неизвестные ключи, source последним.
 * @param {object} system
 * @param {string} documentName
 * @param {string} type
 * @returns {object}
 */
export function orderSystem(system, documentName, type) {
  if ( !isPlainObject(system) ) return system;
  const fields = systemFieldsOf(documentName, type) ?? {};
  const out = {};
  if ( "description" in system ) out.description = orderBySchemaField(system.description, fields.description);
  for ( const [key, field] of Object.entries(fields) ) {
    if ( (key === "description") || (key === "source") || !(key in system) ) continue;
    out[key] = orderBySchemaField(system[key], field);
  }
  for ( const key of Object.keys(system) ) {
    if ( !(key in out) && (key !== "source") ) out[key] = system[key];
  }
  if ( "source" in system ) out.source = orderBySchemaField(system.source, fields.source);
  return out;
}

/**
 * Канонический порядок ключей документа (SCHEMA.md §5): _id, name, type, img, system,
 * затем items / results / effects / prototypeToken, затем прочее в порядке схемы ядра,
 * затем неизвестные ключи. Вложенные документы упорядочиваются рекурсивно.
 * Требует loadCore(); порядок system — по моделям, если загружен loadSystem().
 * @param {object} doc
 * @param {string} documentName
 * @returns {object}
 */
export function orderDocument(doc, documentName) {
  if ( !isPlainObject(doc) ) return doc;
  const schemaFields = documentClass(documentName).schema.fields;
  const embedded = Object.fromEntries(embeddedCollections(documentName));
  const out = {};
  const place = key => {
    if ( !(key in doc) || (key in out) ) return;
    const value = doc[key];
    if ( key === "system" ) out.system = orderSystem(value, documentName, doc.type);
    else if ( (key in embedded) && Array.isArray(value) ) out[key] = value.map(child => orderDocument(child, embedded[key]));
    else out[key] = orderBySchemaField(value, schemaFields[key]);
  };
  for ( const key of TOP_LEVEL_ORDER ) place(key);
  for ( const key of Object.keys(schemaFields) ) place(key);
  for ( const key of Object.keys(doc) ) place(key);
  return out;
}

/* -------------------------------------------- */
/*  Поля, добавляемые сборкой                   */
/* -------------------------------------------- */

/**
 * Прототип токена по умолчанию: имя и картинка актёра; для npc — без связи и враждебный.
 * @param {object} actor
 * @returns {object}
 */
export function defaultPrototypeToken(actor) {
  const token = { name: actor.name };
  if ( actor.img ) token.texture = { src: actor.img };
  if ( actor.type === "npc" ) Object.assign(token, { actorLink: false, disposition: -1 });
  return token;
}

/**
 * Слить defaults под data (значения data главнее), рекурсивно для простых объектов.
 * @param {object} defaults
 * @param {object} data
 * @returns {object}
 */
function mergeUnder(defaults, data) {
  const out = clone(defaults);
  for ( const [key, value] of Object.entries(data ?? {}) ) {
    out[key] = (isPlainObject(value) && isPlainObject(out[key])) ? mergeUnder(out[key], value) : clone(value);
  }
  return out;
}

/**
 * Дописать поля, которые YAML опускает, а сборка добавляет (только поля, существующие в схеме
 * ядра этого документа): folder null, sort 0, ownership {default:0}, flags {}, пустые вложенные
 * коллекции, _stats; у актёра — прототип токена по умолчанию (под заданным в YAML).
 * @param {object} value          Документ (вложенные коллекции уже свёрнуты в массивы _id)
 * @param {string} documentName
 * @param {object} stats          Шаблон _stats этой сборки
 * @returns {object}              Новый объект в порядке полей схемы ядра
 */
export function applyBuildDefaults(value, documentName, stats) {
  const fields = documentClass(documentName).schema.fields;
  const out = { ...value };
  if ( ("folder" in fields) && (out.folder === undefined) ) out.folder = null;
  if ( ("sort" in fields) && (out.sort === undefined) ) out.sort = 0;
  if ( ("ownership" in fields) && (out.ownership === undefined) ) out.ownership = { default: 0 };
  if ( ("flags" in fields) && (out.flags === undefined) ) out.flags = {};
  for ( const [field] of embeddedCollections(documentName) ) {
    if ( out[field] === undefined ) out[field] = [];
  }
  if ( "_stats" in fields ) out._stats = mergeUnder(stats, out._stats);
  if ( documentName === "Actor" ) out.prototypeToken = mergeUnder(defaultPrototypeToken(out), out.prototypeToken);
  const ordered = {};
  for ( const key of Object.keys(fields) ) if ( key in out ) ordered[key] = out[key];
  for ( const key of Object.keys(out) ) if ( !(key in ordered) ) ordered[key] = out[key];
  return ordered;
}

/**
 * Убрать поля, которые добавляет сборка (для extract): _key, _stats; folder/sort/ownership,
 * если равны значениям по умолчанию; пустые flags и пустые вложенные коллекции; прототип
 * токена в части, совпадающей с умолчанием. Нестандартные значения сохраняются (без потерь).
 * @param {object} doc
 * @param {string} documentName
 * @returns {object}  Тот же объект (изменён на месте)
 */
export function stripBuildFields(doc, documentName) {
  delete doc._key;
  delete doc._stats;
  if ( doc.folder === null ) delete doc.folder;
  if ( doc.sort === 0 ) delete doc.sort;
  if ( deepEqual(doc.ownership, { default: 0 }) ) delete doc.ownership;
  if ( isPlainObject(doc.flags) && !Object.keys(doc.flags).length ) delete doc.flags;
  for ( const [field, childName] of embeddedCollections(documentName) ) {
    if ( !Array.isArray(doc[field]) ) continue;
    for ( const child of doc[field] ) if ( isPlainObject(child) ) stripBuildFields(child, childName);
    if ( !doc[field].length ) delete doc[field];
  }
  if ( (documentName === "Actor") && isPlainObject(doc.prototypeToken) ) {
    stripDefaults(doc.prototypeToken, defaultPrototypeToken(doc));
    if ( !Object.keys(doc.prototypeToken).length ) delete doc.prototypeToken;
  }
  return doc;
}

/**
 * Удалить из data листья, равные defaults; опустевшие от этого объекты тоже удалить.
 * @param {object} data
 * @param {object} defaults
 */
function stripDefaults(data, defaults) {
  for ( const [key, def] of Object.entries(defaults) ) {
    if ( !(key in data) ) continue;
    if ( isPlainObject(def) && isPlainObject(data[key]) ) {
      const wasEmpty = !Object.keys(data[key]).length;
      stripDefaults(data[key], def);
      if ( !wasEmpty && !Object.keys(data[key]).length ) delete data[key];
    }
    else if ( deepEqual(data[key], def) ) delete data[key];
  }
}

/* -------------------------------------------- */
/*  LevelDB                                     */
/* -------------------------------------------- */

/**
 * Есть ли в каталоге база LevelDB.
 * @param {string} dir
 * @returns {boolean}
 */
export function hasLevelDb(dir) {
  return fs.existsSync(path.join(dir, "CURRENT"));
}

/**
 * Прочитать все записи LevelDB. База копируется во временный каталог (os.tmpdir()), и
 * открывается копия: исходные файлы не меняются (LevelDB при открытии пишет LOG/MANIFEST).
 * @param {string} dir
 * @returns {Promise<Map<string, any>>}
 */
export async function readLevelDb(dir) {
  if ( !hasLevelDb(dir) ) throw new Error(`в ${displayPath(dir)} нет базы LevelDB (нет CURRENT)`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "darpg-ldb-"));
  try {
    for ( const file of fs.readdirSync(dir) ) {
      if ( !LEVELDB_FILE.test(file) || (file === "LOCK") ) continue;
      fs.copyFileSync(path.join(dir, file), path.join(tmp, file));
    }
    const db = new ClassicLevel(tmp, { keyEncoding: "utf8", valueEncoding: "json", createIfMissing: false });
    await db.open();
    const entries = new Map();
    try {
      for await ( const [key, value] of db.iterator() ) entries.set(key, value);
    } finally {
      await db.close();
    }
    return entries;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Записать набор записей в LevelDB: открыть, clear(), batch put, сжать, закрыть.
 * Не-LevelDB файлы каталога не трогаются (LevelDB удаляет только свои устаревшие файлы).
 * @param {string} dir
 * @param {Array<[string, any]>} entries
 * @returns {Promise<void>}
 */
export async function writeLevelDb(dir, entries) {
  fs.mkdirSync(dir, { recursive: true });
  const db = new ClassicLevel(dir, { keyEncoding: "utf8", valueEncoding: "json" });
  try {
    await db.open();
  } catch(err) {
    const cause = err.cause?.message ?? err.message;
    throw new Error(`не удалось открыть LevelDB ${displayPath(dir)} (Foundry держит пак открытым?): ${cause}`);
  }
  try {
    await db.clear();
    await db.batch(entries.map(([key, value]) => ({ type: "put", key, value })));
    await db.compactRange("\u0000", "\uffff");
  } finally {
    await db.close();
  }
}

/* -------------------------------------------- */
/*  Документ ⇄ записи LevelDB                   */
/* -------------------------------------------- */

/**
 * Проверить жёсткие требования сборки к документу (рекурсивно для вложенных).
 * @param {object} doc
 * @param {string} documentName
 * @param {string} where           Метка для сообщений
 * @param {string[]} errors        Сюда добавляются ошибки
 * @param {string[]} warnings      Сюда добавляются предупреждения
 */
export function checkBuildRequirements(doc, documentName, where, errors, warnings) {
  if ( !isPlainObject(doc) ) {
    errors.push(`${where}: документ должен быть отображением`);
    return;
  }
  if ( (typeof doc._id !== "string") || !ID_PATTERN.test(doc._id) ) {
    errors.push(`${where}: _id ${doc._id === undefined ? "отсутствует" : `«${doc._id}» не 16 латинских букв/цифр`}`);
  }
  const fields = documentClass(documentName).schema.fields;
  const nameRequired = fields.name?.blank === false;
  if ( nameRequired && ((typeof doc.name !== "string") || !doc.name.trim()) ) errors.push(`${where}: нет name`);
  if ( ((documentName === "Item") || (documentName === "Actor")) && ((typeof doc.type !== "string") || !doc.type) ) {
    errors.push(`${where}: нет type`);
  }
  for ( const [field, childName] of embeddedCollections(documentName) ) {
    const children = doc[field];
    if ( children === undefined ) continue;
    if ( !Array.isArray(children) ) {
      errors.push(`${where}: ${field} должен быть массивом`);
      continue;
    }
    const seen = new Set();
    children.forEach((child, i) => {
      const label = `${where} → ${field}[${i}]`;
      if ( typeof child === "string" ) {
        warnings.push(`${label}: «${child}» — ссылка на _id без документа (сохраняется как есть)`);
        return;
      }
      checkBuildRequirements(child, childName, label, errors, warnings);
      if ( child?._id && seen.has(child._id) ) errors.push(`${label}: повтор _id ${child._id} внутри ${field}`);
      seen.add(child?._id);
    });
  }
}

/**
 * Разложить документ в записи LevelDB: родитель хранит вложенные коллекции массивами _id,
 * вложенные документы — отдельными ключами "!<коллекция>.<поле>!<id родителя>.<id>".
 * @param {object} doc
 * @param {string} documentName
 * @param {object} stats                   Шаблон _stats
 * @param {string} [sublevel]              Подуровень ключа (по умолчанию коллекция документа)
 * @param {string[]} [parentIds]           _id предков
 * @param {Array<[string, any]>} [entries] Накопитель
 * @returns {Array<[string, any]>}
 */
export function documentToEntries(doc, documentName, stats, sublevel, parentIds = [], entries = []) {
  sublevel ??= documentClass(documentName).metadata.collection;
  const ids = [...parentIds, doc._id];
  const value = { ...doc };
  for ( const [field, childName] of embeddedCollections(documentName) ) {
    if ( !Array.isArray(doc[field]) ) continue;
    value[field] = doc[field].map(child => {
      if ( typeof child === "string" ) return child;
      documentToEntries(child, childName, stats, `${sublevel}.${field}`, ids, entries);
      return child._id;
    });
  }
  entries.push([`!${sublevel}!${ids.join(".")}`, applyBuildDefaults(value, documentName, stats)]);
  return entries;
}

/**
 * Собрать документы пака из записей LevelDB: вложенные документы встраиваются обратно в
 * массивы родителя (в порядке массива _id родителя). Висячие _id остаются строками;
 * «сироты» (ключи без упоминания в родителе) дописываются в конец с предупреждением.
 * Записи, которые в документы не попадают (ключ не того формата, чужой подуровень — напр. папки
 * компендиума !folders!, вложенный документ без родителя), пропускаются с сообщением в losses.
 * @param {Map<string, any>} entries
 * @param {string} documentName  Тип документов пака
 * @param {string[]} warnings
 * @param {string[]} [losses]    Пропущенные записи (по умолчанию — в warnings)
 * @returns {object[]}  Документы в порядке ключей
 */
export function entriesToDocuments(entries, documentName, warnings = [], losses = warnings) {
  const collection = documentClass(documentName).metadata.collection;
  const top = [];
  const nested = new Map();   // подуровень → Map(путь _id → значение)
  for ( const [key, value] of entries ) {
    const m = key.match(/^!([^!]+)!(.+)$/);
    if ( !m ) {
      losses.push(`ключ «${key}» не в формате !<коллекция>!<id> — пропущен`);
      continue;
    }
    const [, sublevel, idPath] = m;
    if ( sublevel === collection ) top.push({ id: idPath, value: clone(value) });
    else if ( sublevel.startsWith(`${collection}.`) ) {
      if ( !nested.has(sublevel) ) nested.set(sublevel, new Map());
      nested.get(sublevel).set(idPath, value);
    }
    else losses.push(`ключ «${key}»: подуровень «${sublevel}» не относится к ${collection} — пропущен`);
  }
  const used = new Set();
  const inline = (value, name, sublevel, ids) => {
    for ( const [field, childName] of embeddedCollections(name) ) {
      const childSub = `${sublevel}.${field}`;
      const store = nested.get(childSub) ?? new Map();
      if ( !Array.isArray(value[field]) ) continue;
      const prefix = `${ids.join(".")}.`;
      value[field] = value[field].map(id => {
        if ( typeof id !== "string" ) return id;
        const key = `${ids.join(".")}.${id}`;
        const child = store.get(key);
        if ( child === undefined ) {
          warnings.push(`${childSub}: у ${ids.join(".")} висячий _id ${id} (оставлен строкой)`);
          return id;
        }
        used.add(`${childSub}!${key}`);
        return inline(clone(child), childName, childSub, [...ids, id]);
      });
      for ( const [key, child] of store ) {
        if ( !key.startsWith(prefix) || key.slice(prefix.length).includes(".") ) continue;
        if ( used.has(`${childSub}!${key}`) ) continue;
        warnings.push(`${childSub}!${key}: сирота (нет в массиве родителя) — дописан в конец`);
        used.add(`${childSub}!${key}`);
        value[field].push(inline(clone(child), childName, childSub, key.split(".")));
      }
    }
    return value;
  };
  const docs = top.map(({ id, value }) => {
    if ( value?._id !== id ) warnings.push(`!${collection}!${id}: _id в значении (${value?._id}) не совпадает с ключом`);
    return inline(value, documentName, collection, [id]);
  });
  for ( const [sublevel, store] of nested ) {
    for ( const key of store.keys() ) {
      if ( !used.has(`${sublevel}!${key}`) ) losses.push(`${sublevel}!${key}: родитель не найден — пропущен`);
    }
  }
  return docs;
}

/* -------------------------------------------- */
/*  build                                       */
/* -------------------------------------------- */

/**
 * Шаблон _stats для документов этой сборки.
 * @param {number} [now]
 * @returns {object}
 */
export function buildStats(now = Date.now()) {
  const manifest = readSystemManifest();
  return {
    coreVersion: coreVersion(),
    systemId: manifest.id,
    systemVersion: manifest.version,
    createdTime: now,
    modifiedTime: now,
    lastModifiedBy: null,
    compendiumSource: null,
    duplicateSource: null,
    exportSource: null
  };
}

/**
 * Собрать паки из YAML в LevelDB. Сначала читаются и проверяются ВСЕ выбранные паки;
 * при любой жёсткой ошибке ничего не пишется.
 * @param {string} selector                  Имя пака или "all"
 * @param {{src?: string, out?: string, log?: Function}} [options]
 * @returns {Promise<{ok: boolean, errors: string[], warnings: string[], written: object[]}>}
 */
export async function buildPacks(selector, { src, out, log = console.log } = {}) {
  await loadCore();
  const packs = getPacks(selector);
  const errors = [];
  const warnings = [];
  const plans = [];

  // Индекс _id по всей системе (все паки источника), чтобы ловить дубли между паками.
  const idIndex = new Map();
  for ( const pack of getPacks("all") ) {
    for ( const f of readYamlDir(yamlDirOf(pack, src)) ) {
      if ( f.data && (typeof f.data._id === "string") ) {
        if ( !idIndex.has(f.data._id) ) idIndex.set(f.data._id, []);
        idIndex.get(f.data._id).push(`${pack.name}/${f.file}`);
      }
    }
  }

  const skipped = [];
  for ( const pack of packs ) {
    const dir = yamlDirOf(pack, src);
    const files = readYamlDir(dir);
    if ( !files.length ) {
      skipped.push(pack.name);
      continue;
    }
    const docs = [];
    for ( const f of files ) {
      const where = `${pack.name}/${f.file}`;
      if ( f.error ) {
        errors.push(`${where}: ошибка YAML: ${firstLine(f.error.message)}`);
        continue;
      }
      checkBuildRequirements(f.data, pack.type, where, errors, warnings);
      const places = idIndex.get(f.data._id) ?? [];
      if ( places.length > 1 ) errors.push(`${where}: _id ${f.data._id} повторяется в системе: ${places.join(", ")}`);
      docs.push(f.data);
    }
    const target = out ? path.resolve(out, pack.name) : pack.dir;
    plans.push({ pack, docs, target, count: files.length });
  }
  if ( skipped.length ) {
    const where = src ? displayPath(path.resolve(src)) : "каталогах паков";
    warnings.push(`нет YAML в ${where} — пропущены (LevelDB не тронута): ${skipped.join(", ")}`);
  }
  if ( errors.length ) return { ok: false, errors, warnings, written: [] };

  const stats = buildStats();
  const written = [];
  for ( const { pack, docs, target } of plans ) {
    const entries = [];
    for ( const doc of docs ) documentToEntries(doc, pack.type, stats, undefined, [], entries);
    entries.sort((a, b) => (a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0)));
    await writeLevelDb(target, entries);
    written.push({ pack: pack.name, documents: docs.length, entries: entries.length, target });
    log(`build ${pack.name}: ${docs.length} док., ${entries.length} записей → ${displayPath(target)}`);
  }
  return { ok: true, errors, warnings, written };
}

/* -------------------------------------------- */
/*  extract                                     */
/* -------------------------------------------- */

/**
 * Загрузить модели системы для порядка ключей; при сбое — только ядро (порядок system без модели).
 * @param {string[]} warnings
 * @returns {Promise<void>}
 */
async function loadModelsForOrdering(warnings) {
  try {
    const system = await loadSystem();
    for ( const note of system.notes ) warnings.push(`обвязка: ${note}`);
  } catch(err) {
    warnings.push(`модели системы не загрузились (${err.message}) — порядок ключей system без модели`);
    await loadCore();
  }
}

/**
 * Извлечь паки из LevelDB в канонический YAML.
 * @param {string} selector
 * @param {{src?: string, out?: string, inPlace?: boolean, clean?: boolean, log?: Function}} options
 * @returns {Promise<{ok: boolean, errors: string[], warnings: string[], written: object[]}>}
 */
export async function extractPacks(selector, { src, out, inPlace = false, clean = false, log = console.log } = {}) {
  const errors = [];
  const warnings = [];
  const written = [];
  if ( !out && !inPlace ) {
    errors.push("extract требует --out DIR (или --in-place для записи в каталоги паков)");
    return { ok: false, errors, warnings, written };
  }
  await loadModelsForOrdering(warnings);
  for ( const pack of getPacks(selector) ) {
    const dbDir = src ? path.resolve(src, pack.name) : pack.dir;
    const outDir = out ? path.resolve(out, pack.name) : pack.dir;
    if ( isInside(outDir, PACKS_ROOT) && !inPlace ) {
      errors.push(`${pack.name}: отказ писать в ${displayPath(outDir)} без --in-place`);
      continue;
    }
    if ( !hasLevelDb(dbDir) ) {
      warnings.push(`${pack.name}: нет LevelDB в ${displayPath(dbDir)} — пропущен`);
      continue;
    }
    const packWarnings = [];
    const losses = [];
    const entries = await readLevelDb(dbDir);
    const docs = entriesToDocuments(entries, pack.type, packWarnings, losses).map(d => stripBuildFields(d, pack.type));
    warnings.push(...packWarnings.map(w => `${pack.name}: ${w}`));
    // Записи, которых YAML не хранит, после extract + build пропали бы — такой пак не извлекаем.
    if ( losses.length ) {
      errors.push(...losses.map(l => `${pack.name}: ${l}; YAML такие записи не хранит — пак не извлечён`));
      continue;
    }

    // Существующие YAML в целевом каталоге: без --clean — отказ, с --clean — удаляются только *.yaml.
    const existing = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter(f => f.endsWith(".yaml")) : [];
    if ( existing.length && !clean ) {
      errors.push(`${pack.name}: в ${displayPath(outDir)} уже есть ${existing.length} YAML — добавьте --clean для замены`);
      continue;
    }
    fs.mkdirSync(outDir, { recursive: true });
    for ( const f of existing ) fs.rmSync(path.join(outDir, f));

    const names = assignFileNames(docs.map(doc => ({ doc })));
    docs.forEach((doc, i) => {
      fs.writeFileSync(path.join(outDir, names[i]), dumpYaml(orderDocument(doc, pack.type), pack.name, names[i]), "utf8");
    });
    written.push({ pack: pack.name, documents: docs.length, entries: entries.size, target: outDir });
    log(`extract ${pack.name}: ${entries.size} записей → ${docs.length} YAML в ${displayPath(outDir)}`);
  }
  return { ok: !errors.length, errors, warnings, written };
}

/* -------------------------------------------- */
/*  format                                      */
/* -------------------------------------------- */

/**
 * Переписать YAML паков в каноническом виде (и при --rename переименовать файлы).
 * @param {string} selector
 * @param {{src?: string, rename?: boolean, check?: boolean, log?: Function}} [options]
 * @returns {Promise<{ok: boolean, errors: string[], warnings: string[], changed: string[]}>}
 */
export async function formatPacks(selector, { src, rename = false, check = false, log = console.log } = {}) {
  const errors = [];
  const warnings = [];
  const changed = [];
  await loadModelsForOrdering(warnings);
  for ( const pack of getPacks(selector) ) {
    const dir = yamlDirOf(pack, src);
    const files = readYamlDir(dir);
    if ( !files.length ) continue;
    const good = files.filter(f => {
      if ( f.error ) errors.push(`${pack.name}/${f.file}: ошибка YAML: ${firstLine(f.error.message)}`);
      return !f.error;
    });
    // Имена неразобранных файлов заняты: переименование на них затёрло бы их содержимое.
    const broken = files.filter(f => f.error).map(f => f.file);
    const names = rename ? assignFileNames(good.map(f => ({ doc: f.data, current: f.file })), broken) : good.map(f => f.file);
    const plan = good.map((f, i) => {
      const text = dumpYaml(orderDocument(f.data, pack.type), pack.name, names[i]);
      return { from: f, to: names[i], text, dirty: (names[i] !== f.file) || (text !== f.text) };
    }).filter(p => p.dirty);
    for ( const p of plan ) {
      const label = p.to === p.from.file ? `${pack.name}/${p.to}` : `${pack.name}/${p.from.file} → ${p.to}`;
      changed.push(label);
    }
    if ( check || !plan.length ) continue;

    // Цель переименования не должна быть существующим файлом, если его не освобождает другое
    // переименование этого прогона (регистр не различаем — ФС может быть к нему нечувствительна).
    const freed = new Set(plan.filter(p => p.to !== p.from.file).map(p => p.from.file.toLowerCase()));
    const blocked = plan.filter(p => (p.to !== p.from.file) && !freed.has(p.to.toLowerCase())
      && fs.existsSync(path.join(dir, p.to)));
    if ( blocked.length ) {
      for ( const p of blocked ) errors.push(`${pack.name}/${p.from.file}: ${p.to} уже существует — пак не переписан`);
      continue;
    }

    // Без потерь при переименованиях: сначала *.tmp, затем удаление старых, затем перенос.
    for ( const p of plan ) fs.writeFileSync(path.join(dir, `${p.to}.tmp`), p.text, "utf8");
    for ( const p of plan ) if ( p.to !== p.from.file ) fs.rmSync(p.from.path);
    for ( const p of plan ) fs.renameSync(path.join(dir, `${p.to}.tmp`), path.join(dir, p.to));
    log(`format ${pack.name}: переписано ${plan.length} из ${good.length}`);
  }
  return { ok: !errors.length && !(check && changed.length), errors, warnings, changed };
}

/* -------------------------------------------- */
/*  CLI                                         */
/* -------------------------------------------- */

/**
 * Разобрать аргументы: позиционные + --flag / --key VALUE / --key=VALUE.
 * @param {string[]} argv
 * @param {string[]} valueFlags  Флаги со значением
 * @returns {{_: string[], [key: string]: any}}
 */
export function parseArgs(argv, valueFlags = []) {
  const args = { _: [] };
  for ( let i = 0; i < argv.length; i++ ) {
    const arg = argv[i];
    if ( !arg.startsWith("--") ) {
      args._.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const key = arg.slice(2, eq < 0 ? undefined : eq);
    if ( eq >= 0 ) args[key] = arg.slice(eq + 1);
    else if ( valueFlags.includes(key) ) {
      const value = argv[i + 1];
      if ( (value === undefined) || value.startsWith("--") ) throw new Error(`--${key} требует значение (каталог/файл)`);
      args[key] = value;
      i++;
    }
    else args[key] = true;
  }
  return args;
}

const USAGE = `Использование:
  node tools/packs.mjs build   <pack|all> [--src DIR] [--out DIR]
  node tools/packs.mjs extract <pack|all> --out DIR [--src DIR] [--clean]
  node tools/packs.mjs extract <pack|all> --in-place [--clean]
  node tools/packs.mjs format  <pack|all> [--src DIR] [--rename] [--check]
npm: npm run build:packs | npm run format:packs | npm run extract:packs -- <DIR>`;

/**
 * Точка входа CLI.
 * @param {string[]} argv
 * @returns {Promise<number>}  Код выхода
 */
export async function main(argv) {
  let args;
  try {
    args = parseArgs(argv, ["src", "out"]);
  } catch(err) {
    console.error(err.message);
    console.error(USAGE);
    return 2;
  }
  const [command, selector] = args._;
  if ( args.help || !command || !selector ) {
    console.log(USAGE);
    return args.help ? 0 : 2;
  }
  let result;
  try {
    switch ( command ) {
      case "build":
        result = await buildPacks(selector, { src: args.src, out: args.out });
        break;
      case "extract":
        result = await extractPacks(selector, {
          src: args.src, out: args.out, inPlace: !!args["in-place"], clean: !!args.clean
        });
        break;
      case "format":
        result = await formatPacks(selector, { src: args.src, rename: !!args.rename, check: !!args.check });
        if ( args.check ) {
          for ( const c of result.changed ) console.log(`не канонично: ${c}`);
          console.log(`format --check: ${result.changed.length} файл(ов) не в каноническом виде`);
        }
        break;
      default:
        console.error(`Неизвестная команда «${command}»`);
        console.error(USAGE);
        return 2;
    }
  } catch(err) {
    console.error(`${command}: ${err.stack ?? err.message}`);
    return 1;
  }
  for ( const w of result.warnings ) console.warn(`предупреждение: ${w}`);
  for ( const e of result.errors ) console.error(`ошибка: ${e}`);
  if ( result.errors.length ) {
    console.error(`${command}: ${result.errors.length} ошибок — ${command === "build" ? "ничего не записано" : "см. выше"}`);
  }
  return result.ok ? 0 : 1;
}

if ( process.argv[1] && (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) ) {
  process.exitCode = await main(process.argv.slice(2));
}
