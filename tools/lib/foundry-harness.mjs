/**
 * Офлайн-обвязка ядра Foundry VTT для инструментов darpg (Node, без браузера и без сервера).
 *
 * Загружает FOUNDRY/common/server.mjs (серверная точка входа общего кода ядра: ставит
 * globalThis.foundry и CONST), затем ставит минимальные глобалы, которые трогают
 * конструирование и валидация документов, и регистрирует модели данных системы так же,
 * как это делает module/darpg.mjs в хуке init. Модели и CONFIG.DARPG импортируются
 * динамически в момент запуска — их код никогда не копируется в инструменты.
 *
 * Заглушки найдены опытным путём на ядре 14.368 (всё прочее — настоящие классы ядра):
 *  - globalThis.logger — DataModel#validate, migrateDataSafe и logCompatibilityWarning пишут в
 *    него (на клиенте это console); здесь вывод перехватывается, см. captureLogs();
 *  - CONFIG.<Документ>.dataModels — TypeDataField#getModelForType;
 *  - CONFIG.Token = {} — BaseToken.defineSchema читает CONFIG.Token.movement (схема
 *    PrototypeToken у актёра);
 *  - CONFIG.compatibility — режим WARNING явно: предупреждения об устаревших API попадают в лог;
 *  - game.model / game.documentTypes — Document.TYPES и DocumentTypeField (копия логики
 *    серверного World#prepareDataModel из dist/packages/world.mjs);
 *  - game.system / game.modules — TypeDataField.getModelProvider;
 *  - game.release (настоящий foundry.config.ReleaseData) — начальное _stats.coreVersion;
 *  - game.packs — разбор устаревших UUID компендиумов (DocumentUUIDField → parseUuid);
 *  - game.settings намеренно НЕ задаётся: тогда PrototypeTokenOverrides.applyOverrides — no-op.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Корень системы darpg (tools/lib → ../..). */
export const DARPG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Корень ядра Foundry: env FOUNDRY_ROOT либо ../../../../foundryvtt относительно системы. */
export const FOUNDRY_ROOT = process.env.FOUNDRY_ROOT
  ? path.resolve(process.env.FOUNDRY_ROOT)
  : path.resolve(DARPG_ROOT, "../../../../foundryvtt");

/** Точка входа системы, по которой ищется регистрация моделей. */
const ENTRY_POINT = path.join(DARPG_ROOT, "module", "darpg.mjs");

/* -------------------------------------------- */
/*  Манифесты                                   */
/* -------------------------------------------- */

/**
 * Прочитать JSON-файл.
 * @param {string} file
 * @returns {any}
 */
export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Манифест системы (system.json).
 * @returns {object}
 */
export function readSystemManifest() {
  return readJson(path.join(DARPG_ROOT, "system.json"));
}

/**
 * Данные релиза ядра из FOUNDRY/package.json ({generation, build, node_version, ...}).
 * @returns {object}
 */
export function readFoundryRelease() {
  const file = path.join(FOUNDRY_ROOT, "package.json");
  if ( !fs.existsSync(file) ) {
    throw new Error(`Не найдено ядро Foundry: ${file} (задайте FOUNDRY_ROOT)`);
  }
  const release = readJson(file).release;
  if ( !release?.generation || !release?.build ) throw new Error(`В ${file} нет release.generation/build`);
  return release;
}

/**
 * Версия ядра в форме "<generation>.<build>" (как _stats.coreVersion).
 * @returns {string}
 */
export function coreVersion() {
  const { generation, build } = readFoundryRelease();
  return `${generation}.${build}`;
}

/* -------------------------------------------- */
/*  Логгер с перехватом                         */
/* -------------------------------------------- */

/** Текущий буфер перехвата (null — печатать в stderr). */
let capture = null;

/**
 * Привести аргумент логгера к строке (ошибки ядра часто передаются объектами).
 * @param {any} arg
 * @returns {string}
 */
