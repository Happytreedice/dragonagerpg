import * as Vue from "../../../lib/vue.esm-browser.prod.js";

/**
 * Переиспользуемые Vue-компоненты листов darpg (string-шаблоны, полный build Vue
 * с компилятором). Формы завязаны на нативный submitOnChange Foundry: инпуты несут
 * name="system.x", а действия — data-action="..." (ловятся делегатом ApplicationV2).
 *
 * Локализация — глобальный this.$localize (см. VueApplicationMixin). Конфиг системы —
 * this.$config (CONFIG.DARPG).
 */

/** Заголовок секции с необязательной кнопкой «создать/добавить». */
export const SectionTitle = {
  name: "SectionTitle",
  props: {
    label: { type: String, required: true },
    action: { type: String, default: "" },
    type: { type: String, default: "" },
    tooltip: { type: String, default: "" }
  },
  template: /* html */ `
    <h3 class="section-title">
      {{ $localize(label) }}
      <a v-if="action" class="control-btn" :data-action="action" :data-type="type || null"
         :data-tooltip="$localize(tooltip || 'DARPG.Sheet.Create')">
        <i class="fa-solid fa-plus" inert></i>
      </a>
    </h3>`
};

/** Плитка производного показателя (Защита/Броня/Скорость/Сила заклинаний). */
export const StatTile = {
  name: "StatTile",
  props: {
    label: { type: String, required: true },
    value: { required: true }
  },
  template: /* html */ `
    <div class="stat-tile derived">
      <span class="stat-label">{{ $localize(label) }}</span>
      <span class="stat-value"><slot>{{ value }}</slot></span>
    </div>`
};

/** Сфера жизненных сил с liquid-fill (Здоровье/Мана/SP). */
export const VitalSphere = {
  name: "VitalSphere",
  props: {
    kind: { type: String, required: true },          // health | mana | stunt
    label: { type: String, required: true },
    pct: { type: Number, default: 0 },
    valueName: { type: String, required: true },      // system.health.value
    value: { required: true },
    maxName: { type: String, default: "" },           // system.health.max (пусто — без max)
    max: { default: null },
    tooltip: { type: String, default: "" }
  },
  template: /* html */ `
    <div class="vital-sphere" :class="kind" :style="{ '--fill': pct + '%' }"
         :data-tooltip="tooltip ? $localize(tooltip) : null">
      <div class="sphere-liquid"></div>
      <div class="sphere-content">
        <span class="sphere-label">{{ $localize(label) }}</span>
        <span class="sphere-value">
          <input type="number" :name="valueName" :value="value" min="0" step="1">
          <template v-if="maxName">
            <span class="sep">/</span>
            <input type="number" :name="maxName" :value="max" min="0" step="1">
          </template>
        </span>
      </div>
    </div>`
};

/** Сетка восьми характеристик; клик по названию — тест (data-action rollAbility). */
export const AbilitiesGrid = {
  name: "AbilitiesGrid",
  props: {
    abilities: { type: Array, required: true },       // [{id,label,value}]
    compact: { type: Boolean, default: false }
  },
  template: /* html */ `
    <div class="abilities-grid" :class="{ compact }">
      <div v-for="a in abilities" :key="a.id" class="ability-tile" :data-ability="a.id">
        <a class="ability-name" data-action="rollAbility" :data-tooltip="$localize('DARPG.Sheet.RollAbility')">
          {{ $localize(a.label) }}
        </a>
        <input class="ability-value" type="number" :name="'system.abilities.' + a.id + '.value'"
               :value="a.value" step="1">
      </div>
    </div>`
};

