// PDF, Word (.docx) und die Prüfansicht für Ausbilder/innen

const PDF_LIBS = [
  {
    src: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    integrity: "sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk",
  },
  {
    src: "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
    integrity: "sha384-fCAW/rDWORTbQXSiB7mOg0QtQ5c+r0f544y6XoKjuVva0nMBlCpNUjiFeG5iMdS3",
  },
];

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const AZUBIX_CREDIT = {
  author: "s4bt",
  repo: "https://github.com/SneakyTreee/Azubix",
  site: "https://s4bt.de",
};

let pdfLibPromise = null;

// ---------- Gemeinsame Bausteine ----------

function docHours(value) {
  return (Number(value) || 0).toLocaleString("de-DE");
}

function docUnterweisungHours(week) {
  return week.unterweisung && String(week.unterweisung).trim()
    ? Number(week.unterweisungHours) || 0
    : 0;
}

// Unterweisungsstunden zählen wie im IHK-Formular als eigener Posten mit
function docWeekTotal(week) {
  return weekHours(week) + docUnterweisungHours(week);
}

function docWeekRange(week) {
  return `KW ${week.kw}/${week.year} · ${formatDate(week.monday)} bis ${formatDate(week.friday)}`;
}

function docBetrieb(profile) {
  return `${profile.betrieb || ""}${profile.abteilung ? ` / ${profile.abteilung}` : ""}`;
}

function docKindLabel(day) {
  return (DAY_KINDS[day.kind] || DAY_KINDS.betrieb).label;
}

function docTrainerLabel(profile) {
  return `Datum, Unterschrift Ausbilder/in${profile.ausbilder ? ` (${profile.ausbilder})` : ""}`;
}

// Nur PNG und JPEG als Data-URL, alles andere wird ignoriert
function docLogo() {
  const logo = state.profile.logo;
  const match =
    typeof logo === "string"
      ? logo.match(/^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\s]+)$/)
      : null;
  if (!match) {
    return null;
  }
  const type = match[1] === "png" ? "png" : "jpeg";
  return { dataUrl: logo, type, base64: match[2].replace(/\s/g, "") };
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Pixelmaße aus dem PNG- bzw. JPEG-Header lesen
function imageSize(bytes, type) {
  if (type === "png") {
    if (bytes.length < 24) {
      return null;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    offset += 2 + length;
  }
  return null;
}

function fitBox(width, height, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}

// ---------- PDF ----------

function loadScriptOnce(lib) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = lib.src;
    script.integrity = lib.integrity;
    script.crossOrigin = "anonymous";
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error(`${lib.src} nicht erreichbar`));
    };
    document.head.append(script);
  });
}

function loadPdfLibrary() {
  if (!pdfLibPromise) {
    pdfLibPromise = loadScriptOnce(PDF_LIBS[0])
      .then(() => loadScriptOnce(PDF_LIBS[1]))
      .then(() => {
        const jsPDF = window.jspdf && window.jspdf.jsPDF;
        if (!jsPDF || typeof jsPDF.API.autoTable !== "function") {
          throw new Error("jsPDF unvollständig");
        }
        return jsPDF;
      })
      .catch((error) => {
        // Beim nächsten Klick neu versuchen, z. B. wenn wieder Internet da ist
        pdfLibPromise = null;
        throw error;
      });
  }
  return pdfLibPromise;
}

// Zeichen außerhalb von WinAnsi kann Helvetica in jsPDF nicht darstellen
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const PDF_REPLACEMENTS = {
  "\u2010": "-",
  "\u2011": "-",
  "\u2012": "-",
  "\u2212": "-",
  "\u2192": "->",
  "\u2190": "<-",
  "\u21d2": "=>",
  "\u2264": "<=",
  "\u2265": ">=",
  "\u2260": "!=",
  "\u2248": "~",
  "\u2713": "x",
  "\u2714": "x",
  "\u201f": "\u201c",
  "\u2033": '"',
  "\u2032": "'",
};

function pdfText(text) {
  return (
    String(text ?? "")
      .normalize("NFC")
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, " ")
      .replace(/[\u00a0\u2000-\u200a\u202f\u205f]/g, " ")
      // eslint-disable-next-line no-misleading-character-class -- entfernt bewusst Zeichen ohne Breite und Emoji-Hautfarben
      .replace(/[\u200b-\u200d\u2060\u20e3\ufe0e\ufe0f\ufeff\u{1f3fb}-\u{1f3ff}]/gu, "")
      .replace(/[^\n\x20-\x7e\xa0-\xff]/gu, (char) => {
        if (WIN_ANSI_EXTRA.includes(char)) {
          return char;
        }
        if (/\p{Extended_Pictographic}/u.test(char)) {
          return "";
        }
        return PDF_REPLACEMENTS[char] ?? "?";
      })
  );
}

