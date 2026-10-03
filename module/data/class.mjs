import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные класса: первичные/вторичные характеристики, стартовое Health,
 * группы оружия, поуровневые силы. spec §5.
 */
export default class DarpgClassData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      key: new fields.StringField({ required: true, initial: "warrior", choices: Object.keys(DARPG.classes) }),
      primaryAbilities: new fields.ArrayField(
        new fields.StringField({ choices: Object.keys(DARPG.abilities) }),
        { required: true, initial: [] }
      ),
      secondaryAbilities: new fields.ArrayField(
        new fields.StringField({ choices: Object.keys(DARPG.abilities) }),
        { required: true, initial: [] }
      ),
      // Стартовое Health как формула (напр. «30 + @abilities.constitution.value + 1d6»).
      startingHealth: new fields.StringField({ required: true, blank: true, initial: "" }),
      weaponGroups: new fields.StringField({ required: true, blank: true, initial: "" }),
      // Поуровневые силы класса — HTML-таблица уровней 1–20. spec §5.2–5.4.
      powers: new fields.HTMLField({ required: true, blank: true, initial: "" })
    });
  }
}
