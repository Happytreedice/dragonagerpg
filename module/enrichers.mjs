import { DARPG } from "./config.mjs";
import { rollDamageFormula, rollHealFormula } from "./dice/damage.mjs";

/**
 * Энричеры описаний darpg (принципы п.6, п.7, п.12): кликабельные тесты AGE,
 * броски урона и лечения прямо в тексте предметов/заклинаний.
 *
 * Синтаксис (кириллица «к» в костях → латинская «d»):
 *   [[/test str]]                 — тест Силы (диалог параметров)
 *   [[/test con tn=15]]           — тест Телосложения против TN 15
 *   [[/test con focus=Выносливость tn=15]] — с предвыбранным фокусом
 *   [[/damage 2d6]] / [[/damage 2d6 penetrating]] — бросок урона (с кнопкой «Нанести урон»)
 *   [[/heal 1d6]]                 — бросок лечения (с кнопкой «Исцелить»)
 * В формулах урона/лечения `@dragonDie` заменяется реальным броском 1d6 (Драконий куб).
 * Обычные [[/r ...]] и [[/roll ...]] обрабатываются ядром как есть.
 *
 * Реализация повторяет паттерн dnd5e (reference-first, README): у энричера есть `id`
 * и `onRender`, поэтому ядро оборачивает якорь в HTMLEnrichedContentElement и вызывает
 * onRender при появлении в DOM — навешиваем клик прямо на элемент, не полагаясь только
 * на делегирование от document.body.
 */

const ABIL_ALIASES = {
  com: "communication", con: "constitution", cun: "cunning", dex: "dexterity",
  mag: "magic", per: "perception", str: "strength", wp: "willpower"
};

/** Разобрать `key=value` токены хвоста. */
function parseArgs(str) {
  const out = {};
  for ( const m of String(str ?? "").matchAll(/(\w+)=("([^"]*)"|'([^']*)'|(\S+))/g) ) {
    out[m[1]] = m[3] ?? m[4] ?? m[5];
  }
  return out;
}

/** Создать кликабельный элемент. */
function anchor({ label, icon, dataset }) {
  const a = document.createElement("a");
  a.classList.add("darpg-enricher");
  for ( const [k, v] of Object.entries(dataset) ) a.dataset[k] = v;
  const i = document.createElement("i");
  i.classList.add("fa-solid", icon);
  i.inert = true;
  a.append(i, document.createTextNode(` ${label}`));
  return a;
}

/**
 * Разобрать один матч энричера в кликабельный якорь.
 * @param {RegExpMatchArray} match
 * @returns {HTMLAnchorElement|null}
 */
function enrichDarpg(match) {
  const kind = match[1].toLowerCase();
  const body = match[2].trim();
  const custom = match[3];

  if ( kind === "test" ) {
    const [abilToken, ...rest] = body.split(/\s+/);
    const abil = ABIL_ALIASES[abilToken.toLowerCase()] ?? abilToken.toLowerCase();
    if ( !DARPG.abilities[abil] ) return null;
    const args = parseArgs(rest.join(" "));
    const label = custom || (game.i18n.localize(DARPG.abilities[abil])
      + (args.focus ? ` (${args.focus})` : "") + (args.tn ? ` TN ${args.tn}` : ""));
    return anchor({ label, icon: "fa-dice-d6", dataset: {
      darpgTest: abil, focus: args.focus ?? "", tn: args.tn ?? ""
    }});
  }

  // damage / heal — формула, «к»→«d»
  const parts = body.replace(/к/gi, "d").split(/\s+/);
  const formula = parts[0];
  const penetrating = /penetrating|проник/i.test(body);
  const label = custom || (formula + (penetrating ? ` (${game.i18n.localize("DARPG.Sheet.Penetrating")})` : ""));
  return anchor({ label, icon: kind === "heal" ? "fa-heart" : "fa-burst", dataset: {
    darpgRoll: kind, formula, penetrating: penetrating ? "1" : ""
  }});
}

/** Регистрация энричеров и обработчика кликов. */
export function registerEnrichers() {
  CONFIG.TextEditor.enrichers.push({
    id: "darpg-enricher",
    // /test <abil> [focus=..] [tn=..]  |  /damage <formula> [penetrating]  |  /heal <formula>
    // `]](?!])` не даёт схватить открывающую скобку тройного [[[/…]]] ядра.
    pattern: /\[\[\/(test|damage|heal)\s+([^\]]+)\]\](?!\])(?:\{([^}]+)\})?/gi,
    enricher: enrichDarpg,
    onRender: onRenderEnricher
  });

  // Делегированный обработчик — запасной путь (например, для контента, где onRender не сработал).
  document.body.addEventListener("click", onEnricherClick);
}

/**
 * onRender ядра: навесить клик на каждый отрисованный якорь энричера.
 * @param {HTMLEnrichedContentElement} element
 */
function onRenderEnricher(element) {
  for ( const a of element.querySelectorAll("a.darpg-enricher") ) {
    a.addEventListener("click", onEnricherClick);
  }
}

/** Клик по кликабельному тесту/урону/лечению. */
async function onEnricherClick(event) {
  const a = event.target.closest?.("a.darpg-enricher");
  if ( !a ) return;
  event.preventDefault();
  event.stopPropagation();

  // Актёр контекста: выбранный токен либо назначенный персонаж.
  const actor = canvas.tokens?.controlled[0]?.actor ?? game.user?.character ?? null;

  try {
    if ( a.dataset.darpgTest ) {
      if ( !actor ) return ui.notifications.warn(game.i18n.localize("DARPG.Roll.NoActor"));
      const tn = a.dataset.tn ? Number(a.dataset.tn) : null;
      return actor.rollAbility(a.dataset.darpgTest, { defaultFocus: a.dataset.focus || null, targetNumber: tn });
    }

    if ( a.dataset.darpgRoll ) {
      const isHeal = a.dataset.darpgRoll === "heal";
      const fn = isHeal ? rollHealFormula : rollDamageFormula;
      return fn({
        formula: a.dataset.formula,
        actor,
        penetrating: !!a.dataset.penetrating,
        flavor: a.dataset.label || a.textContent?.trim()
      });
    }
  } catch(err) {
    console.error("darpg | enricher click failed", err);
    ui.notifications?.error(err.message);
  }
}
