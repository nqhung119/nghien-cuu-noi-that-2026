(function () {
  "use strict";

  const KB = (window.KB = window.KB || {});

  function inline(source) {
    let text = KB.escapeHtml(source || "");
    const code = [];
    text = text.replace(/\x60([^\x60]+)\x60/g, function (_, value) {
      const token = "@@CODE" + code.length + "@@";
      code.push("<code>" + value + "</code>");
      return token;
    });
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, '<img src="$2" alt="$1" loading="lazy">');
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, function (_, label, href) {
      return '<a href="' + KB.escapeAttribute(href) + '" data-md-link="' + KB.escapeAttribute(href) + '">' + label + "</a>";
    });
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    code.forEach(function (value, index) {
      text = text.replace("@@CODE" + index + "@@", value);
    });
    return text;
  }

  function splitTableRow(line) {
    let value = line.trim();
    if (value.charAt(0) === "|") value = value.slice(1);
    if (value.charAt(value.length - 1) === "|") value = value.slice(0, -1);
    return value.split("|").map(function (cell) { return cell.trim(); });
  }

  KB.renderMarkdown = function (markdown, options) {
    const settings = options || {};
    const lines = String(markdown || "").replace(/\r/g, "").split("\n");
    const output = [];
    const headingIds = {};
    let index = 0;
    let paragraph = [];
    let listType = "";
    let listItems = [];

    function flushParagraph() {
      if (!paragraph.length) return;
      output.push("<p>" + inline(paragraph.join(" ").trim()) + "</p>");
      paragraph = [];
    }

    function flushList() {
      if (!listType) return;
      output.push("<" + listType + ">" + listItems.map(function (item) {
        return "<li>" + inline(item) + "</li>";
      }).join("") + "</" + listType + ">");
      listType = "";
      listItems = [];
    }

    function uniqueHeadingId(title) {
      const root = KB.slugify(title);
      const count = headingIds[root] || 0;
      headingIds[root] = count + 1;
      return count ? root + "-" + (count + 1) : root;
    }

    while (index < lines.length) {
      const line = lines[index];

      if (/^\x60{3}/.test(line)) {
        flushParagraph();
        flushList();
        const language = line.replace(/^\x60{3}/, "").trim();
        const codeLines = [];
        index += 1;
        while (index < lines.length && !/^\x60{3}/.test(lines[index])) {
          codeLines.push(lines[index]);
          index += 1;
        }
        output.push('<pre><code class="language-' + KB.escapeAttribute(language) + '">' + KB.escapeHtml(codeLines.join("\n")) + "</code></pre>");
        index += 1;
        continue;
      }

      const heading = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
      if (heading) {
        flushParagraph();
        flushList();
        const level = heading[1].length;
        if (!(settings.skipH1 && level === 1)) {
          const id = uniqueHeadingId(heading[2].replace(/[*_\x60]/g, ""));
          output.push("<h" + level + ' id="' + id + '">' + inline(heading[2]) + "</h" + level + ">");
        }
        index += 1;
        continue;
      }

      const tableCandidate =
        /^\s*\|/.test(line) &&
        index + 1 < lines.length &&
        /^\s*\|?\s*:?-+/.test(lines[index + 1]);
      if (tableCandidate) {
        flushParagraph();
        flushList();
        const headers = splitTableRow(line);
        const rows = [];
        index += 2;
        while (index < lines.length && /^\s*\|/.test(lines[index])) {
          rows.push(splitTableRow(lines[index]));
          index += 1;
        }
        output.push(
          '<div class="table-wrap"><table><thead><tr>' +
          headers.map(function (cell) { return "<th>" + inline(cell) + "</th>"; }).join("") +
          "</tr></thead><tbody>" +
          rows.map(function (row) {
            return "<tr>" + headers.map(function (_, column) {
              return "<td>" + inline(row[column] || "") + "</td>";
            }).join("") + "</tr>";
          }).join("") +
          "</tbody></table></div>"
        );
        continue;
      }

      const unordered = /^\s*[-+*]\s+(.+)/.exec(line);
      const ordered = /^\s*\d+[.)]\s+(.+)/.exec(line);
      if (unordered || ordered) {
        flushParagraph();
        const wantedType = unordered ? "ul" : "ol";
        if (listType && listType !== wantedType) flushList();
        listType = wantedType;
        listItems.push((unordered || ordered)[1]);
        index += 1;
        continue;
      }

      if (/^>\s?/.test(line)) {
        flushParagraph();
        flushList();
        const quote = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) {
          quote.push(lines[index].replace(/^>\s?/, ""));
          index += 1;
        }
        output.push("<blockquote>" + inline(quote.join(" ")) + "</blockquote>");
        continue;
      }

      if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) {
        flushParagraph();
        flushList();
        output.push("<hr>");
        index += 1;
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
      } else {
        paragraph.push(line.trim());
      }
      index += 1;
    }

    flushParagraph();
    flushList();
    return output.join("\n");
  };
})();