const PDF_MARGIN = 18;
const PDF_TABLE_STYLE = {
  theme: "grid",
  margin: { left: PDF_MARGIN, right: PDF_MARGIN, top: PDF_MARGIN, bottom: PDF_MARGIN },
  styles: {
    font: "helvetica",
    fontSize: 9,
    textColor: [24, 24, 24],
    lineColor: [140, 140, 140],
    lineWidth: 0.2,
    cellPadding: 2.2,
    valign: "top",
    overflow: "linebreak",
  },
  headStyles: { fillColor: [232, 232, 232], textColor: [24, 24, 24], fontStyle: "bold" },
  footStyles: { fillColor: [232, 232, 232], textColor: [24, 24, 24], fontStyle: "bold" },
};

function pdfLogo(doc) {
  const logo = docLogo();
  if (!logo) {
    return null;
  }
  try {
    const props = doc.getImageProperties(logo.dataUrl);
    const box = fitBox(props.width, props.height, 35, 15);
    return { ...logo, format: logo.type === "png" ? "PNG" : "JPEG", ...box };
  } catch {
    return null;
  }
}

function drawPdfWeek(doc, week, logo) {
  const { profile } = state;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  if (logo) {
    doc.addImage(
      logo.dataUrl,
      logo.format,
      pageWidth - PDF_MARGIN - logo.width,
      13,
      logo.width,
      logo.height,
      "azubix-logo",
    );
  }
  doc.setTextColor(24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(pdfText(`Ausbildungsnachweis Nr. ${week.nr}`), PDF_MARGIN, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(pdfText(docWeekRange(week)), PDF_MARGIN, 28.5);

  const label = { fontStyle: "bold", fillColor: [242, 242, 242] };
  doc.autoTable({
    ...PDF_TABLE_STYLE,
    startY: 34,
    body: [
      ["Name", profile.name || "", "Ausbildungsjahr", profile.jahr ? `${profile.jahr}.` : ""],
      ["Beruf", profile.beruf || "", "Betrieb", docBetrieb(profile)],
    ].map((row) => row.map(pdfText)),
    columnStyles: { 0: { ...label, cellWidth: 22 }, 2: { ...label, cellWidth: 30 } },
  });

  const body = week.days.map((day) => {
    const off = !["betrieb", "schule"].includes(day.kind);
    const textColor = off ? [100, 100, 100] : [24, 24, 24];
    return [
      {
        content: pdfText(`${day.name}\n${formatDate(day.date)}\n${docKindLabel(day)}`),
        styles: { textColor },
      },
      { content: pdfText(plainText(day.content) || "–"), styles: { textColor } },
      { content: docHours(day.hours), styles: { textColor } },
    ];
  });
  if (week.unterweisung && String(week.unterweisung).trim()) {
    body.push([
      { content: "Unterweisungen, betrieblicher Unterricht", styles: { fontStyle: "bold" } },
      pdfText(plainText(week.unterweisung)),
      docHours(docUnterweisungHours(week)),
    ]);
  }
  if (week.summary && String(week.summary).trim()) {
    body.push([
      { content: "Zusammenfassung", styles: { fontStyle: "bold" } },
      { content: pdfText(plainText(week.summary)), colSpan: 2 },
    ]);
  }

  doc.autoTable({
    ...PDF_TABLE_STYLE,
    startY: doc.lastAutoTable.finalY + 5,
    head: [[pdfText("Tag"), pdfText("Tätigkeiten und Unterrichtsthemen"), "Std."]],
    body,
    foot: [[{ content: "Gesamtstunden", colSpan: 2 }, docHours(docWeekTotal(week))]],
    showHead: "everyPage",
    showFoot: "lastPage",
    columnStyles: { 0: { cellWidth: 36 }, 2: { cellWidth: 14, halign: "right" } },
    didParseCell: (data) => {
      if (data.column.index === 2 && data.section !== "body") {
        data.cell.styles.halign = "right";
      }
    },
  });

  // Unterschriften brauchen etwa 30 mm, sonst auf eine neue Seite
  let lineY = doc.lastAutoTable.finalY + 24;
  if (lineY + 12 > pageHeight - PDF_MARGIN) {
    doc.addPage();
    lineY = PDF_MARGIN + 24;
  }
  const lineWidth = 78;
  const rightX = pageWidth - PDF_MARGIN - lineWidth;
  doc.setDrawColor(60);
  doc.setLineWidth(0.3);
  doc.line(PDF_MARGIN, lineY, PDF_MARGIN + lineWidth, lineY);
  doc.line(rightX, lineY, rightX + lineWidth, lineY);
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text(
    doc.splitTextToSize("Datum, Unterschrift Auszubildende/r", lineWidth),
    PDF_MARGIN,
    lineY + 4.5,
  );
  doc.text(doc.splitTextToSize(pdfText(docTrainerLabel(profile)), lineWidth), rightX, lineY + 4.5);
}

async function exportPDF() {
  if (!ensureWeeks()) {
    return;
  }
  let jsPDF;
  try {
    jsPDF = await loadPdfLibrary();
  } catch {
    showToast(
      "warn",
      "Die PDF-Bibliothek ließ sich nicht laden. Bist du offline? Im Druckdialog kannst du „Als PDF speichern“ wählen.",
    );
    printReports();
    return;
  }
  try {
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    doc.setProperties({
      title: pdfText(`Ausbildungsnachweise ${state.profile.name || ""}`.trim()),
      creator: "Azubix (https://github.com/SneakyTreee/Azubix)",
    });
    const logo = pdfLogo(doc);
    state.weeks.forEach((week, index) => {
      if (index > 0) {
        doc.addPage();
      }
      drawPdfWeek(doc, week, logo);
    });
    downloadFile(doc.output("blob"), `${fileBaseName()}.pdf`, "application/pdf");
    showToast(
      "success",
      `PDF mit ${state.weeks.length} ${state.weeks.length === 1 ? "Nachweis" : "Nachweisen"} gespeichert`,
    );
  } catch (error) {
    showToast(
      "error",
      `Das PDF ließ sich nicht erstellen (${error.message}). Versuch es mit „Drucken“ und „Als PDF speichern“.`,
    );
  }
}

// ---------- ZIP (nur STORE, reicht für .docx) ----------

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // Dateinamen in UTF-8
    local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), name, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, dosTime, true);
    entry.setUint16(14, dosDate, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const result = new Uint8Array(all.reduce((sum, chunk) => sum + chunk.length, 0));
  let position = 0;
  for (const chunk of all) {
    result.set(chunk, position);
    position += chunk.length;
  }
  return result;
}

