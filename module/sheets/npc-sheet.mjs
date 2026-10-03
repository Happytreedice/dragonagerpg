import BaseActorSheet from "./base-actor-sheet.mjs";
import { NpcSheetApp } from "../vue/components/npc-sheet.mjs";

/**
 * Лист НИП/существа (рендер — Vue, корневой компонент NpcSheetApp).
 */
export default class NpcSheet extends BaseActorSheet {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["npc"],
    position: { width: 640, height: 640 }
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
      this.actor.system.powers,
      { relativeTo: this.actor, rollData: this.actor.getRollData(), secrets: this.actor.isOwner }
    );
    return context;
  }
}
