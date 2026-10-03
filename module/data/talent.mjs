import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные таланта: степень и описание каждой степени.
 */
export default class TalentData extends ItemBaseData {

  /** Поля степеней, общие для талантов и специализаций. */
  static degreeSchema() {
    return {
      degree: new fields.StringField({ required: true, initial: "novice", choices: Object.keys(DARPG.degrees) }),
      requirements: new fields.StringField({ required: true, blank: true, initial: "" }),
      descriptionNovice: new fields.HTMLField({ required: true, blank: true, initial: "" }),
      descriptionJourneyman: new fields.HTMLField({ required: true, blank: true, initial: "" }),
      descriptionMaster: new fields.HTMLField({ required: true, blank: true, initial: "" })
    };
  }

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, this.degreeSchema());
  }
}
