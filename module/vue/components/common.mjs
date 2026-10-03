/**
 * Переиспользуемые Vue-компоненты листов darpg (string-шаблоны, полный build Vue
 * с компилятором). Формы завязаны на нативный submitOnChange Foundry: инпуты несут
 * name="system.x", а действия — data-action="..." (ловятся делегатом ApplicationV2).
 *
 * Массивы system.* (ArrayField) редактируются так (проверено по ядру v14, см.
 * module/sheets/array-actions.mjs):
 *  - значения элементов — обычные инпуты name="system.arr.N" / "system.arr.N.поле";
 *    FormDataExtended → expandObject даёт {arr: {N: …}}, а ArrayField#_cast превращает
 *    объект с числовыми ключами в массив. Каждый элемент чистится с partial:false,
 *    поэтому в форме рендерятся ВСЕ поля ВСЕХ элементов;
 *  - добавление/удаление элемента и переключение значений enum-массивов —
 *    data-action addEntry / deleteEntry / toggleChoice (полная замена массива).
 *
 * Локализация — глобальные this.$localize / this.$label (см. VueApplicationMixin).
 * Конфиг системы — this.$config (CONFIG.DARPG).
 */

/* -------------------------------------------- */
/*  Помощники (без зависимостей от Foundry)     */
/* -------------------------------------------- */

/**
 * i18n-ключ подписи записи CONFIG-таблицы: плоская запись — сама строка,
 * запись-объект (weaponGroups, armorTypes, classes…) — её поле label.
 * @param {string|{label?: string}|null|undefined} entry
 * @returns {string}
 */
export function labelKey(entry) {
  if ( typeof entry === "string" ) return entry;
  return entry?.label ?? "";
}

/**
 * Число со знаком для статблоков и разбивок: «+5», «−1», «+0».
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function signed(value) {
  const n = Number(value);
  if ( (value === null) || (value === undefined) || (value === "") || !Number.isFinite(n) ) return "";
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`;
}

/**
 * Значение по пути с точками (аналог foundry.utils.getProperty для plain-данных листа).
 * @param {object} object
 * @param {string} path      Напр. "damage.dice" или "degrees.novice".
 * @returns {*}
 */
export function getPath(object, path) {
  return String(path ?? "").split(".").reduce((o, k) => ((o === null) || (o === undefined) ? undefined : o[k]), object);
}

/* -------------------------------------------- */
/*  Компоненты                                  */
/* -------------------------------------------- */

