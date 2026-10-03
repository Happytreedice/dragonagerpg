import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные оружия.
 */
export default class WeaponData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      group: new fields.StringField({ required: true, initial: "light-blades", choices: Object.keys(DARPG.weaponGroups) }),
      damage: new fields.StringField({ required: true, blank: true, initial: "1d6" }),
      attackAbility: new fields.StringField({ required: true, initial: "dexterity", choices: Object.keys(DARPG.abilities) }),
      range: new fields.StringField({ required: true, blank: true, initial: "" }),
      minStr: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 0, min: -2 }),
      equipped: this.equippedField(),
      price: this.priceField()
    });
  }

  /** Дальнобойное ли оружие (урон без бонуса Силы). */
  get isRanged() {
    return DARPG.rangedGroups.includes(this.group);
  }
}
