import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";
import { localizeOr } from "./migrations.mjs";

const fields = foundry.data.fields;

/**
 * Данные фокуса: область экспертизы внутри характеристики (+2, улучшенный с 11 уровня — +3).
 * Имя предмета — голое название из книги («Stealth»); вид для показа — «Dexterity (Stealth)».
 */
export default class FocusData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      ability: new fields.StringField({ required: true, initial: "dexterity", choices: () => DARPG.abilities }),
      // Улучшенный фокус: +3 вместо +2 (с 11 уровня).
      improved: new fields.BooleanField({ required: true, initial: false })
    });
  }

  /**
   * Собственные поля фокуса не менялись; описание и источник мигрирует ItemBaseData.
   * @inheritDoc
   */
  static migrateData(source, options) {
    return super.migrateData(source, options);
  }

  /* -------------------------------------------- */

  /** Бонус фокуса: +2, улучшенного — +3. */
  get bonus() {
    return this.improved ? DARPG.improvedFocusBonus : DARPG.focusBonus;
  }

  /** Вид для показа: «Характеристика (Фокус)», напр. «Dexterity (Stealth)». */
  get displayName() {
    const key = DARPG.abilities[this.ability] ?? "";
    const ability = localizeOr(key, key);
    return `${ability} (${this.parent?.name ?? ""})`;
  }
}
