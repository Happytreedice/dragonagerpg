import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные происхождения: раса, допустимые классы, бонус характеристики,
 * фокус на выбор, языки и таблица бенефитов 2d6. spec §6.
 */
export default class BackgroundData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      race: new fields.StringField({ required: true, initial: "human", choices: Object.keys(DARPG.races) }),
      classes: new fields.ArrayField(
        new fields.StringField({ choices: Object.keys(DARPG.classes) }),
        { required: true, initial: [] }
      ),
      abilityBonus: new fields.StringField({ required: true, blank: true, initial: "", choices: ["", ...Object.keys(DARPG.abilities)] }),
      // Фокус(ы) на выбор и языки — свободный текст (варианты «X или Y»), spec §6.
      focusChoice: new fields.StringField({ required: true, blank: true, initial: "" }),
      languages: new fields.StringField({ required: true, blank: true, initial: "" }),
      // Таблица 2d6 бенефитов происхождения: пункты 2 / 3-4 / 5 / 6 / 7-8 / 9 / 10-11 / 12.
      benefits: new fields.HTMLField({ required: true, blank: true, initial: "" })
    });
  }
}
