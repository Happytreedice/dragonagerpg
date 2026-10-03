import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";
import { appendDescription, labeledHTML, parseBenefitsHTML, renameField, splitList } from "./migrations.mjs";

const fields = foundry.data.fields;

/** Разделители вариантов фокуса в старой строке: «X или Y», «X, Y или Z», «X or Y». */
const FOCUS_CHOICE_SEPARATOR = /\s*[,;]\s*|\s+(?:или|or)\s+/iuy;

/**
 * Данные происхождения: раса, допустимые классы, бонус характеристики,
 * фокусы на выбор, языки и таблица бенефитов 2d6.
 */
export default class BackgroundData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      race: new fields.StringField({ required: true, initial: "human", choices: () => DARPG.races }),
      classes: new fields.ArrayField(
        new fields.StringField({ required: true, choices: () => DARPG.classes }),
        { required: true, initial: [] }
      ),
      // +1 к этой характеристике; "" — без бонуса.
      abilityBonus: new fields.StringField({ required: true, blank: true, initial: "", choices: () => DARPG.abilities }),
      // Фокусы на выбор (взять один), напр. ["Dexterity (Stealth)", "Strength (Climbing)"].
      focusChoices: new fields.ArrayField(
        new fields.StringField({ required: true, blank: true, initial: "" }),
        { required: true, initial: [] }
      ),
      languages: new fields.ArrayField(
        new fields.StringField({ required: true, blank: true, initial: "" }),
        { required: true, initial: [] }
      ),
      // Таблица 2d6: roll — "2", "3-4", "5", "6", "7-8", "9", "10-11", "12".
      benefits: new fields.ArrayField(
        new fields.SchemaField({
          roll: new fields.StringField({ required: true, blank: true, initial: "" }),
          result: new fields.StringField({ required: true, blank: true, initial: "" })
        }),
        { required: true, initial: [] }
      )
    });
  }

  /**
   * Старая форма:
   *   focusChoice «DEX (Скрытность) или STR (Лазание)» → focusChoices [..] (по «или»/«or»/«,»/«;»)
   *   languages «Кунлат, торговый»                     → languages [..] (по «,»/«;» вне скобок)
   *   benefits HTML <ul><li><strong>3–4:</strong> …    → benefits [{roll: "3-4", result: "…"}]
   *     Если HTML не сводится однозначно к одному списку (напр. две таблицы — эльф/человек),
   *     benefits = [], а исходный HTML целиком дописывается в описание (таблицу не угадываем).
   * @inheritDoc
   */
  static migrateData(source, options) {
    renameField(source, "focusChoice", "focusChoices", value => splitList(value, FOCUS_CHOICE_SEPARATOR));
    if ( typeof source.languages === "string" ) source.languages = splitList(source.languages);

    if ( typeof source.benefits === "string" ) {
      const html = source.benefits;
      const rows = parseBenefitsHTML(html);
      if ( !rows ) appendDescription(source, labeledHTML("DARPG.Migration.Benefits", "Benefits (2d6)", html), options);
      source.benefits = rows ?? [];
    }
    return super.migrateData(source, options);
  }
}
