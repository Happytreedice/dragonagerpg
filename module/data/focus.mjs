import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные фокуса: область экспертизы внутри характеристики (+2, с 11 уровня +3).
 * README §2.2, §4.2 (сноски); spec §2.
 */
export default class FocusData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      ability: new fields.StringField({ required: true, initial: "dexterity", choices: Object.keys(DARPG.abilities) }),
      improved: new fields.BooleanField({ required: true, initial: false })
    });
  }

  /** Бонус фокуса: +2, либо +3 если взят повторно (с 11 уровня). */
  get bonus() {
    return this.improved ? 3 : DARPG.focusBonus;
  }
}
