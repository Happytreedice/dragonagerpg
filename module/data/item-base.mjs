const fields = foundry.data.fields;

/**
 * Общее ядро данных предметов: описание.
 */
export default class ItemBaseData extends foundry.abstract.TypeDataModel {

  /** Поле цены (свободный текст: «15 см», «3 зм» и т.п.). */
  static priceField() {
    return new fields.StringField({ required: true, blank: true, initial: "" });
  }

  /** Поле флага экипировки. */
  static equippedField() {
    return new fields.BooleanField({ required: true, initial: false });
  }

  /** @override */
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: true, blank: true, initial: "" }),
      // Сноска на оригинальную книгу правил (напр. «Core Rulebook, p. 112»), см. README §2.2/§4.2.
      source: new fields.StringField({ required: true, blank: true, initial: "" })
    };
  }
}
