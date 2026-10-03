/**
 * Однократная запись миграции данных в базу мира.
 *
 * Модели module/data/* приводят старые формы данных к новой схеме только в памяти клиента
 * (static migrateData). Сервер Foundry моделей системы не загружает: для него system — простой
 * ObjectField, и частичный diff обновления (клиент шлёт только изменённые поля) сервер сливает в
 * ХРАНИМЫЙ старый объект. Пока в базе лежит старая форма, правка перестроенного поля после
 * перезагрузки теряет соседние значения (damage.ability, range.short, source.page, manaCostNote),
 * перенесённый в описание текст (группы оружия и силы класса, таблицы бенефитов) пропадает при
 * первой структурной правке, а старые ключи (weakness, immunity, startingHealth…) остаются в базе
 * и мигрируются заново при каждой загрузке.
 *
 * Поэтому system каждого документа один раз заменяется целиком (ForcedReplacement) его уже
 * мигрированным source: старые ключи исчезают из базы, и последующие частичные diff сливаются в
 * новую форму. Запускает активный ГМ при готовности мира, если версия данных мира (служебная
 * настройка darpg.dataVersion) ниже DATA_VERSION. Охват: предметы и актёры мира, предметы актёров,
 * компендиумы мира с Item/Actor (запертые на время записи отпираются). Дельты несвязанных токенов
 * и компендиумы модулей не перезаписываются.
 */

/** Версия формы данных, которую пишет система: 1 — схема Stage 1. */
export const DATA_VERSION = 1;

/** Ключ служебной настройки мира с версией записанных данных. */
const SETTING = "dataVersion";

/**
 * Зарегистрировать служебную настройку мира с версией данных (не показывается в настройках).
 */
export function registerMigrationSetting() {
  game.settings.register("darpg", SETTING, {
    scope: "world",
    config: false,
    type: new foundry.data.fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 })
  });
}

/**
 * Обновление, заменяющее system документа целиком его (уже мигрированным в памяти) source.
 * @param {foundry.abstract.Document} doc
 * @returns {{_id: string, system: object}|null}   null — у подтипа нет модели данных системы.
 */
export function systemReplacement(doc) {
  const model = doc.system;
  if ( !(model instanceof foundry.abstract.TypeDataModel) ) return null;
  return { _id: doc.id, system: foundry.data.operators.ForcedReplacement.create(model.toObject()) };
}

/**
 * Перезаписать system набора документов одной операцией.
 * @param {foundry.abstract.Document[]} documents
 * @param {(updates: object[]) => Promise<foundry.abstract.Document[]>} write   Запись обновлений.
 * @returns {Promise<number>}   Число документов, которые записать не удалось.
 */
async function replaceSystems(documents, write) {
  const updates = documents.map(systemReplacement).filter(Boolean);
  if ( !updates.length ) return 0;
  try {
    const updated = await write(updates);
    return updates.length - (updated?.length ?? 0);
  } catch(err) {
    console.error("darpg | миграция данных: запись не удалась", err);
    return updates.length;
  }
}

/**
 * Перезаписать документы и, для актёров, их предметы.
 * @param {typeof foundry.abstract.Document} documentClass
 * @param {foundry.abstract.Document[]} documents
 * @param {string|null} [pack]   Компендиум документов (null — мир).
 * @returns {Promise<number>}    Число документов, которые записать не удалось.
 */
async function migrateDocuments(documentClass, documents, pack=null) {
  let failed = await replaceSystems(documents, updates => documentClass.updateDocuments(updates, { pack }));
  if ( documentClass.documentName !== "Actor" ) return failed;
  for ( const actor of documents ) {
    failed += await replaceSystems(actor.items.contents, updates => actor.updateEmbeddedDocuments("Item", updates));
  }
  return failed;
}

/**
 * Перезаписать документы компендиума мира; запертый компендиум на время записи отпирается.
 * @param {foundry.documents.collections.CompendiumCollection} pack
 * @returns {Promise<number>}    Число документов, которые записать не удалось (1 — сбой пака).
 */
async function migratePack(pack) {
  const wasLocked = pack.locked;
  try {
    if ( wasLocked ) await pack.configure({ locked: false });
    return await migrateDocuments(pack.documentClass, await pack.getDocuments(), pack.collection);
  } catch(err) {
    console.error(`darpg | миграция данных: компендиум ${pack.collection}`, err);
    return 1;
  } finally {
    if ( wasLocked ) await pack.configure({ locked: true });
  }
}

/**
 * Записать миграцию в базу мира, если версия данных мира устарела (только активный ГМ).
 * При сбоях версия не повышается — миграция повторится при следующей загрузке.
 * @returns {Promise<void>}
 */
export async function migrateWorld() {
  if ( !game.user.isActiveGM || (game.settings.get("darpg", SETTING) >= DATA_VERSION) ) return;
  const version = DATA_VERSION;
  const notice = ui.notifications.info(game.i18n.format("DARPG.Migration.Begin", { version }), { permanent: true });
  let failed = 0;
  try {
    failed += await migrateDocuments(game.items.documentClass, game.items.contents);
    failed += await migrateDocuments(game.actors.documentClass, game.actors.contents);
    for ( const pack of game.packs ) {
      if ( (pack.metadata.packageType !== "world") || !["Actor", "Item"].includes(pack.documentName) ) continue;
      failed += await migratePack(pack);
    }
    if ( !failed ) await game.settings.set("darpg", SETTING, version);
  } catch(err) {
    console.error("darpg | миграция данных мира не удалась", err);
    failed ||= 1;
  } finally {
    notice.remove();
  }
  if ( failed ) {
    ui.notifications.error(game.i18n.format("DARPG.Migration.Failed", { count: failed, version }), { permanent: true });
  }
  else ui.notifications.success(game.i18n.format("DARPG.Migration.Complete", { version }));
}
