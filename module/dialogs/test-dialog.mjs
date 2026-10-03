/**
 * Диалог параметров теста AGE: выбор фокуса, модификатор, TN.
 */

const TEMPLATE = "systems/darpg/templates/dialogs/test.hbs";

/**
 * Показать диалог и вернуть параметры броска.
 * @param {object} config
 * @param {Actor} config.actor                  Актёр, совершающий тест.
 * @param {string|null} [config.ability=null]   Ключ характеристики (фильтр фокусов).
 * @param {string} [config.title]               Заголовок окна.
 * @param {string|null} [config.defaultFocus=null]   Предвыбранный фокус.
 * @param {number|null} [config.targetNumber=null]   Предзаполненное TN.
 * @returns {Promise<{focus: string, modifier: number, targetNumber: number|null}|null>}
 *          Параметры броска либо null, если диалог закрыт.
 */
export async function promptTest({ actor, ability = null, title = "", defaultFocus = null, targetNumber = null } = {}) {
  const source = ability ? actor.focusesFor(ability) : actor.system.focuses;
  const seen = new Set();
  const focuses = [];
  for ( const focus of source ) {
    const name = focus.name?.trim();
    if ( !name || seen.has(name) ) continue;
    seen.add(name);
    focuses.push({ name, selected: name === defaultFocus });
  }

  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    focuses,
    targetNumber,
    abilityLabel: ability ? game.i18n.localize(CONFIG.DARPG.abilities[ability] ?? "") : null
  });

  const result = await foundry.applications.api.DialogV2.input({
    window: { title, icon: "fa-solid fa-dice" },
    classes: ["darpg"],
    position: { width: 380 },
    content,
    ok: { label: "DARPG.Roll.Roll", icon: "fa-solid fa-dice" }
  });
  if ( !result ) return null;

  const modifier = Number(result.modifier);
  const tn = Number(result.targetNumber);
  return {
    focus: result.focus || "",
    modifier: Number.isFinite(modifier) ? modifier : 0,
    targetNumber: (result.targetNumber === "" || result.targetNumber === null || !Number.isFinite(tn)) ? null : tn
  };
}
