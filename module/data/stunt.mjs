import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные стант-приёма: тип (боевой/исследовательский/разговорный/
 * заклинательный/продвинутый заклинательный/особый) и стоимость в SP. spec §3.2–3.4, §10.5–10.6.
 */
export default class StuntData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      stuntType: new fields.StringField({ required: true, initial: "combat", choices: Object.keys(DARPG.stuntTypes) }),
      // Стоимость свободным текстом: «2», «1+», «1–3». Числовое значение — cost, для сортировки.
      costText: new fields.StringField({ required: true, blank: true, initial: "2" }),
      cost: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 2, min: 0 })
    });
  }
}
