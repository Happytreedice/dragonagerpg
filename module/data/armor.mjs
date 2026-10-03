import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";
import { isPartial, renameField } from "./migrations.mjs";

const fields = foundry.data.fields;

/**
 * Тип брони по старому показателю брони — только по таблице CONFIG.DARPG.armorTypes (SCHEMA.md §3):
 * точное совпадение (3 → lightLeather, 4 → heavyLeather, 5 → lightMail, 7 → heavyMail, 8 → lightPlate,
 * 10 → heavyPlate), иначе — ближайший снизу; ниже всех табличных — первый тип таблицы.
 * Старую категорию (light/medium/heavy/plate) не учитываем: в старом листе она по умолчанию
 * была «light» независимо от показателя.
 * @param {number} rating   Старый показатель брони.
 * @returns {string}
 */
function armorTypeFromRating(rating) {
  let best = Object.keys(DARPG.armorTypes)[0] ?? "lightLeather";
  let bestRating = -Infinity;
  for ( const [key, { armorRating }] of Object.entries(DARPG.armorTypes) ) {
    if ( (armorRating <= rating) && (armorRating > bestRating) ) {
      best = key;
      bestRating = armorRating;
    }
  }
  return best;
}

/**
 * Данные брони: тип по таблице книги, показатель брони, штраф (магнитуда) и напряжение
 * (доп. мана за заклинание).
 */
export default class ArmorData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      armorType: new fields.StringField({ required: true, initial: "lightLeather", choices: () => DARPG.armorTypes }),
      armorRating: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 3, min: 0 }),
      // Магнитуда штрафа: Скорость = база + ЛОВ − armorPenalty.
      armorPenalty: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: 0 }),
      // Напряжение: дополнительная мана за каждое заклинание в этой броне.
      strain: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 1, min: 0 }),
      cost: this.costField(),
      equipped: this.equippedField()
    });
  }

  /**
   * Старая форма:
   *   rating, penalty     → armorRating, armorPenalty
   *   type (light/medium/heavy/plate) → упразднён; armorType — по старому показателю брони
   *   strain отсутствовал → из таблицы CONFIG.DARPG.armorTypes
   *   price               → cost
   * @inheritDoc
   */
  static migrateData(source, options) {
    if ( ("rating" in source) || ("penalty" in source) || ("type" in source) ) {
      // Тип и напряжение выводим только для полного source: в частичном diff затёрли бы текущие.
      if ( !isPartial(options) ) {
        const rating = Number(source.rating ?? source.armorRating);
        if ( !("armorType" in source) ) source.armorType = armorTypeFromRating(rating);
        if ( !("strain" in source) ) source.strain = DARPG.armorTypes[source.armorType]?.strain ?? 1;
      }
      renameField(source, "rating", "armorRating");
      renameField(source, "penalty", "armorPenalty");
      delete source.type;
    }
    this._migrateCost(source);
    return super.migrateData(source, options);
  }
}
