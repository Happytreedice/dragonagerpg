/**
 * Константы системы Dragon Age RPG (AGE System).
 * Подписи — i18n-ключи `DARPG.*`, локализуются в шаблонах и коде.
 *
 * Таблицы двух видов:
 *   • плоские — `ключ → i18n-ключ подписи` (abilities, schools, degrees…);
 *   • таблицы объектов — `ключ → { label, …параметры }` (weaponGroups, armorTypes,
 *     shieldTypes, classes, races, difficulties). Подпись такой записи — `.label`.
 * Универсальный доступ к подписи — DARPG.label(table, key), к плоской карте
 * опций для select — DARPG.choices(table).
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

/**
 * Сокращения характеристик → ключ характеристики (синтаксис энричеров:
 * `[[/test dex focus=Stealth]]`). `wp` — устаревший синоним Воли.
 */
DARPG.abilityAbbreviations = {
  com: "communication",
  con: "constitution",
  cun: "cunning",
  dex: "dexterity",
  mag: "magic",
  per: "perception",
  str: "strength",
  wil: "willpower",
  wp: "willpower"
};

/**
 * Группы оружия и характеристика броска атаки для каждой группы (Core Rulebook, гл. 4).
 * @type {Record<string, {label: string, ability: string}>}
 */
DARPG.weaponGroups = {
  axes: { label: "DARPG.WeaponGroup.Axes", ability: "strength" },
  bludgeons: { label: "DARPG.WeaponGroup.Bludgeons", ability: "strength" },
  bows: { label: "DARPG.WeaponGroup.Bows", ability: "dexterity" },
  brawling: { label: "DARPG.WeaponGroup.Brawling", ability: "dexterity" },
  dueling: { label: "DARPG.WeaponGroup.Dueling", ability: "dexterity" },
  heavyBlades: { label: "DARPG.WeaponGroup.HeavyBlades", ability: "strength" },
  lances: { label: "DARPG.WeaponGroup.Lances", ability: "strength" },
  lightBlades: { label: "DARPG.WeaponGroup.LightBlades", ability: "dexterity" },
  polearms: { label: "DARPG.WeaponGroup.Polearms", ability: "strength" },
  spears: { label: "DARPG.WeaponGroup.Spears", ability: "strength" },
  staves: { label: "DARPG.WeaponGroup.Staves", ability: "dexterity" }
};

/** Вид оружия: ближний бой или дальнобойное (стрелковое и метательное). */
DARPG.weaponTypes = {
  melee: "DARPG.WeaponType.Melee",
  ranged: "DARPG.WeaponType.Ranged"
};

/** Действие перезарядки: "" — не требуется. */
DARPG.reloadActions = {
  "": "DARPG.Action.None",
  minor: "DARPG.Action.Minor",
  major: "DARPG.Action.Major"
};

/** Характеристика, прибавляемая к урону оружия: "" — без прибавки. */
DARPG.damageAbilities = {
  strength: "DARPG.Ability.Strength",
  perception: "DARPG.Ability.Perception",
  "": "DARPG.Ability.None"
};

/**
 * Типы брони: показатель брони (AR), штраф брони (магнитуда: Скорость = база + ЛОВ − штраф)
 * и напряжение (strain — доп. мана за каждое заклинание в этой броне).
 * @type {Record<string, {label: string, armorRating: number, armorPenalty: number, strain: number}>}
 */
DARPG.armorTypes = {
  lightLeather: { label: "DARPG.ArmorType.LightLeather", armorRating: 3, armorPenalty: 0, strain: 1 },
  heavyLeather: { label: "DARPG.ArmorType.HeavyLeather", armorRating: 4, armorPenalty: 1, strain: 2 },
  lightMail: { label: "DARPG.ArmorType.LightMail", armorRating: 5, armorPenalty: 2, strain: 3 },
  heavyMail: { label: "DARPG.ArmorType.HeavyMail", armorRating: 7, armorPenalty: 3, strain: 4 },
  lightPlate: { label: "DARPG.ArmorType.LightPlate", armorRating: 8, armorPenalty: 4, strain: 5 },
  heavyPlate: { label: "DARPG.ArmorType.HeavyPlate", armorRating: 10, armorPenalty: 5, strain: 6 }
};

