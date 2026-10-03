/**
 * Корневой Vue-компонент листа НИП/существа бестиария (статблок книги).
 * Вкладки: Основное (характеристики+фокусы) | Бой (атаки статблока, особые силы,
 * избранные приёмы, таланты, группы оружия, снаряжение; предметы-оружие/заклинания/
 * таланты) | Биография. Данные — из BaseActorSheet#_prepareContext +
 * NpcSheet#_prepareContext (enrichedPowers).
 *
 * Массивы статблока редактируются инпутами name="system.<массив>.N[.поле]" (все поля
 * каждого элемента в форме) + действиями addEntry/deleteEntry/toggleChoice.
 */

/** Колонки атак статблока — ВСЕ поля элемента system.attacks. */
const ATTACK_COLUMNS = [
  { key: "name", kind: "text", label: "DARPG.Sheet.AttackName", class: "grow" },
  { key: "attackRoll", kind: "number", label: "DARPG.Sheet.AttackRoll", class: "narrow", step: 1 },
  { key: "damage", kind: "text", label: "DARPG.Sheet.Damage", class: "medium", placeholder: "DARPG.Sheet.DamagePlaceholder" },
  { key: "penetrating", kind: "checkbox", label: "DARPG.Sheet.PenetratingShort", class: "tiny" },
  { key: "range", kind: "text", label: "DARPG.Sheet.Range", class: "medium", placeholder: "DARPG.Sheet.RangePlaceholder" },
  { key: "notes", kind: "text", label: "DARPG.Sheet.Notes", class: "grow" }
];

