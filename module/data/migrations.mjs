/**
 * Помощники миграции исходных данных darpg: старые формы (до Stage 1) → новая схема.
 *
 * Контракт v14 (common/abstract/data.mjs, common/data/fields.mjs): DataModel.migrateData(source, options)
 * вызывается из DataField#clean ДО очистки и может прийти ДВАЖДЫ за одну операцию — из
 * TypeDataField#_migrate (используется возвращённое значение) и из DataModelSchemaField#_migrate
 * (возвращённое значение игнорируется). Поэтому каждая миграция:
 *   • правит source на месте и возвращает тот же объект;
 *   • идемпотентна (повторный прогон ничего не меняет);
 *   • срабатывает только по наличию СТАРЫХ ключей/форм, а не по отсутствию новых —
 *     source может быть частичным diff обновления (DataModel#updateSource чистит с partial: true);
 *   • в частичном diff не выводит значения из таблиц и не дописывает текст в поле, которого
 *     нет в diff, — иначе затёрлись бы текущие данные документа в памяти клиента;
 *   • не дописывает текст повторно, если он уже есть в целевом поле.
 * Метки перенесённого текста локализуются, если game.i18n уже готов, иначе — английский фолбэк.
 *
 * Всё это — миграция только в памяти. Сервер моделей системы не загружает и сливает частичные
 * diff в хранимую старую форму, поэтому в базу мира миграцию один раз записывает
 * module/world-migration.mjs (полная замена system мигрированным source).
 */

/**
 * Мигрируется ли частичный diff обновления, а не полный source.
 * @param {object} [options]   Опции очистки, переданные в migrateData.
 * @returns {boolean}
 */
export function isPartial(options) {
  return options?.partial === true;
}

/**
 * Переименовать поле. Если новое поле уже задано, старое просто удаляется.
 * @param {object} source                    Мигрируемые данные (меняются на месте).
 * @param {string} oldKey                    Старое имя поля.
 * @param {string} newKey                    Новое имя поля.
 * @param {(value: any) => any} [apply]      Преобразование значения.
 * @returns {boolean}                        Был ли старый ключ.
 */
export function renameField(source, oldKey, newKey, apply) {
  if ( !Object.hasOwn(source, oldKey) ) return false;
  const value = source[oldKey];
  delete source[oldKey];
  if ( !Object.hasOwn(source, newKey) ) source[newKey] = apply ? apply(value) : value;
  return true;
}

/**
 * Пустая отметка «нет значения»: пустая строка или одиночное тире.
 * @param {any} value
 * @returns {boolean}
 */
export function isEmptyMark(value) {
  return (typeof value === "string") && /^\s*[-–—]?\s*$/.test(value);
}

/**
 * Локализовать ключ, если перевод доступен, иначе вернуть фолбэк.
 * @param {string} key
 * @param {string} fallback
 * @returns {string}
 */
export function localizeOr(key, fallback) {
  const i18n = globalThis.game?.i18n;
  return i18n?.has?.(key) ? i18n.localize(key) : fallback;
}

/**
 * Разобрать старую строковую ссылку на источник: «Core Rulebook, p. 74» → {book, page}.
 * Строку без номера страницы («Core Rulebook, Ch. 13») целиком сохраняем в book.
 * @param {string} text
 * @returns {{book: string, page: number|null}}
 */
export function parseSourceRef(text) {
  const str = String(text ?? "").trim();
  const match = str.match(/^(.*?)(?:^|[\s,;(]+)(?:p|pp|pg|page|стр|с)\.?\s*(\d+)(?:\s*[-–—]\s*\d+)?\)?\.?$/iu);
  if ( match ) return { book: match[1].trim(), page: Number(match[2]) };
  return { book: str, page: null };
}

/**
 * Привести старое описание (строка) к форме {value}.
 * @param {object} source
 * @returns {object|null}   Объект description либо null, если описания нет или оно не объект.
 */
