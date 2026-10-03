import AgeRoll from "../dice/age-roll.mjs";
import { promptTest } from "../dialogs/test-dialog.mjs";
import { rollDamageFormula } from "../dice/damage.mjs";

/**
 * Актёр Dragon Age RPG: производные значения и тесты характеристик.
 */
export default class DarpgActor extends foundry.documents.Actor {

  /* -------------------------------------------- */
  /*  Справочные помощники                        */
  /* -------------------------------------------- */

  /**
   * Ключ характеристики по ключу или сокращению: "strength", "str", "wp" → ключ CONFIG.DARPG.abilities.
   * @param {string} value
   * @returns {string|null}   Ключ характеристики либо null, если не распознано.
   */
  static resolveAbility(value) {
    const { abilities, abilityAbbreviations = {} } = CONFIG.DARPG;
    const key = String(value ?? "").trim().toLowerCase();
    if ( !key ) return null;
    if ( Object.hasOwn(abilities, key) ) return key;
    const resolved = Object.hasOwn(abilityAbbreviations, key) ? abilityAbbreviations[key] : null;
    return (resolved && Object.hasOwn(abilities, resolved)) ? resolved : null;
  }

  /**
   * Локализованное название характеристики.
   * @param {string} abilityId
   * @returns {string}
   */
  static abilityLabel(abilityId) {
    const entry = CONFIG.DARPG.abilities[abilityId];
    const key = (typeof entry === "string") ? entry : (entry?.label ?? "");
    return key ? game.i18n.localize(key) : "";
  }

  /**
   * Бонус фокуса к тесту: +2, улучшенный (взят повторно с 11 уровня) — +3.
   * @param {{improved?: boolean}|null} focus
   * @returns {number}  0, если фокуса нет.
   */
  static focusBonus(focus) {
    if ( !focus ) return 0;
    const { focusBonus = 2, improvedFocusBonus = 3 } = CONFIG.DARPG;
    return focus.improved ? improvedFocusBonus : focusBonus;
  }

  /* -------------------------------------------- */
  /*  Подготовка данных                           */
  /* -------------------------------------------- */

  /**
   * Производные значения (не хранятся): Сила заклинаний, Защита, Скорость, Броня,
   * штраф брони (armorPenalty) и напряжение брони (strain — только показ; применение
   * напряжения к сотворению — следующий этап).
   * @override
   */
  prepareDerivedData() {
    super.prepareDerivedData();
    const system = this.system;
    const dex = system.abilities.dexterity?.value ?? 0;
    system.spellpower = 10 + (system.abilities.magic?.value ?? 0);

    // НИП/существа: параметры заданы в статблоке; null → вычислить по формуле.
    if ( this.type === "npc" ) {
      if ( (system.defense === null) || (system.defense === undefined) ) system.defense = 10 + dex;
      if ( (system.speed === null) || (system.speed === undefined) ) system.speed = Math.max(0, 10 + dex);
      system.armorPenalty = 0;
      system.strain = 0;
      return;
    }

    // Персонаж: Защита/Броня/Скорость/напряжение от экипированных предметов
    let shieldBonus = 0;
    let armorRating = 0;
    let armorPenalty = 0;
    let strain = 0;
    for ( const item of this.items ) {
      if ( !item.system.equipped ) continue;
      if ( item.type === "shield" ) shieldBonus = Math.max(shieldBonus, item.system.shieldBonus ?? 0);
      else if ( item.type === "armor" ) {
        armorRating += item.system.armorRating ?? 0;
        armorPenalty += item.system.armorPenalty ?? 0;
        strain += item.system.strain ?? 0;
      }
    }

    system.armorRating = armorRating;
    system.armorPenalty = armorPenalty;
    system.strain = strain;
    system.defense = 10 + dex + shieldBonus;
    system.speed = Math.max(0, 10 + dex - armorPenalty);
  }

  /** @override */
  getRollData() {
    const data = super.getRollData();
    // `@dragonDie` встречается в формулах книги; в обычном броске Драконьего куба нет —
    // безопасный дефолт 0, чтобы формула валидировалась. Энричеры урона/лечения
    // подставляют реальный 1d6 вместо @dragonDie (dice/damage.mjs).
    data.dragonDie ??= 0;
    return data;
  }

  /* -------------------------------------------- */
  /*  Фокусы                                      */
  /* -------------------------------------------- */

  /**
   * Именованные фокусы актёра для заданной характеристики.
   * @param {string} ability   Ключ характеристики.
   * @returns {{name: string, ability: string, improved: boolean}[]}
   */
  focusesFor(ability) {
    return this.system.focuses.filter(f => (f.ability === ability) && f.name?.trim());
  }

  /**
   * Найти фокус по названию (без учёта регистра), опционально — только у одной характеристики.
   * @param {string} name
   * @param {string|null} [ability=null]
   * @returns {{name: string, ability: string, improved: boolean}|null}
   */
  findFocus(name, ability = null) {
    const needle = String(name ?? "").trim().toLocaleLowerCase();
    if ( !needle ) return null;
    return this.system.focuses.find(f => (!ability || (f.ability === ability))
      && (f.name?.trim().toLocaleLowerCase() === needle)) ?? null;
  }

