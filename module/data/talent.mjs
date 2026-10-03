import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";
import { classesFromMark, isEmptyMark, isPartial, renameField } from "./migrations.mjs";

const fields = foundry.data.fields;

/** Старые поля описаний степеней → ключи degrees. */
const OLD_DEGREE_FIELDS = {
  descriptionNovice: "novice",
  descriptionJourneyman: "journeyman",
  descriptionMaster: "master"
};

/**
 * Данные таланта: классы, которым он доступен, требование, степень владельца
 * и описание каждой степени.
 */
export default class TalentData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      classes: new fields.ArrayField(
        new fields.StringField({ required: true, choices: () => DARPG.classes }),
        { required: true, initial: [] }
      ),
      requirement: new fields.StringField({ required: true, blank: true, initial: "" }),
      // Степень, которой владеет персонаж (в компендиуме — "novice").
      degree: new fields.StringField({ required: true, initial: "novice", choices: () => DARPG.degrees }),
      degrees: new fields.SchemaField({
        novice: new fields.HTMLField({ required: true, blank: true, initial: "" }),
        journeyman: new fields.HTMLField({ required: true, blank: true, initial: "" }),
        master: new fields.HTMLField({ required: true, blank: true, initial: "" })
      })
    });
  }

  /**
   * Старая форма:
   *   requirements («—» — нет)                → requirement ("")
   *   descriptionNovice/Journeyman/Master     → degrees.novice/journeyman/master
   *   classes отсутствовали                   → из отметки «(М/Р/В)» в конце описания, если она есть
   * @inheritDoc
   */
  static migrateData(source, options) {
    const isOld = ["requirements", ...Object.keys(OLD_DEGREE_FIELDS)].some(key => key in source);
    if ( isOld && !isPartial(options) && !("classes" in source) ) {
      const classes = classesFromMark(source.description);
      if ( classes ) source.classes = classes;
    }

    renameField(source, "requirements", "requirement", value => (isEmptyMark(value) ? "" : value));

    for ( const [oldKey, degree] of Object.entries(OLD_DEGREE_FIELDS) ) {
      if ( !(oldKey in source) ) continue;
      const value = source[oldKey];
      delete source[oldKey];
      if ( !source.degrees || (typeof source.degrees !== "object") ) source.degrees = {};
      if ( !(degree in source.degrees) ) source.degrees[degree] = value ?? "";
    }
    return super.migrateData(source, options);
  }

  /* -------------------------------------------- */

  /** Ключи степеней, действующих при текущей степени владельца (новичок … текущая включительно). */
  get activeDegrees() {
    const keys = Object.keys(DARPG.degrees);
    return keys.slice(0, keys.indexOf(this.degree) + 1);
  }
}