function formatLogArg(arg) {
  if ( typeof arg === "string" ) return arg;
  if ( arg instanceof Error ) return arg.message;
  if ( arg && (typeof arg.message === "string") ) return arg.message;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

/** Поставить globalThis.logger: warn/error перехватываются либо идут в stderr. */
function installLogger() {
  const sink = level => (...args) => {
    const message = args.map(formatLogArg).join(" ");
    if ( capture ) capture.push({ level, message });
    else if ( (level === "warn") || (level === "error") ) process.stderr.write(`[foundry ${level}] ${message}\n`);
  };
  globalThis.logger = {
    debug: sink("debug"), info: sink("info"), log: sink("log"), warn: sink("warn"), error: sink("error")
  };
}

/**
 * Выполнить функцию, перехватывая вывод logger и брошенное исключение.
 * @template T
 * @param {() => T} fn
 * @returns {{result: T|undefined, error: Error|null, logs: Array<{level: string, message: string}>}}
 */
export function captureLogs(fn) {
  const previous = capture;
  const logs = [];
  capture = logs;
  try {
    return { result: fn(), error: null, logs };
  } catch(error) {
    return { result: undefined, error, logs };
  } finally {
    capture = previous;
  }
}

/* -------------------------------------------- */
/*  Ядро                                        */
/* -------------------------------------------- */

let corePromise = null;

/**
 * Загрузить общий код ядра (common/server.mjs) и поставить базовые глобалы.
 * Модели системы при этом НЕ загружаются (это делает loadSystem).
 * @returns {Promise<object>}  globalThis.foundry
 */
export function loadCore() {
  corePromise ??= (async () => {
    const release = readFoundryRelease();
    const entry = path.join(FOUNDRY_ROOT, "common", "server.mjs");
    if ( !fs.existsSync(entry) ) throw new Error(`Не найден ${entry} (задайте FOUNDRY_ROOT)`);
    installLogger();
    await import(pathToFileURL(entry).href);
    const foundry = globalThis.foundry;

    // CONFIG: только то, что читает общий код ядра при валидации документов.
    globalThis.CONFIG = {
      compatibility: {
        mode: CONST.COMPATIBILITY_MODES.WARNING,
        includePatterns: [],
        excludePatterns: []
      },
      Token: {}
    };
    for ( const cls of Object.values(foundry.documents) ) {
      if ( cls.hasTypeData ) CONFIG[cls.documentName] = { dataModels: {} };
    }

    // game: релиз и пустые подтипы (заполняются в loadSystem).
    globalThis.game = {
      release: new foundry.config.ReleaseData(foundry.utils.deepClone(release)),
      system: null,
      modules: new Map(),
      packs: new Map(),
      model: prepareDataModel(foundry, {}),
      documentTypes: {}
    };
    game.documentTypes = documentTypesOf(game.model);
    return foundry;
  })();
  return corePromise;
}

/**
 * Копия серверного World#prepareDataModel: подтипы ядра + подтипы системы.
 * @param {object} foundry
 * @param {Record<string, object>} systemDocumentTypes  system.json → documentTypes
 * @returns {Record<string, Record<string, object>>}
 */
function prepareDataModel(foundry, systemDocumentTypes) {
  const model = {};
  for ( const cls of Object.values(foundry.documents) ) {
    if ( !("coreTypes" in cls.metadata) ) continue;
    const types = model[cls.documentName] = {};
    for ( const type of cls.metadata.coreTypes ) types[type] = {};
    if ( !cls.hasTypeData ) continue;
    for ( const type of Object.keys(systemDocumentTypes[cls.documentName] ?? {}) ) types[type] = {};
  }
  return model;
}

/**
 * game.documentTypes по game.model (как Game#setupPackages на клиенте).
 * @param {Record<string, object>} model
 * @returns {Record<string, string[]>}
 */
function documentTypesOf(model) {
  return Object.fromEntries(Object.entries(model).map(([name, types]) => [name, Object.keys(types)]));
}

/**
 * Базовый класс документа ядра по имени ("Item" → foundry.documents.BaseItem).
 * @param {string} documentName
 * @returns {typeof foundry.abstract.Document}
 */
export function documentClass(documentName) {
  const cls = globalThis.foundry?.documents?.[`Base${documentName}`];
  if ( !cls ) throw new Error(`Неизвестный тип документа ядра: ${documentName}`);
  return cls;
}

/* -------------------------------------------- */
/*  Система                                     */
/* -------------------------------------------- */

let systemPromise = null;

/**
 * Загрузить ядро и модели системы darpg; заполнить CONFIG и game.
 * @returns {Promise<SystemContext>}
 *
 * @typedef {object} SystemContext
 * @property {object} foundry                       globalThis.foundry
 * @property {object} manifest                      system.json
 * @property {object} config                        CONFIG.DARPG
 * @property {Record<string, Record<string, Function>>} dataModels  {Item: {weapon: WeaponData, ...}, Actor: {...}}
 * @property {string} strategy                      Как найдена регистрация: "static" или "execute"
 * @property {string[]} notes                       Предупреждения обвязки (для отчётов)
 */
export function loadSystem() {
  systemPromise ??= (async () => {
    const foundry = await loadCore();
    const manifest = readSystemManifest();
    const notes = [];

    // Регистрация моделей — как в module/darpg.mjs: сначала статический разбор, затем исполнение init.
    // DARPG_HARNESS_STRATEGY=static|execute принудительно выбирает одну стратегию (отладка).
    const forced = process.env.DARPG_HARNESS_STRATEGY;
    let registration;
    if ( forced === "execute" ) {
      registration = await registerByExecution();
      registration.strategy = "execute";
    }
    else {
      try {
        registration = await registerFromSource();
        registration.strategy = "static";
      } catch(staticError) {
        if ( forced === "static" ) throw staticError;
        notes.push(`Статический разбор module/darpg.mjs не удался (${staticError.message}); выполняю хук init с заглушками`);
        registration = await registerByExecution();
        registration.strategy = "execute";
      }
    }

    // CONFIG.DARPG и модели данных
    CONFIG.DARPG = registration.config;
    for ( const [documentName, models] of Object.entries(registration.dataModels) ) {
      CONFIG[documentName] ??= { dataModels: {} };
      Object.assign(CONFIG[documentName].dataModels, models);
    }

    // game: система, подтипы, компендиумы системы
    game.system = {
      id: manifest.id,
      title: manifest.title,
      version: manifest.version,
      documentTypes: manifest.documentTypes ?? {},
      grid: manifest.grid ?? {}
    };
    game.model = prepareDataModel(foundry, game.system.documentTypes);
    game.documentTypes = documentTypesOf(game.model);
    for ( const pack of manifest.packs ?? [] ) {
      const id = `${manifest.id}.${pack.name}`;
      game.packs.set(id, { collection: id, documentName: pack.type, metadata: { ...pack, id, packageName: manifest.id } });
    }

    // Сверка: каждый подтип system.json должен иметь модель, и наоборот.
    for ( const [documentName, types] of Object.entries(game.system.documentTypes) ) {
      const models = CONFIG[documentName]?.dataModels ?? {};
      for ( const type of Object.keys(types) ) {
        if ( !models[type] ) notes.push(`Подтип ${documentName}.${type} из system.json не имеет модели данных`);
      }
      for ( const type of Object.keys(models) ) {
        if ( !(type in types) ) notes.push(`Модель ${documentName}.${type} зарегистрирована, но подтипа нет в system.json`);
      }
    }

    // Прогрев схем: ошибки defineSchema всплывают здесь, а не посреди валидации.
    for ( const [documentName, models] of Object.entries(registration.dataModels) ) {
      for ( const [type, model] of Object.entries(models) ) {
        const { error, logs } = captureLogs(() => model.schema);
        if ( error ) notes.push(`Схема ${documentName}.${type} не строится: ${error.message}`);
        for ( const log of logs ) notes.push(`Схема ${documentName}.${type}: ${log.level}: ${log.message}`);
      }
    }

    return {
      foundry,
      manifest,
      config: CONFIG.DARPG,
      dataModels: registration.dataModels,
      strategy: registration.strategy,
      notes
    };
  })();
  return systemPromise;
}

/* -------------------------------------------- */
/*  Стратегия 1: статический разбор darpg.mjs   */
/* -------------------------------------------- */

/**
 * Найти в module/darpg.mjs присваивания CONFIG.<Документ>.dataModels и CONFIG.DARPG,
 * разрешить идентификаторы через import-объявления и импортировать ровно эти модули.
 * Поддерживаются формы:
 *   Object.assign(CONFIG.Item.dataModels, { weapon: WeaponData, ... })
 *   CONFIG.Item.dataModels = { ... } | Ident | Ident.member
 *   CONFIG.Item.dataModels.weapon = Ident   /   CONFIG.Item.dataModels["weapon"] = Ident
 *   CONFIG.DARPG = Ident
 * @returns {Promise<{config: object, dataModels: Record<string, Record<string, Function>>}>}
 */
async function registerFromSource() {
  const code = stripComments(fs.readFileSync(ENTRY_POINT, "utf8"));
  const imports = parseImports(code);
  const resolveExpr = expr => resolveExpression(expr, imports);
  const dataModels = {};
  const put = async (documentName, type, expr) => {
    const value = await resolveExpr(expr);
    if ( typeof value !== "function" ) throw new Error(`CONFIG.${documentName}.dataModels.${type}: «${expr}» — не класс`);
    (dataModels[documentName] ??= {})[type] = value;
  };
  const putAll = async (documentName, expr) => {
    expr = expr.trim();
    if ( expr.startsWith("{") ) {
      for ( const entry of splitObjectLiteral(expr) ) {
        if ( entry.spread ) await putAllObject(documentName, await resolveExpr(entry.spread), entry.spread);
        else await put(documentName, entry.key, entry.value);
      }
    }
    else await putAllObject(documentName, await resolveExpr(expr), expr);
  };
  const putAllObject = async (documentName, object, expr) => {
    if ( !object || (typeof object !== "object") ) throw new Error(`«${expr}» — не объект моделей`);
    for ( const [type, cls] of Object.entries(object) ) {
      if ( typeof cls !== "function" ) throw new Error(`«${expr}.${type}» — не класс`);
      (dataModels[documentName] ??= {})[type] = cls;
    }
  };

  // Object.assign(CONFIG.X.dataModels, <expr>)
  for ( const m of code.matchAll(/Object\.assign\(\s*CONFIG\.(\w+)\.dataModels\s*,/g) ) {
    const { text } = readExpression(code, m.index + m[0].length, [")"]);
    await putAll(m[1], text);
  }
  // CONFIG.X.dataModels = <expr>
  for ( const m of code.matchAll(/CONFIG\.(\w+)\.dataModels\s*=(?!=)/g) ) {
    const { text } = readExpression(code, m.index + m[0].length, [";", "\n"]);
    await putAll(m[1], text);
  }
  // CONFIG.X.dataModels.type = <expr> | CONFIG.X.dataModels["type"] = <expr>
  for ( const m of code.matchAll(/CONFIG\.(\w+)\.dataModels(?:\.(\w+)|\[\s*["']([^"']+)["']\s*\])\s*=(?!=)/g) ) {
    const { text } = readExpression(code, m.index + m[0].length, [";", "\n"]);
    await put(m[1], m[2] ?? m[3], text);
  }
  if ( !Object.keys(dataModels).length ) throw new Error("не найдено ни одной регистрации CONFIG.*.dataModels");

  // CONFIG.DARPG = <expr>; если присваивания нет — экспорт DARPG из module/config.mjs
  let config;
  const cm = code.match(/CONFIG\.DARPG\s*=(?!=)/);
  if ( cm ) config = await resolveExpr(readExpression(code, cm.index + cm[0].length, [";", "\n"]).text);
  else {
    const mod = await import(pathToFileURL(path.join(DARPG_ROOT, "module", "config.mjs")).href);
    config = mod.DARPG ?? mod.default;
  }
  if ( !config || (typeof config !== "object") ) throw new Error("CONFIG.DARPG не разрешился в объект");
  return { config, dataModels };
}

/**
 * Удалить комментарии JS, не трогая строковые литералы и шаблоны.
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  let quote = null;
  while ( i < src.length ) {
    const c = src[i];
    const next = src[i + 1];
    if ( quote ) {
      out += c;
      if ( c === "\\" ) { out += next ?? ""; i += 2; continue; }
      if ( c === quote ) quote = null;
      i++;
      continue;
    }
    if ( (c === "/") && (next === "/") ) {
      while ( (i < src.length) && (src[i] !== "\n") ) i++;
      continue;
    }
    if ( (c === "/") && (next === "*") ) {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
      out += " ";
      continue;
    }
    if ( (c === "\"") || (c === "'") || (c === "`") ) quote = c;
    out += c;
    i++;
  }
  return out;
}

/**
 * Разобрать import-объявления: локальное имя → {specifier, imported}.
 * imported: "default" | "*" | имя именованного экспорта.
 * @param {string} code
 * @returns {Map<string, {specifier: string, imported: string}>}
 */
function parseImports(code) {
  const imports = new Map();
  for ( const m of code.matchAll(/\bimport\s+([^;]*?)\s+from\s+(["'])([^"']+)\2/g) ) {
    let clause = m[1].trim();
    const specifier = m[3];
    const def = clause.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
    if ( def ) {
      imports.set(def[1], { specifier, imported: "default" });
      clause = clause.slice(def[0].length).trim();
    }
    const ns = clause.match(/^\*\s*as\s+([A-Za-z_$][\w$]*)/);
    if ( ns ) imports.set(ns[1], { specifier, imported: "*" });
    const named = clause.match(/^\{([^}]*)\}/);
    if ( named ) {
      for ( const part of named[1].split(",") ) {
        const p = part.trim();
        if ( !p ) continue;
        const [imported, local] = p.split(/\s+as\s+/).map(s => s.trim());
        imports.set(local ?? imported, { specifier, imported });
      }
    }
  }
  return imports;
}

/**
 * Прочитать выражение от позиции до терминатора на нулевой глубине скобок.
 * @param {string} code
 * @param {number} start
 * @param {string[]} terminators
 * @returns {{text: string, end: number}}
 */
function readExpression(code, start, terminators) {
  let depth = 0;
  let quote = null;
  let i = start;
  for ( ; i < code.length; i++ ) {
    const c = code[i];
    if ( quote ) {
      if ( c === "\\" ) i++;
      else if ( c === quote ) quote = null;
      continue;
    }
    if ( (c === "\"") || (c === "'") || (c === "`") ) { quote = c; continue; }
    if ( "([{".includes(c) ) depth++;
    else if ( ")]}".includes(c) ) {
      if ( depth === 0 ) break;
      depth--;
    }
    else if ( (depth === 0) && terminators.includes(c) ) {
      if ( (c === "\n") && !code.slice(start, i).trim() ) continue;
      break;
    }
  }
  return { text: code.slice(start, i).trim(), end: i };
}

/**
 * Разбить объектный литерал на записи {key, value} / {spread}.
 * @param {string} literal  Текст вида "{ a: B, c, ...D }"
 * @returns {Array<{key?: string, value?: string, spread?: string}>}
 */
function splitObjectLiteral(literal) {
  const body = literal.trim().replace(/^\{/, "").replace(/\}$/, "");
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = "";
  for ( let i = 0; i < body.length; i++ ) {
    const c = body[i];
    if ( quote ) {
      current += c;
      if ( c === "\\" ) current += body[++i] ?? "";
      else if ( c === quote ) quote = null;
      continue;
    }
    if ( (c === "\"") || (c === "'") || (c === "`") ) quote = c;
    if ( "([{".includes(c) ) depth++;
    if ( ")]}".includes(c) ) depth--;
    if ( (c === ",") && (depth === 0) ) {
      parts.push(current);
      current = "";
      continue;
    }
    current += c;
  }
  parts.push(current);
  const entries = [];
  for ( const raw of parts ) {
    const part = raw.trim();
    if ( !part ) continue;
    if ( part.startsWith("...") ) {
      entries.push({ spread: part.slice(3).trim() });
      continue;
    }
    const kv = part.match(/^(?:([A-Za-z_$][\w$]*)|"([^"]+)"|'([^']+)')\s*:\s*([\s\S]+)$/);
    if ( kv ) entries.push({ key: kv[1] ?? kv[2] ?? kv[3], value: kv[4].trim() });
    else if ( /^[A-Za-z_$][\w$]*$/.test(part) ) entries.push({ key: part, value: part });
    else throw new Error(`неподдерживаемая запись объектного литерала: «${part}»`);
  }
  return entries;
}

/**
 * Разрешить выражение вида Ident(.member|["member"])* через import-объявления darpg.mjs.
 * @param {string} expr
 * @param {Map<string, {specifier: string, imported: string}>} imports
 * @returns {Promise<any>}
 */
async function resolveExpression(expr, imports) {
  const m = expr.trim().match(/^([A-Za-z_$][\w$]*)((?:\s*(?:\.[A-Za-z_$][\w$]*|\[\s*["'][^"']+["']\s*\]))*)$/);
  if ( !m ) throw new Error(`неподдерживаемое выражение «${expr}»`);
  const binding = imports.get(m[1]);
  if ( !binding ) throw new Error(`«${m[1]}» не импортирован в module/darpg.mjs`);
  const url = new URL(binding.specifier, pathToFileURL(ENTRY_POINT)).href;
  const mod = await import(url);
  let value = binding.imported === "*" ? mod : mod[binding.imported];
  if ( value === undefined ) throw new Error(`модуль ${binding.specifier} не экспортирует «${binding.imported}»`);
  for ( const pm of m[2].matchAll(/\.([A-Za-z_$][\w$]*)|\[\s*["']([^"']+)["']\s*\]/g) ) {
    value = value?.[pm[1] ?? pm[2]];
  }
  return value;
}

/* -------------------------------------------- */
/*  Стратегия 2: исполнение хука init           */
/* -------------------------------------------- */

/**
 * Глубокая заглушка: любое свойство — снова заглушка; вызов и new — тоже; применение
 * к классу (миксин вида Mixin(Base)) возвращает подкласс Base.
 * @param {string} name
 * @returns {Function}
 */
function deepStub(name) {
  const cache = new Map();
  const target = class Stub {};
  return new Proxy(target, {
    get(t, prop) {
      if ( prop === "prototype" ) return t.prototype;
      if ( prop === "then" ) return undefined;
      if ( prop === Symbol.toPrimitive ) return () => `[stub ${name}]`;
      if ( prop === Symbol.iterator ) return function* () {};
      if ( cache.has(prop) ) return cache.get(prop);
      if ( typeof prop === "symbol" ) return undefined;
      const stub = deepStub(`${name}.${prop}`);
      cache.set(prop, stub);
      return stub;
    },
    set(t, prop, value) {
      cache.set(prop, value);
      return true;
    },
    apply(t, thisArg, args) {
      if ( (typeof args[0] === "function") && args[0].prototype ) return class extends args[0] {};
      return deepStub(`${name}()`);
    },
    construct() {
      return deepStub(`new ${name}`);
    }
  });
}

/**
 * Обернуть настоящее пространство имён: существующие ключи — настоящие значения
 * (вложенные пространства имён тоже обёрнуты), отсутствующие — глубокие заглушки.
 * @param {object} real
 * @param {string} name
 * @returns {object}
 */
function stubNamespace(real, name) {
  const cache = new Map();
  return new Proxy(real, {
    get(t, prop, receiver) {
      if ( typeof prop === "symbol" ) return Reflect.get(t, prop, receiver);
      if ( cache.has(prop) ) return cache.get(prop);
      let value;
      if ( prop in t ) {
        value = Reflect.get(t, prop, receiver);
        if ( value && (typeof value === "object") && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype
          || Object.prototype.toString.call(value) === "[object Module]") ) value = stubNamespace(value, `${name}.${prop}`);
      }
      else value = deepStub(`${name}.${prop}`);
      cache.set(prop, value);
      return value;
    },
    set(t, prop, value) {
      // Запись идёт в настоящий объект (так init заполняет CONFIG.*.dataModels и CONFIG.DARPG);
      // неизменяемые пространства имён модулей запоминают значение только в кэше.
      try {
        Reflect.set(t, prop, value);
      } catch {}
      cache.set(prop, value);
      return true;
    }
  });
}

/**
 * Импортировать module/darpg.mjs целиком и выполнить его хуки init в песочнице
 * глобалов-заглушек; забрать CONFIG.DARPG и CONFIG.*.dataModels, затем вернуть
 * настоящие глобалы на место. Используется, только если статический разбор не удался.
 * @returns {Promise<{config: object, dataModels: Record<string, Record<string, Function>>}>}
 */
async function registerByExecution() {
  const saved = {};
  const names = ["foundry", "CONFIG", "Hooks", "game", "ui", "canvas", "document", "window"];
  for ( const n of names ) saved[n] = Object.getOwnPropertyDescriptor(globalThis, n);
  const hooks = new Map();
  const dataModels = {};
  const realConfig = {};
  for ( const cls of Object.values(saved.foundry.value.documents) ) {
    if ( cls.hasTypeData ) realConfig[cls.documentName] = { dataModels: (dataModels[cls.documentName] = {}) };
  }
  try {
    const set = (n, value) => Object.defineProperty(globalThis, n, { value, configurable: true, writable: true });
    set("foundry", stubNamespace(saved.foundry.value, "foundry"));
    set("CONFIG", stubNamespace(realConfig, "CONFIG"));
    set("game", stubNamespace(saved.game.value, "game"));
    for ( const n of ["ui", "canvas", "document", "window"] ) {
      if ( !saved[n] ) set(n, deepStub(n));
    }
    const register = (name, fn) => {
      if ( !hooks.has(name) ) hooks.set(name, []);
      hooks.get(name).push(fn);
    };
    set("Hooks", { once: register, on: register, off() {}, call: () => true, callAll: () => true, onError() {} });
    await import(pathToFileURL(ENTRY_POINT).href);
    for ( const fn of hooks.get("init") ?? [] ) await fn();
  }
  finally {
    for ( const n of names ) {
      if ( saved[n] ) Object.defineProperty(globalThis, n, saved[n]);
      else delete globalThis[n];
    }
  }
  for ( const [documentName, models] of Object.entries(dataModels) ) {
    if ( !Object.keys(models).length ) delete dataModels[documentName];
  }
  if ( !Object.keys(dataModels).length ) throw new Error("хук init не зарегистрировал ни одной модели данных");
  const config = realConfig.DARPG;
  if ( !config || (typeof config !== "object") ) throw new Error("хук init не задал CONFIG.DARPG");
  return { config, dataModels };
}

/* -------------------------------------------- */
/*  Ошибки валидации                            */
/* -------------------------------------------- */

/**
 * Развернуть DataModelValidationError/Failure в плоский список {path, message}.
 * (DataModelValidationFailure#getAllFailures в 14.368 теряет листовые ошибки — обходим сами.)
 * @param {Error|object} errorOrFailure
 * @returns {Array<{path: string, message: string}>}
 */
export function flattenValidationError(errorOrFailure) {
  const root = (typeof errorOrFailure?.getFailure === "function") ? errorOrFailure.getFailure() : errorOrFailure;
  const out = [];
  if ( !root || (typeof root !== "object") || !("fields" in root) ) {
    out.push({ path: "", message: errorOrFailure?.message ?? String(errorOrFailure) });
    return out;
  }
  const walk = (failure, prefix) => {
    const fields = Object.entries(failure.fields ?? {});
    const elements = failure.elements ?? [];
    if ( failure.joint ) out.push({ path: prefix, message: failure.joint });
    if ( !fields.length && !elements.length ) {
      if ( !failure.joint ) out.push({ path: prefix, message: failure.message });
      return;
    }
    for ( const [key, sub] of fields ) walk(sub, prefix ? `${prefix}.${key}` : key);
    for ( const element of elements ) {
      const label = element.name ? `${element.id}:${element.name}` : element.id;
      const sub = element.failure;
      if ( sub && (typeof sub === "object") && ("fields" in sub) ) walk(sub, `${prefix}[${label}]`);
      else out.push({ path: `${prefix}[${label}]`, message: sub?.message ?? String(sub) });
    }
  };
  walk(root, "");
  return out;
}
