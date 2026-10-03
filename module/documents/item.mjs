import AgeRoll from "../dice/age-roll.mjs";
import DarpgActor from "./actor.mjs";
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
   * Найти у актёра фокус характеристики по одному из вариантов названия
   * (локализованная подпись, ключ конфига, ключ с разбитым camelCase: "lightBlades" → "light blades").
   * @param {Actor} actor
   * @param {string} ability          Ключ характеристики.
   * @param {string} key              Ключ CONFIG (группа оружия, школа магии).
   * @param {string} labelKey         i18n-ключ подписи.
   * @returns {string|null}           Название найденного фокуса.
   */
  static #matchFocus(actor, ability, key, labelKey) {
    const candidates = [
      labelKey ? game.i18n.localize(labelKey) : "",
      key,
      String(key ?? "").replace(/([a-z])([A-Z])/g, "$1 $2")
    ];
    for ( const name of candidates ) {
      const focus = actor.findFocus(name, ability);
      if ( focus ) return focus.name;
    }
    return null;
  }

  /**
   * Атака оружием: 3d6 + характеристика группы оружия (CONFIG.DARPG.weaponGroups[группа].ability)
   * + фокус группы против Защиты цели.
   * @returns {Promise<ChatMessage|null>}
   */
  async rollAttack() {
    if ( this.type !== "weapon" ) return null;
    const actor = this.#requireActor();
    if ( !actor ) return null;
    const system = this.system;

    const group = CONFIG.DARPG.weaponGroups[system.weaponGroup] ?? null;
    const abilityId = DarpgActor.resolveAbility(group?.ability) ?? "dexterity";

    // Фокус по умолчанию: фокус актёра этой характеристики, совпадающий с группой оружия
    const defaultFocus = DarpgItem.#matchFocus(actor, abilityId, system.weaponGroup, group?.label);

    // TN из Защиты первой выбранной цели
    const target = game.user.targets.first() ?? null;
    const targetDefense = target?.actor?.system?.defense ?? null;

    return actor.rollAbility(abilityId, {
      defaultFocus,
      targetNumber: targetDefense,
      targetName: target?.name ?? "",
      flavor: game.i18n.format("DARPG.Roll.AttackWith", { name: this.name })
    });
  }

  /**
   * Урон оружия: кости урона (damage.dice) плюс характеристика из damage.ability
   * (Сила — ближний бой и метательное, Восприятие — луки; "" — без прибавки).
   * Проникающее оружие игнорирует Броню цели при применении урона.
   * @returns {Promise<ChatMessage|null>}
   */
  async rollDamage() {
    if ( this.type !== "weapon" ) return null;
    const actor = this.#requireActor();
    if ( !actor ) return null;
    const system = this.system;

    let formula = system.damage?.dice?.trim() || "1d6";
    const ability = DarpgActor.resolveAbility(system.damage?.ability);
    if ( ability ) {
      const value = actor.system.abilities[ability]?.value ?? 0;
      if ( value > 0 ) formula = `${formula} + ${value}`;
      else if ( value < 0 ) formula = `${formula} - ${Math.abs(value)}`;
    }

    // Карточка урона с кнопкой «Нанести урон» (учёт Брони цели при применении).
    return rollDamageFormula({
      formula,
      actor,
      penetrating: !!system.penetrating,
      flavor: game.i18n.format("DARPG.Roll.DamageFor", { name: this.name })
    });
  }

  /**
   * Сотворение заклинания: списание маны (manaCost) и тест 3d6 + Магия (+ фокус школы)
   * против TN заклинания (tn; null — без TN).
   * @returns {Promise<ChatMessage|null>}
   */
  async castSpell() {
    if ( this.type !== "spell" ) return null;
    const actor = this.#requireActor();
    if ( !actor ) return null;
    const system = this.system;

    // Проверка запаса маны
    const cost = Math.max(0, Number(system.manaCost) || 0);
    const mana = actor.system.mana?.value ?? 0;
    if ( cost > mana ) {
      ui.notifications.warn(game.i18n.format("DARPG.Roll.NotEnoughMana", { cost, mana }));
      return null;
    }

    const title = game.i18n.format("DARPG.Roll.CastOf", { name: this.name });
    const schoolLabel = CONFIG.DARPG.schools[system.school];
    const defaultFocus = DarpgItem.#matchFocus(actor, "magic", system.school,
      (typeof schoolLabel === "string") ? schoolLabel : schoolLabel?.label);
    const tn = Number.isFinite(system.tn) ? system.tn : null;
    const config = await promptTest({ actor, ability: "magic", title, defaultFocus, targetNumber: tn });
    if ( !config ) return null;

    // Списать ману только после подтверждения броска
    if ( cost > 0 ) await actor.update({ "system.mana.value": mana - cost });

    const flavor = cost > 0
      ? `${title} (${game.i18n.format("DARPG.Roll.ManaSpent", { cost })})`
      : title;
    const focus = config.focus ? (actor.findFocus(config.focus, "magic") ?? { improved: false }) : null;
    const roll = AgeRoll.fromTest({
      abilityValue: actor.system.abilities.magic.value,
      abilityLabel: DarpgActor.abilityLabel("magic"),
      focusName: config.focus,
      focusBonus: DarpgActor.focusBonus(focus),
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
