import ItemBaseData from "./item-base.mjs";

const fields = foundry.data.fields;

/**
 * Данные щита.
 */
export default class ShieldData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      defenseBonus: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 1, min: 1, max: 3 }),
      equipped: this.equippedField(),
      price: this.priceField()
    });
  }
}
