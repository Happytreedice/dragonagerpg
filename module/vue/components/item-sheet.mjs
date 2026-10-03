/**
 * Корневой Vue-компонент листа предмета (все 15 типов Item).
 *
 * Поля каждого типа заданы декларативно в ITEM_FIELDS (kind: select/text/number/
 * checkbox/prose) и отрисовываются универсальным <item-field>. Это заменяет 15
 * .hbs-партиалов templates/item/parts/*, сохраняя ровно те же name="system.x"
 * и порядок полей. ProseMirror-поля берут обогащённый HTML из context.enriched*.
 */

/** Опции select берутся из CONFIG.DARPG по ключу конфиг-группы. */
export const ITEM_FIELDS = {
  weapon: [
    { kind: "select", key: "group", label: "DARPG.Item.Group", options: "weaponGroups" },
    { kind: "select", key: "attackAbility", label: "DARPG.Item.AttackAbility", options: "abilities" },
    { kind: "text", key: "damage", label: "DARPG.Item.Damage", placeholder: "2d6" },
    { kind: "text", key: "range", label: "DARPG.Item.Range" },
    { kind: "number", key: "minStr", label: "DARPG.Item.MinStr", step: 1 },
    { kind: "text", key: "price", label: "DARPG.Item.Price" },
    { kind: "checkbox", key: "equipped", label: "DARPG.Sheet.Equipped" }
  ],
  armor: [
    { kind: "select", key: "type", label: "DARPG.Item.ArmorType", options: "armorTypes" },
    { kind: "number", key: "rating", label: "DARPG.Item.Rating", min: 0, step: 1 },
    { kind: "number", key: "penalty", label: "DARPG.Item.Penalty", min: 0, step: 1 },
    { kind: "text", key: "price", label: "DARPG.Item.Price" },
    { kind: "checkbox", key: "equipped", label: "DARPG.Sheet.Equipped" }
  ],
  shield: [
    { kind: "number", key: "defenseBonus", label: "DARPG.Item.DefenseBonus", min: 1, max: 3, step: 1 },
    { kind: "text", key: "price", label: "DARPG.Item.Price" },
    { kind: "checkbox", key: "equipped", label: "DARPG.Sheet.Equipped" }
  ],
  spell: [
    { kind: "select", key: "school", label: "DARPG.Item.School", options: "schools" },
    { kind: "select", key: "spellType", label: "DARPG.Item.SpellType", options: "spellTypes" },
    { kind: "text", key: "manaCost", label: "DARPG.Item.ManaCost" },
    { kind: "text", key: "castingTime", label: "DARPG.Item.CastingTime" },
    { kind: "number", key: "targetNumber", label: "DARPG.Item.TargetNumber", min: 0, step: 1 },
    { kind: "text", key: "test", label: "DARPG.Item.Test" },
    { kind: "text", key: "requirements", label: "DARPG.Item.Requirements" }
  ],
  equipment: [
    { kind: "number", key: "quantity", label: "DARPG.Item.Quantity", min: 0, step: 1 },
    { kind: "number", key: "weight", label: "DARPG.Item.Weight", min: 0, step: 0.1 },
    { kind: "text", key: "price", label: "DARPG.Item.Price" }
  ],
  focus: [
    { kind: "select", key: "ability", label: "DARPG.Item.Ability", options: "abilities" },
    { kind: "checkbox", key: "improved", label: "DARPG.Item.FocusImproved" }
  ],
  consumable: [
    { kind: "select", key: "consumableType", label: "DARPG.Item.ConsumableType", options: "consumableTypes" },
    { kind: "text", key: "formula", label: "DARPG.Item.Formula" },
    { kind: "number", key: "quantity", label: "DARPG.Item.Quantity", min: 0, step: 1 },
    { kind: "text", key: "price", label: "DARPG.Item.Price" }
  ],
  rune: [
    { kind: "select", key: "slot", label: "DARPG.Item.RuneSlot", options: "runeSlots" },
    { kind: "select", key: "degree", label: "DARPG.Item.Degree", options: "degrees" },
    { kind: "text", key: "effect", label: "DARPG.Item.RuneEffect" }
  ],
  honorific: [
    { kind: "text", key: "effect", label: "DARPG.Item.HonorificEffect" }
  ],
  title: [
    { kind: "select", key: "tier", label: "DARPG.Item.TitleTier", options: "titleTiers" },
    { kind: "text", key: "structure", label: "DARPG.Item.TitleStructure" },
    { kind: "text", key: "resources", label: "DARPG.Item.TitleResources" }
  ],
  stunt: [
    { kind: "select", key: "stuntType", label: "DARPG.Item.StuntType", options: "stuntTypes" },
    { kind: "text", key: "costText", label: "DARPG.Item.StuntCost" },
    { kind: "number", key: "cost", label: "DARPG.Item.StuntCostValue", min: 0, step: 1 }
  ],
  talent: [
    { kind: "select", key: "degree", label: "DARPG.Item.Degree", options: "degrees" },
    { kind: "text", key: "requirements", label: "DARPG.Item.Requirements" },
    { kind: "prose", key: "descriptionNovice", label: "DARPG.Item.DescriptionNovice", enriched: "enrichedNovice" },
    { kind: "prose", key: "descriptionJourneyman", label: "DARPG.Item.DescriptionJourneyman", enriched: "enrichedJourneyman" },
    { kind: "prose", key: "descriptionMaster", label: "DARPG.Item.DescriptionMaster", enriched: "enrichedMaster" }
  ],
  specialization: [
    { kind: "select", key: "class", label: "DARPG.Item.Class", options: "classes" },
    { kind: "select", key: "degree", label: "DARPG.Item.Degree", options: "degrees" },
    { kind: "text", key: "requirements", label: "DARPG.Item.Requirements" },
    { kind: "prose", key: "descriptionNovice", label: "DARPG.Item.DescriptionNovice", enriched: "enrichedNovice" },
    { kind: "prose", key: "descriptionJourneyman", label: "DARPG.Item.DescriptionJourneyman", enriched: "enrichedJourneyman" },
    { kind: "prose", key: "descriptionMaster", label: "DARPG.Item.DescriptionMaster", enriched: "enrichedMaster" }
  ],
  background: [
    { kind: "select", key: "race", label: "DARPG.Item.Race", options: "races" },
    { kind: "select", key: "abilityBonus", label: "DARPG.Item.AbilityBonus", options: "abilities", blank: true },
    { kind: "text", key: "focusChoice", label: "DARPG.Item.FocusChoice" },
    { kind: "text", key: "languages", label: "DARPG.Item.Languages" },
    { kind: "prose", key: "benefits", label: "DARPG.Item.Benefits", enriched: "enrichedBenefits" }
  ],
  class: [
    { kind: "select", key: "key", label: "DARPG.Item.ClassKey", options: "classes" },
    { kind: "text", key: "startingHealth", label: "DARPG.Item.StartingHealth" },
    { kind: "text", key: "weaponGroups", label: "DARPG.Item.WeaponGroups" },
    { kind: "prose", key: "powers", label: "DARPG.Item.ClassPowers", enriched: "enrichedPowers" }
  ]
};

