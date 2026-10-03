import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные расходника: зелья, яды, гранаты. Активация — minor-действие Activate.
 * spec §12.5 (зелья), §13.1 (яды), §13.2 (гранаты).
 */
export default class ConsumableData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      consumableType: new fields.StringField({ required: true, initial: "potion", choices: Object.keys(DARPG.consumableTypes) }),
      // Урон/эффект как формула для энричера, напр. «3d6» (граната) или «2d6+@abilities.constitution.value» (зелье).
      formula: new fields.StringField({ required: true, blank: true, initial: "" }),
      quantity: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 1, min: 0 }),
      price: this.priceField()
    });
  }
}
