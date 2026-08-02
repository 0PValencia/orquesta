import type { OrquestaTool } from "./client.js";

/** Catálogo + schemas cortos (estilo OpenCode: tools en el prompt, no 106 schemas enteros). */
export function selectTools(
  tools: OrquestaTool[],
  opts?: { maxTools?: number; query?: string }
): OrquestaTool[] {
  if (!tools.length) return [];
  const maxTools = opts?.maxTools ?? 24;
  const q = (opts?.query || "").toLowerCase();

  const PRIORITY =
    /^(create_document|generate_academic_document|create_academic_structure|get_document_structure|list_documents|read_document|insert_text|append_text|replace_text|delete_text|apply_heading|apply_format|insert_table_of_contents|append_bibliography|format_academic_document|repair_academic_document|create_table|insert_image|search_images|insert_diagram|export_document|get_document_metadata|find_text|duplicate_document)$/i;

  const queryHit = (t: OrquestaTool) => {
    if (!q) return false;
    return q
      .split(/\W+/)
      .some((w) => w.length > 3 && (t.name.includes(w) || t.fullName.includes(w)));
  };

  return [...tools]
    .sort((a, b) => {
      const sa = (PRIORITY.test(a.name) ? 0 : 2) + (queryHit(a) ? -1 : 0);
      const sb = (PRIORITY.test(b.name) ? 0 : 2) + (queryHit(b) ? -1 : 0);
      return sa - sb || a.name.localeCompare(b.name);
    })
    .slice(0, maxTools);
}

function schemaDigest(schema?: Record<string, unknown>): string {
  if (!schema || typeof schema !== "object") return "{}";
  const props = (schema.properties || {}) as Record<string, { type?: string }>;
  const required = Array.isArray(schema.required) ? schema.required : [];
  const brief: Record<string, string> = {};
  for (const k of Object.keys(props).slice(0, 10)) {
    brief[k] = props[k]?.type || "any";
  }
  return JSON.stringify({ required, properties: brief });
}

/** Texto de tools + schemas compactos para inyectar en el prompt del ciclo. */
export function toolsCatalog(
  tools: OrquestaTool[],
  opts?: { maxTools?: number; query?: string }
): string {
  if (!tools.length) return "(No hay servidores MCP configurados o conectados.)";

  const picked = selectTools(tools, opts);
  const lines = picked.map((t) => {
    const desc = (t.description || "").replace(/\s+/g, " ").trim().slice(0, 80);
    const schema = schemaDigest(t.inputSchema);
    return `- ${t.fullName}${desc ? ` — ${desc}` : ""}\n  schema: ${schema}`;
  });

  const omitted = tools.length - picked.length;
  let out = lines.join("\n");
  if (omitted > 0) {
    out += `\n\n(${omitted} tools más disponibles por nombre si las conoces.)`;
  }
  return (
    out +
    "\n\nProtocolo (una o más por mensaje):\n" +
    '<tool_call>{"name":"create_document","arguments":{"title":"..."}}</tool_call>\n' +
    "También vale name corto sin prefijo de servidor. Docs: documentId real; get_document_structure antes de índices."
  );
}
