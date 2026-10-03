/**
 * Корневой Vue-компонент листа предмета (все 15 типов Item).
 *
 * Поля каждого типа заданы декларативно в ITEM_FIELDS и отрисовываются универсальным
 * <item-field>. path — путь внутри system (может быть вложенным: "damage.dice",
 * "range.short", "degrees.novice"); name инпута = "system." + path.
 *
 * Виды полей (kind):
 *   select   — options: имя CONFIG-таблицы (подпись — строка или .label); blank: пункт «—» = "";
 *   text     — list: имя CONFIG-таблицы для подсказок <datalist> (castTimes);
 *   number   — nullable: пустой инпут → null (FormDataExtended отдаёт null для пустого number);
 *   checkbox;
 *   prose    — enriched: ключ обогащённого HTML в context;
 *   choices  — enum-массив: переключатели (data-action toggleChoice), options — CONFIG-таблица;
 *   strings  — массив строк: инпуты name="system.path.N" + addEntry/deleteEntry;
 *   objects  — массив объектов: columns (все поля элемента), enriched — ключ массива
 *              обогащённых HTML для колонок prose.
 * Источник (system.source.book/page) и описание (system.description.value) общие для всех типов.
 */

import { getPath } from "./common.mjs";

/** Поле экипировки (оружие, броня, щиты). */
const EQUIPPED = { kind: "checkbox", path: "equipped", label: "DARPG.Sheet.Equipped" };

/** Поля степеней талантов и специализаций (HTML каждой степени). */
const DEGREE_TEXTS = [
  { kind: "prose", path: "degrees.novice", label: "DARPG.Item.DegreeNovice", enriched: "enrichedNovice" },
  { kind: "prose", path: "degrees.journeyman", label: "DARPG.Item.DegreeJourneyman", enriched: "enrichedJourneyman" },
  { kind: "prose", path: "degrees.master", label: "DARPG.Item.DegreeMaster", enriched: "enrichedMaster" }
];

