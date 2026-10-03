import ActorBaseData from "./actor-base.mjs";
import { DARPG } from "../config.mjs";
import { appendHTMLField, isEmptyMark, labeledText, splitEquipmentText, splitList } from "./migrations.mjs";

const fields = foundry.data.fields;

/**
 * Данные НИП/существа бестиария в форме статблока книги.
 * Defense/Speed со значением null DarpgActor#prepareDerivedData считает как 10 + ЛОВ.
 */
export default class NpcData extends ActorBaseData {

  /** Массив строк свободного текста. */
  static #stringList() {
    return new fields.ArrayField(
      new fields.StringField({ required: true, blank: true, initial: "" }),
      { required: true, initial: [] }
    );
  }

  /** @override */
  static defineSchema() {
    // Приватные статические методы брендируются на классе-объявителе — обращаемся к нему явно.
    const schema = super.defineSchema();
    return Object.assign(schema, {
      threat: new fields.StringField({ required: true, initial: "moderate", choices: () => DARPG.threatLevels }),
      creatureType: new fields.StringField({ required: true, initial: "humanoid", choices: () => DARPG.creatureTypes }),
      size: new fields.StringField({ required: true, initial: "average", choices: () => DARPG.sizes }),

      // Боевые параметры статблока (null у defense/speed — вычислить 10 + ЛОВ).
      defense: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null, min: 0 }),
      armorRating: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 }),
      speed: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null, min: 0 }),

      // Атаки как в книге: итоговый бонус броска и итоговая формула урона.
      attacks: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ required: true, blank: true, initial: "" }),
        attackRoll: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0 }),
        damage: new fields.StringField({ required: true, blank: true, initial: "1d6" }),
        penetrating: new fields.BooleanField({ required: true, initial: false }),
        // "" — ближний бой, «30/60» — дальнобойная атака.
        range: new fields.StringField({ required: true, blank: true, initial: "" }),
        notes: new fields.StringField({ required: true, blank: true, initial: "" })
      }), { required: true, initial: [] }),

      // Избранные стант-приёмы, напр. ["Mighty Blow", "Lightning Attack (3 SP)"].
      favoredStunts: NpcData.#stringList(),
      // Таланты, напр. ["Armor Training (Journeyman)"].
      talents: NpcData.#stringList(),
      weaponGroups: new fields.ArrayField(
        new fields.StringField({ required: true, choices: () => DARPG.weaponGroups }),
        { required: true, initial: [] }
      ),
      // Особые свойства, иммунитеты, уязвимости.
      powers: new fields.HTMLField({ required: true, blank: true, initial: "" }),
      equipment: NpcData.#stringList()
    });
  }

  /**
   * Старая форма:
   *   attacks[].{ability, bonus}  → attacks[].attackRoll = bonus (итог как в книге), ability упразднена
   *   favoredStunts «A, B (2 SP)»  → ["A", "B (2 SP)"]
   *   weakness / immunity          → абзацы в конце powers
   *   equipmentText «A, B. Группы оружия: X, Y» → equipment ["A", "B", "Группы оружия: X, Y"]
   * @inheritDoc
   */
  static migrateData(source, options) {
    if ( Array.isArray(source.attacks) ) {
      for ( const attack of source.attacks ) {
        if ( !attack || (typeof attack !== "object") ) continue;
        if ( "bonus" in attack ) {
          if ( !("attackRoll" in attack) ) attack.attackRoll = attack.bonus;
          delete attack.bonus;
        }
        delete attack.ability;
      }
    }

    if ( typeof source.favoredStunts === "string" ) source.favoredStunts = splitList(source.favoredStunts);

    for ( const [key, labelKey, fallback] of [
      ["weakness", "DARPG.Migration.Weakness", "Weakness"],
      ["immunity", "DARPG.Migration.Immunity", "Immunity"]
    ] ) {
      if ( !(key in source) ) continue;
      const text = source[key];
      delete source[key];
      if ( (typeof text === "string") && !isEmptyMark(text) ) {
        appendHTMLField(source, "powers", labeledText(labelKey, fallback, text), options);
      }
    }

    if ( "equipmentText" in source ) {
      const text = source.equipmentText;
      delete source.equipmentText;
      if ( !("equipment" in source) ) source.equipment = splitEquipmentText(text);
    }
    return super.migrateData(source, options);
  }
}