export function migrateDescription(source) {
  if ( typeof source.description === "string" ) source.description = { value: source.description };
  const description = source.description;
  return (description && (typeof description === "object") && !Array.isArray(description)) ? description : null;
}

/**
 * Дописать HTML в конец HTML-поля верхнего уровня (перенос текста, которому нет места в новой схеме).
 * В частичном diff без этого поля ничего не делает: дописать к неизвестному текущему значению нельзя.
 * Уже дописанный ранее текст повторно не добавляется.
 * @param {object} source
 * @param {string} key          Имя HTML-поля, напр. "powers".
 * @param {string} html
 * @param {object} [options]    Опции очистки, переданные в migrateData.
 */
export function appendHTMLField(source, key, html, options) {
  if ( !html ) return;
  if ( isPartial(options) && !(key in source) ) return;
  const current = (typeof source[key] === "string") ? source[key] : "";
  if ( !current.includes(html) ) source[key] = current + html;
}

/**
 * Дописать HTML в конец description.value (перенос текста, которому нет места в новой схеме).
 * В частичном diff без описания ничего не делает: дописать к неизвестному текущему значению нельзя.
 * Уже дописанный ранее текст повторно не добавляется.
 * @param {object} source
 * @param {string} html
 * @param {object} [options]    Опции очистки, переданные в migrateData.
 */
export function appendDescription(source, html, options) {
  if ( !html ) return;
  const description = migrateDescription(source);
  if ( isPartial(options) && (typeof description?.value !== "string") ) return;
  const target = description ?? (source.description = { value: "" });
  const current = (typeof target.value === "string") ? target.value : "";
  if ( !current.includes(html) ) target.value = current + html;
}

/**
 * Абзац «Метка: текст» для перенесённого простого текста (текст экранируется).
 * @param {string} labelKey   i18n-ключ метки.
 * @param {string} fallback   Метка без локализации.
 * @param {string} text       Простой текст.
 * @returns {string}
 */
export function labeledText(labelKey, fallback, text) {
  const { escapeHTML } = foundry.utils;
  return `<p><strong>${escapeHTML(localizeOr(labelKey, fallback))}:</strong> ${escapeHTML(String(text).trim())}</p>`;
}

/**
 * Заголовок-абзац и следом блок готового HTML (таблицы, списки).
 * @param {string} labelKey   i18n-ключ метки.
 * @param {string} fallback   Метка без локализации.
 * @param {string} html       Готовый HTML.
 * @returns {string}
 */
export function labeledHTML(labelKey, fallback, html) {
  const { escapeHTML } = foundry.utils;
  return `<p><strong>${escapeHTML(localizeOr(labelKey, fallback))}</strong></p>${String(html).trim()}`;
}

/**
 * HTML → простой текст: теги убираются, базовые сущности раскрываются, пробелы схлопываются.
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
  const text = String(html ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&#39;/g, "'");
  return foundry.utils.unescapeHTML(text).replace(/\s+/g, " ").trim();
}

/** Открывающие и закрывающие скобки, внутри которых разделители списка не действуют. */
const OPEN_BRACKETS = "([{«";
const CLOSE_BRACKETS = ")]}»";

/**
 * Разделить строку на элементы по разделителям верхнего уровня (вне скобок и «ёлочек»).
 * Пробелы и концевые точки/запятые элементов обрезаются, пустые элементы отбрасываются.
 * @param {string} text
 * @param {RegExp} [separator]   Липкое (флаг y) выражение разделителя.
 * @returns {string[]}
 */
