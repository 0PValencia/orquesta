# Auditoría de Calidad del Dataset

Fecha: 2026-08-02  
Alcance: `dataset_proyectos`, `dataset_temas`, `dataset_razonamiento`, `dataset_mcp_google_docs`  
Estado: **bloqueantes CJK/PII corregidos**; sigue siendo semilla (volumen/cobertura limitados)

### Remediación aplicada (2026-08-02)
- CJK eliminado en `proyectos` L9/L15 y `temas` L16
- PII de portada anonimizado (`proyectos` L1): integrantes, códigos, docente e institución cliente ficticios
- Universidad/facultad/materia se conservan: forman parte de la plantilla del dominio

---

## Veredicto

El dataset está bien estructurado (JSON válido, claves consistentes, sin duplicados exactos de instruction/output).  
**Resuelto:** contaminación CJK y PII real.  
**Pendiente para entrenar bien:** volumen, huecos de cobertura (sin más PDFs fuente → requiere síntesis), y contrato de salida vs schema.

---

## 1. Validación mecánica

| Archivo | Filas | JSON válido | Claves `instruction/input/output` | Outputs vacíos | Duplicados exactos |
|---------|------:|:-----------:|:---------------------------------:|:--------------:|:------------------:|
| `dataset_proyectos.jsonl` | 32 | Sí | Completas | 0 | 0 |
| `dataset_temas.jsonl` | 38 | Sí | Completas | 0 | 0 |
| `dataset_razonamiento.jsonl` | 12 | Sí | Completas | 0 | 0 |
| `dataset_mcp_google_docs.jsonl` | 15 | Sí | Completas | 0 | 0 |
| **Total** | **97** | | | | |

Near-duplicates (Jaccard ≥ 0.55 sobre outputs): **ninguno**.

Solapamiento n-gram con `proyecto1.txt`: bajo (outputs generalizados, no copia literal del PDF). Buena señal.

---

## 2. Hallazgos bloqueantes

### B1. Contaminación de idioma (CJK) — CORREGIDO

| Archivo | Línea | Antes | Después |
|---------|------:|-------|---------|
| `dataset_proyectos.jsonl` | 9 | `泳道 (swim lanes)` | `andariveles (swimlanes)` |
| `dataset_proyectos.jsonl` | 15 | `El sistema预计将 reducir` | `Se espera que el sistema reduzca` |
| `dataset_temas.jsonl` | 16 | `flujos,泳道` | `flujos, andariveles (swimlanes)` |

### B2. PII real — CORREGIDO

| Archivo | Línea | Cambio |
|---------|------:|--------|
| `dataset_proyectos.jsonl` | 1 | Integrantes/códigos/docente/UE cliente → datos ficticios |

El email `juan.perez@email.com` (L14) es sintético → aceptable.

### B3. Volumen insuficiente — PENDIENTE

~97 ejemplos totales (~70 de contenido útil para informes).  
No hay más informes PDF de origen. Ampliar cobertura implica **síntesis** desde la style guide (mismos patrones, dominios nuevos), no extracción.

Para un modelo pequeño especializado: objetivo inicial 300–800 pares de sección.

---

## 3. Hallazgos importantes (calidad / diseño)

### I1. Contrato de salida inconsistente

| Dataset | Tipo de `output` | Schema |
|---------|------------------|--------|
| proyectos | `string` (texto libre) | `schema_proyectos.json` espera objeto anidado |
| temas | `string` | schema jerárquico |
| razonamiento | `object` | alineado |
| mcp_google_docs | `object` | alineado |

**Riesgo:** el modelo aprenderá prosa libre, no un contrato estable para el MCP.  
**Recomendación:** decidir un contrato único:

- Opción A (recomendada): `output` = JSON tipado por sección (`section_id`, `heading`, `body`, `tables`, `figures`)
- Opción B: texto libre + parser post-hoc (más frágil)

### I2. Huecos de cobertura vs style guide (proyectos)

Secciones de la plantilla **sin ejemplo dedicado en `instruction`**:

