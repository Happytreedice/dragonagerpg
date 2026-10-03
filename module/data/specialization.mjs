import TalentData from "./talent.mjs";
import { DARPG } from "../config.mjs";
import { isPartial } from "./migrations.mjs";

const fields = foundry.data.fields;

/**
 * Данные специализации: поля таланта плюс класс, к которому она относится.
 */
export default class SpecializationData extends TalentData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      class: new fields.StringField({ required: true, initial: "warrior", choices: () => DARPG.classes })
    });
  }

  /**
   * Старая форма — как у таланта; classes отсутствовали → [class] (специализация доступна
   * только своему классу). Остальное мигрирует TalentData.
   * @inheritDoc
   */
  static migrateData(source, options) {
    const isOld = ["requirements", "descriptionNovice", "descriptionJourneyman", "descriptionMaster"]
      .some(key => key in source);
    const hasClass = (typeof source.class === "string") && (source.class in DARPG.classes);
    if ( isOld && !isPartial(options) && !("classes" in source) && hasClass ) source.classes = [source.class];
    return super.migrateData(source, options);
  }
}