/**
 * Типы щитов и их бонус к Защите (средний/тяжёлый требуют таланта «Оружие и щит»).
 * @type {Record<string, {label: string, shieldBonus: number}>}
 */
DARPG.shieldTypes = {
  light: { label: "DARPG.ShieldType.Light", shieldBonus: 1 },
  medium: { label: "DARPG.ShieldType.Medium", shieldBonus: 2 },
  heavy: { label: "DARPG.ShieldType.Heavy", shieldBonus: 3 }
};

/** Школы магии (кровь — только специализация «Маг крови»). */
DARPG.schools = {
  creation: "DARPG.School.Creation",
  entropy: "DARPG.School.Entropy",
  primal: "DARPG.School.Primal",
  spirit: "DARPG.School.Spirit",
  blood: "DARPG.School.Blood"
};

/** Типы заклинаний. */
DARPG.spellTypes = {
  attack: "DARPG.SpellType.Attack",
  defense: "DARPG.SpellType.Defense",
  enhancement: "DARPG.SpellType.Enhancement",
  utility: "DARPG.SpellType.Utility"
};

/**
 * Подсказки для времени сотворения. Само поле castTime — свободная строка:
 * "major" | "minor" | текст вроде "1 minute".
 */
DARPG.castTimes = {
  minor: "DARPG.Action.Minor",
  major: "DARPG.Action.Major"
};

/** Степени талантов, специализаций, рун, рецептов. */
DARPG.degrees = {
  novice: "DARPG.Degree.Novice",
  journeyman: "DARPG.Degree.Journeyman",
  master: "DARPG.Degree.Master"
};

/**
 * Классы: базовые стартовые Здоровье и Мана.
 * Реальный старт: Здоровье = база + ТЕЛ + 1d6; Мана (маг) = база + МАГ + 1d6.
 * @type {Record<string, {label: string, health: number, mana: number}>}
 */
DARPG.classes = {
  mage: { label: "DARPG.Class.Mage", health: 20, mana: 10 },
  rogue: { label: "DARPG.Class.Rogue", health: 25, mana: 0 },
  warrior: { label: "DARPG.Class.Warrior", health: 30, mana: 0 }
};

/**
 * Расы и базовая Скорость (Скорость = база + ЛОВ − штраф брони).
 * @type {Record<string, {label: string, speed: number}>}
 */
DARPG.races = {
  human: { label: "DARPG.Race.Human", speed: 10 },
  elf: { label: "DARPG.Race.Elf", speed: 12 },
  dwarf: { label: "DARPG.Race.Dwarf", speed: 8 },
  qunari: { label: "DARPG.Race.Qunari", speed: 10 }
};

/** Типы стант-приёмов. */
DARPG.stuntTypes = {
  combat: "DARPG.StuntType.Combat",
  spell: "DARPG.StuntType.Spell",
  advancedSpell: "DARPG.StuntType.AdvancedSpell",
  exploration: "DARPG.StuntType.Exploration",
  roleplaying: "DARPG.StuntType.Roleplaying"
};

/** Типы расходников. */
DARPG.consumableTypes = {
  potion: "DARPG.ConsumableType.Potion",
  poison: "DARPG.ConsumableType.Poison",
  grenade: "DARPG.ConsumableType.Grenade"
};

/** Слоты рун. */
DARPG.runeSlots = {
  weapon: "DARPG.RuneSlot.Weapon",
  armor: "DARPG.RuneSlot.Armor"
};

