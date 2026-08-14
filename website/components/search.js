(function () {
  "use strict";

  const KB = (window.KB = window.KB || {});

  function score(haystack, normalizedQuery, title) {
    const normalizedTitle = KB.normalizeText(title);
    if (normalizedTitle === normalizedQuery) return 120;
    if (normalizedTitle.indexOf(normalizedQuery) === 0) return 95;
    if (normalizedTitle.indexOf(normalizedQuery) >= 0) return 75;
    const location = haystack.indexOf(normalizedQuery);
    return location >= 0 ? Math.max(15, 55 - Math.floor(location / 180)) : 0;
  }

  KB.Search = {
    init: function (data, maps) {
      this.data = data;
      this.maps = maps;
      this.dialog = document.getElementById("search-dialog");
      this.input = document.getElementById("search-input");
      this.results = document.getElementById("search-results");
      this.help = document.getElementById("search-help");
      this.focusedIndex = -1;
      this.items = [];

      const that = this;
      document.getElementById("search-trigger").addEventListener("click", function () { that.open(); });
      document.getElementById("search-close").addEventListener("click", function () { that.close(); });
      this.dialog.addEventListener("click", function (event) {
        if (event.target === that.dialog) that.close();
      });
      this.input.addEventListener("input", KB.debounce(function () { that.run(); }, 80));
      this.input.addEventListener("keydown", function (event) { that.onKeyDown(event); });
      this.results.addEventListener("click", function (event) {
        if (event.target.closest("a")) that.close();
      });
      document.addEventListener("keydown", function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          that.open();
        }
      });

      this.renderHint();
    },

    renderHint: function () {
      this.results.innerHTML =
        '<p class="search-hint">Tìm theo tên phòng, hạng mục, vật liệu, mã phương án, mức giá hoặc nội dung hướng dẫn.</p>';
      this.help.textContent = "Tìm không phân biệt dấu";
    },

    open: function () {
      if (typeof this.dialog.showModal === "function") this.dialog.showModal();
      else this.dialog.setAttribute("open", "");
      requestAnimationFrame(() => this.input.focus());
    },

    close: function () {
      if (typeof this.dialog.close === "function") this.dialog.close();
      else this.dialog.removeAttribute("open");
      this.focusedIndex = -1;
    },

    run: function () {
      const query = this.input.value.trim();
      const normalizedQuery = KB.normalizeText(query);
      if (normalizedQuery.length < 2) {
        this.items = [];
        this.renderHint();
        return;
      }

      const results = [];
      this.data.documents.forEach((document) => {
        const group = this.maps.groups[document.groupId];
        const haystack = KB.normalizeText([document.title, document.itemId, document.plainText].join(" "));
        const resultScore = score(haystack, normalizedQuery, document.title);
        if (!resultScore) return;
        results.push({
          groupId: document.groupId,
          groupTitle: group ? group.title : "Tài liệu",
          title: document.title,
          excerpt: KB.snippet(document.plainText, query, 145),
          kind: document.kind === "category" ? "Hạng mục" : document.kind === "csv" ? "Bảng dữ liệu" : "Tài liệu",
          href: KB.route.doc(document.id),
          score: resultScore
        });
      });
      this.data.options.forEach((option) => {
        const parent = this.maps.documents[option.itemId.toLowerCase()];
        const group = parent ? this.maps.groups[parent.groupId] : null;
        const haystack = KB.normalizeText(option.searchText);
        const resultScore = score(haystack, normalizedQuery, option.name);
        if (!resultScore) return;
        results.push({
          groupId: parent ? parent.groupId : "options",
          groupTitle: group ? group.title : "Phương án",
          title: option.name,
          excerpt: option.id + " · " + option.segment + " · " + KB.formatPrice(option, true),
          kind: "Phương án",
          href: KB.route.option(option.id),
          score: resultScore + 4
        });
      });

      this.items = results.sort(function (a, b) {
        return b.score - a.score || a.title.localeCompare(b.title, "vi");
      }).slice(0, 80);
      this.focusedIndex = this.items.length ? 0 : -1;
      this.render(query);
    },

    render: function (query) {
      if (!this.items.length) {
        this.results.innerHTML = '<p class="search-hint">Không tìm thấy kết quả cho “' + KB.escapeHtml(query) + '”. Hãy thử từ khóa ngắn hơn hoặc mã hạng mục.</p>';
        this.help.textContent = "0 kết quả";
        return;
      }

      const grouped = {};
      this.items.forEach(function (item) {
        if (!grouped[item.groupTitle]) grouped[item.groupTitle] = [];
        grouped[item.groupTitle].push(item);
      });
      let itemIndex = 0;
      this.results.innerHTML = Object.keys(grouped).map((title) => {
        return '<section class="search-group">' +
          '<h3 class="search-group-title">' + KB.escapeHtml(title) + "</h3>" +
          grouped[title].map((item) => {
            const currentIndex = itemIndex;
            itemIndex += 1;
            return '<a class="search-result' + (currentIndex === this.focusedIndex ? " is-focused" : "") +
              '" data-search-index="' + currentIndex + '" href="' + item.href + '" role="option">' +
              '<span><span class="search-result-title">' + KB.escapeHtml(item.title) + "</span>" +
              '<span class="search-result-excerpt">' + KB.escapeHtml(item.excerpt) + "</span></span>" +
              '<span class="search-result-kind">' + KB.escapeHtml(item.kind) + "</span>" +
            "</a>";
          }).join("") +
        "</section>";
      }).join("");
      this.help.textContent = this.items.length + " kết quả";
    },

    onKeyDown: function (event) {
      if (!this.items.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const change = event.key === "ArrowDown" ? 1 : -1;
        this.focusedIndex = (this.focusedIndex + change + this.items.length) % this.items.length;
        this.results.querySelectorAll(".search-result").forEach((element, index) => {
          element.classList.toggle("is-focused", index === this.focusedIndex);
        });
        const focused = this.results.querySelector('[data-search-index="' + this.focusedIndex + '"]');
        if (focused) focused.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter" && this.focusedIndex >= 0) {
        event.preventDefault();
        location.hash = this.items[this.focusedIndex].href;
        this.close();
      }
    }
  };
})();
