import BaseActorSheet from "./base-actor-sheet.mjs";
import { CharacterSheetApp } from "../vue/components/character-sheet.mjs";

/**
 * Лист персонажа игрока (рендер — Vue, корневой компонент CharacterSheetApp).
 */
export default class CharacterSheet extends BaseActorSheet {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["character", "darpg-book"],
    position: { width: 880, height: 820 }
  };

  /** @override — корневой Vue-компонент вместо .hbs-партиала. */
  static VUE_ROOT = CharacterSheetApp;

  /** @override — четыре готические «закладки» книги (README «разворот книги»). */
  static TABS = {
    primary: {
      tabs: [
        { id: "character", icon: "fa-solid fa-shield-halved" },
        { id: "grimuar", icon: "fa-solid fa-book-sparkles" },
        { id: "talents", icon: "fa-solid fa-star" },
        { id: "background", icon: "fa-solid fa-scroll" }
      ],
      initial: "character",
      labelPrefix: "DARPG.Sheet.Tabs"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.isMage = this.actor.system.class === "mage";
    return context;
  }
}
