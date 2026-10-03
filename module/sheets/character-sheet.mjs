import BaseActorSheet from "./base-actor-sheet.mjs";
import { CharacterSheetApp } from "../vue/components/character-sheet.mjs";

/**
 * Лист персонажа игрока (рендер — Vue, корневой компонент CharacterSheetApp).
 */
export default class CharacterSheet extends BaseActorSheet {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["character", "darpg-book"],
    position: { width: 900, height: 820 }
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
    const system = this.actor.system;
    context.isMage = system.class === "mage";
    context.xp = CharacterSheet.#xpProgress(system.level, system.xp);
    return context;
  }

  /**
   * Прогресс опыта до следующего уровня по CONFIG.DARPG.xpTable (индекс = уровень − 1).
   * Только показ: повышение уровня — следующий этап.
   * @param {number} level
   * @param {number} xp
   * @returns {{value: number, current: number, next: number|null, pct: number}}
   */
  static #xpProgress(level, xp) {
    const table = CONFIG.DARPG.xpTable ?? [];
    const value = Math.max(0, Number(xp) || 0);
    const lvl = Math.clamp(Number(level) || 1, 1, Math.max(table.length, 1));
    const current = table[lvl - 1] ?? 0;
    const next = table[lvl] ?? null;
    const pct = (next === null) ? 100
      : Math.clamp(Math.round(((value - current) / Math.max(next - current, 1)) * 100), 0, 100);
    return { value, current, next, pct };
  }
}
