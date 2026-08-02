# Dataset para Entrenamiento de Modelo de Generación de Informes

## Descripción General

Este dataset contiene material extraído de informes académicos y material de enseñanza, diseñado para entrenar un modelo especializado en la generación de informes profesionales y académicos.

## Estructura del Dataset

```
dataset/
├── proyectos/
│   ├── extracted_text/          # Texto extraído de PDFs
│   │   ├── proyecto1.txt        # 11,578 líneas
│   │   ├── proyecto2.txt        # 6,571 líneas
│   │   ├── proyecto3.txt        # 12,369 líneas
│   │   ├── proyecto4.txt        # 4,929 líneas (duplicado de proyecto5)
│   │   ├── proyecto5.txt        # 4,929 líneas (duplicado de proyecto4)
│   │   ├── proyecto6.txt        # 7,625 líneas
│   │   ├── proyecto7.txt        # 5,816 líneas
│   │   ├── proyecto8.txt        # 5,793 líneas
│   │   └── proyecto9.txt        # 5,793 líneas (duplicado de proyecto8)
│   ├── docx/                    # Fuentes originales de proyectos 1-3
│   │   ├── proyecto1.docx       # Original (texto idéntico al PDF)
│   │   ├── proyecto2.docx
│   │   ├── proyecto3.docx
│   │   └── extracted_text/      # Texto extraído de los docx (para verificación cruzada)
│   ├── style_guide_proyectos.md # Guía de estilo completa (incluye plantilla oficial del perfil)
│   ├── schema_proyectos.json    # Esquema JSON del informe
│   └── dataset_proyectos.jsonl  # Dataset de entrenamiento (32 ejemplos)
│
├── temas/
│   ├── extracted_text/          # Texto extraído de PDFs y presentaciones
│   │   ├── teoria_general_sistemas.txt      # 7,297 líneas
│   │   ├── paradigmas_ciclos_vida.txt       # 1,094 líneas
│   │   ├── diagrama_espina.txt              # 177 líneas
│   │   ├── teoria_sistemas_clase.txt        # 335 líneas
│   │   ├── puds_proceso_unificado.txt       # 0 líneas (PDF escaneado)
│   │   ├── uml2.txt                        # 96 diapositivas (UML completo)
│   │   ├── diagramas_actividad.txt         # 28 diapositivas (Diagramas de Actividad)
│   │   ├── perfil_proyecto_sistemas.txt    # 39 diapositivas (Perfil de Proyecto + Teoría de Sistemas)
│   │   └── modelo_negocio.txt             # 0 líneas (solo imagen EMF; texto extraído del binario)
│   ├── pdf/ ppt/ pptx/ docx/   # Documentos fuente organizados por formato
│   ├── analysis/nuevos_documentos.md  # Análisis de docx/ppt/pptx/docx nuevos
│   ├── style_guide_temas.md     # Guía de estilo para material educativo
│   ├── schema_temas.json        # Esquema JSON para temas
│   └── dataset_temas.jsonl      # Dataset de entrenamiento (38 ejemplos)
│
├── razonamiento/
│   ├── style_guide_razonamiento.md  # Guía: pensar, planificar, verificar, retroalimentación
│   ├── schema_razonamiento.json     # Esquema: thinking/plan/actions/verification/result
│   └── dataset_razonamiento.jsonl   # Dataset de trazas de razonamiento (12 ejemplos)
│
├── mcp_google_docs/
│   ├── style_guide_mcp_google_docs.md  # Guía de uso correcto del MCP de Google Docs
│   ├── schema_mcp_google_docs.json     # Esquema: reasoning/tool_sequence/rules/result
│   └── dataset_mcp_google_docs.jsonl   # Dataset de orquestación de tools MCP (15 ejemplos)
│
└── README.md                    # Este archivo
```

## Resumen de Análisis

### Dataset de Proyectos

**Tipo de documento**: Informes de proyecto académico para la materia "Sistemas de Información I"

**Estructura estándar detectada**:
1. Portada (universidad, facultad, grupo, título, integrantes)
2. Índice
3. Perfil (Introducción, Antecedentes, Justificación, Descripción del Problema, Formulación del Problema, Objetivos, Alcance)
4. Elementos del Sistema Basado en Computadoras
5. Tecnología para el Desarrollo del Software
6. Posibles Costos/Beneficios/Clientes
7. Marco Teórico
8. Capítulos PUDS (Ishikawa, Captura de Requisitos, Análisis, Diseño, Implementación, Pruebas)

**Metodología utilizada**:
- PUDS (Proceso Unificado de Desarrollo de Software)
- UML (Lenguaje Unificado de Modelado)
- Método de Ishikawa (Diagrama de Causa-Efecto)

**Estadísticas clave**:
- Total de documentos: 9 (3 son duplicados)
- Documentos únicos: 6
- Casos de uso promedio: 25-28 por proyecto
- Tablas SQL promedio: 20-30 por proyecto
- Casos de prueba promedio: 6-8 por proyecto

### Dataset de Temas

**Tipo de documento**: Material académico de enseñanza (libros, presentaciones, apuntes de clase, documentos de diagramas)