  /* -------------------------------------------- */
  /*  Броски                                      */
  /* -------------------------------------------- */

  /**
   * Тест характеристики: диалог параметров, бросок AgeRoll, карточка в чат.
   * Бонус выбранного фокуса: +2, улучшенного — +3.
   * @param {string} abilityId                    Ключ (или сокращение) характеристики.
   * @param {object} [options]
   * @param {string|null} [options.defaultFocus=null]   Предвыбранный фокус.
   * @param {number|null} [options.targetNumber=null]   Предзаполненное TN.
   * @param {string|null} [options.flavor=null]         Заголовок карточки.
   * @param {string} [options.targetName=""]            Имя цели (для атак).
   * @returns {Promise<ChatMessage|null>}
   */
  async rollAbility(abilityId, { defaultFocus = null, targetNumber = null, flavor = null, targetName = "" } = {}) {
    const ability = DarpgActor.resolveAbility(abilityId);
    if ( !ability ) return null;
    const abilityLabel = DarpgActor.abilityLabel(ability);
    const title = flavor ?? game.i18n.format("DARPG.Roll.TestTitle", { ability: abilityLabel });

    const config = await promptTest({ actor: this, ability, title, defaultFocus, targetNumber });
    if ( !config ) return null;

    // Выбранный фокус ищется у этой характеристики: улучшенный даёт +3 вместо +2.
    const focus = config.focus ? (this.findFocus(config.focus, ability) ?? { improved: false }) : null;
    const roll = AgeRoll.fromTest({
      abilityValue: this.system.abilities[ability].value,
      abilityLabel,
      focusName: config.focus,
      focusBonus: DarpgActor.focusBonus(focus),
      modifier: config.modifier,
      targetNumber: config.targetNumber,
      targetName,
      flavor: title
    });
    await roll.evaluate();

    // Дубль на кубах генерирует стант-поинты (значение Драконьего куба) — копим в пул.
    await this.gainStuntPoints(roll.stuntPoints);

    const ChatMessageCls = foundry.utils.getDocumentClass("ChatMessage");
    return roll.toMessage({
      speaker: ChatMessageCls.getSpeaker({ actor: this }),
      flavor: title
    });
  }

  /**
   * Атака из статблока НИП: 3d6 + итоговый бонус атаки (attackRoll, как напечатан)
   * против Защиты первой нацеленной цели.
   * @param {number} index   Индекс атаки в system.attacks.
   * @returns {Promise<ChatMessage|null>}
   */
  async rollStatblockAttack(index) {
    const attack = this.system.attacks?.[index];
    if ( !attack ) return null;
    const name = attack.name?.trim() || game.i18n.localize("DARPG.Sheet.Attack");
    const title = game.i18n.format("DARPG.Roll.AttackWith", { name });

    // TN из Защиты первой выбранной цели
    const target = game.user.targets.first() ?? null;
    const targetDefense = target?.actor?.system?.defense ?? null;

    const config = await promptTest({ actor: this, title, targetNumber: targetDefense, withFocus: false });
    if ( !config ) return null;

    const roll = AgeRoll.fromTest({
      abilityValue: Number(attack.attackRoll) || 0,
      abilityLabel: game.i18n.localize("DARPG.Sheet.AttackRoll"),
      modifier: config.modifier,
      targetNumber: config.targetNumber,
      targetName: target?.name ?? "",
      flavor: title
    });
    await roll.evaluate();
    await this.gainStuntPoints(roll.stuntPoints);

    const ChatMessageCls = foundry.utils.getDocumentClass("ChatMessage");
    return roll.toMessage({
      speaker: ChatMessageCls.getSpeaker({ actor: this }),
      flavor: title
    });
  }

  /**
   * Урон атаки из статблока НИП: формула как напечатана (итог, включая характеристику).
   * @param {number} index   Индекс атаки в system.attacks.
   * @returns {Promise<ChatMessage|null>}
   */
  async rollStatblockDamage(index) {
    const attack = this.system.attacks?.[index];
    if ( !attack ) return null;
    const name = attack.name?.trim() || game.i18n.localize("DARPG.Sheet.Attack");
    return rollDamageFormula({
      formula: attack.damage?.trim() || "1d6",
      actor: this,
      penetrating: !!attack.penetrating,
      flavor: game.i18n.format("DARPG.Roll.DamageFor", { name })
    });
  }

  /**
   * Пополнить пул стант-поинтов результатом броска с дублем.
   * @param {number} points   Сгенерированные SP (0 — дубля не было, обновления нет).
   * @returns {Promise<void>}
   */
  async gainStuntPoints(points) {
    if ( !(points > 0) ) return;
    await this.update({
      "system.stuntPoints.value": (this.system.stuntPoints?.value ?? 0) + points,
      "system.stuntPoints.max": points
    });
  }
}
