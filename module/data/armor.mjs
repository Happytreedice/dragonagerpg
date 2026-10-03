import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные брони.
 */
export default class ArmorData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      rating: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 3, min: 0 }),
      penalty: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 }),
      type: new fields.StringField({ required: true, initial: "light", choices: Object.keys(DARPG.armorTypes) }),
      equipped: this.equippedField(),
      price: this.priceField()
    });
  }
}
