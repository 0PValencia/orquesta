# Guía de Estilo de Uso del MCP Google Documents

## 1. Regla de Oro: SIEMPRE documentId

- Toda tool del servidor `google-documents` exige `documentId` (string del Doc, no URL).
- Si no se tiene: `list_documents` o usar el id/URL que devolvió `create_document` / `generate_academic_document`.
- Nunca llamar `append_text`, `insert_text`, `read_document`, etc. sin `documentId`.
- Nunca inventar documentIds: se obtienen de list_documents o de respuestas previas.

---

## 2. Antes de Editar: get_document_structure

- Nunca inventar startIndex/endIndex.
- Todo índice se obtiene de `get_document_structure` (bloques con startIndex/endIndex, estilos y encabezados).
- Los índices son UTF-16 del Docs API y CAMBIAN con cada mutación:
  - Tras insertar/borrar texto, los índices posteriores se desplazan.
  - Regla: releer la estructura antes de cada edición por índices.
- Para insertar imágenes y tablas: el índice se ubica dentro de un párrafo del body.

### Orden estándar de operación sobre un Doc existente
```
1. get_document_structure (o read_document) → conocer estado actual
2. Localizar el bloque objetivo por su texto/encabezado
3. Ejecutar la mutación (insert_text, insert_image, create_table...)
4. Releer estructura para confirmar y obtener índices frescos
5. Repetir para la siguiente mutación
```

---

## 3. Escritura de Informes Largos (long_report_playbook)

### 3.1. `pages` NO rellena contenido
- `generate_academic_document(pages=N)` solo crea el andamiaje (portada + secciones vacías + índice).
- Para el contenido real: escribir por secciones con `insert_text` tras `get_document_structure`.

### 3.2. Estrategia por turnos
- Un capítulo/sección por turno (no dumps masivos con append_text).
- Presupuesto de palabras por sección definido ANTES de escribir.
- Usar `insert_text` por sección tras localizar el índice del encabezado.

### 3.3. Estructura recomendada
1. `create_document` / `generate_academic_document` → andamiaje
2. `create_academic_structure` (monografía/tesis/investigación) → portada centrada + salto de página + encabezados reales
3. Rellenar por secciones (un turno por capítulo)
4. `insert_table_of_contents` → regenera el índice desde HEADING_1-3
5. `append_bibliography` / `append_text` final → bibliografía
6. `format_academic_document` → APA 7/IEEE/Vancouver real (si corresponde)
7. `repair_academic_document` → corrige fallos de LLM (capítulos sueltos, tablas Markdown, andamiaje vacío)

### 3.4. Formato y encabezados
- Encabezados reales: `apply_heading` (TITLE, HEADING_1, HEADING_2, HEADING_3, NORMAL_TEXT).
- Formato: `apply_format` (negrita, cursiva, fuente, tamaño, alineación, interlineado, sangría).
- Negrita con `set_bold`, cursiva con `set_italic`, enlaces con `set_link`.
- Listas: `create_paragraph_bullets` con presets (BULLET_* o NUMBERED_*).

---

## 4. Imágenes y Diagramas

- NUNCA inventar URLs de imágenes.
- Flujo correcto: `search_images` (Wikimedia Commons, licencias libres) → `insert_image` con la insertUrl devuelta.
- Si Docs no puede hacer fetch (CORS/bloqueo): `insert_image(rehostViaDrive=true)` para subir a Drive y reinsertar.
- Diagramas: `insert_diagram` con fuente Mermaid (flowchart, sequence, class, er...) — se renderiza vía mermaid.ink y se rehostea en Drive.
- Reemplazar imagen existente: `list_images` → objectId → `replace_image`.

---

## 5. Tablas

- `create_table(rows, columns, index)` — pasar `data:[[celda,...],...]` si se quiere contenido (si no, queda grilla vacía).
- Índices de tabla: vienen de `get_document_structure` (tableStartIndex).
- Operaciones: insertar/borrar filas y columnas (`insert_table_row`, `delete_table_column`...), fusionar (`merge_table_cells`), fijar filas de encabezado (`pin_table_header_rows`), estilos (`update_table_cell_style`, `update_table_column_width`).
- Máximo 50 filas / 20 columnas por llamada.

---

## 6. Verificación y Checkpoints

### 6.1. Lectura y conteo
- `read_document` → texto plano completo.
- `get_range_content(startIndex, endIndex)` → solo un rango.
- `find_text(query)` → ocurrencias con índices.
- `count_words` → estadísticas (verificar extensión objetivo).
- `get_document_metadata` → título, propietarios, enlace.

### 6.2. Checkpoints
- `create_document_revision(revisionName)` → marca la revisión actual como keepForever (punto de control).
- `list_revisions` / `get_revision` → historial.
- Antes de operaciones destructivas: guardar revisión.

### 6.3. Notas al pie, citas y bibliografía
- `create_footnote(index, text)` → nota al pie.
- `insert_citation(index, citationKey, style)` → marcador de cita (APA7/IEEE/Vancouver).
- `append_bibliography(entries)` → entradas al final (usa entradas válidas, no inventar referencias).

---

## 7. Anti-Patrones (EVITAR — del guide anti-patterns)

1. Llamar tools sin documentId
2. Inventar índices sin get_document_structure previo
3. Usar append_text masivo para informes largos (rompe estructura y presupuestos)
4. Reutilizar índices obsoletos tras una mutación
5. Inventar URLs de imágenes en insert_image
6. Confiar en `pages` para rellenar contenido
7. No verificar tras mutar (leer siempre de vuelta)
8. Saltarse repair_academic_document cuando el Doc viene de un LLM
9. Editar sin checkpoint antes de operaciones grandes

---

## 8. Orquestación (tool_orchestration)

### Patrón general
```
1. ANALIZAR: get_document_structure / read_document → conocer el Doc
2. PLANIFICAR: decidir secuencia de tools (dependencias entre mutaciones)
3. EJECUTAR: mutaciones una por una, releer estructura entre cada una
4. VERIFICAR: find_text / get_range_content / count_words
5. CHECKPOINT: create_document_revision al cerrar una sección grande
```

### Secuencia típica de creación de informe
1. `create_document(title)`
2. `create_academic_structure(type=..., title, author, institution, date)`
3. Rellenar secciones: `get_document_structure` → `insert_text` (turno por capítulo)
4. `apply_heading` + `apply_format` para jerarquía y estilo
5. `create_table` con data para tablas de contenido
6. `insert_diagram` para figuras
7. `insert_table_of_contents` (regenera el índice)
8. `append_bibliography`
9. `format_academic_document` / `repair_academic_document`
10. `create_document_revision` + `get_document_metadata` para entregar el enlace

---

## 9. Checklist de Calidad

- [ ] ¿documentId presente en TODAS las llamadas?
- [ ] ¿Índices obtenidos de get_document_structure (no inventados)?
- [ ] ¿Estructura releída tras cada mutación?
- [ ] ¿Imágenes con URLs de search_images (no inventadas)?
- [ ] ¿Informe largo escrito por secciones, no con append_text masivo?
- [ ] ¿Contenido real escrito (pages no rellena)?
- [ ] ¿Índice (TOC) regenerado con insert_table_of_contents?
- [ ] ¿Verificación final con read_document/count_words/find_text?
- [ ] ¿Checkpoint con create_document_revision antes de cerrar?
- [ ] ¿Documento reparado (repair_academic_document) si vino de un LLM?