export const NpcSheetApp = {
  name: "NpcSheetApp",
  props: {
    context: { type: Object, required: true },
    app: { type: Object, required: true }
  },
  data() {
    return { attackColumns: ATTACK_COLUMNS };
  },
  computed: {
    system() { return this.context.system; },
    source() { return this.context.source; },
    tabs() { return this.context.tabs ?? {}; },
    config() { return this.context.config; },
    attacks() { return this.source.system.attacks ?? []; },
    favoredStunts() { return this.source.system.favoredStunts ?? []; },
    statTalents() { return this.source.system.talents ?? []; },
    weaponGroups() { return this.source.system.weaponGroups ?? []; },
    equipment() { return this.source.system.equipment ?? []; }
  },
  methods: {
    tabActive(id) { return this.tabs[id]?.active; },
    navClass(id) { return this.tabs[id]?.cssClass ?? ""; },
    labelOf(table, key) { return this.$label(this.config[table]?.[key]); },
    damageText(item) {
      const dice = item.system.damage?.dice || "—";
      const ability = item.system.damage?.ability;
      if ( !ability ) return dice;
      return `${dice} + ${this.$localize(`DARPG.AbilityAbbr.${ability.charAt(0).toUpperCase()}${ability.slice(1)}`)}`;
    },
    tnText(item) {
      const tn = item.system.tn;
      return `${this.$localize("DARPG.Sheet.TN")} ${(tn === null) || (tn === undefined) ? "—" : tn}`;
    }
  },
  template: /* html */ `
  <div class="darpg-sheet-content">

    <header class="sheet-header">
      <img class="profile-img" data-action="editImage" data-edit="img" :src="context.document.img" :alt="context.document.name">
      <div class="header-fields">
        <div class="name-row">
          <input class="charname" type="text" name="name" :value="source.name" :placeholder="$localize('DARPG.Sheet.Name')">
        </div>
        <div class="meta-row">
          <label class="meta-field">
            <span>{{ $localize('DARPG.Sheet.Threat') }}</span>
            <select name="system.threat">
              <option v-for="(entry, key) in config.threatLevels" :key="key" :value="key"
                      :selected="key === source.system.threat">{{ $label(entry) }}</option>
            </select>
          </label>
          <label class="meta-field">
            <span>{{ $localize('DARPG.Sheet.CreatureType') }}</span>
            <select name="system.creatureType">
              <option v-for="(entry, key) in config.creatureTypes" :key="key" :value="key"
                      :selected="key === source.system.creatureType">{{ $label(entry) }}</option>
            </select>
          </label>
          <label class="meta-field">
            <span>{{ $localize('DARPG.Sheet.Size') }}</span>
            <select name="system.size">
              <option v-for="(entry, key) in config.sizes" :key="key" :value="key"
                      :selected="key === source.system.size">{{ $label(entry) }}</option>
            </select>
          </label>
        </div>
        <div class="stats-row">
          <div class="stat-tile resource">
            <span class="stat-label">{{ $localize('DARPG.Sheet.Health') }}</span>
            <span class="stat-value">
              <input type="number" name="system.health.value" :value="source.system.health.value" min="0" step="1">
              <span class="sep">/</span>
              <input type="number" name="system.health.max" :value="source.system.health.max" min="0" step="1">
            </span>
          </div>
          <div class="stat-tile resource">
            <span class="stat-label">{{ $localize('DARPG.Sheet.Mana') }}</span>
            <span class="stat-value">
              <input type="number" name="system.mana.value" :value="source.system.mana.value" min="0" step="1">
              <span class="sep">/</span>
              <input type="number" name="system.mana.max" :value="source.system.mana.max" min="0" step="1">
            </span>
          </div>
          <div class="stat-tile derived" :data-tooltip="$localize('DARPG.Sheet.DerivedHint')">
            <span class="stat-label">{{ $localize('DARPG.Sheet.Defense') }}</span>
            <input class="stat-value" type="number" name="system.defense" :value="source.system.defense" step="1" :placeholder="system.defense">
          </div>
          <div class="stat-tile derived">
            <span class="stat-label">{{ $localize('DARPG.Sheet.ArmorRating') }}</span>
            <input class="stat-value" type="number" name="system.armorRating" :value="source.system.armorRating" min="0" step="1">
          </div>
          <div class="stat-tile derived" :data-tooltip="$localize('DARPG.Sheet.DerivedHint')">
            <span class="stat-label">{{ $localize('DARPG.Sheet.Speed') }}</span>
            <input class="stat-value" type="number" name="system.speed" :value="source.system.speed" step="1" :placeholder="system.speed">
          </div>
        </div>
      </div>
    </header>

    <nav class="sheet-tabs tabs" data-group="primary">
      <a v-for="(t, id) in tabs" :key="id" :class="navClass(id)" data-action="tab" data-group="primary" :data-tab="id">
        <i v-if="t.icon" :class="t.icon" inert></i>
        <span>{{ $localize(t.label) }}</span>
      </a>
    </nav>

    <section class="sheet-body">

      <!-- Основное: характеристики + фокусы -->
      <div class="tab main" :class="{ active: tabActive('main') }" data-group="primary" data-tab="main" v-show="tabActive('main')">
        <section-title label="DARPG.Sheet.Abilities"></section-title>
        <abilities-grid :abilities="context.abilities" compact></abilities-grid>

        <section-title label="DARPG.Sheet.Focuses" action="addFocus" tooltip="DARPG.Sheet.AddFocus"></section-title>
        <ul class="focus-list">
          <focus-row v-for="f in context.focuses" :key="f.index" :focus="f" :abilities="config.abilities"></focus-row>
          <empty-row v-if="!context.focuses.length"></empty-row>
        </ul>
      </div>

      <!-- Бой: статблок (атаки, силы, приёмы, таланты, группы оружия, снаряжение) + предметы -->
      <div class="tab combat" :class="{ active: tabActive('combat') }" data-group="primary" data-tab="combat" v-show="tabActive('combat')">
        <section-title label="DARPG.Sheet.Attacks" action="addEntry" path="system.attacks"
                       tooltip="DARPG.Sheet.AddEntry"></section-title>
        <object-list class="statblock-attacks" path="system.attacks" :rows="attacks" :columns="attackColumns"
                     :uuid="context.document.uuid">
          <template #actions>
            <a class="control-btn" data-action="rollStatblockAttack" :data-tooltip="$localize('DARPG.Sheet.Attack')">
              <i class="fa-solid fa-crosshairs" inert></i>
            </a>
            <a class="control-btn" data-action="rollStatblockDamage" :data-tooltip="$localize('DARPG.Sheet.Damage')">
              <i class="fa-solid fa-burst" inert></i>
            </a>
          </template>
        </object-list>

        <section-title label="DARPG.Sheet.Powers"></section-title>
        <darpg-prose-mirror name="system.powers" :value="source.system.powers ?? ''"
                            :enriched="context.enrichedPowers" :uuid="context.document.uuid"></darpg-prose-mirror>

        <div class="statblock-lists">
          <div class="statblock-list">
            <section-title label="DARPG.Sheet.FavoredStunts" action="addEntry" path="system.favoredStunts"
                           tooltip="DARPG.Sheet.AddEntry"></section-title>
            <string-list path="system.favoredStunts" :values="favoredStunts"
                         placeholder="DARPG.Sheet.FavoredStuntPlaceholder"></string-list>
          </div>
          <div class="statblock-list">
            <section-title label="DARPG.Sheet.StatblockTalents" action="addEntry" path="system.talents"
                           tooltip="DARPG.Sheet.AddEntry"></section-title>
            <string-list path="system.talents" :values="statTalents"
                         placeholder="DARPG.Sheet.TalentPlaceholder"></string-list>
          </div>
          <div class="statblock-list">
            <section-title label="DARPG.Sheet.Equipment" action="addEntry" path="system.equipment"
                           tooltip="DARPG.Sheet.AddEntry"></section-title>
            <string-list path="system.equipment" :values="equipment"
                         placeholder="DARPG.Sheet.EquipmentPlaceholder"></string-list>
          </div>
        </div>

        <section-title label="DARPG.Sheet.WeaponGroups"></section-title>
        <choice-chips path="system.weaponGroups" :value="weaponGroups" :options="config.weaponGroups"></choice-chips>

        <section-title label="DARPG.Sheet.Weapons" action="createItem" type="weapon"></section-title>
        <ul class="item-list">
          <item-row v-for="i in context.weapons" :key="i.id" :item="i" attack>
            <span class="item-detail">{{ labelOf('weaponGroups', i.system.weaponGroup) }}</span>
            <span class="item-detail">{{ damageText(i) }}</span>
          </item-row>
          <empty-row v-if="!context.weapons.length"></empty-row>
        </ul>

        <section-title label="DARPG.Sheet.Spells" action="createItem" type="spell"></section-title>
        <ul class="item-list">
          <item-row v-for="i in context.spells" :key="i.id" :item="i" cast>
            <span class="item-detail">{{ $localize('DARPG.Sheet.ManaShort') }} {{ i.system.manaCost }}{{ i.system.manaCostNote }}</span>
            <span class="item-detail">{{ tnText(i) }}</span>
          </item-row>
          <empty-row v-if="!context.spells.length"></empty-row>
        </ul>

        <section-title label="DARPG.Sheet.TalentItems" action="createItem" type="talent"></section-title>
        <ul class="item-list">
          <item-row v-for="i in context.talents" :key="i.id" :item="i">
            <span class="item-detail degree" :class="i.system.degree">{{ labelOf('degrees', i.system.degree) }}</span>
          </item-row>
          <empty-row v-if="!context.talents.length"></empty-row>
        </ul>
      </div>

      <!-- Биография -->
      <div class="tab biography" :class="{ active: tabActive('biography') }" data-group="primary" data-tab="biography" v-show="tabActive('biography')">
        <darpg-prose-mirror name="system.biography" :value="source.system.biography ?? ''"
                            :enriched="context.enrichedBiography" :uuid="context.document.uuid"></darpg-prose-mirror>
      </div>

    </section>
  </div>`
};
