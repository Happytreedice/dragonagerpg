/**
 * Корневой Vue-компонент листа НИП/существа бестиария (§21).
 * Вкладки: Основное (характеристики+фокусы) | Бой (атаки статблока, оружие,
 * заклинания, таланты, силы) | Биография. Данные — из BaseActorSheet#_prepareContext
 * + NpcSheet#_prepareContext (enrichedPowers).
 */
export const NpcSheetApp = {
  name: "NpcSheetApp",
  props: {
    context: { type: Object, required: true },
    app: { type: Object, required: true }
  },
  computed: {
    system() { return this.context.system; },
    source() { return this.context.source; },
    tabs() { return this.context.tabs ?? {}; },
    config() { return this.context.config; }
  },
  methods: {
    tabActive(id) { return this.tabs[id]?.active; },
    navClass(id) { return this.tabs[id]?.cssClass ?? ""; }
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
              <option v-for="(label, key) in config.threatLevels" :key="key" :value="key"
                      :selected="key === source.system.threat">{{ $localize(label) }}</option>
            </select>
          </label>
          <label class="meta-field">
            <span>{{ $localize('DARPG.Sheet.CreatureType') }}</span>
            <select name="system.creatureType">
              <option v-for="(label, key) in config.creatureTypes" :key="key" :value="key"
                      :selected="key === source.system.creatureType">{{ $localize(label) }}</option>
            </select>
          </label>
          <label class="meta-field">
            <span>{{ $localize('DARPG.Sheet.Size') }}</span>
            <select name="system.size">
              <option v-for="(label, key) in config.sizes" :key="key" :value="key"
                      :selected="key === source.system.size">{{ $localize(label) }}</option>
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
          <div class="stat-tile derived">
            <span class="stat-label">{{ $localize('DARPG.Sheet.Defense') }}</span>
            <input class="stat-value" type="number" name="system.defense" :value="source.system.defense" step="1" :placeholder="system.defense">
          </div>
          <div class="stat-tile derived">
            <span class="stat-label">{{ $localize('DARPG.Sheet.ArmorRating') }}</span>
            <input class="stat-value" type="number" name="system.armorRating" :value="source.system.armorRating" min="0" step="1">
          </div>
          <div class="stat-tile derived">
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
        </ul>
      </div>

      <!-- Бой: атаки статблока + оружие/заклинания/таланты + силы -->
      <div class="tab combat" :class="{ active: tabActive('combat') }" data-group="primary" data-tab="combat" v-show="tabActive('combat')">
        <section-title label="DARPG.Sheet.Attacks"></section-title>
        <ul class="statblock-list">
          <li v-for="(atk, i) in system.attacks" :key="i" class="statblock-row">
            <span class="attack-name">{{ atk.name }}</span>
            <span class="item-detail">{{ $localize(config.abilities[atk.ability]) }}<template v-if="atk.bonus"> {{ atk.bonus >= 0 ? '+' : '' }}{{ atk.bonus }}</template></span>
            <span class="item-detail">{{ atk.damage }}<template v-if="atk.penetrating"> ({{ $localize('DARPG.Sheet.Penetrating') }})</template></span>
            <span v-if="atk.range" class="item-detail">{{ atk.range }}</span>
          </li>
          <li v-if="!system.attacks.length" class="statblock-row empty">{{ $localize('DARPG.Sheet.Empty') }}</li>
        </ul>

        <section-title label="DARPG.Sheet.Weapons" action="createItem" type="weapon"></section-title>
        <ul class="item-list">
          <item-row v-for="i in context.weapons" :key="i.id" :item="i" attack>
            <span class="item-detail">{{ i.system.damage }}</span>
          </item-row>
          <empty-row v-if="!context.weapons.length"></empty-row>
        </ul>

        <section-title label="DARPG.Sheet.Spells" action="createItem" type="spell"></section-title>
        <ul class="item-list">
          <item-row v-for="i in context.spells" :key="i.id" :item="i" cast>
            <span class="item-detail">{{ $localize('DARPG.Item.ManaCost') }}: {{ i.system.manaCost }}</span>
            <span class="item-detail">TN {{ i.system.targetNumber }}</span>
          </item-row>
          <empty-row v-if="!context.spells.length"></empty-row>
        </ul>

        <section-title label="DARPG.Sheet.Talents" action="createItem" type="talent"></section-title>
        <ul class="item-list">
          <item-row v-for="i in context.talents" :key="i.id" :item="i">
            <span class="item-detail">{{ $localize(config.degrees[i.system.degree]) }}</span>
          </item-row>
          <empty-row v-if="!context.talents.length"></empty-row>
        </ul>

        <template v-if="system.favoredStunts">
          <section-title label="DARPG.Sheet.FavoredStunts"></section-title>
          <p class="statblock-text">{{ system.favoredStunts }}</p>
        </template>
        <template v-if="system.weakness">
          <section-title label="DARPG.Sheet.Weakness"></section-title>
          <p class="statblock-text">{{ system.weakness }}</p>
        </template>
        <template v-if="system.immunity">
          <section-title label="DARPG.Sheet.Immunity"></section-title>
          <p class="statblock-text">{{ system.immunity }}</p>
        </template>

        <section-title label="DARPG.Sheet.Powers"></section-title>
        <darpg-prose-mirror name="system.powers" :value="source.system.powers"
                            :enriched="context.enrichedPowers" :uuid="context.document.uuid"></darpg-prose-mirror>

        <template v-if="system.equipmentText">
          <section-title label="DARPG.Sheet.Equipment"></section-title>
          <p class="statblock-text">{{ system.equipmentText }}</p>
        </template>
      </div>

      <!-- Биография -->
      <div class="tab biography" :class="{ active: tabActive('biography') }" data-group="primary" data-tab="biography" v-show="tabActive('biography')">
        <darpg-prose-mirror name="system.biography" :value="source.system.biography"
                            :enriched="context.enrichedBiography" :uuid="context.document.uuid"></darpg-prose-mirror>
      </div>

    </section>
  </div>`
};