**Temas cubiertos**:
1. Teoría General de Sistemas (libro completo)
2. Paradigmas y Ciclos de Vida del Software
3. Diagrama de Ishikawa (Espina de Pescado)
4. Sistemas de Información y Métodos de Desarrollo
5. UML (Lenguaje Unificado de Modelado) — presentación de 96 diapositivas
6. Diagramas de Actividad — presentación de 28 diapositivas + modelo de inscripción (docx)
7. Perfil de Proyecto y Teoría de Sistemas — presentación de 39 diapositivas (plantilla oficial del curso)

**Características**:
- Definiciones formales con ejemplos
- Clasificaciones y comparaciones
- Procesos paso a paso
- Diagramas y figuras de apoyo
- Presentaciones con ejercicios (UML: ejercicios 3-10; actividad: solitario, pasaje aéreo)

## Datasets de Entrenamiento

### dataset_proyectos.jsonl (32 ejemplos)

Cada registro contiene:
- `instruction`: Tarea específica a realizar
- `input`: Contexto y datos de entrada
- `output`: Contenido generado (informe completo o sección)

**Tipos de tareas**:
- Generar portadas
- Redactar introducciones
- Crear justificaciones
- Definir objetivos
- Describir problemas
- Especificar casos de uso
- Crear diagramas de actividades
- Generar scripts SQL
- Crear procedimientos almacenados
- Diseñar triggers
- Crear casos de prueba
- Redactar conclusiones
- Generar recomendaciones
- Crear referencias bibliográficas
- Diseñar esquemas de base de datos
- Generar la estructura del perfil según plantilla oficial (6 ejemplos nuevos basados en la presentación "PERFIL DE PROYECTO Y SISTEMAS": estructura 1.1-1.8, plantilla de entrevista, elementos del sistema basado en computadoras, tecnología para el desarrollo, costos/beneficios/clientes y alcance)

### dataset_temas.jsonl (38 ejemplos)

**Tipos de tareas**:
- Definir conceptos
- Explicar diferencias
- Crear glosarios
- Comparar modelos
- Describir procesos
- Explicar metodologías
- Crear guías prácticas
- Definir UML y clasificar sus diagramas (18 ejemplos nuevos basados en las presentaciones UML2, Diagramas de Actividad y PERFIL DE PROYECTO Y SISTEMAS, y el modelo de inscripción en docx)

### dataset_razonamiento.jsonl (12 ejemplos)

**Objetivo**: Enseñar al modelo a razonar antes de actuar (estilo agentes tipo DeepSeek).

Cada registro contiene una traza completa:
- `thinking`: análisis de la tarea, objetivos, alternativas y estrategia
- `plan`: pasos con resultado esperado y dependencias
- `actions`: herramientas usadas, parámetros y análisis del resultado
- `verification`: qué se comprobó, cómo, resultado y correcciones
- `result`: salida final

**Patrones cubiertos**:
- Planificar antes de ejecutar
- Estrategia de búsqueda (amplia → específica → verificación)
- Bucles verificar-corregir y de calidad
- Detección y manejo de duplicados (hash + diff)
- Selección de herramientas por criterio (disponibilidad, dependencias)
- Paralelización de fases independientes
- Validación de JSONL (wc -l, json.tool, claves requeridas)
- Manejo de errores de índice tras mutaciones
- Cuándo preguntar al usuario (ambigüedad de alto impacto)

### dataset_mcp_google_docs.jsonl (15 ejemplos)

**Objetivo**: Enseñar la orquestación correcta de las tools del MCP de Google Documents.

Cada registro contiene:
- `reasoning`: por qué se usan esas tools y en ese orden
- `tool_sequence`: pasos con tool, parámetros y propósito
- `rules_applied`: reglas del servidor que se aplicaron
- `result`: resultado de la operación

**Patrones cubiertos**:
- documentId obligatorio en toda llamada
- get_document_structure antes de editar (nunca inventar índices UTF-16)
- Releer estructura tras cada mutación (índices inestables)
- pages NO rellena contenido: escribir por secciones con presupuesto de palabras
- Un capítulo por turno en informes largos
- search_images → insert_image (no inventar URLs) + rehostViaDrive para CORS
- insert_diagram con fuente Mermaid
- create_table con data en celdas + filas de encabezado fijas
- insert_citation / create_footnote / append_bibliography
- repair_academic_document para Docs generados por LLM
- format_academic_document (APA 7 / IEEE / Vancouver)
- insert_table_of_contents para regenerar el índice
- create_document_revision como checkpoint
- get_range_content en lugar de read_document completo
- export_document para entrega en PDF/DOCX

## Guías de Estilo

### style_guide_proyectos.md

Contiene reglas detalladas para:
- Estructura del documento
- Formato por sección
- Plantillas de casos de uso
- Formato de tablas y figuras
- Convenciones de nomenclatura
- Errores comunes a evitar

### style_guide_temas.md

Contiene reglas para:
- Tipos de documentos educativos
- Estructura de definiciones
- Formato de comparaciones
- Procesos paso a paso
- Estilo de escritura académica

### style_guide_razonamiento.md

