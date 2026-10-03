/**
 * Корневой Vue-компонент листа персонажа — «разворот книги» DAO (README ЭТАП 5).
 * Данные приходят пропом `context` из BaseActorSheet#_prepareContext (те же ключи,
 * что были в character.hbs). Формы — нативный submitOnChange (name="system.x"),
 * действия — data-action (делегат ApplicationV2).
 */
export const CharacterSheetApp = {
  name: "CharacterSheetApp",
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
  <div class="darpg-sheet-content book">

    <header class="sheet-header book-header">
      <img class="profile-img" data-action="editImage" data-edit="img" :src="context.document.img" :alt="context.document.name">
      <div class="header-fields">
        <div class="name-row">
          <input class="charname" type="text" name="name" :value="source.name"
                 :placeholder="$localize('DARPG.Sheet.Name')">
        </div>
        <div class="meta-row">
          <label class="meta-field">
            <span>{{ $localize('DARPG.Sheet.Class') }}</span>
            <select name="system.class">
              <option v-for="(label, key) in config.classes" :key="key" :value="key"
                      :selected="key === source.system.class">{{ $localize(label) }}</option>
            </select>
          </label>
          <label class="meta-field">
            <span>{{ $localize('DARPG.Sheet.Level') }}</span>
            <input type="number" name="system.level" :value="source.system.level" min="1" max="20" step="1">
          </label>
          <label class="meta-field grow">
            <span>{{ $localize('DARPG.Sheet.Background') }}</span>
            <input type="text" name="system.background" :value="source.system.background">
          </label>
        </div>
      </div>
    </header>

    <nav class="sheet-tabs tabs book-tabs" data-group="primary">
      <a v-for="(t, id) in tabs" :key="id" :class="navClass(id)" data-action="tab" data-group="primary" :data-tab="id">
        <i v-if="t.icon" :class="t.icon" inert></i>
        <span>{{ $localize(t.label) }}</span>
      </a>
    </nav>

    <section class="sheet-body book-body">

      <!-- ===== CHARACTER: портрет/характеристики | бой/снаряжение ===== -->
      <div class="tab spread" :class="{ active: tabActive('character') }" data-group="primary" data-tab="character"
           v-show="tabActive('character')">
        <div class="book-page left">
          <div class="vitals-row">
            <vital-sphere kind="health" label="DARPG.Sheet.Health" :pct="context.healthPct"
                          value-name="system.health.value" :value="source.system.health.value"
                          max-name="system.health.max" :max="source.system.health.max"></vital-sphere>
            <vital-sphere kind="mana" label="DARPG.Sheet.Mana" :pct="context.manaPct"
                          value-name="system.mana.value" :value="source.system.mana.value"
                          max-name="system.mana.max" :max="source.system.mana.max"></vital-sphere>
            <vital-sphere kind="stunt" label="DARPG.Sheet.StuntPoints" :pct="context.stuntPct"
                          value-name="system.stuntPoints.value" :value="source.system.stuntPoints.value"
                          tooltip="DARPG.Sheet.StuntPointsHint"></vital-sphere>
          </div>

          <section-title label="DARPG.Sheet.Abilities"></section-title>
          <abilities-grid :abilities="context.abilities"></abilities-grid>
        </div>

        <div class="book-page right">
          <section-title label="DARPG.Sheet.CombatStats"></section-title>
          <div class="stats-row">
            <stat-tile label="DARPG.Sheet.Defense" :value="system.defense"></stat-tile>
            <stat-tile label="DARPG.Sheet.ArmorRating" :value="system.armorRating"></stat-tile>
            <stat-tile label="DARPG.Sheet.Speed" :value="system.speed"></stat-tile>
          </div>

          <section-title label="DARPG.Sheet.Weapons" action="createItem" type="weapon"></section-title>
          <ul class="item-list">
            <item-row v-for="i in context.weapons" :key="i.id" :item="i" equip attack>
              <span class="item-detail">{{ $localize(config.weaponGroups[i.system.group]) }}</span>
              <span class="item-detail">{{ i.system.damage }}</span>
            </item-row>
            <empty-row v-if="!context.weapons.length"></empty-row>
          </ul>

          <section-title label="DARPG.Sheet.Armors" action="createItem" type="armor"></section-title>
          <ul class="item-list">
            <item-row v-for="i in context.armors" :key="i.id" :item="i" equip>
              <span class="item-detail">{{ $localize(config.armorTypes[i.system.type]) }}</span>
              <span class="item-detail">{{ $localize('DARPG.Item.Rating') }}: {{ i.system.rating }}</span>
            </item-row>
            <empty-row v-if="!context.armors.length"></empty-row>
          </ul>

          <section-title label="DARPG.Sheet.Shields" action="createItem" type="shield"></section-title>
          <ul class="item-list">
            <item-row v-for="i in context.shields" :key="i.id" :item="i" equip>
              <span class="item-detail">{{ $localize('DARPG.Item.DefenseBonus') }}: +{{ i.system.defenseBonus }}</span>
            </item-row>
            <empty-row v-if="!context.shields.length"></empty-row>
          </ul>

          <section-title label="DARPG.Sheet.Equipment" action="createItem" type="equipment"></section-title>
          <ul class="item-list">
            <item-row v-for="i in context.gear" :key="i.id" :item="i">
              <span class="item-detail">x{{ i.system.quantity }}</span>
              <span class="item-detail">{{ i.system.price }}</span>
            </item-row>
            <empty-row v-if="!context.gear.length"></empty-row>
          </ul>

          <section-title label="DARPG.Sheet.Currency"></section-title>
          <div class="currency-row">
            <label class="meta-field"><span>{{ $localize('DARPG.Sheet.Gold') }}</span>
              <input type="number" name="system.currency.gold" :value="source.system.currency.gold" min="0" step="1"></label>
            <label class="meta-field"><span>{{ $localize('DARPG.Sheet.Silver') }}</span>
              <input type="number" name="system.currency.silver" :value="source.system.currency.silver" min="0" step="1"></label>
            <label class="meta-field"><span>{{ $localize('DARPG.Sheet.Copper') }}</span>
              <input type="number" name="system.currency.copper" :value="source.system.currency.copper" min="0" step="1"></label>
          </div>
        </div>
      </div>

      <!-- ===== GRIMUAR: статистика заклинателя | заклинания ===== -->
      <div class="tab spread" :class="{ active: tabActive('grimuar') }" data-group="primary" data-tab="grimuar"
           v-show="tabActive('grimuar')">
        <div class="book-page left">
          <section-title label="DARPG.Sheet.CasterStats"></section-title>
          <div class="stats-row">
            <stat-tile label="DARPG.Sheet.Spellpower" :value="system.spellpower"></stat-tile>
            <stat-tile label="DARPG.Sheet.Mana"><template #default>{{ system.mana.value }}<span class="sep">/</span>{{ system.mana.max }}</template></stat-tile>
          </div>
          <section-title label="DARPG.Sheet.Schools"></section-title>
          <ul class="school-list">
            <li v-for="(label, key) in config.schools" :key="key" class="school-chip">{{ $localize(label) }}</li>
          </ul>
        </div>

        <div class="book-page right">
          <section-title label="DARPG.Sheet.Spells" action="createItem" type="spell"></section-title>
          <template v-for="g in context.spellsBySchool" :key="g.school">
            <h4 class="subsection-title">{{ $localize(g.label) }}</h4>
            <ul class="item-list">
              <item-row v-for="i in g.spells" :key="i.id" :item="i" cast>
                <span class="item-detail">{{ $localize('DARPG.Item.ManaCost') }}: {{ i.system.manaCost }}</span>
                <span class="item-detail">TN {{ i.system.targetNumber }}</span>
              </item-row>
            </ul>
          </template>
          <ul v-if="!context.spellsBySchool.length" class="item-list"><empty-row></empty-row></ul>
        </div>
      </div>

      <!-- ===== TALENTS: фокусы | таланты и специализации ===== -->
      <div class="tab spread" :class="{ active: tabActive('talents') }" data-group="primary" data-tab="talents"
           v-show="tabActive('talents')">
        <div class="book-page left">
          <section-title label="DARPG.Sheet.Focuses" action="addFocus" tooltip="DARPG.Sheet.AddFocus"></section-title>
          <template v-for="g in context.focusesByAbility" :key="g.ability">
            <h4 class="subsection-title">{{ $localize(g.label) }}</h4>
            <ul class="focus-list">
              <focus-row v-for="f in g.focuses" :key="f.index" :focus="f" :abilities="config.abilities"></focus-row>
            </ul>
          </template>
          <ul v-if="!context.focusesByAbility.length" class="focus-list"><empty-row></empty-row></ul>
        </div>

        <div class="book-page right">
          <section-title label="DARPG.Sheet.Talents" action="createItem" type="talent"></section-title>
          <ul class="item-list">
            <item-row v-for="i in context.talents" :key="i.id" :item="i">
              <span class="item-detail degree" :class="i.system.degree">{{ $localize(config.degrees[i.system.degree]) }}</span>
            </item-row>
            <empty-row v-if="!context.talents.length"></empty-row>
          </ul>

          <section-title label="DARPG.Sheet.Specializations" action="createItem" type="specialization"></section-title>
          <ul class="item-list">
            <item-row v-for="i in context.specializations" :key="i.id" :item="i">
              <span class="item-detail">{{ $localize(config.classes[i.system.class]) }}</span>
              <span class="item-detail degree" :class="i.system.degree">{{ $localize(config.degrees[i.system.degree]) }}</span>
            </item-row>
            <empty-row v-if="!context.specializations.length"></empty-row>
          </ul>
        </div>
      </div>

      <!-- ===== BACKGROUND: предыстория/приёмы | дневник (без Кодекса) ===== -->
      <div class="tab spread" :class="{ active: tabActive('background') }" data-group="primary" data-tab="background"
           v-show="tabActive('background')">
        <div class="book-page left">
          <section-title label="DARPG.Sheet.Background"></section-title>
          <label class="meta-field grow">
            <input type="text" name="system.background" :value="source.system.background"
                   :placeholder="$localize('DARPG.Sheet.BackgroundPlaceholder')">
          </label>

          <section-title label="DARPG.Sheet.FavoredStunts" action="createItem" type="stunt"></section-title>
          <ul class="item-list">
            <item-row v-for="i in context.stunts" :key="i.id" :item="i">
              <span class="item-detail">{{ $localize(config.stuntTypes[i.system.stuntType]) }}</span>
              <span class="item-detail">{{ i.system.costText }} SP</span>
            </item-row>
            <empty-row v-if="!context.stunts.length"></empty-row>
          </ul>
        </div>

        <div class="book-page right">
          <section-title label="DARPG.Sheet.Biography"></section-title>
          <darpg-prose-mirror name="system.biography" :value="source.system.biography"
                              :enriched="context.enrichedBiography" :uuid="context.document.uuid"></darpg-prose-mirror>
        </div>
      </div>

    </section>
  </div>`
};