// ---------- Word (.docx) ----------

const DOCX_PAGE_WIDTH = 9638; // A4 minus 2 x 2 cm Rand, in Twips
const DOCX_BORDER = '<w:top w:val="single" w:sz="4" w:space="0" w:color="8C8C8C"/>';

function xmlEscape(text) {
  return (
    String(text ?? "")
      // eslint-disable-next-line no-control-regex -- Whitelist der in XML erlaubten Zeichen
      .replace(/[^\x09\x0a\x0d\x20-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  );
}

function docxRuns(text, { bold = false, size = 0, color = "" } = {}) {
  const props = `${bold ? "<w:b/><w:bCs/>" : ""}${color ? `<w:color w:val="${color}"/>` : ""}${size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : ""}`;
  const rPr = props ? `<w:rPr>${props}</w:rPr>` : "";
  const lines = String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const content = lines
    .map((line) => `<w:t xml:space="preserve">${xmlEscape(line)}</w:t>`)
    .join("<w:br/>");
  return `<w:r>${rPr}${content}</w:r>`;
}

function docxPara(
  runs = "",
  { align = "", before = 0, after = 0, pageBreak = false, keepNext = false } = {},
) {
  const pPr = `${keepNext ? "<w:keepNext/>" : ""}${pageBreak ? "<w:pageBreakBefore/>" : ""}<w:spacing w:before="${before}" w:after="${after}"/>${align ? `<w:jc w:val="${align}"/>` : ""}`;
  return `<w:p><w:pPr>${pPr}</w:pPr>${runs}</w:p>`;
}

function docxCell(paragraphs, width, { span = 1, fill = "", borders = "", align = "" } = {}) {
  const tcPr = `<w:tcW w:w="${width}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}${borders ? `<w:tcBorders>${borders}</w:tcBorders>` : ""}${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ""}`;
  const body = paragraphs.startsWith("<w:p>") ? paragraphs : docxPara(paragraphs, { align });
  return `<w:tc><w:tcPr>${tcPr}</w:tcPr>${body}</w:tc>`;
}

function docxRow(cells, { header = false } = {}) {
  const trPr = header ? "<w:trPr><w:tblHeader/></w:trPr>" : "<w:trPr><w:cantSplit/></w:trPr>";
  return `<w:tr>${trPr}${cells.join("")}</w:tr>`;
}

function docxTable(widths, rows, { bordered = true } = {}) {
  const value = bordered ? 'w:val="single" w:sz="4" w:space="0" w:color="8C8C8C"' : 'w:val="nil"';
  const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((side) => `<w:${side} ${value}/>`)
    .join("");
  const margin = bordered ? 70 : 0;
  const tblPr = `<w:tblPr><w:tblW w:w="${DOCX_PAGE_WIDTH}" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="${margin}" w:type="dxa"/><w:left w:w="${bordered ? 100 : 0}" w:type="dxa"/><w:bottom w:w="${margin}" w:type="dxa"/><w:right w:w="${bordered ? 100 : 0}" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
  const grid = `<w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>`;
  return `<w:tbl>${tblPr}${grid}${rows.join("")}</w:tbl>`;
}

function docxImage(logo, id) {
  const cx = Math.round(logo.widthMm * 36000);
  const cy = Math.round(logo.heightMm * 36000);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Logo ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${logo.fileName}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function docxLogo() {
  const logo = docLogo();
  if (!logo) {
    return null;
  }
  try {
    const bytes = base64ToBytes(logo.base64);
    const size = imageSize(bytes, logo.type);
    if (!size || !size.width || !size.height) {
      return null;
    }
    const box = fitBox(size.width, size.height, 35, 15);
    const extension = logo.type === "png" ? "png" : "jpeg";
    return {
      bytes,
      extension,
      fileName: `logo.${extension}`,
      widthMm: box.width,
      heightMm: box.height,
    };
  } catch {
    return null;
  }
}

function docxWeek(week, index, logo) {
  const { profile } = state;
  const parts = [];
  if (index > 0) {
    parts.push(docxPara(docxRuns("", { size: 2 }), { pageBreak: true }));
  }

  const title = docxPara(docxRuns(`Ausbildungsnachweis Nr. ${week.nr}`, { bold: true, size: 32 }), {
    after: 60,
  });
  const range = docxPara(docxRuns(docWeekRange(week), { size: 20, color: "5A5A5A" }));
  if (logo) {
    const logoWidth = 2200;
    parts.push(
      docxTable(
        [DOCX_PAGE_WIDTH - logoWidth, logoWidth],
        [
          docxRow([
            docxCell(title + range, DOCX_PAGE_WIDTH - logoWidth),
            docxCell(docxPara(docxImage(logo, index + 1), { align: "right" }), logoWidth),
          ]),
        ],
        { bordered: false },
      ),
    );
  } else {
    parts.push(title, range);
  }
  parts.push(docxPara("", { after: 160 }));

  const labelWidth = 1300;
  const labelWidthRight = 1800;
  const valueWidth = (DOCX_PAGE_WIDTH - labelWidth - labelWidthRight) / 2;
  const label = (text, width) =>
    docxCell(docxRuns(text, { bold: true }), width, { fill: "F2F2F2" });
  const value = (text) => docxCell(docxRuns(text), valueWidth);
  parts.push(
    docxTable(
      [labelWidth, valueWidth, labelWidthRight, valueWidth],
      [
        docxRow([
          label("Name", labelWidth),
          value(profile.name || ""),
          label("Ausbildungsjahr", labelWidthRight),
          value(profile.jahr ? `${profile.jahr}.` : ""),
        ]),
        docxRow([
          label("Beruf", labelWidth),
          value(profile.beruf || ""),
          label("Betrieb", labelWidthRight),
          value(docBetrieb(profile)),
        ]),
      ],
    ),
  );
  parts.push(docxPara("", { after: 160 }));

  const dayWidth = 2200;
  const hoursWidth = 800;
  const textWidth = DOCX_PAGE_WIDTH - dayWidth - hoursWidth;
  const rows = [
    docxRow(
      [
        docxCell(docxRuns("Tag", { bold: true }), dayWidth, { fill: "E8E8E8" }),
        docxCell(docxRuns("Tätigkeiten und Unterrichtsthemen", { bold: true }), textWidth, {
          fill: "E8E8E8",
        }),
        docxCell(docxRuns("Std.", { bold: true }), hoursWidth, { fill: "E8E8E8", align: "right" }),
      ],
      { header: true },
    ),
  ];
  for (const day of week.days) {
    const off = !["betrieb", "schule"].includes(day.kind);
    const color = off ? "646464" : "";
    rows.push(
      docxRow([
        docxCell(
          docxRuns(day.name, { bold: true, color }) +
            docxRuns(`\n${formatDate(day.date)}\n${docKindLabel(day)}`, { color }),
          dayWidth,
        ),
        docxCell(docxRuns(plainText(day.content) || "–", { color }), textWidth),
        docxCell(docxRuns(docHours(day.hours), { color }), hoursWidth, { align: "right" }),
      ]),
    );
  }
  if (week.unterweisung && String(week.unterweisung).trim()) {
    rows.push(
      docxRow([
        docxCell(docxRuns("Unterweisungen, betrieblicher Unterricht", { bold: true }), dayWidth),
        docxCell(docxRuns(plainText(week.unterweisung)), textWidth),
        docxCell(docxRuns(docHours(docUnterweisungHours(week))), hoursWidth, { align: "right" }),
      ]),
    );
  }
  if (week.summary && String(week.summary).trim()) {
    rows.push(
      docxRow([
        docxCell(docxRuns("Zusammenfassung", { bold: true }), dayWidth),
        docxCell(docxRuns(plainText(week.summary)), textWidth + hoursWidth, { span: 2 }),
      ]),
    );
  }
  rows.push(
    docxRow([
      docxCell(docxRuns("Gesamtstunden", { bold: true }), dayWidth + textWidth, {
        span: 2,
        fill: "E8E8E8",
      }),
      docxCell(docxRuns(docHours(docWeekTotal(week)), { bold: true }), hoursWidth, {
        fill: "E8E8E8",
        align: "right",
      }),
    ]),
  );
  parts.push(docxTable([dayWidth, textWidth, hoursWidth], rows));

  // Unterschriftenzeilen als randlose Tabelle mit Linie oben
  parts.push(docxPara("", { before: 900, keepNext: true }));
  const signWidth = 4300;
  const gap = DOCX_PAGE_WIDTH - 2 * signWidth;
  const sign = (text) =>
    docxCell(docxRuns(text, { size: 16, color: "5A5A5A" }), signWidth, { borders: DOCX_BORDER });
  parts.push(
    docxTable(
      [signWidth, gap, signWidth],
      [
        docxRow([
          sign("Datum, Unterschrift Auszubildende/r"),
          docxCell("", gap),
          sign(docTrainerLabel(profile)),
        ]),
      ],
      { bordered: false },
    ),
  );
  return parts.join("");
}

function buildDocx() {
  const logo = docxLogo();
  const body = state.weeks.map((week, index) => docxWeek(week, index, logo)).join("");
  const sectPr =
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>';
  const xmlHead = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  const documentXml = `${xmlHead}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}${docxPara()}${sectPr}</w:body></w:document>`;

  const stylesXml = `${xmlHead}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:color w:val="181818"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="de-DE" w:eastAsia="de-DE" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;

  const contentTypes = `${xmlHead}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;

  const rootRels = `${xmlHead}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

  const documentRels = `${xmlHead}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${logo ? `<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${logo.fileName}"/>` : ""}</Relationships>`;

  const created = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const coreXml = `${xmlHead}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(`Ausbildungsnachweise ${state.profile.name || ""}`.trim())}</dc:title><dc:creator>${xmlEscape(state.profile.name || "Azubix")}</dc:creator><cp:keywords>Azubix</cp:keywords><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`;

  const files = [
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rootRels },
    { name: "docProps/core.xml", data: coreXml },
    { name: "word/document.xml", data: documentXml },
    { name: "word/styles.xml", data: stylesXml },
    { name: "word/_rels/document.xml.rels", data: documentRels },
  ];
  if (logo) {
    files.push({ name: `word/media/${logo.fileName}`, data: logo.bytes });
  }
  return zipStore(files);
}

