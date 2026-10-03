import AgeRoll from "../dice/age-roll.mjs";
import { promptTest } from "../dialogs/test-dialog.mjs";

/**
 * Актёр Dragon Age RPG: производные значения и тесты характеристик.
 */
export default class DarpgActor extends foundry.documents.Actor {

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    const system = this.system;
    const dex = system.abilities.dexterity.value;
    system.spellpower = 10 + system.abilities.magic.value;

    // НИП/существа: параметры заданы в статблоке; null → вычислить по формуле.
    if ( this.type === "npc" ) {
      if ( system.defense === null ) system.defense = 10 + dex;
      if ( system.speed === null ) system.speed = Math.max(0, 10 + dex);
      system.armorPenalty = 0;
      return;
    }

    // Персонаж: Защита/Броня/Скорость от экипированных предметов
    let shieldBonus = 0;
    let armorRating = 0;
    let armorPenalty = 0;
    for ( const item of this.items ) {
      if ( !item.system.equipped ) continue;
      if ( item.type === "shield" ) shieldBonus = Math.max(shieldBonus, item.system.defenseBonus ?? 0);
      else if ( item.type === "armor" ) {
        armorRating += item.system.rating ?? 0;
        armorPenalty += item.system.penalty ?? 0;
      }
    }

    system.armorRating = armorRating;
    system.armorPenalty = armorPenalty;
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

  /**
   * Фокусы актёра для заданной характеристики.
   * @param {string} ability   Ключ характеристики.
   * @returns {{name: string, ability: string}[]}
   */
  focusesFor(ability) {
    return this.system.focuses.filter(f => (f.ability === ability) && f.name?.trim());
  }

  /**
   * Найти фокус по названию (без учёта регистра).
   * @param {string} name
   * @returns {{name: string, ability: string}|null}
   */
  findFocus(name) {
    const needle = String(name ?? "").trim().toLocaleLowerCase();
    if ( !needle ) return null;
    return this.system.focuses.find(f => f.name?.trim().toLocaleLowerCase() === needle) ?? null;
  }

  /**
   * Тест характеристики: диалог параметров, бросок AgeRoll, карточка в чат.
   * @param {string} abilityId                    Ключ характеристики.
   * @param {object} [options]
   * @param {string|null} [options.defaultFocus=null]   Предвыбранный фокус.
   * @param {number|null} [options.targetNumber=null]   Предзаполненное TN.
   * @param {string|null} [options.flavor=null]         Заголовок карточки.
   * @param {string} [options.targetName=""]            Имя цели (для атак).
   * @returns {Promise<ChatMessage|null>}
   */
  async rollAbility(abilityId, { defaultFocus = null, targetNumber = null, flavor = null, targetName = "" } = {}) {
    const abilityKey = CONFIG.DARPG.abilities[abilityId];
    if ( !abilityKey ) return null;
    const abilityLabel = game.i18n.localize(abilityKey);
    const title = flavor ?? game.i18n.format("DARPG.Roll.TestTitle", { ability: abilityLabel });

    const config = await promptTest({ actor: this, ability: abilityId, title, defaultFocus, targetNumber });
    if ( !config ) return null;

    const roll = AgeRoll.fromTest({
      abilityValue: this.system.abilities[abilityId].value,
      abilityLabel,
      focusName: config.focus,
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
