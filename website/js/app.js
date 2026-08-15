(function () {
  "use strict";

  const KB = (window.KB = window.KB || {});

  function closeSidebar() {
    document.body.classList.remove("is-sidebar-open");
    const button = document.getElementById("mobile-menu-button");
    button.setAttribute("aria-expanded", "false");
  }

  function openSidebar() {
    document.body.classList.add("is-sidebar-open");
    const button = document.getElementById("mobile-menu-button");
    button.setAttribute("aria-expanded", "true");
  }

  KB.closeSidebar = closeSidebar;

  KB.renderBreadcrumb = function (groupId, title, sourceDocument, option) {
    const container = document.getElementById("header-breadcrumb");
    const group = KB.maps.groups[groupId];
    const parts = [
      { label: "Bắt đầu", href: KB.route.doc("home") }
    ];
    if (group && group.id !== "home") {
      parts.push({
        label: group.title,
        href: group.overviewId ? KB.route.doc(group.overviewId) : ""
      });
    }
    if (option && sourceDocument) {
      parts.push({ label: sourceDocument.title, href: KB.route.doc(sourceDocument.id) });
      parts.push({ label: option.name, href: "" });
    } else if (title && title !== "Bắt đầu") {
      parts.push({ label: title, href: "" });
    }

    container.innerHTML = parts.map(function (part, index) {
      const value = part.href && index < parts.length - 1
        ? '<a href="' + part.href + '">' + KB.escapeHtml(part.label) + "</a>"
        : "<span>" + KB.escapeHtml(part.label) + "</span>";
      return (index ? '<span class="breadcrumb-separator" aria-hidden="true">/</span>' : "") + value;
    }).join("");
  };

  function renderRoute(options) {
    const preserveScroll = Boolean(options && options.preserveScroll);
    const route = KB.route.parse();
    if (route.type === "selection") {
      KB.Selection.show({ preserveScroll: preserveScroll });
      return;
    }
    if (route.type === "option") {
      const option = KB.maps.options[route.id];
      if (option) KB.Content.showOption(option, { preserveScroll: preserveScroll });
      else KB.Content.showMissing();
      return;
    }
    const sourceDocument = KB.maps.documents[route.id];
    if (sourceDocument) KB.Content.showDocument(sourceDocument, { preserveScroll: preserveScroll });
    else KB.Content.showMissing();
  }

  function setTheme(theme) {
    const selected = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = selected;
    localStorage.setItem("kb-theme", selected);
    const button = document.getElementById("theme-toggle");
    button.querySelector(".theme-icon").innerHTML = selected === "dark"
      ? '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.25"></circle><path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.35 4.35l1.1 1.1M14.55 14.55l1.1 1.1M15.65 4.35l-1.1 1.1M5.45 14.55l-1.1 1.1"></path></svg>'
      : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.25 12.45A6.5 6.5 0 0 1 7.55 3.75 6.5 6.5 0 1 0 16.25 12.45Z"></path></svg>';
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", selected === "dark" ? "#000000" : "#f6f5f1");
    button.setAttribute("aria-label", selected === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối");
    button.title = selected === "dark" ? "Giao diện sáng" : "Giao diện tối";
  }

  function init() {
    const data = window.__KB_DATA__;
    const root = document.getElementById("document");
    if (!data || !Array.isArray(data.documents)) {
      root.innerHTML =
        '<div class="empty-state"><h1>Chưa có dữ liệu website</h1>' +
        "<p>Chạy <code>powershell -ExecutionPolicy Bypass -File tools/build-data.ps1</code> trong thư mục website rồi tải lại trang.</p></div>";
      return;
    }

    KB.data = data;
    KB.maps = KB.buildMaps(data);
    KB.renderRoute = renderRoute;
    KB.Selection.init(data, KB.maps);
    KB.Sidebar.render(data, KB.maps);
    KB.Search.init(data, KB.maps);
    KB.Content.init(data, KB.maps);

    const preferredTheme = localStorage.getItem("kb-theme") || "dark";
    setTheme(preferredTheme);
    document.getElementById("theme-toggle").addEventListener("click", function () {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });

    document.getElementById("mobile-menu-button").addEventListener("click", function () {
      if (document.body.classList.contains("is-sidebar-open")) closeSidebar();
      else openSidebar();
    });
    document.getElementById("sidebar-close").addEventListener("click", closeSidebar);
    document.getElementById("sidebar-scrim").addEventListener("click", closeSidebar);
    window.addEventListener("hashchange", renderRoute);
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) closeSidebar();
    });

    renderRoute();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