/** Универсальный рендер одного поля предмета. */
export const ItemField = {
  name: "ItemField",
  props: {
    field: { type: Object, required: true },
    source: { type: Object, required: true },       // item._source
    config: { type: Object, required: true },       // CONFIG.DARPG
    enriched: { type: Object, required: true },      // {enrichedNovice: "...", ...}
    uuid: { type: String, required: true }
  },
  computed: {
    name() { return "system." + this.field.key; },
    value() { return this.source.system[this.field.key]; },
    options() { return this.field.options ? this.config[this.field.options] : null; }
  },
  template: /* html */ `
    <div class="form-group" :class="{ stacked: field.kind === 'prose' }">
      <label>{{ $localize(field.label) }}</label>

      <select v-if="field.kind === 'select'" :name="name">
        <option v-if="field.blank" value="">—</option>
        <option v-for="(label, key) in options" :key="key" :value="key"
                :selected="key === value">{{ $localize(label) }}</option>
      </select>

      <input v-else-if="field.kind === 'text'" type="text" :name="name" :value="value"
             :placeholder="field.placeholder || ''">

      <input v-else-if="field.kind === 'number'" type="number" :name="name" :value="value"
             :min="field.min ?? null" :max="field.max ?? null" :step="field.step ?? 1">

      <input v-else-if="field.kind === 'checkbox'" type="checkbox" :name="name" :checked="value">

      <darpg-prose-mirror v-else-if="field.kind === 'prose'" :name="name" :value="value"
                          :enriched="enriched[field.enriched] || ''" :uuid="uuid"></darpg-prose-mirror>
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
      // Собрать все enriched*-ключи из контекста для проброса в поля prose.
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
        <item-field v-for="f in fields" :key="f.key" :field="f" :source="source"
                    :config="config" :enriched="enriched" :uuid="context.document.uuid"></item-field>
        <div class="form-group">
          <label>{{ $localize('DARPG.Item.Source') }}</label>
          <input type="text" name="system.source" :value="source.system.source" placeholder="Core Rulebook, p. ">
        </div>
      </fieldset>

      <fieldset class="item-description">
        <legend>{{ $localize('DARPG.Item.Description') }}</legend>
        <darpg-prose-mirror name="system.description" :value="source.system.description"
                            :enriched="context.enrichedDescription" :uuid="context.document.uuid"></darpg-prose-mirror>
      </fieldset>
    </section>
  </div>`
};