function exportDOCX() {
  if (!ensureWeeks()) {
    return;
  }
  try {
    downloadFile(buildDocx(), `${fileBaseName()}.docx`, DOCX_MIME);
    showToast(
      "success",
      "Word-Datei gespeichert. Sie lässt sich in Word, LibreOffice und Google Docs öffnen.",
    );
  } catch (error) {
    showToast(
      "error",
      `Die Word-Datei ließ sich nicht erstellen (${error.message}). Versuch es mit dem PDF-Export.`,
    );
  }
}

// ---------- Prüfansicht für Ausbilder/innen ----------

function trainerCommentFileName(profile) {
  const name = (profile.name || "Azubi")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\wäöüÄÖÜß-]/g, "");
  return `Azubix_Kommentare_${name || "Azubi"}.json`;
}

function trainerViewData() {
  const { profile } = state;
  const logo = docLogo();
  return {
    app: "azubix-pruefansicht",
    version: 1,
    createdAt: new Date().toISOString(),
    commentFile: trainerCommentFileName(profile),
    profile: {
      name: profile.name || "",
      beruf: profile.beruf || "",
      betrieb: profile.betrieb || "",
      abteilung: profile.abteilung || "",
      jahr: profile.jahr || "",
      ausbilder: profile.ausbilder || "",
      logo: logo ? logo.dataUrl : "",
    },
    weeks: state.weeks.map((week) => ({
      monday: week.monday,
      friday: week.friday,
      kw: week.kw,
      year: week.year,
      nr: week.nr,
      summary: plainText(week.summary),
      unterweisung: plainText(week.unterweisung),
      unterweisungHours: docUnterweisungHours(week),
      total: docWeekTotal(week),
      comment: week.comment || "",
      trainerOk: Boolean(week.trainerOk),
      days: week.days.map((day) => ({
        date: day.date,
        name: day.name,
        kind: day.kind,
        kindLabel: docKindLabel(day),
        content: plainText(day.content),
        hours: Number(day.hours) || 0,
      })),
    })),
  };
}