/** Поля по типам, в порядке схемы (SCHEMA.md §3). */
export const ITEM_FIELDS = {
  weapon: [
    { kind: "select", path: "weaponGroup", label: "DARPG.Item.WeaponGroup", options: "weaponGroups" },
    { kind: "select", path: "type", label: "DARPG.Item.WeaponType", options: "weaponTypes" },
    { kind: "text", path: "damage.dice", label: "DARPG.Item.DamageDice", placeholder: "2d6" },
    { kind: "select", path: "damage.ability", label: "DARPG.Item.DamageAbility", options: "damageAbilities" },
    { kind: "number", path: "minStrength", label: "DARPG.Item.MinStrength", step: 1, nullable: true },
    { kind: "number", path: "range.short", label: "DARPG.Item.RangeShort", min: 0, step: 1, nullable: true },
    { kind: "number", path: "range.long", label: "DARPG.Item.RangeLong", min: 0, step: 1, nullable: true },
    { kind: "select", path: "reload", label: "DARPG.Item.Reload", options: "reloadActions" },
    { kind: "checkbox", path: "twoHanded", label: "DARPG.Item.TwoHanded" },
    { kind: "text", path: "cost", label: "DARPG.Item.Cost", placeholder: "18 sp" },
    { kind: "checkbox", path: "penetrating", label: "DARPG.Item.Penetrating" },
    { kind: "number", path: "quantity", label: "DARPG.Item.Quantity", min: 0, step: 1 },
    EQUIPPED
  ],
  armor: [
    { kind: "select", path: "armorType", label: "DARPG.Item.ArmorType", options: "armorTypes" },
    { kind: "number", path: "armorRating", label: "DARPG.Item.ArmorRating", min: 0, step: 1 },
    { kind: "number", path: "armorPenalty", label: "DARPG.Item.ArmorPenalty", min: 0, step: 1 },
    { kind: "number", path: "strain", label: "DARPG.Item.Strain", min: 0, step: 1 },
    { kind: "text", path: "cost", label: "DARPG.Item.Cost", placeholder: "50 sp" },
    EQUIPPED
  ],
  shield: [
    { kind: "select", path: "shieldType", label: "DARPG.Item.ShieldType", options: "shieldTypes" },
    { kind: "number", path: "shieldBonus", label: "DARPG.Item.ShieldBonus", min: 0, max: 3, step: 1 },
    { kind: "text", path: "cost", label: "DARPG.Item.Cost", placeholder: "15 sp" },
    EQUIPPED
  ],
  spell: [
    { kind: "select", path: "school", label: "DARPG.Item.School", options: "schools" },
    { kind: "select", path: "spellType", label: "DARPG.Item.SpellType", options: "spellTypes" },
    { kind: "number", path: "manaCost", label: "DARPG.Item.ManaCost", min: 0, step: 1 },
    { kind: "text", path: "manaCostNote", label: "DARPG.Item.ManaCostNote", placeholder: "+" },
    { kind: "text", path: "castTime", label: "DARPG.Item.CastTime", list: "castTimes" },
    { kind: "number", path: "tn", label: "DARPG.Item.TargetNumber", min: 0, step: 1, nullable: true },
    { kind: "text", path: "requirement", label: "DARPG.Item.Requirement" },
    { kind: "text", path: "test", label: "DARPG.Item.Test" }
  ],
  talent: [
    { kind: "choices", path: "classes", label: "DARPG.Item.Classes", options: "classes" },
    { kind: "text", path: "requirement", label: "DARPG.Item.Requirement" },
    { kind: "select", path: "degree", label: "DARPG.Item.Degree", options: "degrees" },
    ...DEGREE_TEXTS
  ],
  specialization: [
    { kind: "select", path: "class", label: "DARPG.Item.Class", options: "classes" },
    { kind: "choices", path: "classes", label: "DARPG.Item.Classes", options: "classes" },
    { kind: "text", path: "requirement", label: "DARPG.Item.Requirement" },
    { kind: "select", path: "degree", label: "DARPG.Item.Degree", options: "degrees" },
    ...DEGREE_TEXTS
  ],
  focus: [
    { kind: "select", path: "ability", label: "DARPG.Item.Ability", options: "abilities" },
    { kind: "checkbox", path: "improved", label: "DARPG.Item.FocusImproved" }
  ],
  background: [
    { kind: "select", path: "race", label: "DARPG.Item.Race", options: "races" },
    { kind: "choices", path: "classes", label: "DARPG.Item.Classes", options: "classes" },
    { kind: "select", path: "abilityBonus", label: "DARPG.Item.AbilityBonus", options: "abilities", blank: true },
    { kind: "strings", path: "focusChoices", label: "DARPG.Item.FocusChoices", placeholder: "DARPG.Item.FocusChoicePlaceholder" },
    { kind: "strings", path: "languages", label: "DARPG.Item.Languages", placeholder: "DARPG.Item.LanguagePlaceholder" },
    { kind: "objects", path: "benefits", label: "DARPG.Item.Benefits", columns: [
      { key: "roll", kind: "text", label: "DARPG.Item.BenefitRoll", class: "narrow", placeholder: "DARPG.Item.BenefitRollPlaceholder" },
      { key: "result", kind: "text", label: "DARPG.Item.BenefitResult", class: "grow" }
    ] }
  ],
  class: [
    { kind: "select", path: "key", label: "DARPG.Item.ClassKey", options: "classes" },
    { kind: "choices", path: "primaryAbilities", label: "DARPG.Item.PrimaryAbilities", options: "abilities" },
    { kind: "choices", path: "secondaryAbilities", label: "DARPG.Item.SecondaryAbilities", options: "abilities" },
    { kind: "number", path: "health", label: "DARPG.Item.StartingHealth", min: 0, step: 1 },
    { kind: "number", path: "mana", label: "DARPG.Item.StartingMana", min: 0, step: 1 },
    { kind: "choices", path: "weaponGroups.granted", label: "DARPG.Item.WeaponGroupsGranted", options: "weaponGroups" },
    { kind: "number", path: "weaponGroups.choose", label: "DARPG.Item.WeaponGroupsChoose", min: 0, step: 1 },
    { kind: "choices", path: "weaponGroups.options", label: "DARPG.Item.WeaponGroupsOptions", options: "weaponGroups" },
    { kind: "objects", path: "powers", label: "DARPG.Item.ClassPowers", enriched: "enrichedPowers", columns: [
      { key: "level", kind: "number", label: "DARPG.Item.PowerLevel", class: "narrow", min: 1, max: 20, step: 1 },
      { key: "name", kind: "text", label: "DARPG.Item.PowerName", class: "grow" },
      { key: "description", kind: "prose", label: "DARPG.Item.PowerDescription" }
    ] }
  ],
  stunt: [
    { kind: "select", path: "stuntType", label: "DARPG.Item.StuntType", options: "stuntTypes" },
    { kind: "number", path: "cost", label: "DARPG.Item.StuntCost", min: 0, step: 1 },
    { kind: "text", path: "costText", label: "DARPG.Item.StuntCostText", placeholder: "1-3" }
  ],
  consumable: [
    { kind: "select", path: "consumableType", label: "DARPG.Item.ConsumableType", options: "consumableTypes" },
    { kind: "text", path: "formula", label: "DARPG.Item.Formula", placeholder: "3d6" },
    { kind: "select", path: "degree", label: "DARPG.Item.Degree", options: "degrees", blank: true },
    { kind: "number", path: "quantity", label: "DARPG.Item.Quantity", min: 0, step: 1 },
    { kind: "text", path: "cost", label: "DARPG.Item.Cost" }
  ],
  rune: [
    { kind: "select", path: "slot", label: "DARPG.Item.RuneSlot", options: "runeSlots" },
    { kind: "select", path: "degree", label: "DARPG.Item.Degree", options: "degrees" },
    { kind: "text", path: "effect", label: "DARPG.Item.RuneEffect" },
    { kind: "text", path: "cost", label: "DARPG.Item.Cost" }
  ],
  equipment: [
    { kind: "number", path: "quantity", label: "DARPG.Item.Quantity", min: 0, step: 1 },
    { kind: "text", path: "cost", label: "DARPG.Item.Cost" }
  ],
  honorific: [
    { kind: "text", path: "effect", label: "DARPG.Item.HonorificEffect" }
  ],
  title: [
    { kind: "select", path: "tier", label: "DARPG.Item.TitleTier", options: "titleTiers" },
    { kind: "text", path: "structure", label: "DARPG.Item.TitleStructure" },
    { kind: "text", path: "resources", label: "DARPG.Item.TitleResources" }
  ]
};

