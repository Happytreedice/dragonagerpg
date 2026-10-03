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
      xp: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 }),
      class: new fields.StringField({ required: true, initial: "warrior", choices: () => DARPG.classes }),
      race: new fields.StringField({ required: true, initial: "human", choices: () => DARPG.races }),
      // Название происхождения.
      background: new fields.StringField({ required: true, blank: true, initial: "" }),
      currency: new fields.SchemaField({
        gold: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 }),
        silver: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 }),
        copper: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 })
      })
    });
  }

  /**
   * Поля персонажа не меняли форму (xp и race — новые, получают начальные значения).
   * @inheritDoc
   */
  static migrateData(source, options) {
    return super.migrateData(source, options);
  }
}
