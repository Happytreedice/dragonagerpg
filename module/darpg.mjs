/**
 * Dragon Age RPG (AGE System) — точка входа системы.
 * Foundry VTT generation 14: ApplicationV2, DataModel, DialogV2.
 */

import { DARPG } from "./config.mjs";

import CharacterData from "./data/character.mjs";
import NpcData from "./data/npc.mjs";
import WeaponData from "./data/weapon.mjs";
import ArmorData from "./data/armor.mjs";
import ShieldData from "./data/shield.mjs";
import TalentData from "./data/talent.mjs";
import SpecializationData from "./data/specialization.mjs";
import SpellData from "./data/spell.mjs";
import EquipmentData from "./data/equipment.mjs";
import FocusData from "./data/focus.mjs";
import BackgroundData from "./data/background.mjs";
import DarpgClassData from "./data/class.mjs";
import StuntData from "./data/stunt.mjs";
import ConsumableData from "./data/consumable.mjs";
import RuneData from "./data/rune.mjs";
import HonorificData from "./data/honorific.mjs";
import TitleData from "./data/title.mjs";

import DarpgActor from "./documents/actor.mjs";
import DarpgItem from "./documents/item.mjs";
import AgeRoll from "./dice/age-roll.mjs";
import { registerEnrichers } from "./enrichers.mjs";
import { registerDamageApplication } from "./dice/damage.mjs";

import CharacterSheet from "./sheets/character-sheet.mjs";
import NpcSheet from "./sheets/npc-sheet.mjs";
import DarpgItemSheet from "./sheets/item-sheet.mjs";

Hooks.once("init", () => {
  // Константы системы
  CONFIG.DARPG = DARPG;

  // Классы документов
  CONFIG.Actor.documentClass = DarpgActor;
  CONFIG.Item.documentClass = DarpgItem;

  // Модели данных
  Object.assign(CONFIG.Actor.dataModels, {
    character: CharacterData,
    npc: NpcData
  });
  Object.assign(CONFIG.Item.dataModels, {
    weapon: WeaponData,
    armor: ArmorData,
    shield: ShieldData,
    talent: TalentData,
    specialization: SpecializationData,
    spell: SpellData,
    equipment: EquipmentData,
    focus: FocusData,
    background: BackgroundData,
    class: DarpgClassData,
    stunt: StuntData,
    consumable: ConsumableData,
    rune: RuneData,
    honorific: HonorificData,
    title: TitleData
  });

  // Бросок AGE и инициатива: 3d6 + Ловкость
  CONFIG.Dice.rolls.push(AgeRoll);
  CONFIG.Combat.initiative = {
    formula: "3d6 + @abilities.dexterity.value",
    decimals: 0
  };

  // Листы (v14: регистрация через DocumentSheetConfig)
  const { DocumentSheetConfig } = foundry.applications.apps;
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "darpg", CharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "TYPES.Actor.character"
  });
  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "darpg", NpcSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "TYPES.Actor.npc"
  });
  DocumentSheetConfig.registerSheet(foundry.documents.Item, "darpg", DarpgItemSheet, {
    makeDefault: true,
    label: "DARPG.Item.Details"
  });

  // Партиалы Handlebars: остаются только вне-листовые (чат, диалоги) — листы
  // актёров/предметов теперь рендерит Vue (module/vue/*).
  foundry.applications.handlebars.loadTemplates([
    "systems/darpg/templates/chat/age-roll.hbs",
    "systems/darpg/templates/chat/damage-roll.hbs",
    "systems/darpg/templates/dialogs/test.hbs"
  ]);

  // Кликабельные тесты/броски в описаниях (принципы п.6, п.7, п.12)
  registerEnrichers();
  // Кнопки «Нанести урон»/«Исцелить» в карточках чата
  registerDamageApplication();
});
