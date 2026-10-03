import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";
import { appendDescription, isEmptyMark, isPartial, labeledHTML, labeledText } from "./migrations.mjs";

const fields = foundry.data.fields;

/** Стандартный хвост формулы стартового Здоровья: «+ ТЕЛ + 1d6» (база задаётся полем health). */
const STANDARD_HEALTH_TAIL = "+@abilities.constitution.value+1d6";

/**
 * Данные класса: первичные/вторичные характеристики, базовые Здоровье и Мана,
 * группы оружия (выданные и на выбор) и силы по уровням.
 */
export default class DarpgClassData extends ItemBaseData {

  /** Массив ключей характеристик. */
  static #abilityList() {
    return new fields.ArrayField(
      new fields.StringField({ required: true, choices: () => DARPG.abilities }),
      { required: true, initial: [] }
    );
  }

  /** Массив ключей групп оружия. */
  static #weaponGroupList() {
    return new fields.ArrayField(
      new fields.StringField({ required: true, choices: () => DARPG.weaponGroups }),
      { required: true, initial: [] }
    );
  }

  /** @override */
  static defineSchema() {
    // Приватные статические методы брендируются на классе-объявителе — обращаемся к нему явно.
    const schema = super.defineSchema();
    return Object.assign(schema, {
      key: new fields.StringField({ required: true, initial: "warrior", choices: () => DARPG.classes }),
      primaryAbilities: DarpgClassData.#abilityList(),
      secondaryAbilities: DarpgClassData.#abilityList(),
      // База стартового Здоровья (30/25/20); реальный старт = база + ТЕЛ + 1d6.
      health: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 30, min: 0 }),
      // База стартовой Маны (10 у мага, иначе 0); реальный старт = база + МАГ + 1d6.
      mana: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 }),
      weaponGroups: new fields.SchemaField({
        granted: DarpgClassData.#weaponGroupList(),
        choose: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 }),
        options: DarpgClassData.#weaponGroupList()
      }),
      powers: new fields.ArrayField(
        new fields.SchemaField({
          level: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 1, min: 1, max: 20 }),
          name: new fields.StringField({ required: true, blank: true, initial: "" }),
          description: new fields.HTMLField({ required: true, blank: true, initial: "" })
        }),
        { required: true, initial: [] }
      )
    });
  }

  /**
   * Старая форма:
   *   startingHealth «30 + @abilities.constitution.value + 1d6» → health 30
   *     (нестандартная формула целиком дописывается в описание)
   *   mana отсутствовала         → из CONFIG.DARPG.classes[key].mana
   *   weaponGroups — свободный текст → текст в описание; weaponGroups = {granted: [], choose: 0, options: []}
   *   powers — HTML-таблица      → HTML в описание; powers = []
   * @inheritDoc
   */
  static migrateData(source, options) {
    const classConfig = DARPG.classes[source.key] ?? DARPG.classes.warrior;
    const isOld = ("startingHealth" in source) || (typeof source.weaponGroups === "string")
      || (typeof source.powers === "string");

    if ( "startingHealth" in source ) {
      const formula = String(source.startingHealth ?? "").trim();
      delete source.startingHealth;
      const base = formula.match(/-?\d+/);
      if ( !("health" in source) && (base || !isPartial(options)) ) {
        source.health = base ? Number(base[0]) : classConfig.health;
      }
      const tail = formula.replace(/\s+/g, "").replace(/^\d+/, "").toLowerCase();
      if ( formula && (!base || (tail !== STANDARD_HEALTH_TAIL)) ) {
        appendDescription(source, labeledText("DARPG.Migration.StartingHealth", "Starting Health", formula), options);
      }
    }
    // Базовую Ману выводим только для полного source: в частичном diff затёрли бы текущую.
    if ( isOld && !isPartial(options) && !("mana" in source) ) source.mana = classConfig.mana;

    if ( typeof source.weaponGroups === "string" ) {
      const text = source.weaponGroups;
      source.weaponGroups = { granted: [], choose: 0, options: [] };
      if ( !isEmptyMark(text) ) {
        appendDescription(source, labeledText("DARPG.Migration.WeaponGroups", "Weapon Groups", text), options);
      }
    }

    if ( typeof source.powers === "string" ) {
      const html = source.powers;
      source.powers = [];
      if ( html.trim() ) {
        appendDescription(source, labeledHTML("DARPG.Migration.ClassPowers", "Class Powers", html), options);
      }
    }
    return super.migrateData(source, options);
  }
}
