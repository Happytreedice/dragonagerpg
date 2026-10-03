import ActorBaseData from "./actor-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные персонажа игрока.
 * Производные значения (defense, speed, armorRating, armorPenalty, spellpower)
 * вычисляются в DarpgActor#prepareDerivedData.
 */
export default class CharacterData extends ActorBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      level: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 1, min: 1, max: 20 }),
      class: new fields.StringField({ required: true, initial: "warrior", choices: Object.keys(DARPG.classes) }),
      background: new fields.StringField({ required: true, blank: true, initial: "" }),
      currency: new fields.SchemaField({
        gold: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 }),
        silver: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 }),
        copper: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 })
      })
    });
  }
}
