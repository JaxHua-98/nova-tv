/* NOVA TV · 聚合片库顶部导航
 * 7 个分类 Tab + 3 个圆形图标按钮，负责页面跳转与选中态同步。
 */
(function () {
  "use strict";

  if (typeof document === "undefined") return;

  const TAB_ROUTE = {
    home: { kind: "library" },
    movie: { kind: "category", key: "movie" },
    series: { kind: "category", key: "series" },
    variety: { kind: "category", key: "variety" },
    anime: { kind: "category", key: "anime" },
    // 纪录片没有独立 Tab，内容在「更多分类」的第一个货架里
    more: { kind: "category", key: "more" }
  };

  const tabNodes = () => [...document.querySelectorAll("[data-lib-tab]")];

  function paintActive(key) {
    tabNodes().forEach((node) => {
      node.classList.toggle("is-active", node.dataset.libTab === key);
    });
  }

  // 当前停在哪一页："" = 片库首页，其余是分类页 key
  function currentPageKey() {
    return window.NovaCategories?.state?.key || "";
  }

  function goTab(key) {
    const route = TAB_ROUTE[key];
    if (!route) return;

    const cat = window.NovaCategories;
    const here = currentPageKey();

    // 选中态先落下去，六个页面各自的那份顶栏会自动同步
    paintActive(key);

    if (route.kind === "library") {
      if (!here) return;
      cat?.back?.();
      window.NovaPages?.open?.("library");
      return;
    }

    if (!cat?.open) return;

    // 已经在这一页就只同步选中态，不重开页面
    if (here === route.key) return;

    try {
      if (route.key === "more") cat.openMore?.();
      else cat.open(route.key);
    } catch {
      /* 该分类还没有对应页面时保持当前视图 */
    }
  }

  function goAction(action) {
    // 分类页不在 NovaPages 的页面栈里，先退出去，否则两个页面会叠在一起
    if (window.NovaCategories?.state?.key) window.NovaCategories.back?.(true);

    if (action === "search") {
      window.NovaSearch?.open?.() || openLegacySearch();
      return;
    }
    if (action === "saved") {
      window.NovaPages?.open?.("saved");
      return;
    }
    if (action === "settings") {
      window.NovaPages?.open?.("settings");
    }
  }

  // 旧版搜索入口
  function openLegacySearch() {
    const trigger =
      document.getElementById("libSearch") ||
      document.querySelector('[data-action="search"]') ||
      document.querySelector("[data-open-search]");
    if (trigger) trigger.click();
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-lib-tab]");
    if (tab) {
      goTab(tab.dataset.libTab);
      return;
    }
    const action = event.target.closest("[data-lib-action]");
    if (action) {
      goAction(action.dataset.libAction);
    }
  });

  // 返回键由 category-ui.js 处理（它知道面板有没有打开），这里不再重复接管 Escape

  window.NovaLibraryNav = { goTab, paintActive };
})();
