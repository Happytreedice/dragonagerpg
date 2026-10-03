import ItemBaseData from "./item-base.mjs";

const fields = foundry.data.fields;

/**
 * Данные прочего снаряжения.
 */
export default class EquipmentData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      quantity: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 1, min: 0 }),
      weight: new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
      price: this.priceField()
    });
  }
}
