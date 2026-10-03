import ItemBaseData from "./item-base.mjs";
import { DARPG } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Данные стант-приёма: тип и стоимость в SP. cost — минимальная стоимость (число, для сортировки
 * и расчётов), costText — запись книги, если она отличается от числа («1-3», «1+»).
 */
export default class StuntData extends ItemBaseData {

  /** @override */
  static defineSchema() {
    const schema = super.defineSchema();
    return Object.assign(schema, {
      stuntType: new fields.StringField({ required: true, initial: "combat", choices: () => DARPG.stuntTypes }),
      cost: new fields.NumberField({ required: true, integer: true, nullable: false, initial: 2, min: 0 }),
      // "" — стоимость равна cost; иначе запись книги: «1-3», «1+».
      costText: new fields.StringField({ required: true, blank: true, initial: "" })
    });
  }

  /**
   * Старая форма:
   *   stuntType "special"        → упразднён, "combat"
   *   costText «2» при cost 2    → "" (совпадает с числом); «1–3» → «1-3»
   * @inheritDoc
   */
  static migrateData(source, options) {
    // Тип «особый» упразднён: без замены значение не прошло бы проверку choices.
    if ( source.stuntType === "special" ) source.stuntType = "combat";
    // Старая запись стоимости — только у документа старой формы (описание ещё строкой).
    if ( (typeof source.description === "string") && (typeof source.costText === "string") ) {
      const text = source.costText.trim().replace(/\s*[–—]\s*/gu, "-");
      const sameAsCost = (typeof source.cost === "number") && (text === String(source.cost));
      source.costText = sameAsCost ? "" : text;
    }
    return super.migrateData(source, options);
  }

  /* -------------------------------------------- */

  /** Стоимость для отображения: «2», «1-3», «1+». */
  get costLabel() {
    return this.costText || String(this.cost);
  }
}
