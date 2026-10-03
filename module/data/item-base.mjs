import { migrateDescription, parseSourceRef, renameField } from "./migrations.mjs";

const fields = foundry.data.fields;

/**
 * Общее ядро данных предметов: описание {value} и ссылка на книгу {book, page}.
 */
export default class ItemBaseData extends foundry.abstract.TypeDataModel {

  /** Поле цены в нотации книги: «18 sp», «1 gp 50 sp», «3 cp»; "" — в книге «—». */
  static costField() {
    return new fields.StringField({ required: true, blank: true, initial: "" });
  }

  /** Поле флага экипировки (состояние в игре, в YAML компендиума не пишется). */
  static equippedField() {
    return new fields.BooleanField({ required: true, initial: false });
  }

  /** Поле количества. */
  static quantityField() {
    return new fields.NumberField({ required: true, integer: true, nullable: false, initial: 1, min: 0 });
  }

  /** @override */
  static defineSchema() {
    return {
      description: new fields.SchemaField({
        value: new fields.HTMLField({ required: true, blank: true, initial: "" })
      }),
      // Сноска на оригинальную книгу правил: {book: "Core Rulebook", page: 74}.
      source: new fields.SchemaField({
        book: new fields.StringField({ required: true, blank: true, initial: "Core Rulebook" }),
        page: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null })
      })
    };
  }

  /**
   * Перенести старую цену `price` в `cost`. Вызывают модели, у которых есть поле cost-цена.
   * @param {object} source
   * @protected
   */
  static _migrateCost(source) {
    renameField(source, "price", "cost");
  }

  /**
   * Старые формы общих полей:
   *   description: "строка"           → description: {value: "строка"}
   *   source: "Core Rulebook, p. 74"  → source: {book: "Core Rulebook", page: 74}
   * @inheritDoc
   */
  static migrateData(source, options) {
    migrateDescription(source);
    // Поле модели называется source — как и параметр миграции.
    if ( typeof source.source === "string" ) source.source = parseSourceRef(source.source);
    return super.migrateData(source, options);
  }
}
