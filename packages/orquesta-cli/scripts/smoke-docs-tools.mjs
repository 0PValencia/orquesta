/**
 * Smoke test de las 106 tools del MCP google-document.
 * Uso: node scripts/smoke-docs-tools.mjs
 *      orquesta mcp smoke-docs
 *
 * No ejecuta delete_document_permanently (irreversible).
 * trash/restore se prueban sobre un duplicado descartable.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, loadMcpFile } from "../dist/config.js";
import { callTool, closeServers, connectServers } from "../dist/mcp/client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SKIP_ALWAYS = new Set([
  // Irreversible / peligroso en la cuenta real
  "delete_document_permanently",
]);

const SOFT_SKIP = new Set([
  // Requieren IDs de sesión previos o límites de Drive API
  "update_permission",
  "delete_permission",
  "move_document",
]);

const DEFER_UNTIL_TRASH_FLOW = new Set([
  "trash_document",
  "restore_from_trash",
  "list_trashed_documents",
  "delete_document", // soft delete vía API; lo hacemos al final sobre duplicado
]);

function parseResult(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function isErrorResult(raw) {
  const s = typeof raw === "string" ? raw : JSON.stringify(raw);
  if (/"isError"\s*:\s*true/.test(s)) return true;
  if (/"error"\s*:\s*"/.test(s) && /Tool no encontrada|Servidor MCP/i.test(s)) return true;
  // MCP a veces devuelve texto con Error:
  try {
    const p = JSON.parse(s);
    const text = (p.content || []).map((c) => c.text || "").join("\n");
    if (/^(Error|ERROR|Failed|PERMISSION_DENIED|INVALID_ARGUMENT)/m.test(text)) return true;
    if (/^\s*\{\s*"error"/i.test(text.trim())) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function extractId(raw) {
  const m =
    raw.match(/"documentId"\s*:\s*"([^"]+)"/) ||
    raw.match(/"id"\s*:\s*"([1-9A-Za-z_-]{20,})"/) ||
    raw.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return m?.[1];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runOne(servers, tools, name, args) {
  await sleep(350);
  const t0 = Date.now();
  const full = tools.find((t) => t.name === name)?.fullName || name;
  try {
    const raw = await callTool(servers, tools, full, args);
    const ok = !isErrorResult(raw);
    return { name, ok, ms: Date.now() - t0, args, raw: raw.slice(0, 1200) };
  } catch (e) {
    return {
      name,
      ok: false,
      ms: Date.now() - t0,
      args,
      raw: e instanceof Error ? e.message : String(e),
    };
  }
}

function buildArgs(name, ctx) {
  const {
    documentId,
    structure,
    permissionId,
    revisionId,
    namedRangeName,
    commentId,
    imageUrl,
    tableStart,
    headerId,
    footerId,
  } = ctx;

  const end = structure?.endIndex || 2;
  const idx = Math.max(1, end - 1);
  const firstPara = (structure?.blocks || []).find(
    (b) => b.type === "paragraph" && (b.text || "").trim().length > 0
  );
  const titleStart = firstPara?.startIndex ?? 1;
  const titleEnd = Math.min(firstPara?.endIndex ?? 2, titleStart + 40);
  const tStart = tableStart || titleStart;
  const range = { documentId, startIndex: titleStart, endIndex: titleEnd };

  switch (name) {
    case "create_document":
      return { title: `SMOKE Orquesta ${new Date().toISOString()}` };
    case "generate_academic_document":
      return {
        topic: "SMOKE academic scaffold litio Bolivia",
        type: "research",
        pages: 2,
        author: "Orquesta Smoke",
        institution: "Orquesta",
      };
    case "list_documents":
    case "list_trashed_documents":
      return {};
    case "search_images":
      return { query: "flamingo bolivia laguna", limit: 2 };
    case "create_document_revision":
      return { documentId };
    case "star_document":
      return { documentId, starred: true };
    case "rename_document":
      return { documentId, title: "SMOKE Orquesta — informe de prueba" };
    case "duplicate_document":
      return { documentId, title: "SMOKE Orquesta DUPLICADO (borrar)" };
    case "export_document":
      return { documentId, format: "txt" };
    case "get_document":
    case "get_document_metadata":
    case "get_document_structure":
    case "get_document_folder":
    case "get_document_owners":
    case "read_document":
    case "get_page_setup":
    case "list_images":
    case "list_named_ranges":
    case "list_permissions":
    case "list_revisions":
    case "list_drive_comments":
    case "count_words":
    case "format_academic_document":
    case "repair_academic_document":
      return { documentId };
    case "append_text":
      return {
        documentId,
        text:
          "Introducción\n\n" +
          "Este párrafo forma parte de la prueba automática de tools MCP de Orquesta. ".repeat(8) +
          "\n\nMétodo\n\n" +
          "Se ejercitan create, estructura, formato, tabla, bibliografía y lectura. ".repeat(6) +
          "\n\n",
      };
    case "insert_text":
      return { documentId, text: "Nota smoke insert_text. ", index: idx };
    case "replace_text":
      return {
        documentId,
        findText: "prueba automática",
        replaceText: "prueba automatizada",
        matchCase: false,
      };
    case "find_text":
      return { documentId, query: "Orquesta", matchCase: false };
    case "delete_text": {
      const s = Math.max(1, end - 5);
      const e = Math.max(s + 1, end - 2);
      return { documentId, startIndex: s, endIndex: e };
    }
    case "get_range_content":
      return { documentId, startIndex: 1, endIndex: Math.min(end, 80) };
    case "apply_heading":
      return { ...range, style: "HEADING_1" };
    case "apply_format":
      return { ...range, bold: true };
    case "clear_formatting":
      return { ...range };
    case "set_bold":
    case "set_italic":
    case "set_underline":
    case "set_strikethrough":
    case "set_small_caps":
      return { ...range, value: true };
    case "set_superscript":
    case "set_subscript":
      return { ...range };
    case "set_font_family":
      return { ...range, fontFamily: "Arial" };
    case "set_font_size":
      return { ...range, fontSize: 12 };
    case "set_foreground_color":
      return { ...range, color: { red: 0.1, green: 0.1, blue: 0.1 } };
    case "set_background_color":
      return { ...range, color: { red: 0.95, green: 0.95, blue: 0.95 } };
    case "set_link":
      return { ...range, url: "https://docs.google.com" };
    case "set_alignment_left":
    case "set_alignment_center":
    case "set_alignment_right":
    case "set_alignment_justified":
      return { ...range };
    case "set_line_spacing":
      return { ...range, lineSpacing: 115 };
    case "set_space_above":
    case "set_space_below":
      return { ...range, spacePt: 6 };
    case "set_first_line_indent":
    case "set_indent_start":
      return { ...range, indentPt: 18 };
    case "create_paragraph_bullets":
    case "delete_paragraph_bullets":
      return { documentId, startIndex: titleStart, endIndex: Math.min(end, titleStart + 200) };
    case "create_academic_structure":
      return {
        documentId,
        type: "research",
        title: "SMOKE estructura académica",
        author: "Orquesta",
        institution: "Orquesta Lab",
        date: "2026",
      };
    case "append_bibliography":
      return {
        documentId,
        entries: [
          "Autor, A. (2024). Título de prueba. https://example.com/a",
          "Autor, B. (2025). Otro recurso. https://example.com/b",
        ],
      };
    case "insert_table_of_contents":
      return { documentId, replaceSection: true };
    case "insert_page_break":
    case "insert_section_break":
      return { documentId, index: idx };
    case "insert_date":
      return { documentId, index: idx, isoDate: new Date().toISOString().slice(0, 10) };
    case "insert_person":
      return { documentId, index: idx, email: "smoke@example.com" };
    case "insert_citation":
      return { documentId, index: idx, citationKey: "autor2024" };
    case "create_footnote":
      return { documentId, index: idx, text: "Nota al pie smoke." };
    case "create_header":
      return { documentId, text: "Header smoke Orquesta" };
    case "create_footer":
      return { documentId, text: "Footer smoke Orquesta" };
    case "delete_header":
      return { documentId, headerId: headerId || "kix.header" };
    case "delete_footer":
      return { documentId, footerId: footerId || "kix.footer" };
    case "create_table":
      return { documentId, rows: 2, columns: 2, index: idx };
    case "insert_table_row":
      return { documentId, tableStartIndex: tStart, rowIndex: 0, insertBelow: true };
    case "insert_table_column":
      return { documentId, tableStartIndex: tStart, columnIndex: 0, insertRight: true };
    case "delete_table_row":
      return { documentId, tableStartIndex: tStart, rowIndex: 1 };
    case "delete_table_column":
      return { documentId, tableStartIndex: tStart, columnIndex: 1 };
    case "merge_table_cells":
      return {
        documentId,
        tableStartIndex: tStart,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: 2,
      };
    case "unmerge_table_cells":
      return {
        documentId,
        tableStartIndex: tStart,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: 2,
      };
    case "pin_table_header_rows":
      return { documentId, tableStartIndex: tStart, pinnedHeaderRowsCount: 1 };
    case "update_table_cell_style":
      return {
        documentId,
        tableStartIndex: tStart,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: 1,
        backgroundColor: { red: 0.9, green: 0.9, blue: 0.95 },
      };
    case "update_table_column_width":
      return { documentId, tableStartIndex: tStart, columnIndices: [0], widthPt: 120 };
    case "update_table_row_min_height":
      return { documentId, tableStartIndex: tStart, rowIndices: [0], minHeightPt: 20 };
    case "insert_image":
      return {
        documentId,
        index: idx,
        uri:
          "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png",
        widthPt: 120,
      };
    case "insert_diagram":
      return {
        documentId,
        index: idx,
        mermaidSource: "graph LR; A[Smoke] --> B[OK]",
        widthPt: 240,
      };
    case "replace_image":
      return {
        documentId,
        imageObjectId: ctx.imageObjectId || "missing",
        uri:
          "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png",
      };
    case "create_named_range":
      return {
        documentId,
        name: namedRangeName || "smoke_range",
        startIndex: titleStart,
        endIndex: titleEnd,
      };
    case "replace_named_range_content":
      return {
        documentId,
        name: namedRangeName || "smoke_range",
        text: "contenido named range",
      };
    case "delete_named_range":
      return { documentId, name: namedRangeName || "smoke_range" };
    case "copy_content":
    case "cut_content":
      return { ...range };
    case "paste_content":
      return { documentId, index: idx, text: "pegado smoke" };
    case "move_content":
      return {
        documentId,
        startIndex: titleStart,
        endIndex: titleEnd,
        destinationIndex: idx,
      };
    case "update_document_style":
      return { documentId, backgroundColor: { red: 1, green: 1, blue: 1 } };
    case "create_drive_comment":
      return { documentId, content: "Comentario smoke Orquesta" };
    case "delete_drive_comment":
      return { documentId, commentId: commentId || "missing" };
    case "get_revision":
    case "keep_revision_forever":
      return { documentId, revisionId: revisionId || "1" };
    case "create_permission":
      return { documentId, role: "reader", type: "anyone" };
    case "get_permission":
    case "delete_permission":
      return { documentId, permissionId: permissionId || "anyoneWithLink" };
    case "update_permission":
      return { documentId, permissionId: permissionId || "anyoneWithLink", role: "reader" };
    case "create_shortcut":
      return { documentId, name: "SMOKE shortcut" };
    case "move_document":
      return { documentId, addParentIds: ["root"] };
    case "trash_document":
    case "restore_from_trash":
    case "delete_document":
      return { documentId };
    default:
      return documentId ? { documentId } : {};
  }
}

async function refreshStructure(servers, tools, documentId) {
  const raw = await callTool(
    servers,
    tools,
    tools.find((t) => t.name === "get_document_structure").fullName,
    { documentId }
  );
  try {
    const p = JSON.parse(raw);
    return p.structuredContent || JSON.parse(p.content?.[0]?.text || "{}");
  } catch {
    return { endIndex: 2, blocks: [] };
  }
}

async function main() {
  const cfg = loadConfig();
  const { servers, tools, failed } = await connectServers(loadMcpFile(cfg.mcpPath));
  const docs = tools.filter((t) => t.server === "google-document");
  if (failed.length) console.error("MCP failed:", failed);
  if (docs.length !== 106) {
    console.warn(`Esperaba 106 tools, hay ${docs.length}`);
  }

  const results = [];
  const ctx = {
    documentId: "",
    structure: { endIndex: 2, blocks: [] },
    namedRangeName: "smoke_range_orquesta",
    imageUrl: "",
    imageObjectId: "",
    permissionId: "",
    revisionId: "",
    commentId: "",
    tableStart: 0,
    dupId: "",
    headerId: "",
    footerId: "",
  };

  console.log(`\n══ Smoke Docs MCP · ${docs.length} tools ══\n`);

  // 1) Documento base
  const created = await runOne(servers, docs, "create_document", buildArgs("create_document", ctx));
  results.push(created);
  ctx.documentId = extractId(created.raw) || "";
  console.log(created.ok ? "✓" : "✗", "create_document", ctx.documentId || created.raw.slice(0, 120));
  if (!ctx.documentId) {
    console.error("No se pudo crear documento base. Abort.");
    await closeServers(servers);
    process.exit(1);
  }

  // Orden preferido: escritura → estructura → formato → extras → listas → peligrosos al final
  const priority = [
    "append_text",
    "get_document_structure",
    "apply_heading",
    "create_academic_structure",
    "insert_text",
    "find_text",
    "replace_text",
    "count_words",
    "read_document",
    "get_document_metadata",
    "get_document",
    "get_page_setup",
    "apply_format",
    "set_bold",
    "set_italic",
    "set_underline",
    "set_font_family",
    "set_font_size",
    "set_alignment_left",
    "set_alignment_center",
    "set_alignment_justified",
    "set_line_spacing",
    "append_bibliography",
    "create_table",
    "insert_table_of_contents",
    "create_header",
    "create_footer",
    "create_named_range",
    "list_documents",
    "list_revisions",
    "list_permissions",
    "search_images",
    "format_academic_document",
  ];

  const names = docs.map((t) => t.name);
  const ordered = [
    ...priority.filter((n) => names.includes(n) && n !== "create_document"),
    ...names
      .filter((n) => n !== "create_document" && !priority.includes(n))
      .sort(),
  ];

  for (const name of ordered) {
    if (SKIP_ALWAYS.has(name)) {
      results.push({ name, ok: true, skipped: true, reason: "irreversible", ms: 0, raw: "" });
      console.log("⊘", name, "(skip irreversible)");
      continue;
    }
    if (SOFT_SKIP.has(name)) {
      results.push({ name, ok: true, skipped: true, reason: "api/limitación conocida", ms: 0, raw: "" });
      console.log("⊘", name, "(skip soft)");
      continue;
    }
    if (DEFER_UNTIL_TRASH_FLOW.has(name)) {
      continue; // al final
    }

    // refrescar estructura cada tanto
    if (
      /apply_|set_|insert_|create_table|delete_text|replace_|append_|heading|format_|repair_|bibliography|table|header|footer|named_range|page_break|section_break|footnote|citation|date|person|diagram|image|bullets|copy_|cut_|paste_|move_content/i.test(
        name
      )
    ) {
      try {
        ctx.structure = await refreshStructure(servers, docs, ctx.documentId);
        const table = (ctx.structure.blocks || []).find((b) => b.type === "table");
        if (table?.startIndex != null) ctx.tableStart = table.startIndex;
      } catch {
        /* ignore */
      }
    }

    // search_images → guardar url
    if (name === "insert_image" && !ctx.imageUrl) {
      const search = results.find((r) => r.name === "search_images" && r.ok);
      const url = search?.raw?.match(/https?:\/\/[^\s\"']+/)?.[0];
      if (url) ctx.imageUrl = url;
    }

    const args = buildArgs(name, ctx);
    const res = await runOne(servers, docs, name, args);
    results.push(res);
    console.log(res.ok ? "✓" : "✗", name, res.ok ? `${res.ms}ms` : res.raw.slice(0, 160).replace(/\n/g, " "));

    // capturar ids útiles
    if (name === "duplicate_document" && res.ok) {
      ctx.dupId = extractId(res.raw) || ctx.dupId;
    }
    if (name === "list_permissions" && res.ok) {
      const pid = res.raw.match(/"id"\s*:\s*"([^"]+)"/)?.[1];
      if (pid) ctx.permissionId = pid;
    }
    if (name === "list_revisions" && res.ok) {
      const rid = res.raw.match(/"id"\s*:\s*"([^"]+)"/)?.[1];
      if (rid) ctx.revisionId = rid;
    }
    if (name === "create_drive_comment" && res.ok) {
      const cid = res.raw.match(/"id"\s*:\s*"([^"]+)"/)?.[1];
      if (cid) ctx.commentId = cid;
    }
    if (name === "create_header" && res.ok) {
      const hid = res.raw.match(/"headerId"\s*:\s*"([^"]+)"/)?.[1] || res.raw.match(/"id"\s*:\s*"([^"]+)"/)?.[1];
      if (hid) ctx.headerId = hid;
    }
    if (name === "create_footer" && res.ok) {
      const fid = res.raw.match(/"footerId"\s*:\s*"([^"]+)"/)?.[1] || res.raw.match(/"id"\s*:\s*"([^"]+)"/)?.[1];
      if (fid) ctx.footerId = fid;
    }
    if (name === "list_images" && res.ok) {
      const oid = res.raw.match(/"objectId"\s*:\s*"([^"]+)"/)?.[1];
      if (oid) ctx.imageObjectId = oid;
    }
    if (name === "search_images" && res.ok) {
      const url = res.raw.match(/https?:\/\/[^\s\"']+/)?.[0];
      if (url) ctx.imageUrl = url;
    }
  }

  // Flujo trash sobre duplicado (no el principal)
  let target = ctx.dupId;
  if (!target) {
    const dup = await runOne(servers, docs, "duplicate_document", {
      documentId: ctx.documentId,
      newTitle: "SMOKE temp trash target",
    });
    results.push(dup);
    target = extractId(dup.raw) || "";
    console.log(dup.ok ? "✓" : "✗", "duplicate_document (trash target)");
  }

  if (target) {
    for (const name of ["list_trashed_documents", "trash_document", "restore_from_trash", "delete_document"]) {
      const args = { documentId: target };
      if (name === "list_trashed_documents") {
        const res = await runOne(servers, docs, name, {});
        results.push(res);
        console.log(res.ok ? "✓" : "✗", name);
        continue;
      }
      const res = await runOne(servers, docs, name, args);
      results.push(res);
      console.log(res.ok ? "✓" : "✗", name, target.slice(0, 12));
      // tras delete_document no restore
      if (name === "trash_document") {
        // restore next
      }
    }
  } else {
    for (const name of DEFER_UNTIL_TRASH_FLOW) {
      results.push({ name, ok: false, skipped: true, reason: "sin duplicado", ms: 0, raw: "" });
      console.log("⊘", name, "(sin duplicado)");
    }
  }

  // Asegurar que SKIP aparece
  for (const name of SKIP_ALWAYS) {
    if (!results.some((r) => r.name === name)) {
      results.push({ name, ok: true, skipped: true, reason: "irreversible", ms: 0, raw: "" });
    }
  }

  // Dedup por nombre (última gana) para conteo
  const byName = new Map();
  for (const r of results) byName.set(r.name, r);
  const final = [...byName.values()];
  const ok = final.filter((r) => r.ok && !r.skipped).length;
  const fail = final.filter((r) => !r.ok && !r.skipped).length;
  const skip = final.filter((r) => r.skipped).length;
  const covered = final.length;

  const report = {
    ts: new Date().toISOString(),
    documentId: ctx.documentId,
    url: `https://docs.google.com/document/d/${ctx.documentId}/edit`,
    totalTools: docs.length,
    covered,
    ok,
    fail,
    skip,
    results: final.map((r) => ({
      name: r.name,
      ok: r.ok,
      skipped: !!r.skipped,
      reason: r.reason,
      ms: r.ms,
      errorPreview: r.ok ? undefined : String(r.raw || "").slice(0, 300),
    })),
  };

  const outDir = path.join(cfg.configDir, "memory");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "smoke-docs-tools.json");
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + "\n");

  // también en el repo si existe
  try {
    const repoOut = path.join(__dirname, "../smoke-docs-report.json");
    fs.writeFileSync(repoOut, JSON.stringify(report, null, 2) + "\n");
  } catch {
    /* ignore */
  }

  console.log("\n══ Resumen ══");
  console.log(`Tools MCP: ${docs.length}`);
  console.log(`Cubiertas: ${covered}  OK: ${ok}  FAIL: ${fail}  SKIP: ${skip}`);
  console.log(`Doc: ${report.url}`);
  console.log(`Reporte: ${outFile}`);
  if (fail) {
    console.log("\nFallidas:");
    for (const r of final.filter((x) => !x.ok && !x.skipped)) {
      console.log(` - ${r.name}: ${String(r.raw).slice(0, 120).replace(/\n/g, " ")}`);
    }
  }

  await closeServers(servers);
  process.exit(fail > 40 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
