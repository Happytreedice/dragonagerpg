import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";
import {
  appendDescription, isEmptyMark, isPartial, labeledText, normalizeDice, renameField
} from "./migrations.mjs";

const fields = foundry.data.fields;

/** Старые ключи групп оружия (kebab-case) → новые; «чёрный порох» упразднён и сведён к лукам. */
const OLD_GROUPS = {
  "heavy-blades": "heavyBlades",
  "light-blades": "lightBlades",
  "black-powder": "bows"
};

/**
 * Старый ключ группы → новый (kebab-case → camelCase).
 * @param {string} group
 * @returns {string}
 */
function migrateGroup(group) {
  if ( typeof group !== "string" ) return group;
  return OLD_GROUPS[group] ?? group.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Старая строка дальности «30/60» → {short, long}. Текст без чисел возвращается в text.
 * @param {string} text
 * @returns {{short: number|null, long: number|null, text: string}}
 */
function parseRange(text) {
  const range = { short: null, long: null, text: "" };
  if ( isEmptyMark(text) ) return range;
  const numbers = String(text).match(/\d+/g);
  if ( numbers ) {
    range.short = Number(numbers[0]);
    if ( numbers.length > 1 ) range.long = Number(numbers[1]);
  }
  else range.text = String(text).trim();
  return range;
}

/**
 * Данные оружия. Характеристика атаки берётся из группы (CONFIG.DARPG.weaponGroups),
 * характеристика урона — из damage.ability.
 */
export default class WeaponData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    // Порядок полей = порядок ключей в YAML (tools/packs.mjs format): первые шесть — ровно
    // как в эталонном примере плана (packs/weapons/longsword.yaml), дополнительные — после.
    return Object.assign(schema, {
      weaponGroup: new fields.StringField({ required: true, initial: "lightBlades", choices: () => DARPG.weaponGroups }),
      damage: new fields.SchemaField({
        dice: new fields.StringField({ required: true, blank: true, initial: "1d6" }),
        ability: new fields.StringField({
          required: true, blank: true, initial: "strength", choices: () => DARPG.damageAbilities
        })
      }),
      type: new fields.StringField({ required: true, initial: "melee", choices: () => DARPG.weaponTypes }),
      // Минимальная Сила; null — «—» (требования нет).
      minStrength: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null }),
      cost: this.costField(),
      penetrating: new fields.BooleanField({ required: true, initial: false }),
      range: new fields.SchemaField({
        short: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null, min: 0 }),
        long: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null, min: 0 })
      }),
      reload: new fields.StringField({ required: true, blank: true, initial: "", choices: () => DARPG.reloadActions }),
      twoHanded: new fields.BooleanField({ required: true, initial: false }),
      quantity: this.quantityField(),
      equipped: this.equippedField()
    });
  }

  /**
   * Старая форма:
   *   group "heavy-blades"     → weaponGroup "heavyBlades" ("black-powder" → "bows")
   *   range "30/60"            → range {short: 30, long: 60}; type "ranged", если дальность была
   *   damage "2d6+1"           → damage {dice: "2d6+1", ability: bows ? "perception" : "strength"}
   *   minStr (−2 означало «—») → minStrength (null)
   *   price                    → cost
   *   attackAbility            → упразднён (берётся из группы)
   * @inheritDoc
   */
  static migrateData(source, options) {
    renameField(source, "group", "weaponGroup", migrateGroup);

    if ( typeof source.range === "string" ) {
      const { short, long, text } = parseRange(source.range);
      const ranged = (short !== null) || (long !== null) || !!text;
      if ( !("type" in source) ) source.type = ranged ? "ranged" : "melee";
      // Нечисловую дальность сохраняем в описании, чтобы не потерять.
      if ( text ) appendDescription(source, labeledText("DARPG.Migration.Range", "Range", text), options);
      source.range = { short, long };
    }

    if ( typeof source.damage === "string" ) {
      const damage = { dice: normalizeDice(source.damage) };
      // В частичном diff без группы характеристику урона не выводим — не затираем текущую.
      if ( !isPartial(options) || ("weaponGroup" in source) ) {
        damage.ability = (source.weaponGroup === "bows") ? "perception" : "strength";
      }
      source.damage = damage;
    }

    renameField(source, "minStr", "minStrength", value => {
      const number = Number(value);
      return ((value === null) || (value === "") || !Number.isFinite(number) || (number === -2)) ? null : number;
    });
    this._migrateCost(source);
    delete source.attackAbility;
    return super.migrateData(source, options);
  }

  /* -------------------------------------------- */

  /** Характеристика броска атаки — по группе оружия. */
  get attackAbility() {
    return DARPG.weaponGroups[this.weaponGroup]?.ability ?? "dexterity";
  }

  /** i18n-ключ подписи группы оружия. */
  get groupLabel() {
    return DARPG.weaponGroups[this.weaponGroup]?.label ?? "";
  }

  /** Дальнобойное ли оружие (стрелковое или метательное). */
  get isRanged() {
    return this.type === "ranged";
  }

  /** Дальность для отображения: «30/60», «16» или "" для оружия без дальности. */
  get rangeLabel() {
    const { short, long } = this.range;
    if ( (short === null) && (long === null) ) return "";
    if ( long === null ) return String(short);
    return `${short ?? "—"}/${long}`;
  }
}
