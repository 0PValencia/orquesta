---
name: informe-angelica
description: >-
  Produce informes académicos SI I / INF 342 (UAGRM, estilo Angélica) de alta
  calidad editorial: carátula, índice real, jerarquía de headings, tablas,
  diagramas, imágenes, APA 7 y colores. Usar cuando pidan informe Angélica,
  SI I, perfil de proyecto, EduGestión-like, Ishikawa, casos de uso, o informe
  en Google Docs de sistemas. Pregunta requisitos y modo (por partes | todo).
---

# Informe Angélica (SI I) — calidad editorial

Skill de **contenido + formato de informe** para Sistemas de Información I
(INF 342, UAGRM). No alcanza con “mucho texto”: el Doc debe verse como un
informe universitario ordenado (carátula, índice clicable, tablas, figuras).

En Google Docs: **obligatorio** combinar con la skill `google-documents`.

## Benchmarks reales (3 ejemplos buenos)

Revisados en Drive (proyecto2, proyecto3, Grupo C0503 / Sonríe):

- **7 k–13 k palabras** + **31–80 imágenes** + **24–41 tablas** + **TOC real**
- Densidad típica: **~1 imagen / 160–260 palabras** y **~1 tabla / 190–540 palabras**
- Detalle: [references/benchmarks-ejemplos.md](references/benchmarks-ejemplos.md)

Un Doc largo **sin** esa densidad visual sigue siendo informe “malo”.

## Diagnóstico de informes “malos” (evitar)

Tu informe falla si ocurre esto:

| Síntoma | Qué hacer en su lugar |
|---------|------------------------|
| Pared de párrafos sin respiro | Cortar en H2/H3, listas, tablas |
| “Índice” pegado como texto | `insert_table_of_contents` (índice real) |
| Todo en HEADING_1 | Jerarquía: H1 capítulo, H2 sección, H3 sub |
| Casi sin tablas/figuras | Cumplir cuotas del benchmark (≥20 tablas / ≥25 figuras en informe completo) |
| Sin carátula centrada | Portada con logo + datos + salto de página |
| Sin APA | `format_academic_document` + bib APA 7 |
| Inventar datos de portada | **Preguntar** requisitos antes de escribir |

## Fase 0 — Intake (OBLIGATORIO antes de redactar)

Si falta algo crítico, **preguntar** (menú / choices). No inventar docente, códigos ni logos.

### A) Modo de trabajo (siempre preguntar si no lo dijeron)

1. **Por partes** (recomendado): carátula+índice+perfil → validar → luego capítulos  
2. **Todo el informe**: mismo estándar, pero por turnos internos (nunca un solo `append_text`)

### B) Requisitos de portada / identidad

Pedir (o confirmar) lo que falte:

- Título del sistema / proyecto  
- Universidad / facultad (default UAGRM + FICCT si confirman)  
- Grupo #  
- Integrantes (nombre + código)  
- Materia / sigla (default SI I / INF 342)  
- Docente (nombre exacto)  
- Gestión / ciudad  
- ¿Logo institucional? (archivo Drive / URL / `search_images`)  
- ¿Colores institucionales? (si no: azul UAGRM `#003366` títulos + negro cuerpo)

### C) Alcance del contenido

- Dominio / organización cliente  
- ¿Incluir entrevista?  
- Capítulos a generar ahora (perfil solo / hasta Ishikawa / informe completo)  
- Extensión objetivo (páginas o “completo”)  
- Fuentes reales disponibles o ¿usar búsqueda web?

**Sin A+B mínimos → no crear el Doc todavía.**

## Estándar visual (Google Docs)

1. **Carátula** (1 página): centrada, logo si hay, universidad en mayúsculas,
   título destacado con color, integrantes, materia, docente, ciudad/gestión,
   `section_break` / salto de página.
2. **Índice real**: `insert_table_of_contents` (NO lista manual). Regenerar al final.
3. **Headings**:
   - `TITLE` / portada  
   - `HEADING_1` = capítulos / bloques mayores (PERFIL, CAP. 1…)  
   - `HEADING_2` = 3.1, 3.2…  
   - `HEADING_3` = subapartados  
   - Cuerpo = `NORMAL_TEXT` (nunca H1 en ítems del índice)
4. **Tipografía APA-ish**: cuerpo ~12pt, títulos con `apply_format` (negrita + color).
5. **APA 7**: `format_academic_document` + `append_bibliography` / citas.
6. **Visuales (cuotas)**: ver [references/visuales.md](references/visuales.md) y benchmarks.
   En informe completo no basta “una figura por capítulo”: los buenos tienen
   **decenas** de UML + pantallas + tablas HW/SW/CU.
7. **Párrafos**: 4–7 líneas máx. por párrafo; luego lista o tabla si hay datos tabulares.
8. **Prohibido**: títulos con `#`, dump único de 10k+ palabras, índice falso,
   fingir “se elaboró el diagrama” sin insertarlo.

