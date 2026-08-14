(function () {
  "use strict";

  const KB = (window.KB = window.KB || {});

  KB.Sidebar = {
    render: function (data, maps) {
      const container = document.getElementById("sidebar-nav");
      const footer = document.getElementById("sidebar-footer");
      const collapsed = JSON.parse(localStorage.getItem("kb-collapsed-groups") || "{}");
      const sections = [];

      data.groups.forEach(function (group) {
        const documents = (group.documentIds || []).map(function (id) {
          return maps.documents[id];
        }).filter(Boolean);
        if (group.id === "home") {
          sections.push('<a class="sidebar-home" data-doc-id="home" href="' + KB.route.doc("home") + '">Bắt đầu</a>');
          return;
        }

        const isCollapsed = collapsed[group.id] === true ||
          (collapsed[group.id] == null && (group.kind === "management" || group.kind === "records"));
        sections.push(
          '<section class="sidebar-section' + (isCollapsed ? " is-collapsed" : "") + '" data-group-id="' + KB.escapeAttribute(group.id) + '">' +
            '<button class="sidebar-group-toggle" type="button" aria-expanded="' + String(!isCollapsed) + '">' +
              '<span class="chevron" aria-hidden="true">›</span>' +
              '<span class="sidebar-item-label">' + KB.escapeHtml(group.title) + "</span>" +
              '<span class="sidebar-count">' + documents.length + "</span>" +
            "</button>" +
            '<div class="sidebar-children">' +
              documents.map(function (document) {
                return '<a class="sidebar-item" data-doc-id="' + KB.escapeAttribute(document.id) + '" href="' + KB.route.doc(document.id) + '">' +
                  '<span class="sidebar-item-label">' + KB.escapeHtml(document.title) + "</span>" +
                "</a>";
              }).join("") +
            "</div>" +
          "</section>"
        );
      });

      container.innerHTML = sections.join("");
      footer.innerHTML =
        "<strong>" + data.meta.itemCount + "</strong> hạng mục · " +
        "<strong>" + data.meta.optionCount + "</strong> phương án<br>" +
        "Dữ liệu sinh từ cây thư mục Markdown/CSV.";

      container.addEventListener("click", function (event) {
        const toggle = event.target.closest(".sidebar-group-toggle");
        if (toggle) {
          const section = toggle.closest(".sidebar-section");
          section.classList.toggle("is-collapsed");
          toggle.setAttribute("aria-expanded", String(!section.classList.contains("is-collapsed")));
          const saved = JSON.parse(localStorage.getItem("kb-collapsed-groups") || "{}");
          saved[section.dataset.groupId] = section.classList.contains("is-collapsed");
          localStorage.setItem("kb-collapsed-groups", JSON.stringify(saved));
          return;
        }
        if (event.target.closest("a")) KB.closeSidebar();
      });
    },

    setActive: function (documentId, groupId) {
      document.querySelectorAll("[data-doc-id]").forEach(function (link) {
        link.classList.toggle("is-active", link.dataset.docId === documentId);
      });
      if (!groupId) return;
      const section = document.querySelector('.sidebar-section[data-group-id="' + CSS.escape(groupId) + '"]');
      if (section && section.classList.contains("is-collapsed")) {
        section.classList.remove("is-collapsed");
        const toggle = section.querySelector(".sidebar-group-toggle");
        if (toggle) toggle.setAttribute("aria-expanded", "true");
      }
      const active = document.querySelector('[data-doc-id="' + CSS.escape(documentId) + '"]');
      if (active) {
        const sidebar = document.getElementById("sidebar");
        const top = active.offsetTop;
        const bottom = top + active.offsetHeight;
        if (top < sidebar.scrollTop + 55) sidebar.scrollTop = Math.max(0, top - 70);
        else if (bottom > sidebar.scrollTop + sidebar.clientHeight - 30) {
          sidebar.scrollTop = bottom - sidebar.clientHeight + 45;
        }
      }
    }
  };
})();
