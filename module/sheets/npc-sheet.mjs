import BaseActorSheet from "./base-actor-sheet.mjs";
import { NpcSheetApp } from "../vue/components/npc-sheet.mjs";

/**
 * Лист НИП/существа (рендер — Vue, корневой компонент NpcSheetApp).
 * Статблок книги: атаки (attacks[]), избранные приёмы, таланты, группы оружия,
 * снаряжение — массивы system.*, правятся действиями module/sheets/array-actions.mjs.
 */
export default class NpcSheet extends BaseActorSheet {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["npc"],
    position: { width: 680, height: 680 },
    actions: {
      rollStatblockAttack: NpcSheet.#onRollStatblockAttack,
      rollStatblockDamage: NpcSheet.#onRollStatblockDamage
    }
  };

  /** @override — корневой Vue-компонент вместо .hbs-партиала. */
  static VUE_ROOT = NpcSheetApp;

  /** @override — характеристики/фокусы и бой/атаки разнесены по разным вкладкам. */
  static TABS = {
    primary: {
      tabs: [
        { id: "main", icon: "fa-solid fa-user" },
        { id: "combat", icon: "fa-solid fa-swords" },
        { id: "biography", icon: "fa-solid fa-book" }
      ],
      initial: "main",
      labelPrefix: "DARPG.Sheet.Tabs"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // Особые силы существа — обогащённый HTML (энричеры darpg работают)
    context.enrichedPowers = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.actor.system.powers ?? "",
      { relativeTo: this.actor, rollData: this.actor.getRollData(), secrets: this.actor.isOwner }
    );
    return context;
  }

  /** Бросок атаки из статблока (индекс строки — data-index). @this {NpcSheet} */
  static #onRollStatblockAttack(event, target) {
    const index = this._getIndex(target);
    if ( index >= 0 ) this.actor.rollStatblockAttack(index);
  }

  /** Бросок урона атаки из статблока. @this {NpcSheet} */
  static #onRollStatblockDamage(event, target) {
    const index = this._getIndex(target);
    if ( index >= 0 ) this.actor.rollStatblockDamage(index);
  }
}
