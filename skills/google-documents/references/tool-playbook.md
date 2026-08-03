# Playbook de tools — Google Documents MCP

## Regla documentId

- Fuente válida: respuesta de `create_document`, `list_documents`,
  `generate_academic_document`, o metadata previa.
- Si falta: `list_documents` o preguntar al usuario el enlace/id.
- Nunca inventar.

## Índices UTF-16

Los `startIndex` / `endIndex` cambian con cada insert/delete.

```text
get_document_structure
→ mutación
→ get_document_structure (otra vez)
→ siguiente mutación
```

## Escritura larga

| Mal | Bien |
|-----|------|
| Un `append_text` de 50k chars | Secciones en turnos |
| `# Introducción` en texto | `Introducción` + `apply_heading` |
| Bib pegada como bullets | `append_bibliography` |
| `pages=20` y dar por hecho | Andamiaje + rellenar |
| Índices viejos | Releer siempre |

## create_academic_structure

Crea portada centrada + saltos + headings reales según tipo
(monografía / tesis / investigación). Preferible a markdown.

## generate_academic_document

`pages` solo andamiaje. El contenido se escribe después.

## append_bibliography

```json
{
  "documentId": "…",
  "entries": [
    { "title": "…", "url": "https://…", "authors": ["…"], "year": "2024" }
  ]
}
```

Entradas con URLs reales (de search). No inventar DOI/autores.

## Tablas

- `create_table(rows, columns, index, data?)` — máx. ~50×20 por llamada.
- Índices de tabla desde `get_document_structure` (`tableStartIndex`).

## Imágenes y diagramas

1. `search_images` (Commons / licencias libres)
2. `insert_image` con `insertUrl` **exacta**
3. Fallback: `rehostViaDrive=true`
4. Mermaid: `insert_diagram`
5. Reemplazo: `list_images` → `objectId` → `replace_image`

## Orquestación

```text
ANALIZAR → PLANIFICAR → EJECUTAR (1 mutación) → VERIFICAR → CHECKPOINT
```

Checkpoint: `create_document_revision` antes de operaciones destructivas.

## Anti-patrones

1. Tools sin `documentId`
2. Índices inventados
3. Dump masivo con `append_text`
4. Reusar índices post-mutación
5. URLs de imagen inventadas
6. Confiar en `pages` para contenido
7. No verificar (`read_document` / `count_words`)
8. Saltar `repair_academic_document` tras LLM
9. Editar sin checkpoint en operaciones grandes
10. Declarar “listo” con `headings=[]` o `#` en títulos
