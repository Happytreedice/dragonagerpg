import ActorBaseData from "./actor-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные НИП/существа бестиария: полный статблок AGE (spec §21).
 * Производные Defense/Speed/ArmorRating для NPC задаются вручную в статблоке
 * (существа не носят предметы-экипировку), но при пустых значениях
 * DarpgActor#prepareDerivedData считает их по формулам (10+DEX и т.п.).
 */
export default class NpcData extends ActorBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      // Классификация
      threat: new fields.StringField({ required: true, initial: "moderate", choices: Object.keys(DARPG.threatLevels) }),
      creatureType: new fields.StringField({ required: true, initial: "humanoid", choices: Object.keys(DARPG.creatureTypes) }),
      size: new fields.StringField({ required: true, initial: "average", choices: Object.keys(DARPG.sizes) }),

      // Боевые параметры статблока (nullable: null = вычислить по формуле в prepareDerivedData)
      defense: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null, min: 0 }),
      armorRating: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 }),
      speed: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null, min: 0 }),

      // Атаки: название, бросок атаки (характеристика+фокус группы), формула урона, тип
      attacks: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ required: true, blank: true, initial: "" }),
        ability: new fields.StringField({ required: true, initial: "strength", choices: Object.keys(DARPG.abilities) }),
        bonus: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0 }),
        damage: new fields.StringField({ required: true, blank: true, initial: "1d6" }),
        penetrating: new fields.BooleanField({ required: true, initial: false }),
        range: new fields.StringField({ required: true, blank: true, initial: "" })
      }), { required: true, initial: [] }),

      // Избранные стунты (текстовый список название/стоимость) и особые силы (HTML)
      favoredStunts: new fields.StringField({ required: true, blank: true, initial: "" }),
      powers: new fields.HTMLField({ required: true, blank: true, initial: "" }),

      // Уязвимости/иммунитеты/сопротивления и снаряжение — свободный текст
      weakness: new fields.StringField({ required: true, blank: true, initial: "" }),
      immunity: new fields.StringField({ required: true, blank: true, initial: "" }),
      equipmentText: new fields.StringField({ required: true, blank: true, initial: "" })
    });
  }
}
