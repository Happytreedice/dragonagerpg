import VueApplicationMixin from "../vue/vue-application-mixin.mjs";
import { ItemSheetApp } from "../vue/components/item-sheet.mjs";
import { ARRAY_ACTIONS } from "./array-actions.mjs";

const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Лист предмета (рендер — Vue, корневой компонент ItemSheetApp).
 * Поля по типу задаются декларативно (ITEM_FIELDS) вместо .hbs-партиалов.
 * Массивы (классы, фокусы на выбор, языки, бенефиты, силы класса…) правятся
 * действиями addEntry/deleteEntry/toggleChoice (module/sheets/array-actions.mjs).
 */
export default class DarpgItemSheet extends VueApplicationMixin(ItemSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["darpg", "item"],
    position: { width: 560, height: 620 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: { ...ARRAY_ACTIONS }
  };

  /** @override — корневой Vue-компонент вместо .hbs-партиала. */
  static VUE_ROOT = ItemSheetApp;

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const system = item.system;
    const enrich = html => foundry.applications.ux.TextEditor.implementation.enrichHTML(
      html ?? "", { relativeTo: item, rollData: item.actor?.getRollData() ?? {}, secrets: item.isOwner }
    );

    context.item = item;
    context.system = system;
    context.config = CONFIG.DARPG;
    context.typeLabel = game.i18n.localize(`TYPES.Item.${item.type}`);
    context.enrichedDescription = await enrich(system.description?.value);

    // Описания степеней талантов и специализаций (system.degrees.*)
    if ( ["talent", "specialization"].includes(item.type) ) {
      context.enrichedNovice = await enrich(system.degrees?.novice);
      context.enrichedJourneyman = await enrich(system.degrees?.journeyman);
      context.enrichedMaster = await enrich(system.degrees?.master);
    }

    // Силы класса по уровням: обогащённое описание каждой силы (по индексу массива)
    if ( item.type === "class" ) {
      const powers = Array.isArray(system.powers) ? system.powers : [];
      context.enrichedPowers = await Promise.all(powers.map(async p => ({ description: await enrich(p.description) })));
    }
    return context;
  }
}
