---
name: google-documents
description: >-
  Orquesta el MCP Google Documents (documentId, estructura, escritura por
  secciones, headings reales, bibliografía, tablas, imágenes). Usar cuando el
  usuario pida crear/editar Google Docs, Documents, informes en Docs, o tools
  como create_document, append_text, apply_heading, get_document_structure.
---

# Google Documents (MCP)

Skill operativa para agentes que usan el servidor MCP **google-documents** (o
equivalente). Objetivo: Docs reales, bien formateados, sin alucinaciones de
`documentId` ni títulos markdown.

## Cuándo activar

- Pedidos con: Google Docs, Documents, documento remoto, `documentId`, enlace
  `docs.google.com`
- Crear/editar informes académicos **en** Docs
- Auditar o reparar un Doc existente vía MCP

## Reglas de oro (no negociables)

1. **Toda tool exige `documentId`** (string del Doc, no inventar, no URL cruda
   como id a menos que la tool lo acepte y lo normalice).
2. **Índices solo de `get_document_structure`**. Tras cada mutación, **releer**.
3. **Nunca** escribir títulos con `#` / `##` en el cuerpo. El estilo lo pone
   `apply_heading` (HEADING_1/2/3).
4. **`pages` no rellena contenido**: andamiaje vacío ≠ informe.
5. **No inventar URLs** de imágenes ni bibliografía.

## Flujo canónico (informe en Docs)

```text
1. (Opcional) search / fetch → fuentes reales
2. create_document(title)  → guardar documentId + URL
3. create_academic_structure  O  generate_academic_document (solo andamiaje)
4. Por sección:
   get_document_structure → insert_text / append_text (párrafos densos, sin #)
5. get_document_structure → apply_heading (solo renglón del título, ≤120 chars)
6. append_bibliography(entries[]) con URLs reales
7. insert_table_of_contents (si aplica)
8. format_academic_document / repair_academic_document
9. read_document + count_words → verificar
10. create_document_revision + get_document_metadata → entregar enlace
```

### Densidad mínima (informes)

- Preferir **varias** escrituras por sección (≥3 párrafos densos).
- Evitar un único `append_text` gigante que destroza la estructura.
- Tras escribir: verificar `headings` no vacíos y sin `#` literal en títulos.

## Tools por categoría

| Categoría | Tools típicas |
|-----------|----------------|
| Identidad | `list_documents`, `create_document`, `get_document_metadata`, `duplicate_document` |
| Lectura | `read_document`, `get_document_structure`, `get_range_content`, `find_text`, `count_words` |
| Escritura | `append_text`, `insert_text`, `replace_text`, `delete_text` |
| Estructura académica | `create_academic_structure`, `generate_academic_document`, `apply_heading`, `apply_format`, `format_academic_document`, `repair_academic_document` |
| Bib / TOC | `append_bibliography`, `insert_citation`, `create_footnote`, `insert_table_of_contents` |
| Tablas | `create_table`, `insert_table_row`, `delete_table_row`, `merge_table_cells`, … |
| Imágenes | `search_images` → `insert_image` (`insertUrl` exacta), `list_images`, `replace_image`, `insert_diagram` |
| Control | `create_document_revision`, `list_revisions`, permisos |

Detalle y anti-patrones: [references/tool-playbook.md](references/tool-playbook.md).  
Checklist de entrega: [references/qa-checklist.md](references/qa-checklist.md).

## Protocolo de tool_call (si el runtime usa texto)

```xml
<tool_call>
{"name":"create_document","arguments":{"title":"Título del informe"}}
</tool_call>
```

- Una o más tools por turno; **nunca** simular resultados.
- Si el runtime no ejecutó la tool, **no** digas que el Doc existe.
- Prohibido inventar `documentId` tipo `document_id_here`.

## apply_heading (crítico)

- Solo sobre el **párrafo-título** corto (`endIndex - startIndex` ≤ ~120).
- Nunca HEADING sobre cuerpo, URLs o bibliografía entera.
- Tras `append_text` con título plano (`Introducción\n\n…`), localizar índices
  frescos y aplicar `HEADING_1`.

## Imágenes

```text
search_images → insert_image(insertUrl=<exacta de search>)
```

Si Docs no puede fetch: `rehostViaDrive=true`. Diagramas: `insert_diagram` (Mermaid).

## Respuesta al usuario

Al terminar: **enlace**, `documentId`, qué tools de formato usaste
(`apply_heading`, bib, TOC), y qué quedó pendiente. Sin pegar el informe entero.

## Combinar con informe-angelica

Si el contenido es un proyecto SI I / UAGRM / Angélica, **leer también** la
skill `informe-angelica` para estructura, tono y secciones, y usar **esta**
skill para materializarlo en Docs.