export function splitList(text, separator=/\s*[,;]\s*/y) {
  const str = String(text ?? "");
  const parts = [];
  let depth = 0;
  let start = 0;
  for ( let i = 0; i < str.length; ) {
    const char = str[i];
    if ( OPEN_BRACKETS.includes(char) ) depth++;
    else if ( CLOSE_BRACKETS.includes(char) ) depth = Math.max(0, depth - 1);
    else if ( depth === 0 ) {
      separator.lastIndex = i;
      const match = separator.exec(str);
      if ( match?.[0].length ) {
        parts.push(str.slice(start, i));
        i += match[0].length;
        start = i;
        continue;
      }
    }
    i++;
  }
  parts.push(str.slice(start));
  return parts.map(p => p.trim().replace(/[.,;]+$/u, "").trim()).filter(Boolean);
}

/**
 * Разделить свободный текст перечня снаряжения: сначала на предложения, затем по запятым.
 * Предложение с меткой «Название: …» (напр. «Группы оружия: Луки, Копья») остаётся целым.
 * @param {string} text
 * @returns {string[]}
 */
export function splitEquipmentText(text) {
  const items = [];
  for ( const sentence of splitList(text, /\.\s+/y) ) {
    if ( sentence.includes(":") ) items.push(sentence);
    else items.push(...splitList(sentence));
  }
  return items;
}

/**
 * Нормализовать формулу костей: кириллическая «к» → «d», лишние пробелы убраны по краям.
 * @param {string} formula
 * @returns {string}
 */
export function normalizeDice(formula) {
  return String(formula ?? "").trim().replace(/(\d)\s*[кК]\s*(\d)/gu, "$1d$2");
}

/**
 * Разобрать строку бенефита «<strong>3–4:</strong> текст» → {roll: "3-4", result: "текст"}.
 * @param {string} html   Содержимое <li>.
 * @returns {{roll: string, result: string}|null}
 */
function parseBenefitRow(html) {
  const match = htmlToText(html).match(/^(\d+(?:\s*[-–—]\s*\d+)?)\s*[:.)]\s*(.*)$/su);
  if ( !match ) return null;
  return { roll: match[1].replace(/\s*[-–—]\s*/gu, "-"), result: match[2].trim() };
}

/**
 * Разобрать старую HTML-таблицу бенефитов 2d6 (<ul><li>…</li></ul>).
 * Структура извлекается, только если она однозначна: HTML — ровно один список, каждая строка
 * которого разобрана, и вне списка нет текста. Иначе (напр. две таблицы «эльф»/«человек»)
 * возвращается null — исходник нужно целиком сохранить в описании, а не угадывать таблицу.
 * @param {string} html
 * @returns {{roll: string, result: string}[]|null}
 */
export function parseBenefitsHTML(html) {
  const str = String(html ?? "");
  const lists = [...str.matchAll(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  if ( !lists.length ) return htmlToText(str) ? null : [];
  if ( (lists.length > 1) || htmlToText(str.replace(lists[0][0], "")) ) return null;
  const rows = [...lists[0][2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(m => parseBenefitRow(m[1]));
  return rows.every(Boolean) ? rows : null;
}

/** Буквы классов в старой русской отметке доступности таланта «(М/Р/В)». */
const CLASS_MARKS = { "м": "mage", "р": "rogue", "в": "warrior" };

/**
 * Классы таланта из старой отметки в конце описания: «… (М/Р/В).», «… (М (Усмирённые)/Р/В).».
 * @param {string|{value: string}} description   Старое описание (строка или {value}).
 * @returns {string[]|null}                      Ключи классов либо null, если отметки нет.
 */
export function classesFromMark(description) {
  const text = htmlToText((typeof description === "string") ? description : description?.value);
  const match = text.match(/\(((?:[^()]|\([^()]*\))*)\)\s*\.?$/u);
  if ( !match ) return null;
  const classes = [];
  for ( const part of match[1].split("/") ) {
    const mark = part.trim().match(/^([МмРрВв])(?:\s*\([^()]*\))?$/u);
    if ( !mark ) return null;
    const key = CLASS_MARKS[mark[1].toLowerCase()];
    if ( !classes.includes(key) ) classes.push(key);
  }
  return classes.length ? classes : null;
}
