import ItemBaseData from "./item-base.mjs";

const fields = foundry.data.fields;

/**
 * Данные хонорифика (spec §15.2): механическое прозвание с узким социальным
 * (или иным) бонусом, обычно ±1 (макс ±3).
 */
export default class HonorificData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      // Краткая сводка бонуса (напр. «+1 к COM(Убеждение) против верующих»).
      effect: new fields.StringField({ required: true, blank: true, initial: "" })
    });
  }
}