/** Ступени титулов. */
DARPG.titleTiers = {
  1: "DARPG.TitleTier.One",
  2: "DARPG.TitleTier.Two",
  3: "DARPG.TitleTier.Three"
};

/** Уровни угрозы НИП. */
DARPG.threatLevels = {
  minor: "DARPG.Threat.Minor",
  moderate: "DARPG.Threat.Moderate",
  major: "DARPG.Threat.Major",
  dire: "DARPG.Threat.Dire",
  legendary: "DARPG.Threat.Legendary"
};

/** Типы существ бестиария. */
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

/** Размеры существ. */
DARPG.sizes = {
  tiny: "DARPG.Size.Tiny",
  small: "DARPG.Size.Small",
  average: "DARPG.Size.Average",
  large: "DARPG.Size.Large",
  huge: "DARPG.Size.Huge",
  colossal: "DARPG.Size.Colossal"
};

/**
 * Шкала сложности базовых тестов (TN).
 * @type {Record<string, {label: string, tn: number}>}
 */
DARPG.difficulties = {
  routine: { label: "DARPG.Difficulty.Routine", tn: 7 },
  easy: { label: "DARPG.Difficulty.Easy", tn: 9 },
  average: { label: "DARPG.Difficulty.Average", tn: 11 },
  challenging: { label: "DARPG.Difficulty.Challenging", tn: 13 },
  hard: { label: "DARPG.Difficulty.Hard", tn: 15 },
  formidable: { label: "DARPG.Difficulty.Formidable", tn: 17 },
  imposing: { label: "DARPG.Difficulty.Imposing", tn: 19 },
  nighImpossible: { label: "DARPG.Difficulty.NighImpossible", tn: 21 }
};

/**
 * Пороги успеха продвинутых тестов (сумма Драконьих кубов).
 * Подписи — у одноимённых ключей DARPG.difficulties.
 */
DARPG.advancedThresholds = {
  easy: 5,
  average: 10,
  challenging: 15,
  hard: 20,
  formidable: 25
};

/** Опыт, необходимый для уровня: индекс = уровень − 1 (1-й уровень — 0 XP, 20-й — 60 000 XP). */
DARPG.xpTable = [
  0, 2000, 4000, 6000, 8000, 10000, 13000, 16000, 19000, 22000,
  25000, 28000, 32000, 36000, 40000, 44000, 48000, 52000, 56000, 60000
];

/** Бонус подходящего фокуса к тесту. */
DARPG.focusBonus = 2;

/** Бонус улучшенного фокуса (взят повторно с 11 уровня). */
DARPG.improvedFocusBonus = 3;

/* -------------------------------------------- */
/*  Помощники                                   */
/* -------------------------------------------- */

/**
 * Разрешить таблицу по имени или вернуть переданную таблицу.
 * @param {string|object} table
 * @returns {object|null}
 */
function resolveTable(table) {
  if ( typeof table === "string" ) table = DARPG[table];
  return (table && (typeof table === "object")) ? table : null;
}

/**
 * i18n-ключ подписи элемента таблицы: и для плоских таблиц (ключ → строка),
 * и для таблиц объектов (ключ → {label, ...}).
 * @param {string|object} table   Имя таблицы в DARPG (напр. "weaponGroups") или сама таблица.
 * @param {string|number} key     Ключ элемента.
 * @returns {string}              i18n-ключ подписи; "" если элемента нет.
 */
DARPG.label = function(table, key) {
  const entry = resolveTable(table)?.[key];
  if ( typeof entry === "string" ) return entry;
  return entry?.label ?? "";
};

/**
 * Плоская карта опций `ключ → i18n-ключ подписи` для select любой таблицы.
 * @param {string|object} table   Имя таблицы в DARPG или сама таблица.
 * @returns {Record<string, string>}
 */
DARPG.choices = function(table) {
  const resolved = resolveTable(table) ?? {};
  return Object.fromEntries(Object.keys(resolved).map(key => [key, DARPG.label(resolved, key)]));
};