/** Виды полей, которые занимают всю ширину (подпись над редактором). */
const STACKED_KINDS = new Set(["prose", "choices", "strings", "objects"]);

/** Универсальный рендер одного поля предмета. */
export const ItemField = {
  name: "ItemField",
  props: {
    field: { type: Object, required: true },
    source: { type: Object, required: true },       // item._source
    config: { type: Object, required: true },       // CONFIG.DARPG
    enriched: { type: Object, required: true },      // {enrichedNovice: "...", enrichedPowers: [...], ...}
    uuid: { type: String, required: true }
  },
  computed: {
    name() { return `system.${this.field.path}`; },
    value() { return getPath(this.source.system, this.field.path); },
    options() { return this.field.options ? (this.config[this.field.options] ?? {}) : null; },
    listId() { return this.field.list ? `darpg-${this.field.list}-${this.uuid}`.replace(/[^\w-]/g, "-") : null; },
    listOptions() { return this.field.list ? (this.config[this.field.list] ?? {}) : null; },
    stacked() { return STACKED_KINDS.has(this.field.kind); },
    arrayValue() { return Array.isArray(this.value) ? this.value : []; },
    addable() { return ["strings", "objects"].includes(this.field.kind); }
  },
  methods: {
    /** Выбран ли ключ опции: ключи CONFIG — строки, значение поля может быть числом (tier). */
    isSelected(key) { return String(key) === String(this.value ?? ""); }
  },
  template: /* html */ `
    <div class="form-group" :class="['kind-' + field.kind, { stacked }]">
      <label>
        <span>{{ $localize(field.label) }}</span>
        <a v-if="addable" class="control-btn" data-action="addEntry" :data-path="name"
           :data-tooltip="$localize('DARPG.Sheet.AddEntry')"><i class="fa-solid fa-plus" inert></i></a>
      </label>

      <select v-if="field.kind === 'select'" :name="name">
        <option v-if="field.blank" value="" :selected="isSelected('')">—</option>
        <option v-for="(entry, key) in options" :key="key" :value="key"
                :selected="isSelected(key)">{{ $label(entry) }}</option>
      </select>

      <template v-else-if="field.kind === 'text'">
        <input type="text" :name="name" :value="value" :placeholder="field.placeholder || null" :list="listId">
        <datalist v-if="listId" :id="listId">
          <option v-for="(entry, key) in listOptions" :key="key" :value="key">{{ $label(entry) }}</option>
        </datalist>
      </template>

      <input v-else-if="field.kind === 'number'" type="number" :name="name" :value="value"
             :min="field.min ?? null" :max="field.max ?? null" :step="field.step ?? 1"
             :placeholder="field.nullable ? '—' : null">

      <input v-else-if="field.kind === 'checkbox'" type="checkbox" :name="name" :checked="!!value">

      <darpg-prose-mirror v-else-if="field.kind === 'prose'" :name="name" :value="value ?? ''"
                          :enriched="enriched[field.enriched] || ''" :uuid="uuid"></darpg-prose-mirror>

      <choice-chips v-else-if="field.kind === 'choices'" :path="name" :value="arrayValue"
                    :options="options || {}"></choice-chips>

      <string-list v-else-if="field.kind === 'strings'" :path="name" :values="arrayValue"
                   :placeholder="field.placeholder || ''"></string-list>

      <object-list v-else-if="field.kind === 'objects'" :path="name" :rows="arrayValue" :columns="field.columns"
                   :enriched="enriched[field.enriched] || []" :uuid="uuid"></object-list>
    </div>`
};

