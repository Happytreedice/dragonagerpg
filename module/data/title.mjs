import ItemBaseData from "./item-base.mjs";

const fields = foundry.data.fields;

/**
 * Данные титула: ступень (Tier) 1–3, структура, внутри которой действует титул, и ресурсы
 * (доход, бойцы, влияние).
 */
export default class TitleData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      tier: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 1, min: 1, max: 3 }),
      structure: new fields.StringField({ required: true, blank: true, initial: "" }),
      resources: new fields.StringField({ required: true, blank: true, initial: "" })
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
