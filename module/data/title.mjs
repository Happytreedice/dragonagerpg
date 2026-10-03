import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные титула (spec §15.2): ступень [Tier] 1–3, социальный модификатор
 * внутри своей структуры (+Tier) и ресурсы (доход, бойцы, влияние).
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
}
