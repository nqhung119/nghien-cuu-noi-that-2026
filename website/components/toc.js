(function () {
  "use strict";

  const KB = (window.KB = window.KB || {});

  KB.Toc = {
    observer: null,

    render: function (root) {
      const container = document.getElementById("page-toc");
      if (this.observer) this.observer.disconnect();
      const headings = Array.from(root.querySelectorAll("h2[id], h3[id]"));
      if (!headings.length) {
        container.innerHTML = '<p class="toc-empty">Trang này không có mục con.</p>';
        return;
      }
      container.innerHTML = headings.map(function (heading) {
        return '<a href="#' + KB.escapeAttribute(heading.id) + '" data-heading-id="' +
          KB.escapeAttribute(heading.id) + '" data-level="' + heading.tagName.slice(1) + '">' +
          KB.escapeHtml(heading.textContent) + "</a>";
      }).join("");

      container.onclick = function (event) {
        const link = event.target.closest("[data-heading-id]");
        if (!link) return;
        event.preventDefault();
        const heading = document.getElementById(link.dataset.headingId);
        if (heading) heading.scrollIntoView({ behavior: "smooth", block: "start" });
      };

      this.observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          container.querySelectorAll("a").forEach(function (link) {
            link.classList.toggle("is-active", link.dataset.headingId === entry.target.id);
          });
        });
      }, { rootMargin: "-80px 0px -70% 0px", threshold: 0 });
      headings.forEach((heading) => this.observer.observe(heading));
    }
  };
})();