Contiene reglas para:
- Principios: planificar, pensar, verificar
- Patrones de búsqueda (cuándo, cómo, evaluación)
- Bucles de retroalimentación (verificar-corregir, calidad, exploración)
- Estructura de trazas de razonamiento
- Manejo de errores (herramienta, datos, expectativa)
- Antipatrones a evitar y checklist de calidad

### style_guide_mcp_google_docs.md

Contiene reglas para:
- documentId obligatorio en toda tool
- get_document_structure antes de editar (índices UTF-16 inestables)
- Playbook de informes largos (andamiaje → contenido por turnos → índice)
- Imágenes (search_images, rehostViaDrive) y diagramas Mermaid
- Tablas (create_table con data, columnas, filas fijas)
- Verificación (read, ranges, find_text, count_words) y checkpoints
- Anti-patrones del servidor y orquestación típica de informe completo

## Esquemas JSON

### schema_proyectos.json

Esquema completo que representa:
- Metadata del proyecto
- Perfil del informe
- Elementos del sistema
- Tecnología utilizada
- Análisis de Ishikawa
- Casos de uso detallados
- Base de datos
- Casos de prueba

### schema_temas.json

Esquema para material educativo:
- Metadata del documento
- Estructura jerárquica
- Definiciones
- Conceptos
- Clasificaciones
- Procesos
- Ejemplos

### schema_razonamiento.json

Esquema de trazas de razonamiento:
- `instruction`: tarea solicitada
- `input`: contexto, restricciones y recursos
- `output`: thinking, plan (pasos con resultado esperado), actions, verification y result

### schema_mcp_google_docs.json

Esquema de orquestación de tools:
- `instruction`: tarea con Google Docs
- `input`: tarea, documentId, estado del documento y restricciones
- `output`: reasoning, tool_sequence (step, tool, params, purpose), rules_applied y result

## Recomendaciones para Entrenamiento

> Pipeline listo en [`../training/`](../training/README.md): Colab + Qwen2.5-7B-Instruct (QLoRA).
> Notebook: [`../training/colab_sft.ipynb`](../training/colab_sft.ipynb) · Bundle: `training/colab_bundle.zip`

### Fine-tuning del Modelo

**Aspectos que deben aprenderse mediante fine-tuning**:
1. Estructura jerárquica de informes
2. Plantillas de casos de uso
3. Formato de scripts SQL
4. Convenciones de nomenclatura
5. Patrones de transición entre secciones
6. Estilo de escritura académica formal
7. Razonamiento antes de actuar (planificar, verificar, corregir) — fase posterior
8. Orquestación de tools del MCP de Google Docs (orden y verificación) — fase posterior / agente

**Qué NO debe aprenderse (dejar para MCP)**:
1. Formato visual (fuentes, colores, espaciado)
2. Inserción de imágenes y diagramas
3. Numeración automática
4. Tablas de contenido
5. Referencias cruzadas
6. Encabezados y pies de página

### Estrategia de Entrenamiento

1. **Fase 1 (activa)**: SFT LoRA con `proyectos` + `temas` → ver `training/`
2. **Fase 2**: Ampliar con secciones sintéticas (sin PDFs nuevos)
3. **Fase 3**: Entrenar con patrones de calidad / más dominios
4. **Fase 4**: Trazas de razonamiento (`dataset_razonamiento`) — agente
5. **Fase 5**: Orquestación MCP (`dataset_mcp_google_docs`) — agente
6. **Fase 6**: Validar con informes de prueba (holdout + revisión humana)

### Métricas de Éxito

- Coherencia estructural del informe
- Completitud de las secciones
- Calidad del lenguaje técnico
- Adherencia a las guías de estilo
- Consistencia en la terminología
- Corrección en la secuencia de tools MCP (sin llamadas sin documentId, sin índices inventados)
- Tasa de éxito en verificación/recuperación de errores

## Notas Técnicas

### Extracción de Texto

- Herramienta: `pdftotext` (poppler-utils) para PDFs; LibreOffice headless para docx→txt y ppt→pptx; python (zipfile+ElementTree) para extraer texto de pptx/docx por XML
- Codificación: UTF-8
- Nota: Algunos PDFs escaneados no pudieron extraerse (puds_proceso_unificado.txt)
- Nota: El filtro txt de LibreOffice no funciona para presentaciones; se convierte a pptx y se parsea el XML de diapositivas
- Nota: modelonegocio.docx contiene solo una imagen EMF sin texto; las cadenas del diagrama se extrajeron del binario (UTF-16LE)

### Duplicados Detectados

- proyecto4.pdf = proyecto5.pdf (idénticos)
- proyecto8.pdf = proyecto9.pdf (idénticos)
- Intencionalmente conservados para análisis de consistencia

### Idioma

Todo el dataset está en español (Latinoamérica), idioma de los documentos originales.

## Licencia y Uso

Este dataset es para uso exclusivo de investigación y entrenamiento de modelos de lenguaje. Los documentos originales son material académico de la Universidad Autónoma Gabriel René Moreno.

## Contacto

Para preguntas sobre el dataset, contactar al equipo de desarrollo.