/** Заголовок секции с необязательной кнопкой «создать/добавить». */
export const SectionTitle = {
  name: "SectionTitle",
  props: {
    label: { type: String, required: true },
    action: { type: String, default: "" },
    type: { type: String, default: "" },
    path: { type: String, default: "" },               // для addEntry: путь массива (system.attacks)
    tooltip: { type: String, default: "" }
  },
  template: /* html */ `
    <h3 class="section-title">
      {{ $localize(label) }}
      <a v-if="action" class="control-btn" :data-action="action" :data-type="type || null" :data-path="path || null"
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
    value: { default: null },
    tooltip: { type: String, default: "" }
  },
  template: /* html */ `
    <div class="stat-tile derived" :data-tooltip="tooltip ? $localize(tooltip) : null">
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

/**
 * Строка фокуса: тест с фокусом, имя, характеристика, «улучшенный» (+3), удаление.
 * Рендерит ВСЕ поля элемента system.focuses (name, ability, improved) — иначе
 * отправка формы сбросит пропущенные поля к initial (ArrayField чистит элементы
 * с partial:false).
 */
export const FocusRow = {
  name: "FocusRow",
  props: {
    focus: { type: Object, required: true },          // {name, ability, improved, index}
    abilities: { type: Object, required: true }        // CONFIG.DARPG.abilities
  },
  computed: {
    prefix() { return `system.focuses.${this.focus.index}`; },
    improvedBonus() { return this.$config?.improvedFocusBonus ?? 3; }
  },
  template: /* html */ `
    <li class="focus-row" :class="{ improved: focus.improved }" :data-index="focus.index">
      <a class="control-btn" data-action="rollFocus" :data-tooltip="$localize('DARPG.Sheet.RollFocus')">
        <i class="fa-solid fa-dice" inert></i>
      </a>
      <input class="focus-name" type="text" :name="prefix + '.name'"
             :value="focus.name" :placeholder="$localize('DARPG.Sheet.FocusName')">
      <select class="focus-ability" :name="prefix + '.ability'">
        <option v-for="(label, key) in abilities" :key="key" :value="key"
                :selected="key === focus.ability">{{ $label(label) }}</option>
      </select>
      <label class="focus-improved" :data-tooltip="$localize('DARPG.Sheet.FocusImprovedHint')">
        <input type="checkbox" :name="prefix + '.improved'" :checked="!!focus.improved">
        <span>{{ $signed(improvedBonus) }}</span>
      </label>
      <a class="control-btn danger" data-action="deleteFocus" :data-tooltip="$localize('DARPG.Sheet.DeleteFocus')">
        <i class="fa-solid fa-trash" inert></i>
      </a>
    </li>`
};

/**
 * Универсальная строка предмета. Слот по умолчанию — под произвольные ячейки; флаги
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
    </li>`
};

/** Пустая строка списка. */
export const EmptyRow = {
  name: "EmptyRow",
  template: /* html */ `<li class="item-row empty">{{ $localize('DARPG.Sheet.Empty') }}</li>`
};

/**
 * Редактор ProseMirror (toggled: показ обогащённого HTML + кнопка правки).
 *
 * Элемент <prose-mirror> создаётся ИМПЕРАТИВНО через штатную фабрику ядра
 * foundry.applications.elements.HTMLProseMirrorElement.create(): конструктор элемента
 * читает toggled/value/enriched в момент создания, а Vue выставляет атрибуты уже ПОСЛЕ
 * document.createElement — поэтому `<prose-mirror toggled>` в шаблоне превращался в
 * всегда-активный редактор без обогащённого показа, а патч v-html при ре-рендере
 * затирал внутренний DOM редактора. Здесь Vue владеет только пустым контейнером,
 * а элемент пересоздаётся при смене данных (кроме момента, пока идёт правка: тогда —
 * после закрытия редактора). Элемент form-associated: его значение попадает в
 * FormDataExtended, а сохранение шлёт change → submitOnChange формы листа.
 */
export const ProseMirror = {
  name: "DarpgProseMirror",
  inject: { app: { default: null } },
  props: {
    name: { type: String, required: true },
    value: { type: String, default: "" },            // сырой HTML (для сохранения)
    enriched: { type: String, default: "" },          // обогащённый HTML (для показа)
    uuid: { type: String, required: true }
  },
  template: /* html */ `<div class="darpg-editor"></div>`,
  mounted() {
    this.build();
  },
  beforeUnmount() {
    this.pm = null;
  },
  watch: {
    name() { this.refresh(); },
    value() { this.refresh(); },
    enriched() { this.refresh(); },
    uuid() { this.refresh(); }
  },
  methods: {
    /** Создать (пересоздать) элемент редактора в контейнере. */
    build() {
      const host = this.$el;
      const ElementCls = globalThis.foundry?.applications?.elements?.HTMLProseMirrorElement;
      if ( !host || !ElementCls ) return;
      const value = this.value ?? "";
      const element = ElementCls.create({
        name: this.name,
        value,
        // Пустой enriched у toggled-редактора показал бы пустоту — падаем на сырой HTML.
        enriched: this.enriched || value,
        toggled: true,
        documentUUID: this.uuid,
        disabled: this.app ? !this.app.isEditable : false
      });
      element.addEventListener("close", () => this.refresh());
      host.replaceChildren(element);
      this.pm = { element, name: this.name, value: this.value, enriched: this.enriched, uuid: this.uuid };
    },

    /** Синхронизировать элемент с пропсами; во время правки — отложить до закрытия. */
    refresh() {
      const pm = this.pm;
      if ( !pm?.element ) return this.build();
      const changed = (pm.name !== this.name) || (pm.value !== this.value)
        || (pm.enriched !== this.enriched) || (pm.uuid !== this.uuid);
      if ( !changed || pm.element.open ) return;
      this.build();
    }
  }
};

/**
 * Переключатели значений enum-массива (classes, primaryAbilities, weaponGroups…).
 * Чекбоксы без name (в данные формы не попадают); клик → data-action toggleChoice,
 * обработчик заменяет массив целиком (module/sheets/array-actions.mjs).
 */
export const ChoiceChips = {
  name: "ChoiceChips",
  props: {
    path: { type: String, required: true },          // system.classes
    value: { type: Array, default: () => [] },        // текущий массив ключей
    options: { type: Object, required: true }         // CONFIG-таблица (строки или {label})
  },
  methods: {
    isOn(key) { return this.value.includes(key); }
  },
  template: /* html */ `
    <div class="choice-chips">
      <label v-for="(entry, key) in options" :key="key" class="choice-chip" :class="{ active: isOn(key) }">
        <input type="checkbox" data-action="toggleChoice" :data-path="path" :data-value="key" :checked="isOn(key)">
        <span>{{ $label(entry) }}</span>
      </label>
    </div>`
};

/**
 * Редактор массива строк (focusChoices, languages, favoredStunts, talents, equipment).
 * Ключ строки включает длину массива: при добавлении/удалении строки пересоздаются
 * целиком (индексы в name сдвигаются — переиспользовать DOM-инпуты небезопасно).
 */
export const StringList = {
  name: "StringList",
  props: {
    path: { type: String, required: true },          // system.languages
    values: { type: Array, default: () => [] },
    placeholder: { type: String, default: "" }
  },
  template: /* html */ `
    <ol class="array-list strings">
      <li v-for="(v, i) in values" :key="values.length + '-' + i" class="array-row" :data-index="i">
        <input class="array-cell grow" type="text" :name="path + '.' + i" :value="v"
               :placeholder="placeholder ? $localize(placeholder) : null">
        <a class="control-btn danger" data-action="deleteEntry" :data-path="path"
           :data-tooltip="$localize('DARPG.Sheet.DeleteEntry')">
          <i class="fa-solid fa-trash" inert></i>
        </a>
      </li>
      <li v-if="!values.length" class="array-row empty">{{ $localize('DARPG.Sheet.Empty') }}</li>
    </ol>`
};

/**
 * Редактор массива объектов (атаки НИП, бенефиты происхождения, силы класса).
 * columns: [{key, kind: text|number|checkbox|select|prose, label, class?, placeholder?,
 *            min?, max?, step?, options? (CONFIG-таблица для select)}].
 * Все поля элемента обязаны быть колонками (см. шапку модуля). Колонки prose
 * выводятся на всю ширину под строкой; их обогащённый HTML — enriched[i][key].
 * Слот #actions — дополнительные кнопки строки (напр. броски атаки НИП).
 */
export const ObjectList = {
  name: "ObjectList",
  props: {
    path: { type: String, required: true },          // system.attacks
    rows: { type: Array, default: () => [] },
    columns: { type: Array, required: true },
    enriched: { type: Array, default: () => [] },
    uuid: { type: String, default: "" }
  },
  computed: {
    inlineColumns() { return this.columns.filter(c => c.kind !== "prose"); },
    proseColumns() { return this.columns.filter(c => c.kind === "prose"); }
  },
  methods: {
    cellName(index, column) { return `${this.path}.${index}.${column.key}`; },
    rowKey(index) { return `${this.rows.length}-${index}`; },
    enrichedFor(index, column) {
      return this.enriched?.[index]?.[column.key] ?? this.rows[index]?.[column.key] ?? "";
    }
  },
  template: /* html */ `
    <div class="array-editor">
      <div class="array-head">
        <span v-for="c in inlineColumns" :key="c.key" class="array-cell" :class="[c.kind, c.class]">{{ $localize(c.label) }}</span>
        <span class="array-cell controls"></span>
      </div>
      <ol class="array-list objects">
        <li v-for="(row, i) in rows" :key="rowKey(i)" class="array-row" :data-index="i">
          <span v-for="c in inlineColumns" :key="c.key" class="array-cell" :class="[c.kind, c.class]">
            <input v-if="c.kind === 'number'" type="number" :name="cellName(i, c)" :value="row[c.key]"
                   :min="c.min ?? null" :max="c.max ?? null" :step="c.step ?? 1"
                   :placeholder="c.placeholder ?? null" :data-tooltip="$localize(c.label)">
            <input v-else-if="c.kind === 'checkbox'" type="checkbox" :name="cellName(i, c)" :checked="!!row[c.key]"
                   :data-tooltip="$localize(c.label)">
            <select v-else-if="c.kind === 'select'" :name="cellName(i, c)" :data-tooltip="$localize(c.label)">
              <option v-for="(entry, key) in c.options" :key="key" :value="key"
                      :selected="String(key) === String(row[c.key])">{{ $label(entry) }}</option>
            </select>
            <input v-else type="text" :name="cellName(i, c)" :value="row[c.key]"
                   :placeholder="c.placeholder ? $localize(c.placeholder) : null" :data-tooltip="$localize(c.label)">
          </span>
          <span class="array-cell controls">
            <slot name="actions" :row="row" :index="i"></slot>
            <a class="control-btn danger" data-action="deleteEntry" :data-path="path"
               :data-tooltip="$localize('DARPG.Sheet.DeleteEntry')">
              <i class="fa-solid fa-trash" inert></i>
            </a>
          </span>
          <div v-for="c in proseColumns" :key="c.key" class="array-cell prose">
            <span class="array-prose-label">{{ $localize(c.label) }}</span>
            <darpg-prose-mirror :name="cellName(i, c)" :value="row[c.key] ?? ''"
                                :enriched="enrichedFor(i, c)" :uuid="uuid"></darpg-prose-mirror>
          </div>
        </li>
        <li v-if="!rows.length" class="array-row empty">{{ $localize('DARPG.Sheet.Empty') }}</li>
      </ol>
    </div>`
};

/** Зарегистрировать общие компоненты в приложении Vue. */
export function registerCommon(app) {
  for ( const c of [SectionTitle, StatTile, VitalSphere, AbilitiesGrid, FocusRow, ItemRow, EmptyRow, ProseMirror,
    ChoiceChips, StringList, ObjectList] ) {
    app.component(c.name, c);
  }
}
