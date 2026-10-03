import TalentData from "./talent.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные специализации: как талант, плюс привязка к классу.
 */
export default class SpecializationData extends TalentData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      class: new fields.StringField({ required: true, initial: "warrior", choices: Object.keys(DARPG.classes) })
    });
  }
}