function trainerMultiline(text) {
  return escHtml(text).replace(/\n/g, "<br>");
}

function trainerWeekCard(week) {
  const days = week.days
    .map(
      (day) => `<tr class="${["betrieb", "schule"].includes(day.kind) ? "" : "is-off"}">
            <td class="day"><strong>${escHtml(day.name)}</strong><span class="date">${formatDate(day.date)}</span><span class="kind kind-${escHtml(day.kind)}">${escHtml(day.kindLabel)}</span></td>
            <td class="text">${trainerMultiline(day.content) || "–"}</td>
            <td class="std">${docHours(day.hours)}</td>
          </tr>`,
    )
    .join("");
  const unterweisung = week.unterweisung
    ? `<tr class="extra"><td class="day"><strong>Unterweisungen, betrieblicher Unterricht</strong></td><td class="text">${trainerMultiline(week.unterweisung)}</td><td class="std">${docHours(week.unterweisungHours)}</td></tr>`
    : "";
  const summary = week.summary
    ? `<div class="block"><h3>Zusammenfassung der Woche</h3><p>${trainerMultiline(week.summary)}</p></div>`
    : "";
  const id = escHtml(week.monday);
  return `
      <article class="card" data-monday="${id}">
        <header class="card-head">
          <div>
            <h2>Ausbildungsnachweis Nr. ${escHtml(week.nr)}</h2>
            <p class="range">${escHtml(docWeekRange(week))}</p>
          </div>
          <span class="ok-tag">In Ordnung</span>
        </header>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Tag</th><th>Tätigkeiten und Unterrichtsthemen</th><th class="std">Std.</th></tr></thead>
            <tbody>${days}${unterweisung}</tbody>
            <tfoot><tr><td colspan="2">Gesamtstunden</td><td class="std">${docHours(week.total)}</td></tr></tfoot>
          </table>
        </div>
        ${summary}
        <div class="review">
          <label class="review-label" for="c-${id}">Ihr Kommentar</label>
          <textarea id="c-${id}" data-comment="${id}" rows="3" placeholder="Was soll geändert oder ergänzt werden?"></textarea>
          <p class="comment-print" data-print="${id}"></p>
          <label class="check"><input type="checkbox" data-ok="${id}" /> In Ordnung</label>
        </div>
      </article>`;
}

