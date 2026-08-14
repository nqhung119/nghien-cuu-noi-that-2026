(function () {
  "use strict";

  const KB = (window.KB = window.KB || {});

  KB.escapeHtml = function (value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  KB.escapeAttribute = KB.escapeHtml;

  KB.normalizeText = function (value) {
    return String(value == null ? "" : value)
      .toLocaleLowerCase("vi")
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  };

  KB.slugify = function (value) {
    return KB.normalizeText(value).replace(/\s+/g, "-") || "muc";
  };

  KB.debounce = function (callback, delay) {
    let timer;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        callback.apply(null, args);
      }, delay);
    };
  };

  KB.formatNumber = function (number) {
    return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(number) || 0);
  };

  KB.formatVnd = function (number) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0
    }).format(Number(number) || 0);
  };

  KB.formatPrice = function (option, compact) {
    if (!option) return "Liên hệ";
    const min = Number(option.priceMin) || 0;
    const max = Number(option.priceMax) || 0;
    const basis = option.priceBasis || "VND";
    const suffix = basis.replace(/^VND\/?/i, "").trim();

    if (/PCT|%/i.test(basis)) {
      return (min === max ? KB.formatNumber(min) : KB.formatNumber(min) + "–" + KB.formatNumber(max)) + "%";
    }

    function value(number) {
      if (compact && number >= 1000000) {
        return KB.formatNumber(number / 1000000) + " triệu";
      }
      return KB.formatVnd(number);
    }

    let price;
    if (!min && !max) price = "Theo báo giá";
    else if (min === max || !max) price = value(min);
    else price = value(min) + "–" + value(max);

    return suffix ? price + "/" + suffix : price;
  };

  KB.getCell = function (option, patterns) {
    if (!option || !option.cells) return "";
    const entries = Object.keys(option.cells);
    const list = Array.isArray(patterns) ? patterns : [patterns];
    for (let index = 0; index < entries.length; index += 1) {
      const key = entries[index];
      if (list.some(function (pattern) { return pattern.test(key); })) {
        return option.cells[key] || "";
      }
    }
    return "";
  };

  KB.cleanMarkdownLabel = function (value) {
    return String(value || "").replace(/\*\*/g, "").replace(/<br\s*\/?>/gi, " · ").trim();
  };

  KB.route = {
    parse: function () {
      const raw = location.hash.replace(/^#\/?/, "");
      const parts = raw.split("/").filter(Boolean).map(decodeURIComponent);
      if (parts[0] === "selection") return { type: "selection", id: "selection" };
      if (parts[0] === "option" && parts[1]) return { type: "option", id: parts[1] };
      if (parts[0] === "doc" && parts[1]) return { type: "doc", id: parts[1] };
      return { type: "doc", id: "home" };
    },
    doc: function (id) {
      return "#/doc/" + encodeURIComponent(id);
    },
    option: function (id) {
      return "#/option/" + encodeURIComponent(id);
    },
    selection: function () {
      return "#/selection";
    }
  };

  KB.resolvePath = function (currentPath, targetPath) {
    if (!targetPath || /^(https?:|mailto:|tel:|#)/i.test(targetPath)) return targetPath;
    const cleanTarget = targetPath.split("#")[0].split("?")[0].replace(/\\/g, "/");
    const baseParts = String(currentPath || "").replace(/\\/g, "/").split("/");
    baseParts.pop();
    cleanTarget.split("/").forEach(function (part) {
      if (!part || part === ".") return;
      if (part === "..") baseParts.pop();
      else baseParts.push(part);
    });
    return decodeURIComponent(baseParts.join("/")).replace(/^\.\//, "").toLocaleLowerCase("vi");
  };

  KB.stripOptionTable = function (markdown) {
    const lines = String(markdown || "").split(/\r?\n/);
    const kept = [];
    let index = 0;
    while (index < lines.length) {
      const isHeader =
        /^\s*\|/.test(lines[index]) &&
        /\|\s*Mã\s*\|/i.test(lines[index]) &&
        index + 1 < lines.length &&
        /^\s*\|?\s*:?-+/.test(lines[index + 1]);
      if (!isHeader) {
        kept.push(lines[index]);
        index += 1;
        continue;
      }
      index += 2;
      while (index < lines.length && /^\s*\|/.test(lines[index])) index += 1;
    }
    return kept.join("\n").replace(/\n{3,}/g, "\n\n");
  };

  KB.stripGeneratedGuide = function (markdown) {
    return String(markdown || "")
      .replace(/\n?<!-- GUIDE:START -->[\s\S]*?<!-- GUIDE:END -->\n?/g, "\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  KB.snippet = function (text, query, maximum) {
    const source = String(text || "").replace(/\s+/g, " ").trim();
    const limit = maximum || 150;
    if (!source) return "";
    if (!query) return source.slice(0, limit) + (source.length > limit ? "…" : "");
    const normalized = KB.normalizeText(source);
    const needle = KB.normalizeText(query);
    const location = normalized.indexOf(needle);
    const start = location > 35 ? location - 35 : 0;
    const result = source.slice(start, start + limit);
    return (start ? "…" : "") + result + (start + limit < source.length ? "…" : "");
  };

  KB.textList = function (text) {
    const cleaned = KB.cleanMarkdownLabel(text);
    if (!cleaned) return [];
    return cleaned
      .split(/(?:;|\.\s+(?=[A-ZÀ-Ỹ]))/)
      .map(function (item) { return item.trim().replace(/^[-–]\s*/, ""); })
      .filter(Boolean);
  };

  KB.buildMaps = function (data) {
    const maps = {
      documents: {},
      options: {},
      groups: {},
      pathToDocument: {},
      groupDocuments: {},
      itemOptions: {}
    };
    data.groups.forEach(function (group) {
      maps.groups[group.id] = group;
      maps.groupDocuments[group.id] = [];
    });
    data.documents.forEach(function (document) {
      maps.documents[document.id] = document;
      maps.pathToDocument[String(document.path || "").toLocaleLowerCase("vi")] = document;
      if (!maps.groupDocuments[document.groupId]) maps.groupDocuments[document.groupId] = [];
      maps.groupDocuments[document.groupId].push(document);
    });
    data.options.forEach(function (option) {
      maps.options[option.id] = option;
      if (!maps.itemOptions[option.itemId]) maps.itemOptions[option.itemId] = [];
      maps.itemOptions[option.itemId].push(option);
    });
    return maps;
  };
})();
