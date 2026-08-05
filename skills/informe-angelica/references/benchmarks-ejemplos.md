# Benchmarks — ejemplos reales “bien hechos” (INF 342)

Fuente: 3 Google Docs de proyectos aprobados / de referencia (convertidos
desde Word). Usar como techo de calidad, no como plantilla literal.

| Doc | Palabras | Imágenes | Tablas | TOC real | words/img | words/tabla |
|-----|----------|----------|--------|----------|-----------|-------------|
| proyecto2 (colegio / notas) | ~12 855 | **80** | 24 | sí | ~161 | ~536 |
| proyecto3 (Eagles School) | ~7 178 | **44** | **38** | sí | ~163 | ~189 |
| Grupo C0503 (consultorio Sonríe) | ~7 967 | **31** | **41** | sí | ~257 | ~194 |

## Qué los distingue de un informe “malo”

No es la cantidad de palabras (un Doc flojo puede tener ~11 k). Es:

1. **Densidad visual**: ~1 imagen cada 160–260 palabras (UML, pantallas, logos, organigramas).
2. **Tablas densas**: ~1 tabla cada 190–540 palabras (HW/SW, costos, CU, volúmenes, entidades).
3. **Índice automático** (`tableOfContents`), no lista pegada.
4. **Carátula** con universidad, título del sistema, grupo, integrantes, materia INF 342, ciudad.
5. **Capítulos numerados** tipo `1.- PERFIL`, `2.- ELEMENTOS…`, Ishikawa, flujos UML.

## Cuotas objetivo (informe completo)

Derivar de la mediana de los ejemplos:

| Métrica | Mínimo aceptable | Objetivo fuerte |
|---------|------------------|-----------------|
| Imágenes / diagramas insertados | **≥ 25** | 40–80 |
| Tablas | **≥ 20** | 25–40 |
| Palabras por imagen | ≤ 300 | ≤ 200 |
| TOC | obligatorio | regenerado al final |
| H1 capítulos mayores | 8–16 | numerados |

Si el usuario pide solo “perfil”, escalar: ≥3 tablas + ≥2 figuras en perfil+elementos.

## Capítulos que siempre traen figuras (en los ejemplos)

- Organigrama / estructura organizacional  
- Tablas HW servidor·cliente y SW  
- Ishikawa  
- Actores + lista/priorización de casos de uso  
- Diagramas UML: casos de uso, clases, secuencia/comunicación, actividad, paquetes, despliegue, capas  
- Diseño de datos / ER / volúmenes  
- Prototipo UI (capturas de pantalla — muchas en proyecto2)

## Márgenes observados

- A4 (`595 × 842` pt)  
- Márgenes típicos ~70.85 pt (~2.5 cm) o 72 pt (1")  
- Header/footer activos; a veces distinta 1.ª página  

## Anti-benchmark

Un Doc de ~11 k palabras con **pocas** tablas/imágenes e índice débil
**no** cumple el estándar Angélica aunque el texto sea correcto.