// Läuft nur in der heruntergeladenen Prüfansicht, nicht in Azubix selbst
function trainerViewRuntime() {
  const source = document.getElementById("azubix-data").textContent;
  const data = JSON.parse(source);
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const storageKey = `azubix-pruefung-${hash.toString(16)}`;
  let comments = {};
  try {
    comments = JSON.parse(localStorage.getItem(storageKey) || "null") || {};
  } catch {
    comments = {};
  }
  for (const week of data.weeks) {
    if (!comments[week.monday] && (week.comment || week.trainerOk)) {
      comments[week.monday] = { text: week.comment || "", ok: Boolean(week.trainerOk) };
    }
  }

  const status = document.getElementById("saveStatus");
  const counter = document.getElementById("okCount");

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(comments));
    } catch {
      // Ohne Speicher funktioniert die Seite trotzdem, nur ohne Erinnerung
    }
  }

  function update(monday) {
    const entry = comments[monday] || { text: "", ok: false };
    const card = document.querySelector(`.card[data-monday="${monday}"]`);
    card.classList.toggle("is-ok", entry.ok);
    card.querySelector("[data-print]").textContent = entry.text;
    const okCount = data.weeks.filter(
      (week) => comments[week.monday] && comments[week.monday].ok,
    ).length;
    counter.textContent = `${okCount} von ${data.weeks.length} ${data.weeks.length === 1 ? "Woche" : "Wochen"} in Ordnung`;
  }

  for (const week of data.weeks) {
    const entry = comments[week.monday] || { text: "", ok: false };
    const textarea = document.querySelector(`[data-comment="${week.monday}"]`);
    const checkbox = document.querySelector(`[data-ok="${week.monday}"]`);
    textarea.value = entry.text;
    checkbox.checked = entry.ok;
    const onChange = () => {
      comments[week.monday] = { text: textarea.value, ok: checkbox.checked };
      persist();
      update(week.monday);
      status.textContent = "";
    };
    textarea.addEventListener("input", onChange);
    checkbox.addEventListener("change", onChange);
    update(week.monday);
  }

  document.getElementById("saveComments").addEventListener("click", () => {
    const result = {};
    for (const week of data.weeks) {
      const entry = comments[week.monday];
      if (entry && (entry.text.trim() || entry.ok)) {
        result[week.monday] = { text: entry.text.trim(), ok: entry.ok };
      }
    }
    const count = Object.keys(result).length;
    if (count === 0) {
      status.textContent = "Sie haben noch keine Woche kommentiert oder abgehakt.";
      return;
    }
    const file = {
      app: "azubix-kommentare",
      version: 1,
      createdAt: new Date().toISOString(),
      comments: result,
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = data.commentFile;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `Gespeichert: ${count} ${count === 1 ? "Woche" : "Wochen"}. Schicken Sie die Datei jetzt zurück.`;
  });

  document.getElementById("printPage").addEventListener("click", () => window.print());
}

