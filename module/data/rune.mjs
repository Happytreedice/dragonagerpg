import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные руны (spec §14.3): слот (оружие/броня), степень N/J/M и краткая
 * сводка бонуса. Наносится в рунный слот предмета (талант Рунное дело).
 */
export default class RuneData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      slot: new fields.StringField({ required: true, initial: "weapon", choices: Object.keys(DARPG.runeSlots) }),
      degree: new fields.StringField({ required: true, initial: "novice", choices: Object.keys(DARPG.degrees) }),
      // Краткая сводка эффекта для быстрого просмотра (полный текст — в description).
      effect: new fields.StringField({ required: true, blank: true, initial: "" })
    });
  }
}
