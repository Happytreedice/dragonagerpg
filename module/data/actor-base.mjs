import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Общее ядро данных актёров: характеристики, фокусы, здоровье, мана, биография.
 */
export default class ActorBaseData extends foundry.abstract.TypeDataModel {

  /** Схема восьми характеристик AGE. */
  static #abilitiesSchema() {
    const abilities = {};
    for ( const key of Object.keys(DARPG.abilities) ) {
      abilities[key] = new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: -2 })
      });
    }
    return new fields.SchemaField(abilities);
  }

  /** Схема ресурса вида {value, max}. */
  static resourceSchema(initial) {
    return new fields.SchemaField({
      value: new fields.NumberField({ required: true, integer: true, nullable: false, initial, min: 0 }),
      max: new fields.NumberField({ required: true, integer: true, nullable: false, initial, min: 0 })
    });
  }

  /** @override */
  static defineSchema() {
    // Приватный статический метод брендируется на классе-объявителе: при вызове
    // super.defineSchema() из подкласса `this` — подкласс, и `this.#abilitiesSchema()`
    // бросает «Receiver must be class ActorBaseData». Ссылаемся на класс явно.
    return {
      abilities: ActorBaseData.#abilitiesSchema(),
      focuses: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ required: true, blank: true, initial: "" }),
        ability: new fields.StringField({ required: true, initial: "communication", choices: Object.keys(DARPG.abilities) })
      })),
      health: this.resourceSchema(20),
      mana: this.resourceSchema(10),
      // Стант-поинты (SP): пул, пополняемый дублями при бросках и тратящийся на приёмы.
      // value — текущий запас, max — сколько сгенерировано последним броском (для наглядности).
      stuntPoints: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 }),
        max: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 6, min: 0 })
      }),
      biography: new fields.HTMLField({ required: true, blank: true, initial: "" })
    };
  }
}