const TRAINER_VIEW_CSS = `
  :root {
    --paper: #f4f5f7;
    --sheet: #ffffff;
    --ink: #18202c;
    --muted: #5f6775;
    --rule: #e3e6eb;
    --rule-strong: #cfd4dc;
    --soft: #fafbfc;
    --schule: #2557c4;
    --betrieb: #138a72;
    --ferien: #c4701a;
    --frei: #9aa0a8;
    --ok: #138a72;
    --radius: 12px;
    color-scheme: light;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: "Instrument Sans", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 15px;
    line-height: 1.55;
  }
  .wrap { max-width: 920px; margin: 0 auto; padding: 40px 16px 48px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .eyebrow { margin: 0; color: var(--muted); font-size: 13px; font-weight: 600; }
  h1 { margin: 4px 0 6px; font-size: 30px; line-height: 1.2; letter-spacing: -0.01em; }
  .meta { margin: 0; color: var(--muted); }
  .logo { max-width: 140px; max-height: 60px; object-fit: contain; }
  .note {
    margin: 28px 0 0;
    padding: 18px 22px;
    background: var(--sheet);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }
  .note h2 { margin: 0 0 6px; font-size: 16px; }
  .note ol { margin: 0; padding-left: 20px; }
  .note li + li { margin-top: 4px; }
  .note .fine { margin: 10px 0 0; color: var(--muted); font-size: 14px; }
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 20px 0 24px;
    padding: 12px 0;
    background: var(--paper);
    border-bottom: 1px solid var(--rule);
  }
  .toolbar-info { display: flex; flex-direction: column; }
  #okCount { font-weight: 600; }
  #saveStatus { color: var(--muted); font-size: 14px; }
  #saveStatus:empty { display: none; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  button {
    font: inherit;
    font-weight: 600;
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid var(--ink);
    background: var(--ink);
    color: #fff;
    cursor: pointer;
  }
  button.secondary { background: var(--sheet); color: var(--ink); border-color: var(--rule-strong); }
  button:hover { opacity: 0.92; }
  button:focus-visible, textarea:focus-visible, input:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(24, 32, 44, 0.16);
  }
  .card {
    margin-bottom: 20px;
    background: var(--sheet);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    box-shadow: 0 1px 2px rgba(24, 32, 44, 0.05), 0 4px 16px -8px rgba(24, 32, 44, 0.12);
    overflow: hidden;
  }
  .card.is-ok { border-color: #9fd2c4; }
  .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 18px 20px 14px; }
  .card-head h2 { margin: 0; font-size: 18px; line-height: 1.3; }
  .range { margin: 2px 0 0; color: var(--muted); font-size: 14px; }
  .ok-tag {
    display: none;
    padding: 3px 10px;
    border-radius: 999px;
    background: #e3f3ee;
    color: #0e6b58;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }
  .card.is-ok .ok-tag { display: inline-block; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 10px 20px; text-align: left; vertical-align: top; border-top: 1px solid var(--rule); }
  th { background: var(--soft); color: var(--muted); font-size: 13px; font-weight: 600; }
  td.day { width: 168px; }
  td.day strong, td.day span { display: block; }
  .date { color: var(--muted); font-size: 14px; font-variant-numeric: tabular-nums; }
  .kind { display: inline-flex !important; align-items: center; gap: 6px; margin-top: 2px; color: var(--muted); font-size: 13px; }
  .kind::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--frei); }
  .kind-betrieb::before { background: var(--betrieb); }
  .kind-schule::before { background: var(--schule); }
  .kind-urlaub::before { background: var(--ferien); }
  .std { width: 64px; text-align: right; font-variant-numeric: tabular-nums; }
  tr.is-off td.text { color: var(--muted); }
  tr.extra td { background: var(--soft); }
  tfoot td { font-weight: 600; background: var(--soft); }
  .block { padding: 14px 20px; border-top: 1px solid var(--rule); }
  .block h3, .review-label { display: block; margin: 0 0 4px; color: var(--muted); font-size: 13px; font-weight: 600; }
  .block p { margin: 0; }
  .review { padding: 16px 20px 18px; border-top: 1px solid var(--rule); background: var(--soft); }
  textarea {
    display: block;
    width: 100%;
    min-height: 84px;
    padding: 10px 12px;
    font: inherit;
    color: var(--ink);
    background: var(--sheet);
    border: 1px solid var(--rule-strong);
    border-radius: 8px;
    resize: vertical;
  }
  textarea:focus-visible { border-color: var(--ink); }
  .comment-print { display: none; margin: 0; white-space: pre-wrap; }
  .check { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; font-weight: 600; cursor: pointer; }
  .check input { width: 18px; height: 18px; margin: 0; accent-color: var(--ok); }
  footer { margin-top: 36px; color: var(--muted); font-size: 13px; text-align: center; }
  footer a { color: inherit; }
  @media (max-width: 640px) {
    .wrap { padding-top: 24px; }
    h1 { font-size: 24px; }
    .top { flex-direction: column-reverse; gap: 12px; }
    th, td { padding: 10px 12px; }
    td.day { width: 104px; }
    .std { width: 48px; }
    .card-head, .block, .review { padding-left: 14px; padding-right: 14px; }
    .actions { width: 100%; }
    .actions button { flex: 1; }
  }
  @media print {
    @page { size: A4; margin: 15mm; }
    body { background: #fff; font-size: 10.5pt; }
    .wrap { max-width: none; padding: 0; }
    .note, .toolbar, textarea, .ok-tag { display: none !important; }
    .card { box-shadow: none; border-color: #999; break-after: page; }
    .card:last-of-type { break-after: auto; }
    tr { break-inside: avoid; }
    .comment-print { display: block; }
    .comment-print:empty::before { content: "Kein Kommentar"; color: var(--muted); }
    footer { margin-top: 12px; }
  }
`;