/** Корневой компонент листа предмета. */
export const ItemSheetApp = {
  name: "ItemSheetApp",
  components: { ItemField },
  props: {
    context: { type: Object, required: true },
    app: { type: Object, required: true }
  },
  computed: {
    source() { return this.context.source; },
    config() { return this.context.config; },
    fields() { return ITEM_FIELDS[this.context.item.type] ?? []; },
    enriched() {
      // Собрать все enriched*-ключи из контекста для проброса в поля prose/objects.
      const out = {};
      for ( const k of Object.keys(this.context) ) if ( k.startsWith("enriched") ) out[k] = this.context[k];
      return out;
    }
  },
  template: /* html */ `
  <div class="darpg-sheet-content">
    <header class="sheet-header item-header">
      <img class="profile-img" data-action="editImage" data-edit="img" :src="context.document.img" :alt="context.document.name">
      <div class="header-fields">
        <div class="name-row">
          <input class="charname" type="text" name="name" :value="source.name" :placeholder="$localize('DARPG.Sheet.Name')">
        </div>
        <div class="item-type-label">{{ context.typeLabel }}</div>
      </div>
    </header>

    <section class="sheet-body">
      <fieldset class="item-fields">
        <legend>{{ $localize('DARPG.Item.Details') }}</legend>
        <item-field v-for="f in fields" :key="f.path" :field="f" :source="source"
                    :config="config" :enriched="enriched" :uuid="context.document.uuid"></item-field>
      </fieldset>

      <fieldset class="item-source">
        <legend>{{ $localize('DARPG.Item.Source') }}</legend>
        <div class="form-group">
          <label>{{ $localize('DARPG.Item.SourceBook') }}</label>
          <input type="text" name="system.source.book" :value="source.system.source?.book" placeholder="Core Rulebook">
        </div>
        <div class="form-group">
          <label>{{ $localize('DARPG.Item.SourcePage') }}</label>
          <input type="number" name="system.source.page" :value="source.system.source?.page" min="1" step="1" placeholder="—">
        </div>
      </fieldset>

      <fieldset class="item-description">
        <legend>{{ $localize('DARPG.Item.Description') }}</legend>
        <darpg-prose-mirror name="system.description.value" :value="source.system.description?.value ?? ''"
                            :enriched="context.enrichedDescription" :uuid="context.document.uuid"></darpg-prose-mirror>
      </fieldset>
    </section>
  </div>`
};
