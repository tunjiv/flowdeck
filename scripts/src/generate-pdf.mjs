import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mdPath = path.resolve(__dirname, "../../DOCUMENTATION.md");
const outPath = path.resolve(__dirname, "../../FlowDeck-Documentation.pdf");

const md = fs.readFileSync(mdPath, "utf8");

// ── colour palette ────────────────────────────────────────────────────────────
const TEAL       = "#0e7490";   // primary brand
const TEAL_LIGHT = "#cffafe";
const DARK       = "#0f172a";
const MID        = "#334155";
const MUTED      = "#64748b";
const BORDER     = "#e2e8f0";
const BG_CODE    = "#f1f5f9";
const WHITE      = "#ffffff";

// ── doc setup ─────────────────────────────────────────────────────────────────
const doc = new PDFDocument({
  size: "A4",
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
  info: {
    Title: "FlowDeck Documentation",
    Author: "FlowDeck",
    Subject: "System architecture, tech stack, and feature reference",
  },
});

doc.pipe(fs.createWriteStream(outPath));

const W = doc.page.width - 120; // usable width

// ── helpers ───────────────────────────────────────────────────────────────────
let pageNumber = 0;

function addHeader() {
  pageNumber++;
  // Top bar
  doc.save()
    .rect(0, 0, doc.page.width, 36)
    .fill(TEAL)
    .restore();
  doc.fillColor(WHITE).fontSize(9).font("Helvetica-Bold")
    .text("FlowDeck", 60, 13, { continued: true })
    .font("Helvetica").fillColor("#a5f3fc")
    .text("  ·  Full Documentation");
  // Page number (right)
  doc.fillColor(WHITE).fontSize(9).font("Helvetica")
    .text(String(pageNumber), 0, 13, { align: "right", width: doc.page.width - 60 });
}

function addFooter() {
  const y = doc.page.height - 40;
  doc.save().moveTo(60, y).lineTo(doc.page.width - 60, y)
    .strokeColor(BORDER).lineWidth(0.5).stroke().restore();
  doc.fillColor(MUTED).fontSize(8).font("Helvetica")
    .text("© 2026 FlowDeck · Confidential", 60, y + 8, { width: W, align: "center" });
}

doc.on("pageAdded", () => {
  addHeader();
});

// ── cover page ────────────────────────────────────────────────────────────────
// Header bar
doc.rect(0, 0, doc.page.width, 36).fill(TEAL);
doc.fillColor(WHITE).fontSize(9).font("Helvetica-Bold").text("FlowDeck", 60, 13);
pageNumber++;

// Big logo area
doc.rect(0, 36, doc.page.width, 220).fill("#0c4a6e");
doc.fillColor(WHITE).fontSize(48).font("Helvetica-Bold")
  .text("FlowDeck", 60, 100, { align: "center", width: W });
doc.fillColor("#7dd3fc").fontSize(16).font("Helvetica")
  .text("Full Documentation", 60, 160, { align: "center", width: W });

// Meta box
const metaY = 300;
doc.roundedRect(60, metaY, W, 100, 8).fill(BG_CODE);
const metaItems = [
  ["Version",  "1.0"],
  ["Date",     "May 2026"],
  ["Status",   "Production"],
  ["Stack",    "React · Express · PostgreSQL · Clerk"],
];
metaItems.forEach(([k, v], i) => {
  const row = metaY + 16 + i * 20;
  doc.fillColor(MUTED).fontSize(9).font("Helvetica-Bold").text(k, 80, row, { continued: true, width: 80 });
  doc.fillColor(DARK).font("Helvetica").text(`  ${v}`);
});

// Divider
doc.moveTo(60, 430).lineTo(doc.page.width - 60, 430).strokeColor(BORDER).lineWidth(1).stroke();

doc.fillColor(MUTED).fontSize(10).font("Helvetica")
  .text("System architecture, tech stack, API reference, database schema,\nand feature documentation for the FlowDeck productivity platform.", 60, 450, { align: "center", width: W });

addFooter();

// ── parse markdown into tokens ────────────────────────────────────────────────
const lines = md.split("\n");

let inCodeBlock = false;
let codeLines  = [];
let inTable    = false;
let tableRows  = [];

function flushCode() {
  if (!codeLines.length) return;
  const text = codeLines.join("\n");
  const pad = 10;
  const lineCount = codeLines.length;
  const blockH = lineCount * 11.5 + pad * 2;

  if (doc.y + blockH > doc.page.height - 80) doc.addPage();

  doc.save().roundedRect(60, doc.y, W, blockH, 6).fill(BG_CODE).restore();
  doc.fillColor(MID).fontSize(8).font("Courier")
    .text(text, 60 + pad, doc.y + pad, { width: W - pad * 2, lineGap: 2 });
  doc.moveDown(1.2);
  codeLines = [];
}

