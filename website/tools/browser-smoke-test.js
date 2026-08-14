const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function findBrowser() {
  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
      ]
    : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge"];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function waitForEndpoint(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:" + port + "/json");
      if (response.ok) return response.json();
    } catch (_) {
      // Browser is still starting.
    }
    await delay(100);
  }
  throw new Error("Khong ket noi duoc Chrome DevTools.");
}

async function main() {
  const browserPath = findBrowser();
  assert(browserPath, "Khong tim thay Chrome hoac Edge.");

  const port = await getFreePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "kb-can-ho-mau-"));
  const expectedData = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "data", "catalog.json"), "utf8"));
  const expectedSofa = expectedData.documents.find((document) => document.id === "liv-sofa");
  const expectedFloorOption = expectedData.options.find((option) => option.id === "COM-FLOOR-01");
  const expectedSofaOption = expectedData.options.find((option) => option.itemId === "LIV-SOFA");
  const expectedPercentageOption = expectedData.options.find((option) => option.id === "COM-HARDWARE-01");
  const expectedCsv = expectedData.documents.find((document) => document.kind === "csv");
  const indexPath = path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");
  const targetUrl = "file:///" + indexPath;
  const browser = spawn(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--allow-file-access-from-files",
    "--remote-debugging-port=" + port,
    "--user-data-dir=" + profile,
    "--window-size=1440,1000",
    targetUrl
  ], { stdio: "ignore", windowsHide: true });

  try {
    const targets = await waitForEndpoint(port);
    const page = targets.find((target) => target.type === "page");
    assert(page, "Khong tim thay browser page.");

    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });

    let callId = 0;
    const pending = new Map();
    const exceptions = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params);
      if (!message.id || !pending.has(message.id)) return;
      const handler = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message));
      else handler.resolve(message.result);
    });

    function call(method, params) {
      callId += 1;
      return new Promise((resolve, reject) => {
        pending.set(callId, { resolve, reject });
        socket.send(JSON.stringify({ id: callId, method, params: params || {} }));
      });
    }

    async function evaluate(expression) {
      const response = await call("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true
      });
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
      return response.result.value;
    }

    await call("Runtime.enable");
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (await evaluate("document.readyState === 'complete' && !!window.KB && !!window.KB.data")) break;
      await delay(100);
    }

    const home = JSON.parse(await evaluate("JSON.stringify({title:document.querySelector('.document-title')?.textContent,docs:window.KB.data?.documents?.length,options:window.KB.data?.options?.length})"));
    assert(
      home.title &&
      home.docs === expectedData.documents.length &&
      home.options === expectedData.options.length,
      "Trang bat dau hoac catalog khong dung."
    );

    await evaluate("document.getElementById('search-trigger').click();document.getElementById('search-input').value='sofa';document.getElementById('search-input').dispatchEvent(new Event('input',{bubbles:true}));true");
    await delay(250);
    const search = JSON.parse(await evaluate("JSON.stringify({open:document.getElementById('search-dialog').open,count:document.querySelectorAll('.search-result').length})"));
    assert(search.open && search.count > 0, "Tim kiem khong tra ket qua.");
    await evaluate("document.getElementById('search-close').click();true");

    await evaluate("location.hash='#/doc/liv-sofa';true");
    await delay(150);
    const category = JSON.parse(await evaluate("JSON.stringify({title:document.querySelector('.document-title')?.textContent,comparison:!!document.querySelector('.comparison-table'),cards:document.querySelectorAll('.option-card').length,guide:!!document.querySelector('#hieu-nhanh-hang-muc')&&!!document.querySelector('#huong-dan-ra-quyet-dinh'),image:document.querySelector('.knowledge-figure img')?.complete&&document.querySelector('.knowledge-figure img')?.naturalWidth>0})"));
    assert(
      category.title === "Sofa" &&
      category.comparison &&
      category.guide &&
      category.image &&
      expectedSofa &&
      category.cards === expectedSofa.optionIds.length,
      "Trang so sanh Sofa khong dung."
    );

    await evaluate("location.hash='#/option/COM-FLOOR-01';true");
    await delay(150);
    const option = JSON.parse(await evaluate("JSON.stringify({title:document.querySelector('.document-title')?.textContent,scrollY,definitions:document.querySelectorAll('.definition-list').length,explainer:!!document.querySelector('#ban-chat-phuong-an')&&!!document.querySelector('#uu-nhuoc-va-do-ben')&&!!document.querySelector('#danh-gia-tong-hop'),image:document.querySelector('.knowledge-figure img')?.complete&&document.querySelector('.knowledge-figure img')?.naturalWidth>0})"));
    assert(option.title && option.scrollY === 0 && option.definitions >= 3 && option.explainer && option.image, "Trang chi tiet phuong an khong dung.");

    await evaluate("document.querySelector('[data-select-option]').click();true");
    await delay(100);
    const firstSelection = JSON.parse(await evaluate("JSON.stringify({count:document.getElementById('selection-count')?.textContent,pressed:document.querySelector('[data-select-option]')?.getAttribute('aria-pressed'),stored:Object.keys(JSON.parse(localStorage.getItem('kb-selected-options-v1')||'{}').items||{}).length})"));
    assert(firstSelection.count === "1" && firstSelection.pressed === "true" && firstSelection.stored === 1, "Khong luu duoc phuong an dau tien.");

    await evaluate("location.hash='#/doc/liv-sofa';true");
    await delay(150);
    await evaluate("document.querySelector('.option-card [data-select-option]').click();true");
    await delay(100);
    await evaluate("location.hash='#/selection';true");
    await delay(150);
    const selectionPage = JSON.parse(await evaluate("JSON.stringify({title:document.querySelector('.document-title')?.textContent,rows:document.querySelectorAll('.selection-table tbody tr').length,count:document.getElementById('selection-count')?.textContent,total:document.querySelector('.selection-total-card strong')?.textContent,pdfDisabled:document.querySelector('[data-export-pdf]')?.disabled,xlsxDisabled:document.querySelector('[data-export-xlsx]')?.disabled})"));
    assert(
      selectionPage.title === "Phương án đã chọn" &&
      selectionPage.rows === 2 &&
      selectionPage.rows < expectedData.documents.filter((document) => document.kind === "category").length &&
      selectionPage.count === "2" &&
      selectionPage.total &&
      !selectionPage.pdfDisabled &&
      !selectionPage.xlsxDisabled,
      "Trang tong hop lua chon khong ho tro xuat mot phan."
    );

    await evaluate("const input=document.querySelector('[data-selection-quantity=\"COM-FLOOR\"]');input.value='2';input.dispatchEvent(new Event('change',{bubbles:true}));true");
    await delay(100);
    const exports = JSON.parse(await evaluate("(()=>{const report=window.KB.Selection.getReport();const pdf=window.KB.Export.createPdfBlob(report);const xlsx=window.KB.Export.createXlsxBlob(report);return Promise.all([pdf.arrayBuffer(),xlsx.arrayBuffer()]).then(([pdfBuffer,xlsxBuffer])=>{const pdfBytes=new Uint8Array(pdfBuffer);const xlsxBytes=new Uint8Array(xlsxBuffer);return JSON.stringify({rows:report.rows.length,quantity:report.rows.find((row)=>row.itemId==='COM-FLOOR').quantity,totalMin:report.totalMin,totalMax:report.totalMax,pdfType:pdf.type,pdfSize:pdf.size,pdfHeader:new TextDecoder().decode(pdfBytes.slice(0,5)),pdfFooter:new TextDecoder().decode(pdfBytes.slice(-5)),xlsxType:xlsx.type,xlsxSize:xlsx.size,xlsxHeader:Array.from(xlsxBytes.slice(0,2)).join(','),xlsxEndRecord:Array.from(xlsxBytes.slice(-22,-18)).join(','),xlsxHasTotal:new TextDecoder().decode(xlsxBytes).includes('TỔNG CHI PHÍ THAM KHẢO')})})})()"));
    assert(
      expectedFloorOption && expectedSofaOption && exports.rows === 2 && exports.quantity === 2 &&
      exports.totalMin === expectedFloorOption.priceMin * 2 + expectedSofaOption.priceMin &&
      exports.totalMax === expectedFloorOption.priceMax * 2 + expectedSofaOption.priceMax &&
      exports.pdfType === "application/pdf" && exports.pdfSize > 1000 && exports.pdfHeader === "%PDF-" && exports.pdfFooter === "%%EOF" &&
      /spreadsheetml/.test(exports.xlsxType) && exports.xlsxSize > 1000 && exports.xlsxHeader === "80,75" && exports.xlsxEndRecord === "80,75,5,6" && exports.xlsxHasTotal,
      "Tep PDF/XLSX khong duoc tao dung dinh dang hoac thieu tong chi phi: " + JSON.stringify(exports)
    );

    await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: profile, eventsEnabled: true });
    const downloadNames = JSON.parse(await evaluate("(()=>{const date=window.KB.Selection.getReport().fileDate;return JSON.stringify({pdf:'phuong-an-noi-that-can-ho-mau-'+date+'.pdf',xlsx:'phuong-an-noi-that-can-ho-mau-'+date+'.xlsx'})})()"));
    await evaluate("document.querySelector('[data-export-xlsx]').click();true");
    const xlsxDownload = path.join(profile, downloadNames.xlsx);
    for (let attempt = 0; attempt < 40 && !fs.existsSync(xlsxDownload); attempt += 1) await delay(50);
    await evaluate("document.querySelector('[data-export-pdf]').click();true");
    const pdfDownload = path.join(profile, downloadNames.pdf);
    for (let attempt = 0; attempt < 40 && !fs.existsSync(pdfDownload); attempt += 1) await delay(50);
    assert(
      fs.existsSync(xlsxDownload) && fs.readFileSync(xlsxDownload).subarray(0, 2).toString("ascii") === "PK" &&
      fs.existsSync(pdfDownload) && fs.readFileSync(pdfDownload).subarray(0, 5).toString("ascii") === "%PDF-",
      "Nut xuat khong tai duoc tep PDF/XLSX."
    );

    const percentageCost = JSON.parse(await evaluate("(()=>{window.KB.Selection.toggle('COM-HARDWARE-01');const before=window.KB.Selection.getReport();window.KB.Selection.items['COM-HARDWARE'].basePrice=100000000;window.KB.Selection.save();const after=window.KB.Selection.getReport();const row=after.rows.find((item)=>item.itemId==='COM-HARDWARE');window.KB.Selection.toggle('COM-HARDWARE-01');return JSON.stringify({unpricedBefore:before.unpricedCount,unpricedAfter:after.unpricedCount,costMin:row.costMin,costMax:row.costMax})})()"));
    assert(
      expectedPercentageOption && percentageCost.unpricedBefore === 1 && percentageCost.unpricedAfter === 0 &&
      percentageCost.costMin === expectedPercentageOption.priceMin * 1000000 &&
      percentageCost.costMax === expectedPercentageOption.priceMax * 1000000,
      "Chi phi theo phan tram khong yeu cau hoac khong dung gia co so."
    );

    assert(expectedCsv, "Catalog khong co tai lieu CSV de kiem thu.");
    const expectedCsvRoute = "#/doc/" + encodeURIComponent(expectedCsv.id);
    await evaluate("location.hash=" + JSON.stringify(expectedCsvRoute) + ";true");
    await delay(150);
    const csv = JSON.parse(await evaluate("JSON.stringify({table:!!document.querySelector('.table-wrap table'),actionHref:document.querySelector('.document-actions a')?.getAttribute('href'),actionTarget:document.querySelector('.document-actions a')?.getAttribute('target')})"));
    assert(
      csv.table && csv.actionHref === expectedCsvRoute && csv.actionTarget === "_blank" && !/\.csv(?:$|[?#])/i.test(csv.actionHref),
      "Lien ket mo CSV khong tro den noi dung da render."
    );

    await evaluate("location.hash='#/selection';true");
    await delay(100);

    await call("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    await delay(100);
    const mobileSelection = JSON.parse(await evaluate("JSON.stringify({horizontal:document.querySelector('.selection-table-wrap')?.scrollWidth>document.querySelector('.selection-table-wrap')?.clientWidth,exportButtons:document.querySelectorAll('.selection-export-actions .button').length,selectionTrigger:getComputedStyle(document.getElementById('selection-trigger')).display})"));
    assert(mobileSelection.horizontal && mobileSelection.exportButtons === 2 && mobileSelection.selectionTrigger !== "none", "Trang lua chon mobile khong dung.");
    const mobile = JSON.parse(await evaluate("document.getElementById('mobile-menu-button').click();JSON.stringify({open:document.body.classList.contains('is-sidebar-open'),button:getComputedStyle(document.getElementById('mobile-menu-button')).display,sidebar:getComputedStyle(document.getElementById('sidebar')).position})"));
    assert(mobile.open && mobile.button !== "none" && mobile.sidebar === "fixed", "Drawer mobile khong hoat dong.");

    assert(exceptions.length === 0, "Co JavaScript exception trong trinh duyet.");
    socket.close();
    console.log(JSON.stringify({
      home: true,
      searchResults: search.count,
      categoryComparison: true,
      optionDetail: true,
      partialSelection: selectionPage.rows,
      pdfExportBytes: exports.pdfSize,
      xlsxExportBytes: exports.xlsxSize,
      renderedCsvSource: true,
      mobileSelection: true,
      mobileDrawer: true,
      runtimeExceptions: exceptions.length
    }, null, 2));
  } finally {
    if (!browser.killed) browser.kill();
    await delay(150);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
