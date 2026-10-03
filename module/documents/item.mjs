import AgeRoll from "../dice/age-roll.mjs";
import { promptTest } from "../dialogs/test-dialog.mjs";
import { rollDamageFormula } from "../dice/damage.mjs";

/**
 * Предмет Dragon Age RPG: атака оружием, урон, сотворение заклинаний.
 */
export default class DarpgItem extends foundry.documents.Item {

  /** Класс сообщений чата. */
  static get #chatMessageCls() {
    return foundry.utils.getDocumentClass("ChatMessage");
  }

  /** Предупредить, если предмет не принадлежит актёру. */
  #requireActor() {
    if ( this.actor ) return this.actor;
    ui.notifications.warn(game.i18n.localize("DARPG.Roll.NoActor"));
    return null;
  }

  /**
   * Атака оружием: 3d6 + характеристика атаки + фокус группы против Защиты цели.
   * @returns {Promise<ChatMessage|null>}
   */
  async rollAttack() {
    if ( this.type !== "weapon" ) return null;
    const actor = this.#requireActor();
    if ( !actor ) return null;
    const system = this.system;

    // Фокус по умолчанию: фокус актёра, совпадающий с группой оружия
    const groupLabel = game.i18n.localize(CONFIG.DARPG.weaponGroups[system.group] ?? "");
    const defaultFocus = (actor.findFocus(groupLabel) ?? actor.findFocus(system.group))?.name ?? null;

    // TN из Защиты первой выбранной цели
    const target = game.user.targets.first() ?? null;
    const targetDefense = target?.actor?.system?.defense ?? null;

    const abilityId = system.attackAbility in CONFIG.DARPG.abilities ? system.attackAbility : "dexterity";
    return actor.rollAbility(abilityId, {
      defaultFocus,
      targetNumber: targetDefense,
      targetName: target?.name ?? "",
      flavor: game.i18n.format("DARPG.Roll.AttackWith", { name: this.name })
    });
  }

  /**
   * Урон оружия: формула урона плюс Сила для ближнего боя.
   * @returns {Promise<ChatMessage|null>}
   */
  async rollDamage() {
    if ( this.type !== "weapon" ) return null;
    const actor = this.#requireActor();
    if ( !actor ) return null;
    const system = this.system;

    let formula = system.damage?.trim() || "1d6";
    if ( !system.isRanged ) {
      const str = actor.system.abilities.strength.value;
      if ( str > 0 ) formula = `${formula} + ${str}`;
      else if ( str < 0 ) formula = `${formula} - ${Math.abs(str)}`;
    }

    // Карточка урона с кнопкой «Нанести урон» (учёт Брони цели при применении).
    return rollDamageFormula({
      formula,
      actor,
      penetrating: false,
      flavor: game.i18n.format("DARPG.Roll.DamageFor", { name: this.name })
    });
  }

  /**
   * Сотворение заклинания: списание маны и тест 3d6 + Магия против TN заклинания.
   * @returns {Promise<ChatMessage|null>}
   */
  async castSpell() {
    if ( this.type !== "spell" ) return null;
    const actor = this.#requireActor();
    if ( !actor ) return null;
    const system = this.system;

    // Проверка запаса маны
    const cost = system.manaCostNumber;
    const mana = actor.system.mana?.value ?? 0;
    if ( cost > mana ) {
      ui.notifications.warn(game.i18n.format("DARPG.Roll.NotEnoughMana", { cost, mana }));
      return null;
    }

    const title = game.i18n.format("DARPG.Roll.CastOf", { name: this.name });
    const config = await promptTest({ actor, ability: "magic", title, targetNumber: system.targetNumber });
    if ( !config ) return null;

    // Списать ману только после подтверждения броска
    if ( cost > 0 ) await actor.update({ "system.mana.value": mana - cost });

    const flavor = cost > 0
      ? `${title} (${game.i18n.format("DARPG.Roll.ManaSpent", { cost })})`
      : title;
    const roll = AgeRoll.fromTest({
      abilityValue: actor.system.abilities.magic.value,
      abilityLabel: game.i18n.localize(CONFIG.DARPG.abilities.magic),
      focusName: config.focus,
      modifier: config.modifier,
      targetNumber: config.targetNumber,
      flavor
    });
    await roll.evaluate();

    // Дубль при касте генерирует заклинательные стант-поинты — копим в пул актёра.
    await actor.gainStuntPoints(roll.stuntPoints);

    return roll.toMessage({
      speaker: DarpgItem.#chatMessageCls.getSpeaker({ actor }),
      flavor
    });
  }
}