function buildTrainerView() {
  const data = trainerViewData();
  const { profile } = data;
  const name = profile.name || "Auszubildende/r";
  const recipient = profile.name || "Ihre Auszubildende oder Ihren Auszubildenden";
  const metaLine = [
    profile.beruf,
    docBetrieb(profile),
    profile.jahr ? `${profile.jahr}. Ausbildungsjahr` : "",
  ]
    .filter(Boolean)
    .map(escHtml)
    .join(" · ");
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const runtime = trainerViewRuntime.toString().replace(/<\/script/gi, "<\\/script");

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="generator" content="Azubix" />
    <title>Prüfansicht ${escHtml(name)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;600;700&display=swap" />
    <style>${TRAINER_VIEW_CSS}</style>
  </head>
  <body>
    <div class="wrap">
      <header class="top">
        <div>
          <p class="eyebrow">Ausbildungsnachweise zur Prüfung</p>
          <h1>${escHtml(name)}</h1>
          <p class="meta">${metaLine}</p>
        </div>
        ${profile.logo ? `<img class="logo" src="${escHtml(profile.logo)}" alt="Logo des Betriebs" />` : ""}
      </header>

      <section class="note" aria-label="Hinweis">
        <h2>So geben Sie Ihre Rückmeldung</h2>
        <ol>
          <li>Schreiben Sie zu jeder Woche einen Kommentar oder setzen Sie das Häkchen „In Ordnung“.</li>
          <li>Klicken Sie auf „Kommentare speichern“. Ihr Browser lädt eine kleine Datei herunter.</li>
          <li>Schicken Sie diese Datei an ${escHtml(recipient)}, zum Beispiel per E-Mail. In Azubix wird sie geladen, dann stehen Ihre Kommentare direkt bei den Wochen.</li>
        </ol>
        <p class="fine">Ihre Eingaben bleiben in diesem Browser gespeichert, auch wenn Sie die Seite schließen. Hochgeladen wird nichts.</p>
      </section>

      <div class="toolbar">
        <div class="toolbar-info" aria-live="polite">
          <span id="okCount"></span>
          <span id="saveStatus"></span>
        </div>
        <div class="actions">
          <button type="button" class="secondary" id="printPage">Drucken</button>
          <button type="button" id="saveComments">Kommentare speichern</button>
        </div>
      </div>

      <main>${data.weeks.map(trainerWeekCard).join("")}
      </main>

      <footer>
        Erstellt mit Azubix von <a href="${AZUBIX_CREDIT.site}">${AZUBIX_CREDIT.author}</a> ·
        <a href="${AZUBIX_CREDIT.repo}">github.com/SneakyTreee/Azubix</a> ·
        <a href="${AZUBIX_CREDIT.site}">s4bt.de</a>
      </footer>
    </div>
    <script type="application/json" id="azubix-data">${json}</script>
    <script>(${runtime})();</script>
  </body>
</html>
`;
}

function exportTrainerView() {
  if (!ensureWeeks()) {
    return;
  }
  downloadFile(
    buildTrainerView(),
    `${fileBaseName()}_Pruefansicht.html`,
    "text/html;charset=utf-8",
  );
  showToast(
    "success",
    "Prüfansicht gespeichert. Schick die Datei an deine Ausbilderin oder deinen Ausbilder.",
  );
}

async function importTrainerComments(file) {
  try {
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new Error("Die Datei ist kein gültiges JSON.");
    }
    if (
      !data ||
      data.app !== "azubix-kommentare" ||
      !data.comments ||
      typeof data.comments !== "object"
    ) {
      throw new Error("Das ist keine Kommentar-Datei aus der Prüfansicht.");
    }
    let count = 0;
    for (const week of state.weeks) {
      const entry = data.comments[week.monday];
      if (!entry || typeof entry !== "object") {
        continue;
      }
      week.comment = String(entry.text ?? "").trim();
      week.trainerOk = Boolean(entry.ok);
      count++;
    }
    if (count === 0) {
      throw new Error("Die Kommentare passen zu keiner deiner Wochen.");
    }
    saveState();
    renderResults();
    showToast("success", `Kommentare für ${count} ${count === 1 ? "Woche" : "Wochen"} übernommen`);
  } catch (error) {
    showToast(
      "error",
      `${error.message} Wähle die Datei „Azubix_Kommentare_….json“, die deine Ausbilderin oder dein Ausbilder in der Prüfansicht gespeichert hat.`,
    );
  }
}
