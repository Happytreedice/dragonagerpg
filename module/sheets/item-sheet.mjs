import VueApplicationMixin from "../vue/vue-application-mixin.mjs";
import { ItemSheetApp } from "../vue/components/item-sheet.mjs";

const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Лист предмета (рендер — Vue, корневой компонент ItemSheetApp).
 * Поля по типу задаются декларативно (ITEM_FIELDS) вместо .hbs-партиалов.
 */
export default class DarpgItemSheet extends VueApplicationMixin(ItemSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["darpg", "item"],
    position: { width: 540, height: 560 },
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  /** @override — корневой Vue-компонент вместо .hbs-партиала. */
  static VUE_ROOT = ItemSheetApp;

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const system = item.system;
    const enrich = html => foundry.applications.ux.TextEditor.implementation.enrichHTML(
      html, { relativeTo: item, rollData: item.actor?.getRollData() ?? {}, secrets: item.isOwner }
    );

    context.item = item;
    context.system = system;
    context.config = CONFIG.DARPG;
    context.typeLabel = game.i18n.localize(`TYPES.Item.${item.type}`);
    context.enrichedDescription = await enrich(system.description);

    // Описания степеней талантов и специализаций
    if ( ["talent", "specialization"].includes(item.type) ) {
      context.enrichedNovice = await enrich(system.descriptionNovice);
      context.enrichedJourneyman = await enrich(system.descriptionJourneyman);
      context.enrichedMaster = await enrich(system.descriptionMaster);
    }
    // Таблица бенефитов происхождения и силы класса
    if ( item.type === "background" ) context.enrichedBenefits = await enrich(system.benefits);
    if ( item.type === "class" ) context.enrichedPowers = await enrich(system.powers);
    return context;
  }
}
