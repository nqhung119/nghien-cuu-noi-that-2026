(function () {
  "use strict";

  const KB = (window.KB = window.KB || {});
  const STORAGE_KEY = "kb-selected-options-v1";

  function finiteNumber(value, fallback) {
    const parsed = Number(String(value == null ? "" : value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum, fallback) {
    const parsed = finiteNumber(value, fallback);
    return Math.min(maximum, Math.max(minimum, parsed));
  }

  function isPercentageBasis(basis) {
    return /PCT|%/i.test(String(basis || ""));
  }

  function formatRange(minimum, maximum) {
    if (minimum == null || maximum == null) return "Chưa tính";
    if (Number(minimum) === Number(maximum)) return KB.formatVnd(minimum);
    return KB.formatVnd(minimum) + "–" + KB.formatVnd(maximum);
  }

  function selectionButton(option, compact) {
    const selected = KB.Selection.isSelected(option.id);
    return '<button class="button selection-option-button' + (selected ? " is-selected" : "") + (compact ? " is-compact" : "") + '" type="button" ' +
      'data-select-option="' + KB.escapeAttribute(option.id) + '" aria-pressed="' + String(selected) + '">' +
      (selected ? "Đã chọn ✓" : "Chọn phương án") + "</button>";
  }

  function renderEmpty() {
    return '<div class="empty-state selection-empty"><h2>Chưa chọn phương án nào</h2>' +
      '<p>Mở một hạng mục, chọn phương án phù hợp rồi quay lại đây. Bạn có thể xuất ngay khi mới chọn một phần.</p>' +
      '<a class="button is-primary" href="' + KB.route.doc("home") + '">Bắt đầu chọn</a></div>';
  }

  function renderRow(row, index) {
    const basePrice = row.isPercentage
      ? '<label class="selection-field"><span>Giá tủ cơ sở / đơn vị</span><input type="number" min="0" step="100000" inputmode="numeric" value="' +
        KB.escapeAttribute(row.basePrice || "") + '" placeholder="Nhập VND" data-selection-base="' + KB.escapeAttribute(row.itemId) + '"></label>'
      : "";
    return '<tr data-selection-row="' + KB.escapeAttribute(row.itemId) + '">' +
      '<td class="selection-index">' + (index + 1) + "</td>" +
      '<td><strong><a href="' + KB.route.doc(row.documentId) + '">' + KB.escapeHtml(row.itemTitle) + "</a></strong>" +
        '<small class="selection-cell-note">' + KB.escapeHtml(row.groupTitle + " · " + row.itemId) + "</small></td>" +
      '<td><strong><a href="' + KB.route.option(row.optionId) + '">' + KB.escapeHtml(row.optionName) + "</a></strong>" +
        '<small class="selection-cell-note">' + KB.escapeHtml(row.optionId + " · " + row.segment) + "</small></td>" +
      '<td><label class="selection-field"><span class="sr-only">Số lượng cho ' + KB.escapeHtml(row.itemTitle) + '</span>' +
        '<input type="number" min="0.01" max="1000000" step="0.01" inputmode="decimal" value="' + KB.escapeAttribute(row.quantity) +
        '" data-selection-quantity="' + KB.escapeAttribute(row.itemId) + '"></label>' +
        '<small class="selection-cell-note">' + KB.escapeHtml(row.unitLabel) + "</small></td>" +
      '<td><strong>' + KB.escapeHtml(row.unitPriceLabel) + '</strong><small class="selection-cell-note">' + KB.escapeHtml(row.priceBasis) + "</small>" + basePrice + "</td>" +
      '<td class="selection-cost"><strong>' + KB.escapeHtml(row.costLabel) + '</strong><small class="selection-cell-note">' + KB.escapeHtml(row.note) + "</small></td>" +
      '<td><button class="button is-danger is-compact" type="button" data-remove-selection="' + KB.escapeAttribute(row.itemId) + '">Bỏ</button></td>' +
    "</tr>";
  }

  function renderPage(report) {
    const hasRows = report.rows.length > 0;
    return '<header class="document-header selection-page-header">' +
      '<div class="document-eyebrow">Bảng lựa chọn &amp; dự toán</div>' +
      '<h1 class="document-title">Phương án đã chọn</h1>' +
      '<p class="document-summary">Chọn một phương án cho từng hạng mục, điều chỉnh số lượng và xuất bất kỳ lúc nào — không cần hoàn tất toàn bộ danh mục.</p>' +
    "</header>" +
    '<section class="selection-summary" aria-label="Tổng quan dự toán">' +
      '<article><span>Đã chọn</span><strong>' + report.rows.length + '</strong><small>hạng mục</small></article>' +
      '<article class="selection-total-card"><span>Tổng tham khảo</span><strong>' + KB.escapeHtml(report.totalLabel) + '</strong><small>Theo số lượng đã nhập</small></article>' +
      '<article><span>Chưa tính vào tổng</span><strong>' + report.unpricedCount + '</strong><small>hạng mục thiếu giá cơ sở</small></article>' +
    "</section>" +
    '<section class="section-block selection-section" aria-labelledby="danh-sach-da-chon">' +
      '<div class="section-heading-row selection-toolbar"><div><h2 id="danh-sach-da-chon">Danh sách lựa chọn</h2>' +
        '<p class="section-note">Chọn phương án khác trong cùng hạng mục sẽ tự thay thế phương án hiện tại.</p></div>' +
        '<div class="selection-export-actions">' +
          '<button class="button" type="button" data-export-pdf' + (hasRows ? "" : " disabled") + '>Xuất PDF</button>' +
          '<button class="button is-primary" type="button" data-export-xlsx' + (hasRows ? "" : " disabled") + '>Xuất XLSX</button>' +
        "</div></div>" +
      (hasRows
        ? '<div class="table-wrap selection-table-wrap"><table class="selection-table"><thead><tr><th>STT</th><th>Hạng mục</th><th>Phương án</th><th>Số lượng</th><th>Giá tham khảo</th><th>Chi phí hạng mục</th><th></th></tr></thead><tbody>' +
          report.rows.map(renderRow).join("") + '</tbody><tfoot><tr><td colspan="5">Tổng chi phí tham khảo</td><td colspan="2"><strong>' + KB.escapeHtml(report.totalLabel) + "</strong>" +
          (report.unpricedCount ? '<small class="selection-cell-note">Chưa gồm ' + report.unpricedCount + " hạng mục thiếu giá cơ sở</small>" : "") + "</td></tr></tfoot></table></div>"
        : renderEmpty()) +
    "</section>" +
    (hasRows ? '<div class="callout is-warning selection-disclaimer"><p class="callout-title">Phạm vi của con số tham khảo</p><p>Đơn giá được lấy từ cơ sở dữ liệu hiện tại và nhân với số lượng bạn nhập. Tổng chưa thay thế báo giá; cần xác nhận lại quy cách, khối lượng, thuế, vận chuyển, phụ kiện và lắp đặt.</p></div>' : "");
  }

  KB.Selection = {
    items: {},

    init: function (data, maps) {
      this.data = data;
      this.maps = maps;
      this.root = document.getElementById("document");
      this.live = document.getElementById("selection-live");
      this.load();
      this.updateHeader();

      this.root.addEventListener("click", (event) => {
        const select = event.target.closest("[data-select-option]");
        if (select) {
          const result = this.toggle(select.dataset.selectOption);
          this.announce(result);
          if (KB.renderRoute) KB.renderRoute();
          return;
        }

        const remove = event.target.closest("[data-remove-selection]");
        if (remove) {
          const row = this.getReport().rows.find(function (candidate) { return candidate.itemId === remove.dataset.removeSelection; });
          delete this.items[remove.dataset.removeSelection];
          this.save();
          this.announce(row ? "Đã bỏ " + row.itemTitle + " khỏi danh sách." : "Đã bỏ phương án.");
          if (KB.renderRoute) KB.renderRoute();
          return;
        }

        if (event.target.closest("[data-export-pdf]")) {
          KB.Export.downloadPdf(this.getReport());
          this.announce("Đã tạo tệp PDF.");
          return;
        }
        if (event.target.closest("[data-export-xlsx]")) {
          KB.Export.downloadXlsx(this.getReport());
          this.announce("Đã tạo tệp XLSX.");
        }
      });

      this.root.addEventListener("change", (event) => {
        const quantity = event.target.closest("[data-selection-quantity]");
        const base = event.target.closest("[data-selection-base]");
        if (!quantity && !base) return;
        const itemId = quantity ? quantity.dataset.selectionQuantity : base.dataset.selectionBase;
        const item = this.items[itemId];
        if (!item) return;
        if (quantity) item.quantity = clamp(quantity.value, 0.01, 1000000, 1);
        if (base) item.basePrice = clamp(base.value, 0, 1000000000000000, 0);
        this.save();
        if (KB.renderRoute) KB.renderRoute();
      });
    },

    load: function () {
      this.items = {};
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        const source = saved.items || saved;
        Object.keys(source || {}).forEach((itemId) => {
          const value = source[itemId] || {};
          const option = this.maps.options[value.optionId];
          if (!option || option.itemId !== itemId) return;
          this.items[itemId] = {
            optionId: option.id,
            quantity: clamp(value.quantity, 0.01, 1000000, 1),
            basePrice: clamp(value.basePrice, 0, 1000000000000000, 0)
          };
        });
      } catch (_) {
        this.items = {};
      }
    },

    save: function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items: this.items }));
      } catch (_) {
        // The current browser may block storage for local files; the in-memory selection still works.
      }
      this.updateHeader();
    },

    updateHeader: function () {
      const count = Object.keys(this.items).length;
      const badge = document.getElementById("selection-count");
      const trigger = document.getElementById("selection-trigger");
      if (badge) badge.textContent = count;
      if (trigger) trigger.setAttribute("aria-label", "Phương án đã chọn: " + count + " hạng mục");
    },

    announce: function (message) {
      if (!this.live) return;
      this.live.textContent = "";
      requestAnimationFrame(() => { this.live.textContent = message; });
    },

    isSelected: function (optionId) {
      const option = this.maps && this.maps.options[optionId];
      return Boolean(option && this.items[option.itemId] && this.items[option.itemId].optionId === optionId);
    },

    toggle: function (optionId) {
      const option = this.maps.options[optionId];
      if (!option) return "Không tìm thấy phương án.";
      const current = this.items[option.itemId];
      if (current && current.optionId === optionId) {
        delete this.items[option.itemId];
        this.save();
        return "Đã bỏ " + option.name + ".";
      }
      const replaced = current && this.maps.options[current.optionId];
      this.items[option.itemId] = {
        optionId: option.id,
        quantity: current ? current.quantity : 1,
        basePrice: 0
      };
      this.save();
      return replaced
        ? "Đã thay " + replaced.name + " bằng " + option.name + "."
        : "Đã chọn " + option.name + ".";
    },

    getReport: function () {
      const now = new Date();
      const order = {};
      this.data.documents.filter(function (document) { return document.kind === "category"; }).forEach(function (document, index) {
        order[document.itemId] = index;
      });
      const rows = Object.keys(this.items).map((itemId) => {
        const saved = this.items[itemId];
        const option = this.maps.options[saved.optionId];
        const parent = this.maps.documents[itemId.toLowerCase()];
        if (!option) return null;
        const group = parent ? this.maps.groups[parent.groupId] : null;
        const quantity = clamp(saved.quantity, 0.01, 1000000, 1);
        const basePrice = clamp(saved.basePrice, 0, 1000000000000000, 0);
        const isPercentage = isPercentageBasis(option.priceBasis);
        const isCalculated = !isPercentage || basePrice > 0;
        const unitMinimum = Number(option.priceMin) || 0;
        const unitMaximum = Number(option.priceMax) || 0;
        const costMinimum = isPercentage ? basePrice * unitMinimum / 100 * quantity : unitMinimum * quantity;
        const costMaximum = isPercentage ? basePrice * unitMaximum / 100 * quantity : unitMaximum * quantity;
        const unitLabel = String(option.priceBasis || "VND").replace(/^VND\/?/i, "").replace(/^PCT-?/i, "% ").replace(/-/g, " ").trim() || "hạng mục";
        return {
          itemId: itemId,
          documentId: parent ? parent.id : itemId.toLowerCase(),
          itemTitle: parent ? parent.title : itemId,
          groupTitle: group ? group.title : (option.room || "Khác"),
          optionId: option.id,
          optionName: option.name,
          segment: option.segment,
          quantity: quantity,
          unitLabel: unitLabel,
          priceBasis: option.priceBasis || "VND",
          priceMin: unitMinimum,
          priceMax: unitMaximum,
          basePrice: basePrice,
          isPercentage: isPercentage,
          isCalculated: isCalculated,
          costMin: isCalculated ? costMinimum : null,
          costMax: isCalculated ? costMaximum : null,
          unitPriceLabel: KB.formatPrice(option, false),
          costLabel: isCalculated ? formatRange(costMinimum, costMaximum) : "Chưa tính — cần nhập giá tủ cơ sở",
          note: isPercentage && !isCalculated
            ? "Mức giá là tỷ lệ phần trăm của giá tủ; chưa cộng vào tổng."
            : "Chi phí = mức giá tham khảo × số lượng.",
          sortOrder: Object.prototype.hasOwnProperty.call(order, itemId) ? order[itemId] : 9999
        };
      }).filter(Boolean).sort(function (left, right) { return left.sortOrder - right.sortOrder; });
      const totalMin = rows.reduce(function (total, row) { return total + (row.isCalculated ? row.costMin : 0); }, 0);
      const totalMax = rows.reduce(function (total, row) { return total + (row.isCalculated ? row.costMax : 0); }, 0);
      const unpricedCount = rows.filter(function (row) { return !row.isCalculated; }).length;
      return {
        title: "Bảng phương án nội thất căn hộ mẫu",
        generatedAt: now.getTime(),
        generatedLabel: new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeStyle: "short" }).format(now),
        fileDate: now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0"),
        rows: rows,
        totalMin: totalMin,
        totalMax: totalMax,
        totalLabel: formatRange(totalMin, totalMax),
        unpricedCount: unpricedCount
      };
    },

    show: function () {
      const report = this.getReport();
      this.root.dataset.sourcePath = "";
      this.root.innerHTML = renderPage(report);
      window.scrollTo(0, 0);
      KB.Sidebar.setActive("", "");
      KB.Toc.render(this.root);
      KB.renderBreadcrumb("", "Phương án đã chọn");
      document.title = "Phương án đã chọn — Nội thất căn hộ mẫu";
    },

    button: selectionButton
  };
})();
