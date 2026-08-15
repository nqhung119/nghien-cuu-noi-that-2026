(function () {
  "use strict";

  const KB = (window.KB = window.KB || {});

  function documentHeader(config) {
    const chips = (config.chips || []).filter(Boolean).map(function (chip) {
      return '<span class="meta-chip">' + KB.escapeHtml(chip) + "</span>";
    }).join("");
    const statuses = (config.statuses || []).map(function (status) {
      return '<span class="status-chip ' + (status.className || "") + '">' + KB.escapeHtml(status.label) + "</span>";
    }).join("");
    const actions = (config.actions || []).map(function (action) {
      const classes = "button " + (action.primary ? "is-primary " : "") + (action.className || "");
      if (action.button) {
        return '<button class="' + KB.escapeAttribute(classes.trim()) + '" type="button" data-select-option="' +
          KB.escapeAttribute(action.optionId) + '" aria-pressed="' + String(action.selected) + '">' + KB.escapeHtml(action.label) + "</button>";
      }
      const opensNewTab = action.external || action.newTab;
      return '<a class="' + KB.escapeAttribute(classes.trim()) + '" href="' +
        KB.escapeAttribute(action.href) + '"' + (opensNewTab ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" +
        KB.escapeHtml(action.label) + "</a>";
    }).join("");
    return '<header class="document-header">' +
      (config.eyebrow ? '<div class="document-eyebrow">' + KB.escapeHtml(config.eyebrow) + "</div>" : "") +
      '<h1 class="document-title">' + KB.escapeHtml(config.title) + "</h1>" +
      (config.summary ? '<p class="document-summary">' + KB.escapeHtml(config.summary) + "</p>" : "") +
      (chips || statuses ? '<div class="meta-row">' + statuses + chips + "</div>" : "") +
      (actions ? '<div class="document-actions">' + actions + "</div>" : "") +
    "</header>";
  }

  function getDocumentSummary(document) {
    if (document.kind === "category") {
      const count = (document.optionIds || []).length;
      return "So sánh " + count + " phương án theo chi phí, cấu tạo, độ bền, công năng và điều kiện thi công.";
    }
    if (document.kind === "csv") return "Bảng dữ liệu vận hành có thể dùng để lọc, đối chiếu hoặc chuyển sang Excel/Google Sheets.";
    return KB.snippet(document.plainText, "", 210);
  }

  function cleanCell(value) {
    return KB.cleanMarkdownLabel(value || "");
  }

  function itemTypeLabel(code) {
    return ({
      FIX: "Nội thất đóng",
      LOO: "Nội thất mua sẵn",
      ELE: "Thiết bị điện",
      ACC: "Phụ kiện",
      MAT: "Vật liệu",
      PLU: "Thiết bị nước",
      AUX: "Vật tư phụ",
      LAB: "Nhân công / dịch vụ"
    })[code] || code;
  }

  function phaseLabel(code) {
    return ({
      IN: "Có trong gói 150 triệu",
      "DE-SAU": "Để giai đoạn sau",
      "GIU-LAI": "Giữ hiện trạng",
      "CUC-BO": "Thi công cục bộ"
    })[code] || (code ? "Gói 150 triệu: " + code : "");
  }

  function optionDescriptor(option) {
    return (
      cleanCell(KB.getCell(option, [/Cấu tạo/i, /Vật liệu/i, /Thông số/i, /Cấu hình/i, /Giải pháp/i])) ||
      cleanCell(KB.getCell(option, [/Ưu.*nhược/i, /Đặc điểm/i])) ||
      option.normalizedName
    );
  }

  function optionCard(option) {
    return '<article class="option-card">' +
      '<div class="option-card-header"><div>' +
        '<span class="option-card-code">' + KB.escapeHtml(option.id) + "</span>" +
        '<h3><a href="' + KB.route.option(option.id) + '">' + KB.escapeHtml(option.name) + "</a></h3>" +
      "</div>" +
      (option.recommended ? '<span class="status-chip is-recommended">Khuyên dùng</span>' : "") +
      "</div>" +
      '<p>' + KB.escapeHtml(optionDescriptor(option)) + "</p>" +
      '<div class="option-card-footer">' +
        '<span class="option-price">' + KB.escapeHtml(KB.formatPrice(option, true)) +
          '<span class="option-unit"> · ' + KB.escapeHtml(option.segment) + "</span></span>" +
        '<div class="option-card-actions"><a href="' + KB.route.option(option.id) + '">Chi tiết</a>' + KB.Selection.button(option, true) + "</div>" +
      "</div>" +
    "</article>";
  }

  function getComparisonSelection(document, options) {
    const saved = KB.Content.comparisonSelections[document.itemId];
    if (saved && saved.length) {
      return saved.filter(function (id) {
        return options.some(function (option) { return option.id === id; });
      }).slice(0, 4);
    }
    const recommended = options.filter(function (option) { return option.recommended; }).map(function (option) { return option.id; });
    options.forEach(function (option) {
      if (recommended.length < Math.min(3, options.length) && recommended.indexOf(option.id) < 0) recommended.push(option.id);
    });
    return recommended.slice(0, 4);
  }

  function comparisonFields(options) {
    const names = [];
    options.forEach(function (option) {
      Object.keys(option.cells || {}).forEach(function (name) {
        if (/^Mã$/i.test(name) || /^Giá/i.test(name) || /Phương án|Cấu hình|Giải pháp|Gói|Phân khúc|Loại|Vật tư/i.test(name)) return;
        if (names.indexOf(name) < 0) names.push(name);
      });
    });
    return names.slice(0, 6);
  }

  function renderComparison(document, options) {
    const selection = getComparisonSelection(document, options);
    KB.Content.comparisonSelections[document.itemId] = selection;
    const selected = selection.map(function (id) {
      return options.find(function (option) { return option.id === id; });
    }).filter(Boolean);
    const fields = comparisonFields(selected);
    const matrixRows = [
      { label: "Phân khúc", values: selected.map(function (option) { return option.segment; }) },
      { label: "Giá tham khảo", values: selected.map(function (option) { return KB.formatPrice(option, true); }) }
    ].concat(fields.map(function (field) {
      return {
        label: field,
        values: selected.map(function (option) { return cleanCell(option.cells[field]); })
      };
    }));

    return '<section class="section-block" aria-labelledby="so-sanh-phuong-an">' +
      '<div class="section-heading-row"><div><h2 id="so-sanh-phuong-an">So sánh phương án</h2>' +
      '<p class="section-note">Chọn tối đa 4 phương án để đặt cạnh nhau.</p></div></div>' +
      '<div class="comparison-controls">' +
        options.map(function (option) {
          const chosen = selection.indexOf(option.id) >= 0;
          return '<button class="filter-chip' + (chosen ? " is-selected" : "") + '" type="button" ' +
            'data-compare-option="' + KB.escapeAttribute(option.id) + '" data-item-id="' + KB.escapeAttribute(document.itemId) + '" aria-pressed="' + chosen + '">' +
            KB.escapeHtml(option.name) + "</button>";
        }).join("") +
      "</div>" +
      (selected.length ?
        '<div class="table-wrap"><table class="comparison-table"><thead><tr><th>Tiêu chí</th>' +
          selected.map(function (option) {
            return '<th><a class="comparison-option-link" href="' + KB.route.option(option.id) + '">' +
              KB.escapeHtml(option.name) + "</a></th>";
          }).join("") +
        "</tr></thead><tbody>" +
          matrixRows.map(function (row) {
            return "<tr><td>" + KB.escapeHtml(row.label) + "</td>" +
              row.values.map(function (value) { return "<td>" + KB.escapeHtml(value || "—") + "</td>"; }).join("") +
            "</tr>";
          }).join("") +
        "</tbody></table></div>" :
        '<div class="callout is-warning"><p>Chọn ít nhất một phương án để so sánh.</p></div>'
      ) +
    "</section>";
  }

  function renderCsv(document) {
    const headers = document.csvHeaders || [];
    const rows = document.csvRows || [];
    if (!headers.length) return '<div class="empty-state">Bảng dữ liệu chưa có dòng.</div>';
    return '<div class="table-wrap"><table><thead><tr>' +
      headers.map(function (header) { return "<th>" + KB.escapeHtml(header) + "</th>"; }).join("") +
      "</tr></thead><tbody>" +
      rows.map(function (row) {
        return "<tr>" + headers.map(function (header) {
          return "<td>" + KB.escapeHtml(row[header] || "") + "</td>";
        }).join("") + "</tr>";
      }).join("") +
      "</tbody></table></div>";
  }

  function renderRelated(document, maps) {
    const groupDocuments = (maps.groupDocuments[document.groupId] || []).filter(function (candidate) {
      return candidate.id !== document.id && candidate.kind !== "csv";
    }).slice(0, 3);
    if (!groupDocuments.length) return "";
    return '<section class="section-block" aria-labelledby="tai-lieu-lien-quan"><h2 id="tai-lieu-lien-quan">Liên quan</h2>' +
      '<div class="related-grid">' + groupDocuments.map(function (candidate) {
        return '<a class="related-card" href="' + KB.route.doc(candidate.id) + '">' +
          "<small>" + KB.escapeHtml(candidate.kind === "category" ? "Hạng mục" : "Tài liệu") + "</small>" +
          KB.escapeHtml(candidate.title) + "</a>";
      }).join("") + "</div></section>";
  }

  function renderPagination(document, data) {
    const navigable = data.documents.filter(function (item) { return item.kind !== "csv"; });
    const index = navigable.findIndex(function (item) { return item.id === document.id; });
    if (index < 0) return "";
    const previous = navigable[index - 1];
    const next = navigable[index + 1];
    return '<nav class="document-pagination" aria-label="Tài liệu trước và sau">' +
      (previous ? '<a class="pagination-link" href="' + KB.route.doc(previous.id) + '"><span class="pagination-direction">Trước</span><span class="pagination-title">' + KB.escapeHtml(previous.title) + "</span></a>" : "<span></span>") +
      (next ? '<a class="pagination-link next" href="' + KB.route.doc(next.id) + '"><span class="pagination-direction">Sau</span><span class="pagination-title">' + KB.escapeHtml(next.title) + "</span></a>" : "<span></span>") +
    "</nav>";
  }

  function renderGroupDirectory(data, maps) {
    const roomGroups = data.groups.filter(function (group) { return group.kind === "room" || group.kind === "shared"; });
    const groupVisuals = {
      "01-sanh-va-loi-vao": ["assets/guides/entry-storage.webp", "Tổ chức sảnh gọn, thoáng và thuận tiện khi ra vào."],
      "02-phong-khach": ["assets/guides/living-room-sofa.jpg", "Cân bằng tỷ lệ đồ rời, lối đi và trải nghiệm sinh hoạt."],
      "03-bep-va-phong-an": ["assets/guides/modern-kitchen.webp", "Khóa đồng bộ tủ, mặt bàn, thiết bị và hệ điện nước."],
      "04-phong-ngu-01": ["assets/guides/bedroom-storage.webp", "Ưu tiên giấc ngủ, lưu trữ và khoảng thao tác quanh giường."],
      "05-phong-ngu-02": ["assets/guides/bedroom-storage.webp", "Tối ưu phòng nhỏ cho nghỉ ngơi, học tập và giai đoạn sau."],
      "06-phong-tam": ["assets/guides/bathroom-fixtures.webp", "Kiểm soát vùng ướt, thoát nước và khoảng bảo trì thiết bị."],
      "07-lo-gia": ["assets/guides/laundry-room.webp", "Phối hợp giặt, phơi, thoát sàn và thông gió thiết bị."],
      "08-hang-muc-chung": ["assets/guides/material-hardware-detail.webp", "Một bộ tiêu chuẩn chung cho sàn, đèn, ván và phụ kiện."]
    };
    return '<section class="section-block home-directory" aria-labelledby="danh-muc-khong-gian">' +
      '<div class="section-heading-row home-section-heading"><div><span class="section-kicker">Khám phá theo phòng</span>' +
      '<h2 id="danh-muc-khong-gian">Mọi quyết định, đúng ngữ cảnh</h2>' +
      '<p class="section-note">Chọn một không gian để xem tiêu chí kỹ thuật, so sánh giá và phương án phù hợp.</p></div>' +
      '<span class="section-index">01</span></div>' +
      '<div class="room-grid">' + roomGroups.map(function (group, index) {
        const documents = maps.groupDocuments[group.id] || [];
        const itemCount = documents.filter(function (document) { return document.kind === "category"; }).length;
        const visual = groupVisuals[group.id] || ["assets/guides/apartment-overview-hero.webp", "Khám phá tài liệu và phương án theo khu vực."];
        return '<a class="room-card" href="' + KB.route.doc(group.overviewId || (group.documentIds || [])[0]) + '">' +
          '<span class="room-card-media"><img src="' + KB.escapeAttribute(visual[0]) + '" alt="" loading="lazy" decoding="async"></span>' +
          '<span class="room-card-body"><span class="room-card-meta">0' + (index + 1) + ' · ' + itemCount + ' hạng mục</span>' +
          '<strong>' + KB.escapeHtml(group.title) + '</strong><span class="room-card-description">' + KB.escapeHtml(visual[1]) + '</span>' +
          '<span class="room-card-link">Mở không gian <span aria-hidden="true">↗</span></span></span></a>';
      }).join("") + "</div></section>";
  }

  function renderHome(document, data, maps) {
    return '<div class="home-page">' +
      '<section class="home-hero" aria-labelledby="home-title">' +
        '<img class="home-hero-image" src="assets/guides/apartment-overview-hero.webp" alt="Không gian phòng khách, bàn ăn và bếp của căn hộ mẫu" fetchpriority="high" decoding="async">' +
        '<div class="home-hero-shade" aria-hidden="true"></div>' +
        '<div class="home-hero-content"><span class="home-hero-kicker">Căn hộ 61 m² · Đã ẩn danh</span>' +
          '<h1 class="document-title" id="home-title">Một nơi để chốt đúng từng quyết định nội thất.</h1>' +
          '<p>Từ nhu cầu đến vật liệu, dự toán và nghiệm thu — toàn bộ dữ liệu căn hộ 61 m² được tổ chức để so sánh nhanh và triển khai rõ ràng.</p>' +
          '<div class="home-hero-actions"><a class="button is-primary is-large" href="#/doc/02-phong-khach-overview">Khám phá không gian</a>' +
          '<a class="button is-glass is-large" href="#/selection">Xem bộ phương án</a></div>' +
        '</div>' +
        '<div class="home-hero-stats" aria-label="Tổng quan dữ liệu">' +
          '<div><strong>61</strong><span>m² căn hộ</span></div>' +
          '<div><strong>' + data.meta.itemCount + '</strong><span>hạng mục</span></div>' +
          '<div><strong>' + data.meta.optionCount + '</strong><span>phương án</span></div>' +
          '<div><strong>08</strong><span>nhóm không gian</span></div>' +
        '</div>' +
      '</section>' +
      '<div class="home-trust-row"><span><i aria-hidden="true"></i>Dữ liệu lưu cục bộ</span><span><i aria-hidden="true"></i>Không cần đăng nhập</span><span><i aria-hidden="true"></i>Giá dự toán cập nhật 14.08.2026</span></div>' +
      renderGroupDirectory(data, maps) +
      '<section class="section-block home-detail-feature" aria-labelledby="chi-tiet-tao-chat-luong">' +
        '<div class="section-heading-row home-section-heading"><div><span class="section-kicker">Nhìn kỹ trước khi chốt</span>' +
        '<h2 id="chi-tiet-tao-chat-luong">Chi tiết tạo nên chất lượng</h2></div><span class="section-index">02</span></div>' +
        '<div class="detail-feature-grid">' +
          '<article class="detail-feature-card detail-feature-card-main"><img src="assets/guides/material-hardware-detail.webp" alt="Mẫu ván, cạnh dán, đá, vải và phụ kiện tủ" loading="lazy" decoding="async">' +
            '<div class="detail-feature-copy"><span>Vật liệu &amp; phụ kiện</span><h3>Đừng chỉ chọn bằng tên màu.</h3><p>Lõi ván, cạnh dán, bề mặt và đúng mã phụ kiện quyết định độ bền của đồ gỗ nhiều hơn một ảnh phối cảnh đẹp.</p><a href="#/doc/com-board">Xem tiêu chuẩn vật liệu <span aria-hidden="true">→</span></a></div></article>' +
          '<article class="detail-feature-card"><img src="assets/guides/bathroom-waterproofing-detail.webp" alt="Chi tiết cấu tạo chống thấm và thoát sàn khu tắm" loading="lazy" decoding="async">' +
            '<div class="detail-feature-copy"><span>Cấu tạo khu ướt</span><h3>Phần ẩn phải được nghiệm thu trước.</h3><p>Độ dốc, màng chống thấm, góc chân tường và liên kết phễu cần có ảnh và biên bản trước khi lát kín.</p><a href="#/doc/bat-wp">Xem chống thấm &amp; thoát sàn <span aria-hidden="true">→</span></a></div></article>' +
        '</div>' +
      '</section>' +
      '<section class="section-block home-workflow" aria-labelledby="quy-trinh-ra-quyet-dinh">' +
        '<div class="section-heading-row home-section-heading"><div><span class="section-kicker">Quy trình tinh gọn</span><h2 id="quy-trinh-ra-quyet-dinh">Từ tham khảo đến phương án có thể thi công</h2></div><span class="section-index">03</span></div>' +
        '<div class="workflow-grid">' +
          '<article><span>01</span><h3>Khám phá</h3><p>Đi theo từng phòng để hiểu vai trò, điều kiện kỹ thuật và lỗi thường gặp của mỗi hạng mục.</p></article>' +
          '<article><span>02</span><h3>So sánh</h3><p>Đặt tối đa bốn lựa chọn cạnh nhau theo cấu tạo, chi phí, độ bền và điều kiện thi công.</p></article>' +
          '<article><span>03</span><h3>Chốt &amp; xuất</h3><p>Lưu một phương án cho mỗi hạng mục, nhập khối lượng rồi xuất bảng dự toán PDF hoặc XLSX.</p></article>' +
        '</div>' +
        '<div class="home-cta"><div><span class="section-kicker">Bắt đầu từ nhu cầu thực</span><h2>Sẵn sàng tạo bộ phương án cho Căn hộ mẫu?</h2></div>' +
          '<div><a class="button is-primary is-large" href="#/doc/01-sanh-va-loi-vao-overview">Bắt đầu từ sảnh</a><a class="button is-large" href="#/doc/management-overview">Mở hồ sơ quản lý</a></div></div>' +
      '</section>' +
    '</div>';
  }

  function renderFigure(figure, heading) {
    if (!figure || !figure.src) return "";
    const credit = figure.credit ? '<span class="figure-credit">' + KB.escapeHtml(figure.credit) + "</span>" : "";
    const source = figure.source
      ? '<a class="figure-source" href="' + KB.escapeAttribute(figure.source) + '" target="_blank" rel="noreferrer">Xem nguồn ảnh</a>'
      : "";
    return '<section class="section-block guide-visual" aria-label="' + KB.escapeAttribute(heading || "Hình minh họa") + '">' +
      '<figure class="knowledge-figure"><img src="' + KB.escapeAttribute(figure.src) + '" alt="' +
        KB.escapeAttribute(figure.alt || "") + '" loading="lazy" decoding="async">' +
        '<figcaption><strong>' + KB.escapeHtml(heading || "Hình minh họa") + ".</strong> " +
          KB.escapeHtml(figure.caption || "") +
          ((credit || source) ? '<span class="figure-meta">' + credit + source + "</span>" : "") +
        "</figcaption></figure></section>";
  }

  function renderGuideOverview(document) {
    const guide = document.guide;
    if (!guide) return "";
    return '<section class="section-block" aria-labelledby="hieu-nhanh-hang-muc">' +
      '<div class="section-heading-row"><div><h2 id="hieu-nhanh-hang-muc">Hiểu nhanh hạng mục</h2>' +
      '<p class="section-note">Vai trò, vị trí và mức độ cần thiết trước khi xem sản phẩm.</p></div></div>' +
      '<div class="guide-summary-grid">' +
        '<article class="info-card is-wide"><h3>Đây là gì và dùng để làm gì?</h3><p>' + KB.escapeHtml(guide.intro) + "</p></article>" +
        '<article class="info-card"><h3>Nằm ở đâu?</h3><p>' + KB.escapeHtml(guide.location) + "</p></article>" +
        '<article class="info-card"><h3>Có bắt buộc không?</h3><p>' + KB.escapeHtml(guide.mandatory) + "</p></article>" +
      "</div></section>" +
      renderFigure(guide.figure, "Hình minh họa thực tế / định hướng") +
      '<section class="section-block" aria-labelledby="loai-va-vat-lieu">' +
        '<h2 id="loai-va-vat-lieu">Các loại phổ biến và vật liệu</h2>' +
        '<div class="guide-summary-grid">' +
          '<article class="info-card"><h3>Các loại thường gặp</h3><p>' + KB.escapeHtml(guide.commonTypes) + "</p></article>" +
          '<article class="info-card"><h3>Vật liệu / cấu tạo cần nhận biết</h3><p>' + KB.escapeHtml(guide.materials) + "</p></article>" +
        "</div></section>";
  }

  function renderGuideDecision(guide) {
    if (!guide) return "";
    return '<section class="section-block" aria-labelledby="huong-dan-ra-quyet-dinh">' +
      '<h2 id="huong-dan-ra-quyet-dinh">Hướng dẫn ra quyết định</h2>' +
      '<div class="guide-summary-grid">' +
        '<article class="info-card"><h3>Vì sao giá chênh nhau?</h3><p>' + KB.escapeHtml(guide.priceFactors) + "</p></article>" +
        '<article class="info-card"><h3>Vệ sinh và bảo trì</h3><p>' + KB.escapeHtml(guide.maintenance) + "</p></article>" +
        '<article class="info-card"><h3>Trước khi thi công</h3><p>' + KB.escapeHtml(guide.installation) + "</p></article>" +
        '<article class="info-card"><h3>Checklist nghiệm thu</h3><p>' + KB.escapeHtml(guide.inspection) + "</p></article>" +
      "</div>" +
      '<div class="callout is-warning"><p class="callout-title">Lỗi thường gặp</p><p>' + KB.escapeHtml(guide.pitfalls) + "</p></div>" +
      '<div class="callout"><p class="callout-title">Khuyến nghị cho căn hộ mẫu</p><p>' + KB.escapeHtml(guide.recommendation) + "</p></div>" +
    "</section>";
  }

  function renderDocument(document, data, maps) {
    if (document.id === "home") return renderHome(document, data, maps);
    const group = maps.groups[document.groupId];
    const actions = document.kind === "csv"
      ? [{ label: "Mở CSV đã render", href: KB.route.doc(document.id), newTab: true }]
      : document.sourceHref
        ? [{ label: "Mở Markdown gốc", href: document.sourceHref, external: true }]
        : [];
    let content = documentHeader({
      eyebrow: group ? group.title : "Tài liệu",
      title: document.title,
      summary: getDocumentSummary(document),
      chips: [document.itemId, itemTypeLabel(document.itemType), phaseLabel(document.phaseB)],
      actions: actions
    });

    if (document.kind === "category") {
      const options = maps.itemOptions[document.itemId] || [];
      content += renderGuideOverview(document);
      content += renderComparison(document, options);
      content += '<section class="section-block" aria-labelledby="cac-lua-chon"><h2 id="cac-lua-chon">Các lựa chọn</h2>' +
        '<div class="option-grid">' + options.map(optionCard).join("") + "</div></section>";
      content += renderGuideDecision(document.guide);
      const residualMarkdown = KB.stripGeneratedGuide(KB.stripOptionTable(document.markdown));
      if (residualMarkdown) {
        content += '<section class="section-block prose" aria-label="Ghi chú kỹ thuật từ hồ sơ nguồn">' +
          '<h2 id="ghi-chu-ky-thuat">Ghi chú kỹ thuật từ hồ sơ nguồn</h2>' +
          KB.renderMarkdown(residualMarkdown, { skipH1: true }) + "</section>";
      }
    } else if (document.kind === "csv") {
      content += '<section class="section-block" aria-labelledby="bang-du-lieu"><h2 id="bang-du-lieu">Bảng dữ liệu</h2>' +
        renderCsv(document) + "</section>";
    } else {
      content += '<div class="prose">' + KB.renderMarkdown(document.markdown, { skipH1: true }) + "</div>";
    }
    content += renderRelated(document, maps);
    content += renderPagination(document, data);
    return content;
  }

  function renderDefinitions(rows) {
    return '<dl class="definition-list">' + rows.filter(function (row) { return row[1]; }).map(function (row) {
      return "<dt>" + KB.escapeHtml(row[0]) + "</dt><dd>" + KB.escapeHtml(row[1]) + "</dd>";
    }).join("") + "</dl>";
  }

  function renderOption(option, data, maps) {
    const parent = maps.documents[option.itemId.toLowerCase()];
    const group = parent ? maps.groups[parent.groupId] : null;
    const guide = (parent && parent.guide) || {};
    const cells = Object.keys(option.cells || {}).filter(function (key) {
      return !/^Mã$/i.test(key) && !/Phương án|Giải pháp|Gói|Phân khúc|Loại|Vật tư/i.test(key);
    });
    const decision = cleanCell(KB.getCell(option, [/Chọn.*tránh/i, /Khi nào/i, /Phù hợp/i, /Dùng khi/i]));
    const strengths = cleanCell(KB.getCell(option, [/Ưu.*nhược/i, /Đặc điểm/i, /Tuổi thọ/i, /Đánh giá/i]));
    const installation = cleanCell(KB.getCell(option, [/Thi công/i, /Lắp đặt/i, /Phụ kiện/i, /Bao gồm/i]));
    const configuration = cleanCell(KB.getCell(option, [/Cấu tạo/i, /Vật liệu/i, /Thông số/i, /Cấu hình/i, /Thành phần/i, /Phạm vi/i, /Sản phẩm bàn giao/i]));
    const brand = option.brandGroups || {};
    const siblings = maps.itemOptions[option.itemId] || [];
    const position = siblings.findIndex(function (candidate) { return candidate.id === option.id; });
    const previous = siblings[position - 1];
    const next = siblings[position + 1];

    const strengthParts = strengths.split(/\s*;\s*/).filter(Boolean);
    const durabilityMatch = strengths.match(/[^.;]*(?:(?:\d+[.,]?\d*)\s*[–-]\s*)?(?:\d+[.,]?\d*)\s*năm[^.;]*/i);
    const durability = durabilityMatch ? durabilityMatch[0].trim() : "Phụ thuộc cấu hình cụ thể, chất lượng lắp đặt, cường độ sử dụng và bảo trì.";
    const pros = strengthParts[0] || "Điểm mạnh cần được xác nhận bằng mẫu, thông số hoặc trải nghiệm dùng thực tế.";
    const cons = strengthParts.slice(1).join("; ") || "Chưa có nhược điểm tách riêng trong dữ liệu; cần đối chiếu lỗi thường gặp của hạng mục và điều kiện bảo hành.";
    const avoidMatch = decision.match(/(?:^|[.;]\s*)(tránh(?:\s+khi)?|không\s+nên(?:\s+dùng)?|không\s+chọn(?:\s+khi)?)[\s:]*/i);
    const suitable = avoidMatch ? decision.slice(0, avoidMatch.index).replace(/[.;\s]+$/, "") : decision;
    const avoid = avoidMatch ? decision.slice(avoidMatch.index).replace(/^[.;\s]+/, "") : guide.pitfalls;
    const comparisonPosition = position >= 0
      ? "Phương án thứ " + (position + 1) + "/" + siblings.length + " theo thứ tự phân khúc trong hồ sơ."
      : "Đối chiếu trực tiếp với các phương án cùng hạng mục trước khi chốt.";
    const valueAssessment = option.recommended
      ? "Cao trong bối cảnh căn hộ mẫu: phương án được đánh dấu khuyên dùng, nhưng vẫn phải khóa quy cách và báo giá."
      : (position <= 1
        ? "Thiên về tiết kiệm; kiểm tra kỹ phần bị lược bớt và chi phí sửa/thay về sau."
        : (position >= siblings.length - 1
          ? "Chỉ đáng tiền khi đặc tính nâng cấp giải quyết nhu cầu cụ thể, không chỉ tăng mức hoàn thiện."
          : "Mức trung gian; so chênh giá với phương án khuyên dùng trên cùng quy cách."));
    const isSelected = KB.Selection.isSelected(option.id);

    let content = documentHeader({
      eyebrow: (group ? group.title + " · " : "") + (parent ? parent.title : option.itemId),
      title: option.name,
      summary: configuration || strengths || "Chi tiết cấu hình, mức giá và tiêu chí áp dụng cho phương án.",
      statuses: option.recommended ? [{ label: "Khuyên dùng", className: "is-recommended" }] : [],
      chips: [option.id, option.segment, option.room],
      actions: [
        { label: isSelected ? "Đã chọn ✓" : "Chọn phương án", button: true, optionId: option.id, selected: isSelected, primary: !isSelected, className: isSelected ? "selection-option-button is-selected" : "selection-option-button" },
        parent ? { label: "Về hạng mục", href: KB.route.doc(parent.id) } : null,
        parent && parent.sourceHref ? { label: "Mở dữ liệu gốc", href: parent.sourceHref, external: true } : null
      ].filter(Boolean)
    });

    content += '<section class="section-block" aria-labelledby="ban-chat-phuong-an"><h2 id="ban-chat-phuong-an">Bản chất và công dụng</h2>' +
      '<div class="guide-summary-grid">' +
        '<article class="info-card"><h3>Đây là gì?</h3><p><strong>' + KB.escapeHtml(option.name) + "</strong> là một phương án thuộc phân khúc " +
          KB.escapeHtml(option.segment) + " của hạng mục " + KB.escapeHtml(parent ? parent.title : option.itemId) + ".</p></article>" +
        '<article class="info-card"><h3>Dùng để làm gì?</h3><p>' + KB.escapeHtml(guide.intro || "Giải quyết công năng được mô tả trong hạng mục nguồn.") + "</p></article>" +
        '<article class="info-card is-wide"><h3>Đặc điểm cấu tạo / thông số</h3><p>' +
          KB.escapeHtml(configuration || "Cần yêu cầu nhà cung cấp ghi rõ vật liệu, kích thước, mã sản phẩm và phạm vi kèm theo.") + "</p></article>" +
      "</div></section>";

    content += renderFigure(guide.figure, "Tham chiếu hình ảnh hạng mục");

    content += '<section class="section-block" aria-labelledby="uu-nhuoc-va-do-ben"><h2 id="uu-nhuoc-va-do-ben">Ưu, nhược điểm và độ bền</h2>' +
      '<div class="pros-cons-grid">' +
        '<article class="info-card pros-card"><h3>Ưu điểm</h3><p>' + KB.escapeHtml(pros) + "</p></article>" +
        '<article class="info-card cons-card"><h3>Nhược điểm / giới hạn</h3><p>' + KB.escapeHtml(cons) + "</p></article>" +
      "</div>" +
      '<div class="guide-summary-grid option-care-grid">' +
        '<article class="info-card"><h3>Độ bền dự kiến</h3><p>' + KB.escapeHtml(durability) + "</p></article>" +
        '<article class="info-card"><h3>Vệ sinh và bảo trì</h3><p>' + KB.escapeHtml(guide.maintenance || "Theo hướng dẫn của nhà sản xuất và vật liệu bề mặt.") + "</p></article>" +
      "</div></section>";

    content += '<section class="section-block" aria-labelledby="chi-phi-va-thi-cong"><h2 id="chi-phi-va-thi-cong">Chi phí và thi công</h2>' +
      '<div class="guide-summary-grid">' +
        '<article class="info-card"><h3>Chi phí tham khảo</h3>' + renderDefinitions([
          ["Khoảng giá", KB.formatPrice(option, false)],
          ["Đơn vị/cơ sở giá", option.priceBasis],
          ["Phân khúc", option.segment],
          ["Mã dự toán", option.id]
        ]) + '<p class="card-note"><strong>Yếu tố làm đổi giá:</strong> ' + KB.escapeHtml(guide.priceFactors || "Quy cách, số lượng, vận chuyển, lắp đặt và bảo hành.") + "</p></article>" +
        '<article class="info-card"><h3>Thi công / lắp đặt</h3>' +
          (installation ? "<p>" + KB.escapeHtml(installation) + "</p>" : "") +
          '<p><strong>Điểm phải khóa:</strong> ' + KB.escapeHtml(guide.installation || "Kích thước, nền lắp và phạm vi phụ kiện.") + "</p></article>" +
      "</div>" +
      '<div class="callout"><p class="callout-title">Checklist nghiệm thu</p><p>' + KB.escapeHtml(guide.inspection || "Kiểm tra đủ cấu hình, vận hành và hồ sơ bảo hành.") + "</p></div>" +
    "</section>";

    content += '<section class="section-block" aria-labelledby="phu-hop-va-so-sanh"><h2 id="phu-hop-va-so-sanh">Phù hợp, không phù hợp và so sánh</h2>' +
      '<div class="pros-cons-grid">' +
        '<article class="info-card pros-card"><h3>Phù hợp với ai / khi nào?</h3><p>' + KB.escapeHtml(suitable || guide.recommendation || "Khi cấu hình giải quyết đúng nhu cầu và nằm trong ngân sách đã khóa.") + "</p></article>" +
        '<article class="info-card cons-card"><h3>Không nên dùng khi nào?</h3><p>' + KB.escapeHtml(avoid || "Khi điều kiện hiện trạng, bảo trì hoặc ngân sách không đáp ứng.") + "</p></article>" +
      "</div>" +
      '<div class="info-card comparison-context"><h3>So với lựa chọn tương đương</h3><p>' + KB.escapeHtml(comparisonPosition) + "</p>" +
        '<div class="comparison-neighbors">' +
          (previous ? '<a href="' + KB.route.option(previous.id) + '"><small>Phân khúc trước · ' + KB.escapeHtml(KB.formatPrice(previous, true)) + "</small>" + KB.escapeHtml(previous.name) + "</a>" : '<span><small>Đầu dải</small>Không có phương án trước</span>') +
          (next ? '<a href="' + KB.route.option(next.id) + '"><small>Phân khúc sau · ' + KB.escapeHtml(KB.formatPrice(next, true)) + "</small>" + KB.escapeHtml(next.name) + "</a>" : '<span><small>Cuối dải</small>Không có phương án sau</span>') +
        "</div></div></section>";

    content += '<section class="section-block" aria-labelledby="danh-gia-tong-hop"><h2 id="danh-gia-tong-hop">Đánh giá tổng hợp</h2>' +
      '<div class="info-card">' + renderDefinitions([
        ["Giá trị", valueAssessment],
        ["Chất lượng", "Mức " + option.segment + "; phải xác nhận bằng cấu hình, mã vật liệu/model và mẫu thực tế."],
        ["Thẩm mỹ", "Phụ thuộc tỷ lệ, màu, bề mặt và mức hòa hợp với không gian; không suy ra chỉ từ mức giá."],
        ["Độ bền", durability],
        ["Công năng", suitable || guide.recommendation || "Đánh giá theo nhu cầu sử dụng thực tế."]
      ]) + "</div></section>";

    if (cells.length) {
      content += '<section class="section-block" aria-labelledby="thong-so-day-du"><h2 id="thong-so-day-du">Thông tin gốc đầy đủ</h2>' +
        '<p class="section-note">Dữ liệu trích từ dòng phương án trong README hạng mục.</p>' +
        renderDefinitions(cells.map(function (key) { return [key, cleanCell(option.cells[key])]; })) + "</section>";
    }

    if (brand.economy || brand.mainstream || brand.upper) {
      content += '<section class="section-block" aria-labelledby="thuong-hieu-tham-khao"><h2 id="thuong-hieu-tham-khao">Nhóm thương hiệu tham khảo</h2>' +
        '<div class="info-card">' + renderDefinitions([
          ["Kinh tế / địa phương", brand.economy],
          ["Phổ thông / chính hãng", brand.mainstream],
          ["Cao cấp / chuyên biệt", brand.upper],
          ["Lưu ý lựa chọn", brand.note]
        ]) + "</div>" +
        '<div class="callout is-warning"><p class="callout-title">Cần xác minh trước khi đặt hàng</p><p>Giá, tồn kho, model, bảo hành và phạm vi lắp đặt có thể thay đổi. Dùng tên nhóm để lấy tối thiểu 2–3 báo giá cùng cấu hình.</p></div>' +
      "</section>";
    }

    const otherOptions = siblings.filter(function (candidate) { return candidate.id !== option.id; }).slice(0, 3);
    if (otherOptions.length) {
      content += '<section class="section-block" aria-labelledby="phuong-an-cung-hang-muc"><h2 id="phuong-an-cung-hang-muc">Phương án cùng hạng mục</h2>' +
        '<div class="related-grid">' + otherOptions.map(function (candidate) {
          return '<a class="related-card" href="' + KB.route.option(candidate.id) + '"><small>' +
            KB.escapeHtml(candidate.segment + " · " + KB.formatPrice(candidate, true)) + "</small>" +
            KB.escapeHtml(candidate.name) + "</a>";
        }).join("") + "</div></section>";
    }

    content += '<nav class="document-pagination" aria-label="Phương án trước và sau">' +
      (previous ? '<a class="pagination-link" href="' + KB.route.option(previous.id) + '"><span class="pagination-direction">Phương án trước</span><span class="pagination-title">' + KB.escapeHtml(previous.name) + "</span></a>" : "<span></span>") +
      (next ? '<a class="pagination-link next" href="' + KB.route.option(next.id) + '"><span class="pagination-direction">Phương án sau</span><span class="pagination-title">' + KB.escapeHtml(next.name) + "</span></a>" : "<span></span>") +
    "</nav>";
    return { html: content, parent: parent, group: group };
  }

  KB.Content = {
    comparisonSelections: {},

    init: function (data, maps) {
      this.data = data;
      this.maps = maps;
      this.root = document.getElementById("document");
      this.root.addEventListener("click", (event) => {
        const compare = event.target.closest("[data-compare-option]");
        if (compare) {
          const itemId = compare.dataset.itemId;
          const optionId = compare.dataset.compareOption;
          const current = this.comparisonSelections[itemId] || [];
          const location = current.indexOf(optionId);
          if (location >= 0) current.splice(location, 1);
          else if (current.length < 4) current.push(optionId);
          else {
            compare.blur();
            return;
          }
          this.comparisonSelections[itemId] = current;
          const parent = this.maps.documents[itemId.toLowerCase()];
          if (parent) this.showDocument(parent, { preserveScroll: true });
          return;
        }

        const markdownLink = event.target.closest("[data-md-link]");
        if (markdownLink) {
          const currentPath = this.root.dataset.sourcePath || "";
          const target = markdownLink.dataset.mdLink;
          const resolved = KB.resolvePath(currentPath, target);
          const documentTarget = this.maps.pathToDocument[resolved];
          if (documentTarget) {
            event.preventDefault();
            location.hash = KB.route.doc(documentTarget.id);
          } else if (!/^(https?:|mailto:|tel:|#)/i.test(target)) {
            markdownLink.setAttribute("target", "_blank");
          }
        }
      });
    },

    showDocument: function (document, options) {
      this.root.dataset.sourcePath = document.path || "";
      this.root.innerHTML = renderDocument(document, this.data, this.maps);
      this.afterRender(document.id, document.groupId, document.title, document, null, options);
    },

    showOption: function (option, options) {
      const result = renderOption(option, this.data, this.maps);
      this.root.dataset.sourcePath = result.parent ? result.parent.path : option.sourceFile;
      this.root.innerHTML = result.html;
      this.afterRender(result.parent ? result.parent.id : "", result.parent ? result.parent.groupId : "", option.name, result.parent, option, options);
    },

    showMissing: function () {
      this.root.innerHTML = '<div class="empty-state"><h1>Không tìm thấy nội dung</h1><p>Liên kết có thể đã thay đổi sau khi dữ liệu được xây dựng lại.</p><a class="button is-primary" href="' + KB.route.doc("home") + '">Về trang bắt đầu</a></div>';
      document.getElementById("page-toc").innerHTML = "";
    },

    afterRender: function (activeDocumentId, groupId, title, sourceDocument, option, options) {
      if (!(options && options.preserveScroll)) window.scrollTo(0, 0);
      KB.Sidebar.setActive(activeDocumentId, groupId);
      KB.Toc.render(this.root);
      KB.renderBreadcrumb(groupId, title, sourceDocument, option);
      document.title = title + " — Nội thất căn hộ mẫu";
    }
  };
})();
