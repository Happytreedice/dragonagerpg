import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные расходника: зелья, яды, гранаты. Активация — малое действие.
 */
export default class ConsumableData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      consumableType: new fields.StringField({ required: true, initial: "potion", choices: () => DARPG.consumableTypes }),
      // Бросок урона/лечения, если есть: «3d6», «2d6 + @abilities.constitution.value».
      formula: new fields.StringField({ required: true, blank: true, initial: "" }),
      // Степень рецепта для ядов и гранат; "" — не применяется.
      degree: new fields.StringField({ required: true, blank: true, initial: "", choices: () => DARPG.degrees }),
      quantity: this.quantityField(),
      cost: this.costField()
    });
  }

  /**
   * Старая форма: price → cost (degree появилась впервые — начальное "").
   * @inheritDoc
   */
  static migrateData(source, options) {
    this._migrateCost(source);
    return super.migrateData(source, options);
  }
}