Detalle de carátula y colores: [references/caratula-y-formato.md](references/caratula-y-formato.md).  
Visuales por capítulo: [references/visuales.md](references/visuales.md).  
Estructura y longitudes: [references/estructura.md](references/estructura.md).  
Estilo de prosa: [references/estilo.md](references/estilo.md).  
Benchmarks: [references/benchmarks-ejemplos.md](references/benchmarks-ejemplos.md).

## Estructura canónica (orden — como los ejemplos)

Numeración flexible (`1.-` / `1.` / `CAP.`); el **orden de bloques** sí es fijo:

```text
PORTADA                          ← UAGRM + título SI + grupo + integrantes + INF 342
ÍNDICE (auto)                    ← insert_table_of_contents (“Contenido” / “Índice”)
1. PERFIL                        ← intro, antecedentes, justificación, problema,
                                   formulación, objetivos, alcance (+ entrevista)
2. ELEMENTOS DEL SISTEMA         ← HW / SW / Datos / Procesos / Gente / Documentos
3. TECNOLOGÍA                    ← estrategia, PUDS, UML, herramientas
   (+ posibles costos / beneficios / clientes — tablas)
4. DISEÑO DE DATOS / MODELO DE DOMINIO  ← clases, ER, volúmenes (tablas + figuras)
5. MODELO DE NEGOCIO
6. MÉTODO ISHIKAWA               ← diagrama + tablas
7. CAPTURA DE REQUISITOS         ← actores, CU, priorización, detalle
8. ANÁLISIS                      ← paquetes, CU análisis, arquitectura
9. DISEÑO                        ← secuencia/comunicación, clases, despliegue, capas
10. IMPLEMENTACIÓN / PRUEBAS     ← pantallas + tabla de pruebas (si aplica)
CONCLUSIONES · RECOMENDACIONES · BIBLIOGRAFÍA (APA 7) · ANEXOS
```

## Flujo operativo (agente)

```text
1. Intake (modo + requisitos). Bloquear si faltan datos de portada.
2. Crear Doc (create_document / create_academic_structure).
3. Armar CARÁTULA (centrado, color, logo) + salto de página.
4. Esqueleto de headings H1/H2 (sin rellenar aún) O estructura académica.
5. insert_table_of_contents.
6. format_academic_document (APA).
7. Si modo "por partes": entregar enlace del esqueleto+portada+índice y PEDIR OK.
8. Rellenar sección a sección:
   get_document_structure → insert/append → apply_heading H2/H3 →
   tablas/diagramas/imágenes → count_words.
9. Cierre: bib APA, TOC replace, repair_academic_document, revisión, URL.
```

### Modo “por partes” — entregables sugeridos

| Parte | Contenido | Checkpoint |
|-------|-----------|------------|
| P0 | Carátula + índice + esqueleto | OK usuario |
| P1 | Perfil completo + elementos + tech | OK |
| P2 | Costos/beneficios/clientes + marco | OK |
| P3 | Cap. 1–2 (Ishikawa + requisitos) | OK |
| P4 | Cap. 3–4 (análisis + diseño) | OK |
| P5 | Cap. 5–6 + cierre + bib + TOC final | Entrega |

### Modo “todo”

Misma calidad; no pedir OK entre partes, pero **sí** escribir por turnos internos (un bloque mayor por ciclo de tools). Nunca un solo pegado masivo.

## Cuotas mínimas de calidad (Definition of Done)

Antes de decir “listo” (**informe completo**):

- [ ] Carátula con datos reales (no placeholders)  
- [ ] Índice **automático** regenerado (`tableOfContents`)  
- [ ] Jerarquía H1/H2/H3 coherente (índice no está en H1 suelto)  
- [ ] **≥ 20 tablas** (HW/SW, costos/beneficios, actores, CU, datos…)  
- [ ] **≥ 25 imágenes/diagramas** insertados (UML + Ishikawa + UI/organigrama)  
- [ ] Densidad: no superar ~300 palabras por imagen de promedio  
- [ ] Ishikawa + al menos: CU, clases, y uno de {secuencia, actividad, despliegue}  
- [ ] Bibliografía APA (entradas reales o marcadas pendientes)  
- [ ] `format_academic_document` / repair ejecutados  
- [ ] No hay pared continua > ~400 palabras sin subtítulo/tabla/figura  
- [ ] Entregar **enlace** + qué partes faltan si es parcial  

**Solo perfil / parcial:** ≥3 tablas + ≥2 figuras en lo entregado; declarar cuotas globales pendientes.

## Combinar con google-documents

Esta skill decide **qué** escribir y **cómo debe verse**.  
`google-documents` decide **cómo** llamar tools (`documentId`, índices, TOC, imágenes).

## Respuesta al usuario

- Parcial: enlace + “Parte Px lista; ¿seguimos con …?”  
- Final: enlace + checklist DoD cumplido (tablas/diagramas/APA).  
- Nunca fingir UML/SQL/figuras: o se insertan o se declara pendiente.