/** Строка фокуса (тест с фокусом, имя, характеристика, удаление). */
export const FocusRow = {
  name: "FocusRow",
  props: {
    focus: { type: Object, required: true },          // {name, ability, index}
    abilities: { type: Object, required: true }        // CONFIG.DARPG.abilities
  },
  template: /* html */ `
    <li class="focus-row" :data-index="focus.index">
      <a class="control-btn" data-action="rollFocus" :data-tooltip="$localize('DARPG.Sheet.RollFocus')">
        <i class="fa-solid fa-dice" inert></i>
      </a>
      <input class="focus-name" type="text" :name="'system.focuses.' + focus.index + '.name'"
             :value="focus.name" :placeholder="$localize('DARPG.Sheet.FocusName')">
      <select class="focus-ability" :name="'system.focuses.' + focus.index + '.ability'">
        <option v-for="(label, key) in abilities" :key="key" :value="key"
                :selected="key === focus.ability">{{ $localize(label) }}</option>
      </select>
      <a class="control-btn danger" data-action="deleteFocus" :data-tooltip="$localize('DARPG.Sheet.DeleteFocus')">
        <i class="fa-solid fa-trash" inert></i>
      </a>
    </li>`
};

/**
 * Универсальная строка предмета. Слот "detail" под произвольные ячейки; флаги
 * управляют наличием чекбокса экипировки и кнопок атаки/урона/каста.
 */
export const ItemRow = {
  name: "ItemRow",
  props: {
    item: { type: Object, required: true },
    equip: { type: Boolean, default: false },
    attack: { type: Boolean, default: false },
    cast: { type: Boolean, default: false }
  },
  template: /* html */ `
    <li class="item-row" :data-item-id="item.id">
      <input v-if="equip" type="checkbox" class="equip-toggle" data-action="toggleEquip"
             :data-tooltip="$localize('DARPG.Sheet.Equipped')" :checked="item.system.equipped">
      <a v-if="cast" class="control-btn cast" data-action="castSpell" :data-tooltip="$localize('DARPG.Sheet.Cast')">
        <i class="fa-solid fa-hand-sparkles" inert></i>
      </a>
      <img class="item-img" :src="item.img" :alt="item.name">
      <a class="item-name" data-action="editItem">{{ item.name }}</a>
      <slot></slot>
      <template v-if="attack">
        <a class="control-btn" data-action="rollAttack" :data-tooltip="$localize('DARPG.Sheet.Attack')">
          <i class="fa-solid fa-crosshairs" inert></i>
        </a>
        <a class="control-btn" data-action="rollDamage" :data-tooltip="$localize('DARPG.Sheet.Damage')">
          <i class="fa-solid fa-burst" inert></i>
        </a>
      </template>
      <a class="control-btn danger" data-action="deleteItem" :data-tooltip="$localize('DARPG.Sheet.Delete')">
        <i class="fa-solid fa-trash" inert></i>
      </a>
    </li>`,
  components: {}
};

/** Пустая строка списка. */
export const EmptyRow = {
  name: "EmptyRow",
  template: /* html */ `<li class="item-row empty">{{ $localize('DARPG.Sheet.Empty') }}</li>`
};

/**
 * Редактор ProseMirror. Vue создаёт нативный <prose-mirror> с обогащённым HTML;
 * name="system.x" гарантирует сохранение через submitOnChange формы.
 */
export const ProseMirror = {
  name: "DarpgProseMirror",
  props: {
    name: { type: String, required: true },
    value: { type: String, default: "" },            // сырой HTML (для сохранения)
    enriched: { type: String, default: "" },          // обогащённый HTML (для показа)
    uuid: { type: String, required: true }
  },
  // v-html вставляет обогащённый HTML внутрь кастом-элемента <prose-mirror>.
  template: /* html */ `
    <prose-mirror :name="name" :value="value" toggled :data-document-uuid="uuid" v-html="enriched"></prose-mirror>`
};

/** Зарегистрировать общие компоненты в приложении Vue. */
export function registerCommon(app) {
  for ( const c of [SectionTitle, StatTile, VitalSphere, AbilitiesGrid, FocusRow, ItemRow, EmptyRow, ProseMirror] ) {
    app.component(c.name, c);
  }
}
