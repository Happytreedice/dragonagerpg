import ItemBaseData from "./item-base.mjs";

/**
 * Данные прочего снаряжения (общий инвентарь, шедевры и превосходные предметы).
 */
export default class EquipmentData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      quantity: this.quantityField(),
      cost: this.costField()
    });
  }

  /**
   * Старая форма: price → cost; weight упразднён.
   * @inheritDoc
   */
  static migrateData(source, options) {
    this._migrateCost(source);
    delete source.weight;
    return super.migrateData(source, options);
  }
}
