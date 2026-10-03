/**
 * Бросок AGE: 3d6 + характеристика + фокус + модификатор против TN.
 * Третий куб — Драконий: при любом дубле на трёх кубах он определяет
 * количество стант-поинтов.
 */
export default class AgeRoll extends foundry.dice.Roll {

  /** @override */
  static CHAT_TEMPLATE = "systems/darpg/templates/chat/age-roll.hbs";

  /** Бонус обычного фокуса (+2) из CONFIG.DARPG. */
  static get defaultFocusBonus() {
    return CONFIG.DARPG?.focusBonus ?? 2;
  }

  /**
   * Собрать бросок теста AGE.
   * @param {object} config
   * @param {number} [config.abilityValue=0]      Значение характеристики (или итоговый бонус атаки НИП).
   * @param {string} [config.abilityLabel=""]     Локализованное название характеристики.
   * @param {string} [config.focusName=""]        Название применённого фокуса (пусто — без фокуса).
   * @param {number|null} [config.focusBonus=null]  Бонус фокуса: +2, улучшенный +3 (null — +2 по умолчанию).
   * @param {number} [config.modifier=0]          Ситуативный модификатор.
   * @param {number|null} [config.targetNumber=null]  Целевое число (TN), если задано.
   * @param {string} [config.targetName=""]       Имя цели (для атак).
   * @param {string} [config.flavor=""]           Заголовок карточки в чате.
   * @returns {AgeRoll}
   */
  static fromTest({ abilityValue = 0, abilityLabel = "", focusName = "", focusBonus = null, modifier = 0,
    targetNumber = null, targetName = "", flavor = "" } = {}) {
    // Числа подставляются со знаком, чтобы формула оставалась валидной и читаемой
    const signed = n => (n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`);
    const bonus = focusName ? (Number.isFinite(focusBonus) ? focusBonus : this.defaultFocusBonus) : 0;
    let formula = `3d6 ${signed(abilityValue)}`;
    if ( bonus ) formula += ` ${signed(bonus)}`;
    if ( modifier ) formula += ` ${signed(modifier)}`;
    return new this(formula, {}, {
      abilityValue, abilityLabel, focusName, focusBonus: bonus, modifier, targetNumber, targetName, flavor
    });
  }

  /** Значения трёх кубов d6 (после evaluate). */
  get d6Results() {
    const die = this.dice[0];
    return die?.results.filter(r => r.active).map(r => r.result) ?? [];
  }

  /** Значение Драконьего куба (третий куб). */
  get dragonDie() {
    return this.d6Results[2] ?? null;
  }

  /** Есть ли дубль среди трёх кубов. */
  get hasDoubles() {
    const results = this.d6Results;
    return (results.length === 3) && (new Set(results).size < 3);
  }

  /** Стант-поинты: значение Драконьего куба при дубле, иначе 0. */
  get stuntPoints() {
    return this.hasDoubles ? (this.dragonDie ?? 0) : 0;
  }

  /** Успех против TN: true/false либо null, если TN не задано. */
  get isSuccess() {
    const tn = this.options.targetNumber;
    if ( (tn === null) || (tn === undefined) || (tn === "") ) return null;
    return this.total >= Number(tn);
  }

  /** @override */
  async _prepareChatRenderContext({ flavor, isPrivate = false, ...options } = {}) {
    const context = await super._prepareChatRenderContext({ flavor, isPrivate, ...options });
    if ( isPrivate ) return context;
    const o = this.options;
    const results = this.d6Results;
    const success = this.isSuccess;
    // Сообщения старых версий не хранят focusBonus — для них фокус давал +2.
    const focusBonus = o.focusName ? (Number.isFinite(o.focusBonus) ? o.focusBonus : AgeRoll.defaultFocusBonus) : 0;
    return Object.assign(context, {
      isAge: true,
      dice: results.map((value, i) => ({ value, isDragon: i === 2 })),
      diceTotal: results.reduce((sum, v) => sum + v, 0),
      abilityLabel: o.abilityLabel || null,
      abilityValue: o.abilityValue ?? 0,
      focusName: o.focusName || null,
      focusBonus,
      modifier: o.modifier || 0,
      hasDoubles: this.hasDoubles,
      stuntPoints: this.stuntPoints,
      targetNumber: (o.targetNumber === null || o.targetNumber === undefined || o.targetNumber === "")
        ? null : Number(o.targetNumber),
      targetName: o.targetName || null,
      outcome: (success === null) ? null : (success ? "success" : "failure"),
      outcomeLabel: (success === null) ? null
        : game.i18n.localize(success ? "DARPG.Roll.Success" : "DARPG.Roll.Failure")
    });
  }
}
