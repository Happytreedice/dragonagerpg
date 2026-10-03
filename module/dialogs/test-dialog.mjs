/**
 * Диалог параметров теста AGE: выбор фокуса, модификатор, TN (с подсказками шкалы сложности).
 */

const TEMPLATE = "systems/darpg/templates/dialogs/test.hbs";

/**
 * Бонус фокуса: +2, улучшенный (с 11 уровня) — +3.
 * @param {{improved?: boolean}} focus
 * @returns {number}
 */
function focusBonusOf(focus) {
  const { focusBonus = 2, improvedFocusBonus = 3 } = CONFIG.DARPG;
  return focus?.improved ? improvedFocusBonus : focusBonus;
}

/**
 * Показать диалог и вернуть параметры броска.
 * @param {object} config
 * @param {Actor} config.actor                  Актёр, совершающий тест.
 * @param {string|null} [config.ability=null]   Ключ характеристики (фильтр фокусов).
 * @param {string} [config.title]               Заголовок окна.
 * @param {string|null} [config.defaultFocus=null]   Предвыбранный фокус (без учёта регистра).
 * @param {number|null} [config.targetNumber=null]   Предзаполненное TN.
 * @param {boolean} [config.withFocus=true]     Показывать выбор фокуса (false — атака НИП
 *                                              со статблока, бонус уже включает фокус).
 * @returns {Promise<{focus: string, focusBonus: number, modifier: number, targetNumber: number|null}|null>}
 *          Параметры броска либо null, если диалог закрыт.
 */
export async function promptTest({ actor, ability = null, title = "", defaultFocus = null, targetNumber = null,
  withFocus = true } = {}) {
  const wanted = String(defaultFocus ?? "").trim().toLocaleLowerCase();
  const focuses = [];
  if ( withFocus ) {
    const source = ability ? actor.focusesFor(ability) : actor.system.focuses;
    const seen = new Set();
    for ( const focus of source ) {
      const name = focus.name?.trim();
      if ( !name || seen.has(name) ) continue;
      seen.add(name);
      const bonus = focusBonusOf(focus);
      focuses.push({ name, bonus, label: `${name} (+${bonus})`, selected: !!wanted && (name.toLocaleLowerCase() === wanted) });
    }
  }

  // Подсказки TN по шкале сложности (CONFIG.DARPG.difficulties: {label, tn})
  const difficulties = Object.values(CONFIG.DARPG.difficulties ?? {}).map(d => ({
    tn: d.tn, label: `${game.i18n.localize(d.label)} (${d.tn})`
  }));

  const abilityEntry = ability ? CONFIG.DARPG.abilities[ability] : null;
  const abilityLabelKey = (typeof abilityEntry === "string") ? abilityEntry : (abilityEntry?.label ?? "");
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    withFocus,
    focuses,
    targetNumber,
    difficulties,
    listId: `darpg-tn-${foundry.utils.randomID()}`,
    abilityLabel: abilityLabelKey ? game.i18n.localize(abilityLabelKey) : null
  });

  const result = await foundry.applications.api.DialogV2.input({
    window: { title, icon: "fa-solid fa-dice" },
    classes: ["darpg"],
    position: { width: 380 },
    content,
    ok: { label: "DARPG.Roll.Roll", icon: "fa-solid fa-dice" }
  });
  if ( !result ) return null;

  const focus = result.focus || "";
  const modifier = Number(result.modifier);
  const tn = Number(result.targetNumber);
  return {
    focus,
    focusBonus: focus ? (focuses.find(f => f.name === focus)?.bonus ?? focusBonusOf(null)) : 0,
    modifier: Number.isFinite(modifier) ? modifier : 0,
    targetNumber: (result.targetNumber === "" || result.targetNumber === null || !Number.isFinite(tn)) ? null : tn
  };
}
