(function () {
  "use strict";

  const KB = (window.KB = window.KB || {});
  const encoder = new TextEncoder();

  function xmlEscape(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function columnName(index) {
    let value = index + 1;
    let name = "";
    while (value > 0) {
      value -= 1;
      name = String.fromCharCode(65 + (value % 26)) + name;
      value = Math.floor(value / 26);
    }
    return name;
  }

  function stringCell(reference, value, style) {
    return '<c r="' + reference + '" t="inlineStr"' + (style ? ' s="' + style + '"' : "") + '><is><t xml:space="preserve">' +
      xmlEscape(value) + "</t></is></c>";
  }

  function numberCell(reference, value, style) {
    if (value == null || !Number.isFinite(Number(value))) return stringCell(reference, "", style);
    return '<c r="' + reference + '"' + (style ? ' s="' + style + '"' : "") + "><v>" + Number(value) + "</v></c>";
  }

  function worksheetXml(report) {
    const headers = [
      "STT", "Không gian / nhóm", "Hạng mục", "Mã hạng mục", "Phương án", "Mã phương án", "Phân khúc",
      "Số lượng", "Cơ sở giá", "Mức giá từ", "Mức giá đến", "Giá cơ sở nếu tính %", "Chi phí từ (VND)",
      "Chi phí đến (VND)", "Ghi chú"
    ];
    const rows = [];

    function addRow(values, styles, numericColumns) {
      const rowNumber = rows.length + 1;
      const cells = values.map(function (value, index) {
        const reference = columnName(index) + rowNumber;
        const style = styles && styles[index] ? styles[index] : 0;
        return numericColumns && numericColumns.indexOf(index) >= 0
          ? numberCell(reference, value, style)
          : stringCell(reference, value, style);
      }).join("");
      rows.push('<row r="' + rowNumber + '">' + cells + "</row>");
    }

    addRow([report.title], [5]);
    addRow(["Thời điểm xuất", report.generatedLabel]);
    addRow(["Số hạng mục đã chọn", report.rows.length, "Có thể xuất khi danh sách chưa đầy đủ"], [1, 0, 0], [1]);
    addRow(headers, headers.map(function () { return 1; }));

    report.rows.forEach(function (row, index) {
      addRow([
        index + 1,
        row.groupTitle,
        row.itemTitle,
        row.itemId,
        row.optionName,
        row.optionId,
        row.segment,
        row.quantity,
        row.priceBasis,
        row.priceMin,
        row.priceMax,
        row.isPercentage && row.basePrice ? row.basePrice : null,
        row.isCalculated ? row.costMin : null,
        row.isCalculated ? row.costMax : null,
        row.note
      ], [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 0], [0, 7, 9, 10, 11, 12, 13]);
    });

    addRow([]);
    const totalStyles = [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 0];
    addRow([
      "TỔNG CHI PHÍ THAM KHẢO", "", "", "", "", "", "", "", "", "", "", "",
      report.totalMin, report.totalMax,
      report.unpricedCount ? report.unpricedCount + " hạng mục chưa được cộng do thiếu giá cơ sở" : "Đã tính toàn bộ hạng mục đã chọn"
    ], totalStyles, [12, 13]);
    addRow(["Lưu ý", "Chi phí chỉ mang tính tham khảo; cần xác nhận khối lượng, cấu hình, thuế, vận chuyển và lắp đặt bằng báo giá thực tế."]);

    const dataLastRow = 4 + report.rows.length;
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<cols>' +
        '<col min="1" max="1" width="7" customWidth="1"/><col min="2" max="2" width="22" customWidth="1"/>' +
        '<col min="3" max="4" width="19" customWidth="1"/><col min="5" max="5" width="38" customWidth="1"/>' +
        '<col min="6" max="7" width="18" customWidth="1"/><col min="8" max="8" width="12" customWidth="1"/>' +
        '<col min="9" max="9" width="19" customWidth="1"/><col min="10" max="14" width="19" customWidth="1"/>' +
        '<col min="15" max="15" width="45" customWidth="1"/>' +
      '</cols><sheetData>' + rows.join("") + "</sheetData>" +
      '<autoFilter ref="A4:O' + dataLastRow + '"/><mergeCells count="1"><mergeCell ref="A1:O1"/></mergeCells>' +
      '<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>' +
      "</worksheet>";
  }

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let index = 0; index < bytes.length; index += 1) {
      crc ^= bytes[index];
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function zipStore(files, mimeType) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach(function (file) {
      const name = encoder.encode(file.name);
      const data = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
      const checksum = crc32(data);
      const local = new Uint8Array(30);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034B50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint32(14, checksum, true);
      localView.setUint32(18, data.length, true);
      localView.setUint32(22, data.length, true);
      localView.setUint16(26, name.length, true);
      localParts.push(local, name, data);

      const central = new Uint8Array(46);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014B50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint32(16, checksum, true);
      centralView.setUint32(20, data.length, true);
      centralView.setUint32(24, data.length, true);
      centralView.setUint16(28, name.length, true);
      centralView.setUint32(42, offset, true);
      centralParts.push(central, name);
      offset += local.length + name.length + data.length;
    });

    const centralSize = centralParts.reduce(function (size, part) { return size + part.length; }, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054B50, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    return new Blob(localParts.concat(centralParts, [end]), { type: mimeType });
  }

  function createXlsxBlob(report) {
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0 &quot;₫&quot;"/></numFmts>' +
      '<fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="18"/><name val="Aptos Display"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAEAEA"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="2"><border/><border><left style="thin"><color rgb="FFBDBDBD"/></left><right style="thin"><color rgb="FFBDBDBD"/></right><top style="thin"><color rgb="FFBDBDBD"/></top><bottom style="thin"><color rgb="FFBDBDBD"/></bottom></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="6">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>' +
        '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
        '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>' +
        '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    const files = [
      { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>' },
      { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
      { name: "docProps/core.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xmlEscape(report.title) + '</dc:title><dc:creator>Nội thất căn hộ mẫu</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date(report.generatedAt).toISOString() + "</dcterms:created></cp:coreProperties>" },
      { name: "docProps/app.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Nội thất căn hộ mẫu</Application></Properties>' },
      { name: "xl/workbook.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Phương án đã chọn" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { name: "xl/_rels/workbook.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: "xl/styles.xml", data: styles },
      { name: "xl/worksheets/sheet1.xml", data: worksheetXml(report) }
    ];
    return zipStore(files, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  function wrapLines(context, text, maximumWidth) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach(function (word) {
      const candidate = line ? line + " " + word : word;
      if (line && context.measureText(candidate).width > maximumWidth) {
        lines.push(line);
        line = word;
      } else line = candidate;
    });
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  function drawLines(context, lines, x, y, lineHeight) {
    lines.forEach(function (line, index) { context.fillText(line, x, y + index * lineHeight); });
    return y + lines.length * lineHeight;
  }

  function jpegBytes(canvas) {
    const encoded = canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function buildPdfImages(report) {
    const width = 1050;
    const height = 1485;
    const margin = 72;
    const bottom = 86;
    const pages = [];
    let canvas;
    let context;
    let y;

    function newPage() {
      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#000000";
      context.textBaseline = "top";
      context.font = pages.length ? '700 25px "Segoe UI", Arial, sans-serif' : '800 39px "Segoe UI", Arial, sans-serif';
      context.fillText(pages.length ? "PHƯƠNG ÁN NỘI THẤT căn hộ mẫu" : report.title, margin, 58);
      context.font = '400 18px "Segoe UI", Arial, sans-serif';
      context.fillStyle = "#555555";
      context.fillText(report.generatedLabel + " · " + report.rows.length + " hạng mục đã chọn", margin, pages.length ? 96 : 116);
      context.strokeStyle = "#000000";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(margin, pages.length ? 132 : 156);
      context.lineTo(width - margin, pages.length ? 132 : 156);
      context.stroke();
      y = pages.length ? 164 : 190;
      pages.push({ canvas: canvas, context: context });
    }

    function ensureSpace(amount) {
      if (y + amount > height - bottom) newPage();
    }

    newPage();
    report.rows.forEach(function (row, index) {
      context.font = '700 27px "Segoe UI", Arial, sans-serif';
      const optionLines = wrapLines(context, row.optionName, width - margin * 2 - 40);
      context.font = '400 18px "Segoe UI", Arial, sans-serif';
      const noteLines = wrapLines(context, row.note, width - margin * 2 - 40).slice(0, 2);
      const cardHeight = 220 + Math.max(0, optionLines.length - 1) * 34 + Math.max(0, noteLines.length - 1) * 24;
      ensureSpace(cardHeight + 18);

      context.strokeStyle = "#c8c8c8";
      context.lineWidth = 1;
      context.strokeRect(margin, y, width - margin * 2, cardHeight);
      context.fillStyle = "#000000";
      context.font = '700 19px "Segoe UI", Arial, sans-serif';
      context.fillText(String(index + 1).padStart(2, "0") + "  " + row.itemTitle, margin + 20, y + 17);
      context.font = '400 16px "Segoe UI", Arial, sans-serif';
      context.fillStyle = "#555555";
      context.fillText(row.groupTitle + " · " + row.itemId, margin + 20, y + 46);
      context.font = '700 27px "Segoe UI", Arial, sans-serif';
      context.fillStyle = "#000000";
      let lineY = drawLines(context, optionLines, margin + 20, y + 74, 34);
      context.font = '400 18px "Segoe UI", Arial, sans-serif';
      context.fillStyle = "#444444";
      context.fillText("SL " + KB.formatNumber(row.quantity) + " · " + row.priceBasis + " · " + row.unitPriceLabel, margin + 20, lineY + 5);
      context.font = '700 22px "Segoe UI", Arial, sans-serif';
      context.fillStyle = "#000000";
      context.fillText("Chi phí tham khảo: " + row.costLabel, margin + 20, lineY + 36);
      context.font = '400 16px "Segoe UI", Arial, sans-serif';
      context.fillStyle = "#666666";
      drawLines(context, noteLines, margin + 20, lineY + 67, 23);
      y += cardHeight + 18;
    });

    ensureSpace(230);
    context.fillStyle = "#000000";
    context.fillRect(margin, y, width - margin * 2, 116);
    context.fillStyle = "#ffffff";
    context.font = '700 18px "Segoe UI", Arial, sans-serif';
    context.fillText("TỔNG CHI PHÍ THAM KHẢO", margin + 24, y + 20);
    context.font = '800 31px "Segoe UI", Arial, sans-serif';
    context.fillText(report.totalLabel, margin + 24, y + 50);
    y += 136;
    context.fillStyle = "#555555";
    context.font = '400 17px "Segoe UI", Arial, sans-serif';
    const disclaimer = report.unpricedCount
      ? report.unpricedCount + " hạng mục chưa cộng vào tổng do chưa có giá cơ sở. Chi phí chỉ mang tính tham khảo; hãy xác nhận bằng báo giá thực tế."
      : "Chi phí chỉ mang tính tham khảo; hãy xác nhận khối lượng, cấu hình, thuế, vận chuyển và lắp đặt bằng báo giá thực tế.";
    drawLines(context, wrapLines(context, disclaimer, width - margin * 2), margin, y, 25);

    pages.forEach(function (page, index) {
      const pageContext = page.context;
      pageContext.fillStyle = "#777777";
      pageContext.font = '400 15px "Segoe UI", Arial, sans-serif';
      pageContext.fillText("Nội thất căn hộ mẫu", margin, height - 45);
      const pageLabel = "Trang " + (index + 1) + "/" + pages.length;
      pageContext.fillText(pageLabel, width - margin - pageContext.measureText(pageLabel).width, height - 45);
    });
    return pages.map(function (page) { return { bytes: jpegBytes(page.canvas), width: width, height: height }; });
  }

  function createPdfBlob(report) {
    const images = buildPdfImages(report);
    const objectCount = 2 + images.length * 3;
    const objectBodies = {};
    objectBodies[1] = [encoder.encode("<< /Type /Catalog /Pages 2 0 R >>")];
    const pageIds = images.map(function (_, index) { return 3 + index * 3; });
    objectBodies[2] = [encoder.encode("<< /Type /Pages /Kids [" + pageIds.map(function (id) { return id + " 0 R"; }).join(" ") + "] /Count " + images.length + " >>")];

    images.forEach(function (image, index) {
      const pageId = 3 + index * 3;
      const imageId = pageId + 1;
      const contentId = pageId + 2;
      const content = encoder.encode("q 595 0 0 842 0 0 cm /Im0 Do Q");
      objectBodies[pageId] = [encoder.encode("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 " + imageId + " 0 R >> >> /Contents " + contentId + " 0 R >>")];
      objectBodies[imageId] = [
        encoder.encode("<< /Type /XObject /Subtype /Image /Width " + image.width + " /Height " + image.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + image.bytes.length + " >>\nstream\n"),
        image.bytes,
        encoder.encode("\nendstream")
      ];
      objectBodies[contentId] = [encoder.encode("<< /Length " + content.length + " >>\nstream\n"), content, encoder.encode("\nendstream")];
    });

    const parts = [encoder.encode("%PDF-1.4\n")];
    const offsets = [0];
    let length = parts[0].length;
    for (let id = 1; id <= objectCount; id += 1) {
      offsets[id] = length;
      const start = encoder.encode(id + " 0 obj\n");
      const end = encoder.encode("\nendobj\n");
      parts.push(start);
      length += start.length;
      objectBodies[id].forEach(function (body) { parts.push(body); length += body.length; });
      parts.push(end);
      length += end.length;
    }

    const xrefOffset = length;
    let xref = "xref\n0 " + (objectCount + 1) + "\n0000000000 65535 f \n";
    for (let id = 1; id <= objectCount; id += 1) xref += String(offsets[id]).padStart(10, "0") + " 00000 n \n";
    xref += "trailer\n<< /Size " + (objectCount + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF";
    parts.push(encoder.encode(xref));
    return new Blob(parts, { type: "application/pdf" });
  }

  function download(blob, filename) {
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 1000);
  }

  KB.Export = {
    createPdfBlob: createPdfBlob,
    createXlsxBlob: createXlsxBlob,
    downloadPdf: function (report) {
      download(createPdfBlob(report), "phuong-an-noi-that-can-ho-mau-" + report.fileDate + ".pdf");
    },
    downloadXlsx: function (report) {
      download(createXlsxBlob(report), "phuong-an-noi-that-can-ho-mau-" + report.fileDate + ".xlsx");
    }
  };
})();