| Sección | Estado |
|---------|--------|
| Índice | Ausente como tarea |
| Antecedentes | Solo aparece embebido, sin ejemplo propio |
| Formulación del problema | Ausente como tarea |
| Marco teórico | **Ausente** |
| Ishikawa (capítulo completo) | Solo menciones; sin ejemplo de sección |
| Captura de requisitos (actores, priorización parcial) | Parcial |
| Implementación (Cap. 5) | Ausente como tarea |
| Anexos | Ausente |
| Informe completo extremo a extremo | Ausente |

Cobertura fuerte: portada, intro, justificación, objetivos, problema, alcance, CU, SQL, triggers, pruebas, conclusiones, recomendaciones, bibliografía, perfil oficial.

### I3. Estilo de encabezados inconsistente

En `proyectos`, los outputs mezclan:

- `ALLCAPS` (`CONCLUSIONES`)
- numerados (`2. ELEMENTOS DEL SISTEMA...`)
- prosa sin encabezado (intro/justificación L2–L3)
- tablas markdown / comentarios SQL

La style guide define un orden y numeración; el dataset no lo refuerza de forma uniforme. El modelo aprenderá estilos mezclados.

### I4. Inputs a veces demasiado pobres

Varios ejemplos tienen solo 1–2 claves (`references`, `entities/relationships`).  
Funciona para tareas locales, pero no enseña a conditioning rico (dominio + restricciones + audiencia).

### I5. Dominios sesgados

Dominios recurrentes: cafetería, escolar, inventario, taller/motos, condominio.  
Faltan dominios distintos para generalizar (salud, logística, RRHH, biblioteca, etc.) manteniendo la misma estructura.

### I6. Datasets auxiliares mezclables demasiado pronto

`razonamiento` y `mcp_google_docs` están bien formados, pero:

- Razonamiento enseña **pipeline de dataset**, no generación de informes.
- MCP enseña **orquestación de tools**, no redacción.

**No deben mezclarse en la misma fase 1 de fine-tuning** del generador de informes.

---

## 4. Lo que está bien (conservar)

1. Formato Alpaca-like consistente (`instruction` / `input` / `output`).
2. Variedad de tareas de sección (no solo “genera el informe completo”).
3. Generalización de dominio (no copia literal del PDF fuente).
4. Style guides detalladas y alineadas a la plantilla oficial del curso.
5. Schemas de razonamiento y MCP coherentes con sus outputs.
6. Separación conceptual contenido vs formato visual (README).

---

## 5. Split recomendado (cuando se entrene)

No hacer split aleatorio por línea. Agrupar por **familia de tarea** y por **dominio**:

| Split | Proyectos | Temas | Razonamiento | MCP | Uso |
|-------|----------:|------:|-------------:|----:|-----|
| train | 24 | 28 | 0* | 0* | Fine-tune fase 1 |
| val | 4 | 5 | — | — | Early stopping |
| test / holdout | 4 | 5 | — | — | Evaluación humana |

\* Razonamiento y MCP → fases 4–5, con su propio split.

Regla: si dos ejemplos comparten el mismo dominio+sección, no poner ambos en train y test.

---

## 6. Checklist de remediación (orden)

1. [x] Corregir CJK en L9 y L15 (proyectos) y L16 (temas)
2. [x] Anonimizar PII de portada L1
3. [ ] Unificar convención de encabezados según style guide
4. [ ] Definir contrato de salida (texto vs JSON seccionado)
5. [ ] Añadir ejemplos faltantes por **síntesis** (sin PDFs nuevos): antecedentes, formulación, marco teórico, Ishikawa, implementación, anexos, índice
6. [ ] Expandir a ≥300 ejemplos de sección con dominios nuevos (sintético)
7. [x] Crear `train.jsonl` / `val.jsonl` / `test.jsonl` → `training/data/`
8. [x] Montar pipeline de fine-tuning → `training/` (modelo a elegir al entrenar)

---

## 7. Métricas rápidas post-fix

- 0 caracteres CJK / scripts no latinos en corpus de informes
- 0 PII real (nombres/códigos de personas)
- ≥1 ejemplo por sección del orden obligatorio (1–19 de la style guide)
- 100% outputs parseables al contrato elegido
- Diversidad: ≥8 dominios distintos en proyectos
