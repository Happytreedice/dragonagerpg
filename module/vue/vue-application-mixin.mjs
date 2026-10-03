import * as Vue from "../../lib/vue.esm-browser.prod.js";
import { registerCommon } from "./components/common.mjs";

/**
 * Мост Vue 3 <-> ApplicationV2 (Foundry VTT v14).
 *
 * Идея: Foundry по-прежнему управляет ОКНОМ (рамка, заголовок, форма, submitOnChange,
 * делегированные data-action и change/submit листенеры на рамке — см. ApplicationV2
 * #_attachFrameListeners). Vue управляет только СОДЕРЖИМЫМ: монтируется один раз в
 * дочерний контейнер внутри `.window-content` и при последующих ре-рендерах Foundry
 * лишь обновляет реактивные данные — Vue сам патчит DOM (без destroy/recreate).
 *
 * Почему это работает без правок ядра:
 *  - data-action-клики ловятся делегатом на рамке окна (this.element), которую Vue не
 *    трогает; closest("[data-action]") находит цель в любой момент, в т.ч. после патча;
 *  - submitOnChange: change/submit делегируются на <form>; Vue-инпуты с name="system.x"
 *    штатно попадают в _onChangeForm → document.update -> повторный render();
 *  - localize/enrich и т.п. отдаются в компоненты как plain-данные из _prepareContext.
 *
 * Класс-наследник обязан задать static VUE_ROOT — корневой компонент (объект-описание
 * Vue-компонента со string-шаблоном; полный build vue.esm-browser включает компилятор).
 * Данные для компонента приходят из стандартного _prepareContext (как и в Handlebars).
 *
 * @param {typeof foundry.applications.api.ApplicationV2} Base
 */
export default function VueApplicationMixin(Base) {
  return class VueApplication extends Base {

    /** Корневой Vue-компонент листа (переопределяется наследником). */
    static VUE_ROOT = null;

    /** Экземпляр Vue-приложения (null, пока не смонтирован). */
    #vueApp = null;

    /** Реактивный контейнер данных, отдаваемый корневому компоненту. */
    #vueData = null;

    /** Узел, в который смонтирован Vue (для проверки актуальности при ре-рендере). */
    #mountPoint = null;

    /** Смонтирован ли уже Vue. */
    get vueMounted() {
      return this.#vueApp !== null;
    }

    /* -------------------------------------------- */
    /*  Render pipeline                             */
    /* -------------------------------------------- */

    /**
     * Backend рендера: просто вернуть контекст. Разметку строит Vue в _replaceHTML.
     * @override
     */
    async _renderHTML(context, options) {
      return context;
    }

    /**
     * Смонтировать Vue при первом рендере, иначе обновить реактивные данные.
     * @override
     */
    _replaceHTML(context, content, options) {
      // Если контейнер пересоздан ядром (перемонтирование окна) — размонтировать и заново.
      const stale = this.#mountPoint && !content.contains(this.#mountPoint);
      if ( stale ) this.#unmountVue();
      if ( !this.#vueApp ) this.#mount(context, content);
      else this.#sync(context);
    }

    /** Создать реактивный стор, приложение Vue и смонтировать его в контейнер. */
    #mount(context, content) {
      const root = this.constructor.VUE_ROOT;
      if ( !root ) throw new Error(`${this.constructor.name}: static VUE_ROOT не задан.`);

      // Реактивные данные: shallow-объект «context», перезаписываемый целиком при sync.
      this.#vueData = Vue.reactive({ context });

      const host = this;
      this.#vueApp = Vue.createApp({
        render() {
          return Vue.h(root, { context: host.#vueData.context, app: host });
        }
      });

      // Глобальные помощники, доступные во всех компонентах как this.$x / инъекции.
      this.#vueApp.config.globalProperties.$localize = (key, data) =>
        data ? game.i18n.format(key, data) : game.i18n.localize(key);
      this.#vueApp.config.globalProperties.$config = CONFIG.DARPG;
      this.#vueApp.provide("app", this);

      // Общие компоненты (сферы, списки предметов, характеристики и т.п.)
      registerCommon(this.#vueApp);

      // Отдельный контейнер: Vue владеет только им, .window-content остаётся за Foundry.
      const mountPoint = document.createElement("div");
      mountPoint.classList.add("darpg-vue-root");
      content.replaceChildren(mountPoint);
      this.#vueApp.mount(mountPoint);
      this.#mountPoint = mountPoint;
    }

    /** Обновить реактивные данные — Vue перепатчит DOM. */
    #sync(context) {
      this.#vueData.context = context;
    }

    /**
     * Переключение вкладок: активной вкладкой управляет Vue (через context.tabs),
     * поэтому вместо ручного тоггла DOM ядром пересобираем контекст и синхронизируем
     * Vue. Ядро тоже дёрнет DOM-классы, но следующий sync их перезадаёт консистентно.
     * @override
     */
    changeTab(tab, group, options = {}) {
      this.tabGroups[group] = tab;
      if ( this.vueMounted ) {
        // Пересобрать tabs с новым активным id и обновить реактивные данные.
        const tabs = this._prepareTabs(group);
        const context = this.#vueData.context;
        this.#vueData.context = { ...context, tabs };
      }
      // Позиционирование/aria ядра (без обязательного наличия DOM-узлов вкладок).
      const pos = {};
      if ( (options.updatePosition !== false) && !this.options.window.resizable ) {
        if ( this.options.position.width === "auto" ) pos.width = "auto";
        if ( this.options.position.height === "auto" ) pos.height = "auto";
        if ( !foundry.utils.isEmpty(pos) ) this.setPosition(pos);
      }
    }

    /* -------------------------------------------- */
    /*  Teardown                                    */
    /* -------------------------------------------- */

    /** @override */
    _tearDown(options) {
      this.#unmountVue();
      return super._tearDown(options);
    }

    /** Снять приложение Vue (при закрытии/перемонтировании окна). */
    #unmountVue() {
      if ( !this.#vueApp ) return;
      try { this.#vueApp.unmount(); }
      catch(err) { console.error("darpg | ошибка размонтирования Vue", err); }
      this.#vueApp = null;
      this.#vueData = null;
      this.#mountPoint = null;
    }
  };
}
