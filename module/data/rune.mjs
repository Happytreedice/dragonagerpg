import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные руны: слот (оружие/броня), степень и однострочная сводка эффекта.
 * Наносится в рунный слот предмета (талант «Рунное дело»).
 */
export default class RuneData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      slot: new fields.StringField({ required: true, initial: "weapon", choices: () => DARPG.runeSlots }),
      degree: new fields.StringField({ required: true, initial: "novice", choices: () => DARPG.degrees }),
      // Однострочная сводка эффекта (полный текст — в description).
      effect: new fields.StringField({ required: true, blank: true, initial: "" }),
      cost: this.costField()
    });
  }

  /**
   * Собственные поля руны не менялись (cost — новое поле); описание и источник мигрирует ItemBaseData.
   * @inheritDoc
   */
  static migrateData(source, options) {
    return super.migrateData(source, options);
  }
}
