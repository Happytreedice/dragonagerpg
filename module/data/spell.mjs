import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";
import { isEmptyMark, renameField } from "./migrations.mjs";

const fields = foundry.data.fields;

/** Старые русские значения времени сотворения → новые (сравнение без учёта регистра). */
const OLD_CAST_TIMES = {
  "основное действие": "major",
  "малое действие": "minor",
  "1 минута": "1 minute",
  "5 минут": "5 minutes",
  "1 час": "1 hour"
};

/**
 * Старое время сотворения → новое: известные фразы по таблице, «N минут/часов» по шаблону,
 * прочий текст — как есть.
 * @param {string} text
 * @returns {string}   "" — значение не задано (останется начальное "major").
 */
function migrateCastTime(text) {
  const str = String(text ?? "").trim();
  if ( isEmptyMark(str) ) return "";
  const lower = str.toLowerCase();
  if ( lower in OLD_CAST_TIMES ) return OLD_CAST_TIMES[lower];
  const match = lower.match(/^(\d+)\s*(мин|минута|минуты|минут|час|часа|часов)\.?$/u);
  if ( !match ) return str;
  const count = Number(match[1]);
  const unit = match[2].startsWith("мин") ? "minute" : "hour";
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/**
 * Старая стоимость маны строкой («10+», «3–8») → число и примечание после него.
 * @param {string} text
 * @returns {{cost: number, note: string}}
 */
function parseManaCost(text) {
  const str = String(text ?? "").trim();
  if ( isEmptyMark(str) ) return { cost: 0, note: "" };
  const match = str.match(/^(\d+)\s*(.*)$/su);
  // Тире диапазона «3–8» (U+2013/U+2014) → дефис, как в нотации схемы («3-8»).
  if ( match ) return { cost: Number(match[1]), note: match[2].trim().replace(/[–—]/g, "-") };
  return { cost: 0, note: str };
}

/**
 * Данные заклинания.
 */
export default class SpellData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      // Порядок полей = порядок ключей в YAML: как в эталонном примере плана
      // (packs/spells/mana-cleanse.yaml); manaCostNote — дополнительное поле, в конце.
      school: new fields.StringField({ required: true, initial: "creation", choices: () => DARPG.schools }),
      spellType: new fields.StringField({ required: true, initial: "attack", choices: () => DARPG.spellTypes }),
      manaCost: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 1, min: 0 }),
      // "major" | "minor" | свободный текст («1 minute»); пустое значение сбрасывается в "major".
      castTime: new fields.StringField({ required: true, blank: false, initial: "major" }),
      // Сложность сотворения; null — не указана.
      tn: new fields.NumberField({ required: true, integer: true, nullable: true, initial: null, min: 0 }),
      requirement: new fields.StringField({ required: true, blank: true, initial: "" }),
      // Тест цели простым текстом, напр. «Constitution (Stamina) vs. Spellpower»; пустое → "None".
      test: new fields.StringField({ required: true, blank: false, initial: "None" }),
      // Суффикс сразу после числа: "+" для «10+», "-9" для диапазона «3-9».
      manaCostNote: new fields.StringField({ required: true, blank: true, initial: "" })
    });
  }

  /**
   * Старая форма:
   *   manaCost "10+"                 → manaCost 10, manaCostNote "+"
   *   castingTime «Основное действие» → castTime "major" (и др., см. OLD_CAST_TIMES)
   *   targetNumber (0 — не указан)   → tn (null)
   *   requirements («—» — нет)       → requirement ("")
   *   test «—»                       → test "None"
   * @inheritDoc
   */
  static migrateData(source, options) {
    const isOld = ["castingTime", "targetNumber", "requirements"].some(key => key in source);

    if ( typeof source.manaCost === "string" ) {
      const { cost, note } = parseManaCost(source.manaCost);
      source.manaCost = cost;
      if ( note && !("manaCostNote" in source) ) source.manaCostNote = note;
    }

    if ( "castingTime" in source ) {
      const castTime = migrateCastTime(source.castingTime);
      delete source.castingTime;
      if ( castTime && !("castTime" in source) ) source.castTime = castTime;
    }

    renameField(source, "targetNumber", "tn", value => {
      const number = Number(value);
      return ((value === null) || (value === "") || !Number.isFinite(number) || (number <= 0)) ? null : number;
    });
    renameField(source, "requirements", "requirement", value => (isEmptyMark(value) ? "" : value));
    if ( isOld && isEmptyMark(source.test) ) source.test = "None";
    return super.migrateData(source, options);
  }

  /* -------------------------------------------- */

  /** Стоимость маны для отображения: «10+», «3–8», «5». */
  get manaCostLabel() {
    return `${this.manaCost}${this.manaCostNote}`;
  }

  /**
   * Числовая стоимость маны (синоним manaCost для кода, писавшегося под строковое поле).
   * @type {number}
   */
  get manaCostNumber() {
    return this.manaCost;
  }

  /** Время сотворения для отображения: i18n-ключ для major/minor, иначе свободный текст. */
  get castTimeLabel() {
    return DARPG.castTimes[this.castTime] ?? this.castTime;
  }
}
