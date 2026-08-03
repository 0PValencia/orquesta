# Checklist de calidad — Docs

Antes de entregar el enlace al usuario:

- [ ] `documentId` en **todas** las llamadas
- [ ] Índices de `get_document_structure` (no inventados)
- [ ] Estructura releída tras mutaciones relevantes
- [ ] Títulos **sin** `#` / `##` en texto plano
- [ ] `apply_heading` aplicado a secciones (HEADING_1+)
- [ ] `headings` no vacío en auditoría
- [ ] Contenido real (no solo andamiaje de `pages`)
- [ ] Bibliografía vía `append_bibliography` si hay fuentes
- [ ] Imágenes con URLs de `search_images`
- [ ] TOC regenerado si el Doc lo requiere
- [ ] `count_words` / `read_document` coherente con el pedido
- [ ] `get_document_metadata` → URL compartible
- [ ] Revisión (`create_document_revision`) en trabajos grandes

## Señales de fallo

| Señal | Acción |
|-------|--------|
| `headings=[]` | `apply_heading` o `create_academic_structure` |
| Título con `#` visible | `replace_text` / reescribir + heading |
| Doc casi vacío | Más `append_text` / `insert_text` por sección |
| Bib duplicada en bullets | Limpiar + `append_bibliography` |
| documentId falso | Parar; crear/listar Doc real |
