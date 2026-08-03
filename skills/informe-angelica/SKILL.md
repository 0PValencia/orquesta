---
name: informe-angelica
description: >-
  Redacta informes académicos de Sistemas de Información I (SI I / INF 342,
  UAGRM, estilo Angélica): perfil, elementos del sistema, PUDS/UML, Ishikawa,
  requisitos, análisis, diseño, implementación, pruebas. Usar cuando el usuario
  pida informe Angélica, SI I, proyecto de sistemas, perfil de proyecto,
  Ishikawa, casos de uso, o estructura canónica UAGRM.
---

# Informe Angélica (SI I)

Skill de **contenido y estructura** para informes de proyecto de
**Sistemas de Información I** (INF 342), Universidad Autónoma Gabriel René Moreno,
estilo académico formal (“Angélica”).

Para materializar en Google Docs, combinar con la skill **google-documents**.

## Cuándo activar

- “Informe Angélica”, SI I, INF 342, perfil de proyecto
- Proyecto de sistema de información / monografía SI
- Pedidos de Ishikawa, casos de uso, diseño UML, costos/beneficios UAGRM

## Identidad del documento

| Campo | Valor típico |
|-------|----------------|
| Universidad | Universidad Autónoma Gabriel René Moreno |
| Facultad | Ingeniería en Ciencias de la Computación y Telecomunicaciones |
| Materia | Sistemas de Información I |
| Sigla | INF 342 |
| Ciudad | Santa Cruz de la Sierra |
| Persona | Tercera persona |
| Tono | Formal, académico, sin jerga de chat |
| Títulos | Texto plano (sin `#`); en Docs → `apply_heading` |

## Estructura canónica (orden obligatorio)

```text
1.  PORTADA
2.  ÍNDICE
3.  PERFIL
    3.1 Introducción
    3.2 Antecedentes
    3.3 Justificación
    3.4 Descripción del Problema
    3.5 Formulación del Problema
    3.6 Objetivos (General + Específicos)
    3.7 Alcance
    3.8 Entrevista (opcional)
4.  ELEMENTOS DEL SISTEMA BASADO EN COMPUTADORAS
    Hardware · Software · Datos · Procesos · Gente/Usuario · Documentos
5.  TECNOLOGÍA PARA EL DESARROLLO DEL SOFTWARE
    Estrategia · Metodología (PUDS, UML) · Herramientas
6.  POSIBLES COSTOS
7.  POSIBLES BENEFICIOS (Tiempo, Esfuerzo, Costos)
8.  POSIBLES CLIENTES
9.  MARCO TEÓRICO
10. CAPÍTULO 1: MÉTODO DE ISHIKAWA
11. CAPÍTULO 2: CAPTURA DE REQUISITOS
12. CAPÍTULO 3: ANÁLISIS
13. CAPÍTULO 4: DISEÑO
14. CAPÍTULO 5: IMPLEMENTACIÓN
15. CAPÍTULO 6: PRUEBAS
16. CONCLUSIONES
17. RECOMENDACIONES
18. BIBLIOGRAFÍA
19. ANEXOS
```

Detalle por sección y longitudes: [references/estructura.md](references/estructura.md).  
Voz, verbos y anti-patrones de redacción: [references/estilo.md](references/estilo.md).  
Portada y plantillas: [references/plantillas.md](references/plantillas.md).

## Flujo de trabajo del agente

1. **Aclarar** (si falta): dominio/organización, integrantes, docente, gestión,
   páginas objetivo, ¿Docs o solo texto?
2. **Planear** secciones a redactar en este turno (nunca el monstruo entero si
   el canal es corto).
3. **Redactar** en tercera persona, párrafos densos, verbos de objetivos en
   infinitivo.
4. **Verificar** contra checklist de estructura (todas las secciones pedidas).
5. Si hay MCP Docs → skill **google-documents**.

### Si faltan datos críticos

Preferir menú estructurado (choices) antes que un párrafo de 5 preguntas.

## Densidad y extensión

| Pedido | Enfoque |
|--------|---------|
| 4–10 páginas | Perfil + elementos + esqueleto de capítulos |
| Informe “completo” / 100+ págs | Por capítulos; un capítulo (o subsección mayor) por turno |
| Solo perfil | Secciones 1–8 del perfil con longitudes guía |

**Alcance** del perfil suele ser la parte más larga (módulos funcionales).  
**Descripción del problema**: concreta, por área, con afectados y consecuencias.

## Objetivos (formato)

- **General**: 1–2 oraciones, verbo en infinitivo.
- **Específicos**: 4–10 ítems medibles, infinitivo (`Analizar…`, `Diseñar…`).

## Bibliografía

- Estilo académico coherente (APA 7 preferido si no indican otro).
- No inventar fuentes; si no hay búsqueda, marcar como pendientes o usar solo
  lo que el usuario aportó.

## Entrega

- Si es chat: secciones con títulos claros y numeración decimal.
- Si es Docs: enlace + resumen de qué secciones se cargaron.
- Nunca fingir tablas UML/SQL sin contenido real cuando el usuario las pide.
