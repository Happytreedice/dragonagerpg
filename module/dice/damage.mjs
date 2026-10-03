/**
 * Броски урона/лечения и их применение к актёрам.
 *
 * Карточка в чате содержит кнопку «Нанести урон» / «Исцелить», которая применяет
 * итог к выбранным (или нацеленным) токенам. Урон вычитает Броню цели (Armor Rating),
 * если бросок не проникающий; лечение просто добавляет Хиты в пределах максимума.
 */

const CHAT_TEMPLATE = "systems/darpg/templates/chat/damage-roll.hbs";

/** Класс сообщений чата. */
function chatMessageCls() {
  return foundry.utils.getDocumentClass("ChatMessage");
}

/**
 * Подготовить формулу: кириллическое «к»→«d», `@dragonDie` → реальный бросок 1d6.
 * @param {string} formula
 * @returns {string}
 */
function normalizeFormula(formula) {
  return String(formula ?? "")
    .replace(/к/gi, "d")
    .replace(/@dragonDie/g, "1d6");
}

/**
 * Бросить урон и вывести карточку с кнопкой «Нанести урон».
 * @param {object} config
 * @param {string} config.formula                 Формула урона.
 * @param {Actor|null} [config.actor=null]        Актёр-источник (для rollData и говорящего).
 * @param {boolean} [config.penetrating=false]    Проникающий (игнорирует Броню при применении).
 * @param {string} [config.flavor]                Заголовок карточки.
 * @returns {Promise<ChatMessage|null>}
 */
export function rollDamageFormula(config) {
  return rollAndPost({ ...config, kind: "damage" });
}

/**
 * Бросить лечение и вывести карточку с кнопкой «Исцелить».
 * @param {object} config
 * @param {string} config.formula
 * @param {Actor|null} [config.actor=null]
 * @param {string} [config.flavor]
 * @returns {Promise<ChatMessage|null>}
 */
export function rollHealFormula(config) {
  return rollAndPost({ ...config, kind: "heal", penetrating: false });
}

/** Общая реализация броска и карточки. */
async function rollAndPost({ kind, formula, actor = null, penetrating = false, flavor = null }) {
  const normalized = normalizeFormula(formula);
  if ( !foundry.dice.Roll.validate(normalized) ) {
    ui.notifications.warn(game.i18n.format("DARPG.Roll.InvalidDamage", { formula }));
    return null;
  }

  const roll = new foundry.dice.Roll(normalized, actor?.getRollData() ?? {});
  await roll.evaluate();

  const isHeal = kind === "heal";
  const flavorKey = isHeal ? "DARPG.Roll.Heal" : (penetrating ? "DARPG.Roll.DamagePenetrating" : "DARPG.Roll.Damage");
  const cardFlavor = flavor || game.i18n.localize(flavorKey);

  const button = await foundry.applications.handlebars.renderTemplate(CHAT_TEMPLATE, {
    kind,
    isHeal,
    penetrating,
    total: roll.total,
    label: game.i18n.localize(isHeal ? "DARPG.Damage.ApplyHeal" : "DARPG.Damage.ApplyDamage"),
    icon: isHeal ? "fa-heart" : "fa-heart-crack"
  });

  // Содержимое карточки — штатная разметка броска (кубы, подсказка, итог) и кнопка применения.
  // Ядро (ChatMessage##renderRollContent) показывает content как есть, если в нём уже есть
  // элементы, — поэтому разметку броска кладём в content сами, иначе от броска остался бы
  // голый итог. Скрытые броски ядро само заменяет приватной разметкой (кнопка не видна).
  // Режим видимости — штатный core.messageMode (Roll#toMessage берёт его по умолчанию;
  // опция rollMode и настройка core.rollMode устарели в v14).
  const rollHTML = await roll.render();
  return roll.toMessage({
    speaker: chatMessageCls().getSpeaker(actor ? { actor } : {}),
    flavor: cardFlavor,
    content: `${rollHTML}${button}`
  });
}

/**
 * Целевые актёры применения: сначала нацеленные, иначе выбранные токены.
 * @returns {Actor[]}
 */
function applyTargets() {
  const targeted = Array.from(game.user.targets).map(t => t.actor).filter(Boolean);
  if ( targeted.length ) return targeted;
  return (canvas.tokens?.controlled ?? []).map(t => t.actor).filter(Boolean);
}

/**
 * Применить урон/лечение к цели.
 * @param {Actor} actor
 * @param {number} amount              Итог броска (положительное число).
 * @param {object} [options]
 * @param {boolean} [options.isHeal=false]
 * @param {boolean} [options.penetrating=false]
 * @returns {Promise<{name: string, applied: number, hp: number}>}
 */
async function applyToActor(actor, amount, { isHeal = false, penetrating = false } = {}) {
  const health = actor.system.health ?? { value: 0, max: 0 };
  let applied;
  if ( isHeal ) {
    applied = Math.min(amount, health.max - health.value);
    await actor.update({ "system.health.value": Math.min(health.max, health.value + amount) });
  } else {
    const armor = penetrating ? 0 : (actor.system.armorRating ?? 0);
    applied = Math.max(0, amount - armor);
    await actor.update({ "system.health.value": Math.max(0, health.value - applied) });
  }
  return { name: actor.name, applied, hp: actor.system.health.value };
}

/**
 * Обработчик клика по кнопке «Нанести урон»/«Исцелить» в карточке чата.
 * @param {PointerEvent} event
 */
async function onApplyClick(event) {
  const button = event.target.closest?.("button.darpg-apply");
  if ( !button ) return;
  event.preventDefault();

  const amount = Number(button.dataset.amount);
  const isHeal = button.dataset.kind === "heal";
  const penetrating = button.dataset.penetrating === "1";

  const targets = applyTargets();
  if ( !targets.length ) return ui.notifications.warn(game.i18n.localize("DARPG.Damage.NoTargets"));

  const results = [];
  for ( const actor of targets ) {
    if ( !actor.isOwner ) continue;
    results.push(await applyToActor(actor, amount, { isHeal, penetrating }));
  }
  if ( !results.length ) return ui.notifications.warn(game.i18n.localize("DARPG.Damage.NotOwner"));

  const key = isHeal ? "DARPG.Damage.HealedNotice" : "DARPG.Damage.DamagedNotice";
  for ( const r of results ) {
    ui.notifications.info(game.i18n.format(key, { name: r.name, amount: r.applied, hp: r.hp }));
  }
}

/** Навесить делегированный обработчик кнопок применения на лог чата. */
export function registerDamageApplication() {
  document.body.addEventListener("click", onApplyClick);
}
