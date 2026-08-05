# Carátula y formato visual — Angélica / SI I

Basado en portadas reales (proyecto2, Grupo C0503 / Sonríe).

## Carátula (una página)

Orden tipográfico (centrado), alineado a los ejemplos:

1. Logo UAGRM / facultad **o** logo de la organización cliente — `insert_image`  
2. `UNIVERSIDAD AUTÓNOMA GABRIEL RENÉ MORENO` (mayúsculas)  
3. Facultad (FICCT u oficial que indiquen) — opcional si no la piden  
4. Espacio  
5. **TÍTULO DEL SISTEMA** (negrita, color institucional, 16–18 pt)  
6. Nombre corto / marca del sistema entre comillas si aplica (`“SONRIE”`)  
7. `Grupo “X”` / `GRUPO: X`  
8. `Integrantes:` (nombre — código), uno por línea  
9. `Materia: Sistemas de Información I` · `Sigla: INF 342`  
10. `Docente: Ing. …` (nombre exacto)  
11. `Semestre` / gestión si la dan  
12. `Santa Cruz – Bolivia`  
13. **Salto de página** → índice  

### Variantes vistas

- Portada 100 % tipográfica (proyecto2).  
- Portada con logo/ícono + título largo del SI (Grupo C0503).  
- Algunos Docs heredan carátula como imagen de Word: preferir **texto editable** + logo.

### Tools típicas

- Texto: `append_text` / `insert_text` + `set_alignment_center` / `apply_format`  
- Título: color `#003366` (o el que pidan), bold, size 16–18  
- Universidad: bold, size 12–14  
- Logo: URL/Drive del usuario o `search_images` → `insert_image`  

No inventar logo ni códigos de estudiante.

## Índice

- Título “Contenido” o “Índice” en texto normal.  
- Luego `insert_table_of_contents` (y `replaceSection: true` al regenerar).  
- Prohibido pegar el índice como lista de párrafos.  
- Primero headings reales → después TOC.

## Página y márgenes (ejemplos)

| Parámetro | Valor típico |
|-----------|--------------|
| Tamaño | A4 (595 × 842 pt) |
| Márgenes | ~70.85 pt (2.5 cm) o 72 pt |
| Header/footer | activos; nº de página desde 1 |
| Modo | PAGES |

## Colores y tipografía

| Elemento | Sugerencia |
|----------|------------|
| H1 | Negrita, color institucional, 14–16 pt |
| H2 | Negrita, institucional o gris oscuro, 12–13 pt |
| H3 | Negrita, negro, 12 pt |
| Cuerpo | Negro, 12 pt, interlineado 1.15–1.5 |
| Tablas | Encabezado bold; fondo suave si la tool lo permite |

`format_academic_document` (APA 7) después del esqueleto; reaplicar si se degrada.

## APA 7

- Citas en texto cuando haya fuente real.  
- `append_bibliography` con entries válidas.  
- Sin fuentes: Bibliografía + “Pendiente de contrastar” — no inventar.

## Anti-patrones de formato

- Portada alineada a la izquierda  
- Índice manual desincronizado  
- Solo H1 en cascada (índice falso)  
- Cuerpo en color chillón  
- Figuras sin pie ni referencia en el texto  
- Informe “completo” con < 10 figuras (contra benchmark)
