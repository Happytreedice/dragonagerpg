/**
 * Константы системы Dragon Age RPG (AGE System).
 * Все значения — i18n-ключи, локализуются в шаблонах и коде.
 */
export const DARPG = {};

/** Восемь характеристик AGE. */
DARPG.abilities = {
  communication: "DARPG.Ability.Communication",
  constitution: "DARPG.Ability.Constitution",
  cunning: "DARPG.Ability.Cunning",
  dexterity: "DARPG.Ability.Dexterity",
  magic: "DARPG.Ability.Magic",
  perception: "DARPG.Ability.Perception",
  strength: "DARPG.Ability.Strength",
  willpower: "DARPG.Ability.Willpower"
};

/** Группы оружия. */
DARPG.weaponGroups = {
  "axes": "DARPG.WeaponGroup.Axes",
  "bludgeons": "DARPG.WeaponGroup.Bludgeons",
  "bows": "DARPG.WeaponGroup.Bows",
  "brawling": "DARPG.WeaponGroup.Brawling",
  "dueling": "DARPG.WeaponGroup.Dueling",
  "heavy-blades": "DARPG.WeaponGroup.HeavyBlades",
  "lances": "DARPG.WeaponGroup.Lances",
  "light-blades": "DARPG.WeaponGroup.LightBlades",
  "polearms": "DARPG.WeaponGroup.Polearms",
  "spears": "DARPG.WeaponGroup.Spears",
  "staves": "DARPG.WeaponGroup.Staves",
  "black-powder": "DARPG.WeaponGroup.BlackPowder"
};

/** Дальнобойные группы: урон без бонуса Силы. */
DARPG.rangedGroups = ["bows", "black-powder"];

/** Типы брони. */
DARPG.armorTypes = {
  light: "DARPG.ArmorType.Light",
  medium: "DARPG.ArmorType.Medium",
  heavy: "DARPG.ArmorType.Heavy",
  plate: "DARPG.ArmorType.Plate"
};

/** Степени талантов и специализаций. */
DARPG.degrees = {
  novice: "DARPG.Degree.Novice",
  journeyman: "DARPG.Degree.Journeyman",
  master: "DARPG.Degree.Master"
};

/** Типы заклинаний. */
DARPG.spellTypes = {
  attack: "DARPG.SpellType.Attack",
  defense: "DARPG.SpellType.Defense",
  utility: "DARPG.SpellType.Utility",
  enhancement: "DARPG.SpellType.Enhancement"
};

/** Школы магии (кровь — только специализация «Маг крови»). */
DARPG.schools = {
  creation: "DARPG.School.Creation",
  entropy: "DARPG.School.Entropy",
  primal: "DARPG.School.Primal",
  spirit: "DARPG.School.Spirit",
  blood: "DARPG.School.Blood"
};

/** Классы персонажей. */
DARPG.classes = {
  mage: "DARPG.Class.Mage",
  rogue: "DARPG.Class.Rogue",
  warrior: "DARPG.Class.Warrior"
};

/** Расы (для происхождений). spec §6. */
DARPG.races = {
  dwarf: "DARPG.Race.Dwarf",
  elf: "DARPG.Race.Elf",
  human: "DARPG.Race.Human",
  qunari: "DARPG.Race.Qunari"
};

/** Типы стант-приёмов. spec §3.2–3.4, §10.5–10.6. */
DARPG.stuntTypes = {
  combat: "DARPG.StuntType.Combat",
  exploration: "DARPG.StuntType.Exploration",
  roleplaying: "DARPG.StuntType.Roleplaying",
  spell: "DARPG.StuntType.Spell",
  advancedSpell: "DARPG.StuntType.AdvancedSpell",
  special: "DARPG.StuntType.Special"
};

/** Типы расходников. spec §12.5, §13.1–13.2. */
DARPG.consumableTypes = {
  potion: "DARPG.ConsumableType.Potion",
  poison: "DARPG.ConsumableType.Poison",
  grenade: "DARPG.ConsumableType.Grenade"
};

/** Типы существ бестиария. spec §21. */
DARPG.creatureTypes = {
  humanoid: "DARPG.CreatureType.Humanoid",
  beast: "DARPG.CreatureType.Beast",
  darkspawn: "DARPG.CreatureType.Darkspawn",
  dragon: "DARPG.CreatureType.Dragon",
  undead: "DARPG.CreatureType.Undead",
  demon: "DARPG.CreatureType.Demon",
  spirit: "DARPG.CreatureType.Spirit",
  golem: "DARPG.CreatureType.Golem",
  other: "DARPG.CreatureType.Other"
};

/** Уровни угрозы NPC. spec §21. */
DARPG.threatLevels = {
  minor: "DARPG.Threat.Minor",
  moderate: "DARPG.Threat.Moderate",
  major: "DARPG.Threat.Major",
  dire: "DARPG.Threat.Dire",
  legendary: "DARPG.Threat.Legendary"
};

/** Размеры существ. spec §21 / Гл.12. */
DARPG.sizes = {
  tiny: "DARPG.Size.Tiny",
  small: "DARPG.Size.Small",
  average: "DARPG.Size.Average",
  large: "DARPG.Size.Large",
  huge: "DARPG.Size.Huge",
  colossal: "DARPG.Size.Colossal"
};

/** Слоты рун. spec §14.3. */
DARPG.runeSlots = {
  weapon: "DARPG.RuneSlot.Weapon",
  armor: "DARPG.RuneSlot.Armor"
};

/** Ступени титулов. spec §15.2. */
DARPG.titleTiers = {
  1: "DARPG.TitleTier.One",
  2: "DARPG.TitleTier.Two",
  3: "DARPG.TitleTier.Three"
};

/** Бонус подходящего фокуса к тесту. */
DARPG.focusBonus = 2;
