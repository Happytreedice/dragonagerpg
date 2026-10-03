import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные заклинания.
 */
export default class SpellData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      school: new fields.StringField({ required: true, initial: "creation", choices: Object.keys(DARPG.schools) }),
      spellType: new fields.StringField({ required: true, initial: "attack", choices: Object.keys(DARPG.spellTypes) }),
      manaCost: new fields.StringField({ required: true, blank: true, initial: "1" }),
      castingTime: new fields.StringField({ required: true, blank: true, initial: "" }),
      targetNumber: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 10, min: 0 }),
      test: new fields.StringField({ required: true, blank: true, initial: "" }),
      requirements: new fields.StringField({ required: true, blank: true, initial: "" })
    });
  }

  /** Числовая стоимость маны (первое число из строки manaCost). */
  get manaCostNumber() {
    const match = String(this.manaCost).match(/-?\d+/);
    return match ? Number(match[0]) : 0;
  }
}
