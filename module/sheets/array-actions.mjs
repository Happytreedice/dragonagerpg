/**
 * Действия листов для правки массивов system.* (ArrayField) — общие для листов
 * актёров и предметов (регистрируются в DEFAULT_OPTIONS.actions).
 *
 * Как ядро v14 превращает форму листа в данные обновления (сверено с исходниками):
 *  1. FormDataExtended (client/applications/ux/form-data-extended.mjs) собирает плоский
 *     объект {"system.attacks.0.name": "Bite", …}: пустой number → null, checkbox без
 *     value → boolean, select[multiple] → массив, form-associated <prose-mirror> → HTML.
 *  2. DocumentSheetV2#_processFormData → foundry.utils.expandObject →
 *     {system: {attacks: {"0": {name: "Bite", …}}}} — объект с числовыми ключами, не массив.
 *  3. ArrayField#_cast (common/data/fields.mjs) превращает plain-объект с целыми
 *     неотрицательными ключами в массив; ArrayField#_cleanType чистит каждый элемент
 *     с partial:false — отсутствующие в форме поля элемента получают initial, а
 *     пропущенные индексы становятся элементами по умолчанию.
 *  4. ArrayField#_updateDiff: массив всегда заменяется целиком.
 * Отсюда правила листов: (а) в форме рендерятся ВСЕ поля ВСЕХ элементов массива;
 * (б) структурные изменения (добавить / удалить элемент, переключить значение
 * enum-массива) выполняются здесь полной заменой массива через
 * document.update({[path]: array}). Перед изменением форма отправляется (submit),
 * чтобы не потерять несохранённые правки соседних полей.
 */

/**
 * Начальный элемент массива по схеме модели данных (ArrayField#element).
 * @param {foundry.abstract.Document} document
 * @param {string} path                     Путь массива, напр. "system.attacks".
 * @returns {*}
 */
export function defaultArrayEntry(document, path) {
  const fields = foundry.data.fields;
  const field = document.system?.schema?.getField?.(path.replace(/^system\./, ""));
  const element = field?.element;
  const initial = element?.getInitialValue?.({});
  if ( (initial !== undefined) && (initial !== null) ) return foundry.utils.deepClone(initial);
  return (element instanceof fields.SchemaField) ? {} : "";
}

/**
 * Изменить массив документа листа: отправить форму, взять массив из источника,
 * применить изменение и заменить массив целиком.
 * @param {foundry.applications.api.DocumentSheetV2} sheet
 * @param {string} path                                     Путь массива (system.*).
 * @param {(array: any[]) => (boolean|void)} mutate         Изменение; false — изменений нет.
 * @returns {Promise<void>}
 */
export async function mutateArray(sheet, path, mutate) {
  if ( !sheet.isEditable || !path?.startsWith("system.") ) return;
  try {
    // Сохранить несохранённые правки формы (иначе полная замена массива их затрёт).
    await sheet.submit();
    const current = foundry.utils.getProperty(sheet.document._source, path);
    const array = Array.isArray(current) ? foundry.utils.deepClone(current) : [];
    if ( mutate(array) === false ) return;
    await sheet.document.update({ [path]: array });
  } catch(err) {
    console.error("darpg | ошибка правки массива", path, err);
    ui.notifications.error(err.message ?? String(err));
  }
}

/** Индекс элемента по ближайшему [data-index]. */
function indexOf(target) {
  const index = Number(target.closest("[data-index]")?.dataset.index);
  return Number.isInteger(index) ? index : -1;
}

/**
 * Добавить элемент (data-path — путь массива). @this {DocumentSheetV2}
 * @type {ApplicationClickAction}
 */
export function onAddEntry(event, target) {
  const path = target.dataset.path;
  return mutateArray(this, path, array => {
    array.push(defaultArrayEntry(this.document, path));
  });
}

/**
 * Удалить элемент (data-path + индекс строки в [data-index]). @this {DocumentSheetV2}
 * @type {ApplicationClickAction}
 */
export function onDeleteEntry(event, target) {
  const index = indexOf(target);
  return mutateArray(this, target.dataset.path, array => {
    if ( (index < 0) || (index >= array.length) ) return false;
    array.splice(index, 1);
  });
}

/**
 * Переключить значение enum-массива чекбоксом (data-path, data-value). @this {DocumentSheetV2}
 * @type {ApplicationClickAction}
 */
export function onToggleChoice(event, target) {
  const { path, value } = target.dataset;
  const checked = target.checked;
  return mutateArray(this, path, array => {
    const index = array.indexOf(value);
    if ( checked && (index < 0) ) array.push(value);
    else if ( !checked && (index >= 0) ) array.splice(index, 1);
    else return false;
  });
}

/** Действия для DEFAULT_OPTIONS.actions листов. */
export const ARRAY_ACTIONS = {
  addEntry: onAddEntry,
  deleteEntry: onDeleteEntry,
  toggleChoice: onToggleChoice
};
