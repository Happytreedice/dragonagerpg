import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";
import { isPartial, renameField } from "./migrations.mjs";

const fields = foundry.data.fields;

/**
 * Тип щита по бонусу к Защите: 1 → light, 2 → medium, 3 → heavy (иначе — ближайший снизу).
 * @param {number} bonus
 * @returns {string}
 */
function shieldTypeFromBonus(bonus) {
  const keys = Object.keys(DARPG.shieldTypes);
  let best = keys[0] ?? "light";
  for ( const key of keys ) {
    if ( DARPG.shieldTypes[key].shieldBonus <= bonus ) best = key;
  }
  return best;
}

/**
 * Данные щита: тип и бонус к Защите (+1/+2/+3).
 */
export default class ShieldData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      shieldType: new fields.StringField({ required: true, initial: "light", choices: () => DARPG.shieldTypes }),
      shieldBonus: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 1, min: 0, max: 3 }),
      cost: this.costField(),
      equipped: this.equippedField()
    });
  }

  /**
   * Старая форма:
   *   defenseBonus 1/2/3 → shieldBonus; shieldType light/medium/heavy по нему
   *   price              → cost
   * @inheritDoc
   */
  static migrateData(source, options) {
    if ( "defenseBonus" in source ) {
      // Тип выводим только для полного source: в частичном diff затёрли бы текущий.
      if ( !isPartial(options) && !("shieldType" in source) ) {
        source.shieldType = shieldTypeFromBonus(Number(source.defenseBonus));
      }
      renameField(source, "defenseBonus", "shieldBonus");
    }
    this._migrateCost(source);
    return super.migrateData(source, options);
  }
}
