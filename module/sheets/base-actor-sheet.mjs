import VueApplicationMixin from "../vue/vue-application-mixin.mjs";
import { ARRAY_ACTIONS, defaultArrayEntry, mutateArray } from "./array-actions.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Общая логика листов актёров: тесты, фокусы, управление предметами.
 * Рендер — через Vue (VueApplicationMixin); контекст и действия те же, что раньше.
 * Массивы system.* (фокусы, атаки НИП, списки статблока) правятся действиями
 * module/sheets/array-actions.mjs.
 */
export default class BaseActorSheet extends VueApplicationMixin(ActorSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["darpg", "actor"],
    position: { width: 720, height: 720 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      ...ARRAY_ACTIONS,
      rollAbility: BaseActorSheet.#onRollAbility,
      rollFocus: BaseActorSheet.#onRollFocus,
      addFocus: BaseActorSheet.#onAddFocus,
      deleteFocus: BaseActorSheet.#onDeleteFocus,
      createItem: BaseActorSheet.#onCreateItem,
      editItem: BaseActorSheet.#onEditItem,
      deleteItem: BaseActorSheet.#onDeleteItem,
      toggleEquip: BaseActorSheet.#onToggleEquip,
      rollAttack: BaseActorSheet.#onRollAttack,
      rollDamage: BaseActorSheet.#onRollDamage,
      castSpell: BaseActorSheet.#onCastSpell
    }
  };

  /* -------------------------------------------- */
  /*  Контекст рендера                            */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;
    const config = CONFIG.DARPG;

    // Характеристики и фокусы (все поля элемента: name, ability, improved)
    context.system = system;
    context.config = config;
    context.abilities = Object.entries(config.abilities)
      .map(([id, label]) => ({ id, label, value: system.abilities[id]?.value ?? 0 }));
    context.focuses = system.focuses.map((focus, index) => ({ ...focus, index }));

    // Предметы по типам, в порядке сортировки
    const byType = {
      weapon: [], armor: [], shield: [], spell: [], talent: [], specialization: [],
      equipment: [], consumable: [], focus: [], background: [], class: [], stunt: []
    };
    for ( const item of actor.items ) byType[item.type]?.push(item);
    for ( const list of Object.values(byType) ) list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    context.weapons = byType.weapon;
    context.armors = byType.armor;
    context.shields = byType.shield;
    context.spells = byType.spell;
    context.talents = byType.talent;
    context.specializations = byType.specialization;
    context.stunts = byType.stunt;
    // Снаряжение и расходники (зелья/яды/гранаты) — общий инвентарь
    context.gear = [...byType.equipment, ...byType.consumable].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    // Заклинания, сгруппированные по школам магии (вкладка «Гримуар»)
    context.spellsBySchool = Object.keys(config.schools).map(school => ({
      school, label: config.schools[school],
      spells: byType.spell.filter(s => s.system.school === school)
    })).filter(g => g.spells.length);

    // Фокусы, сгруппированные по характеристикам (вкладка «Таланты»). Показываются
    // ВСЕ фокусы, включая новые безымянные: каждый элемент массива обязан быть в форме,
    // иначе отправка формы заменит пропущенный элемент значением по умолчанию.
    context.focusesByAbility = Object.keys(config.abilities).map(ability => ({
      ability, label: config.abilities[ability],
      focuses: context.focuses.filter(f => f.ability === ability)
    })).filter(g => g.focuses.length);

    // Проценты заполнения сфер жизненных сил (README §5.2, «liquid fill»)
    const pct = (v, m) => (m > 0 ? Math.clamp(Math.round((v / m) * 100), 0, 100) : 0);
    context.healthPct = pct(system.health?.value ?? 0, system.health?.max ?? 0);
    context.manaPct = pct(system.mana?.value ?? 0, system.mana?.max ?? 0);
    context.stuntPct = pct(system.stuntPoints?.value ?? 0, system.stuntPoints?.max ?? 0);

    // Обогащённая биография для prose-mirror
    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.biography ?? "",
      { relativeTo: actor, rollData: actor.getRollData(), secrets: actor.isOwner }
    );
    return context;
  }

  /* -------------------------------------------- */
  /*  Вспомогательные методы                      */
  /* -------------------------------------------- */

  /**
   * Предмет по ближайшему элементу с data-item-id.
   * @param {HTMLElement} target
   * @returns {Item|null}
   */
  _getItem(target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    return this.actor.items.get(itemId) ?? null;
  }

  /**
   * Индекс элемента массива по ближайшему элементу с data-index.
   * @param {HTMLElement} target
   * @returns {number}
   */
  _getIndex(target) {
    return Number(target.closest("[data-index]")?.dataset.index ?? -1);
  }

  /* -------------------------------------------- */
  /*  Обработчики действий                        */
  /* -------------------------------------------- */

  /** Тест характеристики по клику на плитке. @this {BaseActorSheet} */
  static #onRollAbility(event, target) {
    const ability = target.closest("[data-ability]")?.dataset.ability;
    if ( ability ) this.actor.rollAbility(ability);
  }

  /** Тест с предвыбранным фокусом. @this {BaseActorSheet} */
  static #onRollFocus(event, target) {
    const index = this._getIndex(target);
    const focus = this.actor.system.focuses[index];
    if ( focus?.name?.trim() ) this.actor.rollAbility(focus.ability, { defaultFocus: focus.name });
  }

  /** Добавить пустой фокус (элемент по умолчанию — из схемы system.focuses). @this {BaseActorSheet} */
  static #onAddFocus() {
    return mutateArray(this, "system.focuses", focuses => {
      focuses.push(defaultArrayEntry(this.actor, "system.focuses"));
    });
  }

  /** Удалить фокус по индексу. @this {BaseActorSheet} */
  static #onDeleteFocus(event, target) {
    const index = this._getIndex(target);
    return mutateArray(this, "system.focuses", focuses => {
      if ( (index < 0) || (index >= focuses.length) ) return false;
      focuses.splice(index, 1);
    });
  }

  /** Создать предмет заданного типа. @this {BaseActorSheet} */
  static #onCreateItem(event, target) {
    const type = target.dataset.type;
    if ( !type ) return;
    const name = game.i18n.format("DARPG.Sheet.NewItemName", {
      type: game.i18n.localize(`TYPES.Item.${type}`)
    });
    foundry.documents.Item.implementation.create({ name, type }, { parent: this.actor, renderSheet: true });
  }

  /** Открыть лист предмета. @this {BaseActorSheet} */
  static #onEditItem(event, target) {
    this._getItem(target)?.sheet.render({ force: true });
  }

  /** Удалить предмет (с подтверждением). @this {BaseActorSheet} */
  static #onDeleteItem(event, target) {
    this._getItem(target)?.deleteDialog();
  }

  /** Переключить экипировку чекбоксом. @this {BaseActorSheet} */
  static #onToggleEquip(event, target) {
    const item = this._getItem(target);
    if ( item ) item.update({ "system.equipped": target.checked });
  }

  /** Бросок атаки оружием. @this {BaseActorSheet} */
  static #onRollAttack(event, target) {
    this._getItem(target)?.rollAttack();
  }

  /** Бросок урона оружия. @this {BaseActorSheet} */
  static #onRollDamage(event, target) {
    this._getItem(target)?.rollDamage();
  }

  /** Сотворение заклинания. @this {BaseActorSheet} */
  static #onCastSpell(event, target) {
    this._getItem(target)?.castSpell();
  }
}