function flushTable() {
  if (!tableRows.length) return;

  // Separate header from body
  const [header, _sep, ...body] = tableRows;
  if (!header) { tableRows = []; return; }

  const cols = header.split("|").map(c => c.trim()).filter(Boolean);
  const colW = W / cols.length;
  const rowH = 20;
  const totalH = (1 + body.length) * rowH + 4;

  if (doc.y + totalH > doc.page.height - 80) doc.addPage();

  let startY = doc.y;

  // Header row
  doc.rect(60, startY, W, rowH).fill(TEAL);
  cols.forEach((c, i) => {
    doc.fillColor(WHITE).fontSize(8).font("Helvetica-Bold")
      .text(c, 60 + i * colW + 6, startY + 6, { width: colW - 12, lineBreak: false });
  });

  // Body rows
  body.forEach((row, ri) => {
    const cells = row.split("|").map(c => c.trim()).filter(Boolean);
    const y = startY + rowH + ri * rowH;
    // Stripe
    doc.rect(60, y, W, rowH).fill(ri % 2 === 0 ? WHITE : "#f8fafc");
    // Border
    doc.rect(60, y, W, rowH).stroke(BORDER).lineWidth(0.3);
    cells.forEach((cell, ci) => {
      // Strip inline markdown bold/code
      const clean = cell.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`(.*?)`/g, "$1").replace(/\\|/g, "|");
      doc.fillColor(DARK).fontSize(8).font("Helvetica")
        .text(clean, 60 + ci * colW + 6, y + 6, { width: colW - 12, lineBreak: false });
    });
  });

  doc.y = startY + rowH + body.length * rowH + 10;
  doc.moveDown(0.5);
  tableRows = [];
  inTable = false;
}

// ── main render loop ──────────────────────────────────────────────────────────
doc.addPage();

for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];

  // Code block toggle
  if (raw.startsWith("```")) {
    if (inCodeBlock) {
      flushCode();
      inCodeBlock = false;
    } else {
      inCodeBlock = true;
    }
    continue;
  }
  if (inCodeBlock) { codeLines.push(raw); continue; }

  // Table rows
  if (raw.startsWith("|")) {
    if (!inTable) inTable = true;
    tableRows.push(raw);
    continue;
  }
  if (inTable && !raw.startsWith("|")) {
    flushTable();
  }

  // Skip ToC lines and horizontal rules
  if (raw.match(/^-{3,}$/) || raw.match(/^\[.*\]\(#.*\)$/)) continue;

  // Strip inline markdown (bold, code, italic, links)
  const clean = raw
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s*/, "")
    .trim();

  if (!clean) { doc.moveDown(0.4); continue; }

  // H1
  if (raw.startsWith("# ") && !raw.startsWith("## ")) {
    // Cover already handled; skip the very first H1
    if (clean === "FlowDeck — Full Documentation") continue;
    if (doc.y > doc.page.height - 120) doc.addPage();
    // Full-width teal band
    doc.rect(60, doc.y, W, 32).fill(TEAL);
    doc.fillColor(WHITE).fontSize(18).font("Helvetica-Bold")
      .text(clean.replace(/^\d+\.\s*/, ""), 68, doc.y - 28, { width: W - 16 });
    doc.moveDown(1.2);
    continue;
  }

  // H2
  if (raw.startsWith("## ")) {
    if (doc.y > doc.page.height - 100) doc.addPage();
    doc.moveDown(0.6);
    const label = clean.replace(/^#+\s*/, "");
    doc.save().rect(60, doc.y, 3, 18).fill(TEAL).restore();
    doc.fillColor(DARK).fontSize(14).font("Helvetica-Bold")
      .text(label, 70, doc.y, { width: W - 10 });
    doc.moveDown(0.6);
    continue;
  }

  // H3
  if (raw.startsWith("### ")) {
    if (doc.y > doc.page.height - 80) doc.addPage();
    doc.moveDown(0.4);
    const label = clean.replace(/^#+\s*/, "");
    doc.fillColor(TEAL).fontSize(11).font("Helvetica-Bold")
      .text(label, 60, doc.y, { width: W });
    doc.moveDown(0.3);
    continue;
  }

  // H4
  if (raw.startsWith("#### ")) {
    doc.fillColor(MID).fontSize(10).font("Helvetica-Bold")
      .text(clean.replace(/^#+\s*/, ""), 60, doc.y, { width: W });
    doc.moveDown(0.3);
    continue;
  }

  // Bullet list
  if (raw.match(/^[-*]\s+/) || raw.match(/^\s{2,}[-*]\s+/)) {
    const indent = raw.match(/^\s{2,}/) ? 80 : 66;
    const text = clean.replace(/^[-*]\s+/, "");
    doc.fillColor(TEAL).fontSize(8).text("•", indent - 10, doc.y + 1.5, { continued: true, width: 10 });
    doc.fillColor(DARK).fontSize(9).font("Helvetica").text(` ${text}`, { width: W - (indent - 60) });
    continue;
  }

  // Numbered list
  if (raw.match(/^\d+\.\s+/)) {
    const num = raw.match(/^(\d+)\./)?.[1];
    const text = clean.replace(/^\d+\.\s+/, "");
    doc.fillColor(TEAL).fontSize(9).font("Helvetica-Bold").text(`${num}.`, 60, doc.y + 1, { continued: true, width: 18 });
    doc.fillColor(DARK).font("Helvetica").text(` ${text}`, { width: W - 18 });
    continue;
  }

  // Normal paragraph
  if (doc.y > doc.page.height - 80) doc.addPage();
  doc.fillColor(MID).fontSize(9.5).font("Helvetica")
    .text(clean, 60, doc.y, { width: W, lineGap: 1.5 });
  doc.moveDown(0.3);
}

// Flush any remaining table/code at EOF
if (inTable) flushTable();
if (inCodeBlock) flushCode();

addFooter();
doc.end();

doc.on("finish", () => {
  console.log(`PDF written to ${outPath}`);
});
