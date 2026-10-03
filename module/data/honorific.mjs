import ItemBaseData from "./item-base.mjs";

const fields = foundry.data.fields;

/**
 * Данные хонорифика: прозвание с узким (обычно социальным) бонусом ±1 … ±3.
 */
export default class HonorificData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      // Однострочная сводка бонуса.
      effect: new fields.StringField({ required: true, blank: true, initial: "" })
    });
  }

  /**
   * Собственные поля не менялись; описание и источник мигрирует ItemBaseData.
   * @inheritDoc
   */
  static migrateData(source, options) {
    return super.migrateData(source, options);
  }
}
