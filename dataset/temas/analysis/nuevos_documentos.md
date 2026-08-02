# Análisis de Nuevos Documentos (docx proyectos + ppt/pptx/docx temas)

Fecha: 2026-08-02

## 1. proyectos/docx/ (proyecto1-3.docx)

**Conclusión**: Son las fuentes originales de los proyectos 1-3, mismos documentos que los PDFs ya analizados.
- Texto extraído (via LibreOffice → txt) es subconjunto del texto PDF (menos líneas: el PDF arrastra encabezados/pies de página).
- No aportan contenido nuevo al dataset de proyectos.
- Extraídos a `proyectos/docx/extracted_text/proyecto{1,2,3}.txt` para referencia/verificación cruzada.
- Estructura confirmada coincide con la canónica: portada → índice → PERFIL (1.1-1.8) → elementos del sistema → tecnología → costos/beneficios/clientes → marco teórico → capítulos PUDS.

## 2. temas/pptx/PERFIL DE PROYECTO Y SISTEMAS.pptx (39 diapositivas)

**Hallazgo clave**: es la PLANTILLA OFICIAL del curso para el perfil de proyecto. Extremadamente relevante para el dataset de proyectos.

Contenido:
- Estructura del perfil: 1.1 Introducción, 1.2 Antecedentes, 1.3 Justificación, 1.4 Descripción del problema, 1.5 Formulación del problema, 1.6 Objetivos (general + específicos), 1.7 Alcance, 1.8 Entrevista.
- Plantilla de entrevista para obtención de requisitos (objetivo, lugar, duración, datos de empresa: privada/estatal, datos del entrevistado: nombre/cargo, datos del entrevistador).
- 2. Elementos del sistema basado en computadoras: 2.1 Hardware (servidor, cliente, medios de comunicación, otros dispositivos), 2.2 Software (servidor, cliente, adicional), 2.3 Datos, 2.4 Procesos, 2.5 Gente/Usuario, 2.6 Documento.
- 3. Tecnología para el desarrollo del software: 3.1 Estrategia, 3.2 Metodología (PUDS, UML), 3.3 Herramientas (software/hardware). 4. Posibles costos. 5. Posibles beneficios (tiempo, esfuerzo, costos). 6. Posibles clientes. 7. Anexos.
- Teoría de sistemas (también útil para temas): definición de sistema, características (elementos, objetivos, entradas/proceso/salidas, subsistemas, retroalimentación, sinergia, equifinalidad), subsistemas de la empresa (psicosocial, técnico, administrativo), tipos (físicos/abstractos, cerrados/abiertos), premisas de la TGS, datos vs información, atributos de la información, categorías (estratégica, táctica, operacional), importancia en la toma de decisiones.

## 3. temas/ppt/UML2.ppt (96 diapositivas, convertido a pptx vía LibreOffice)

Tutorial completo de UML:
- ¿Qué es UML? (lenguaje gráfico, requisitos/arquitectura/diseño; OMG; MDA).
- Tipos de diagramas: estructurales (clases, objetos, estructural compuesto, despliegue, componentes, paquetes), comportamiento (actividades, casos de uso, máquina de estados), interacción (secuencia, visión general, comunicación, tiempos).
- Diagrama de clases: formato, atributos (tipos, valores por defecto, multiplicidad), métodos, visibilidad (+ - # ~), estáticos, abstractos, asociación (multiplicidad, roles, navegación, reflexiva, clase de asociación), estereotipos, agregación, composición, herencia, dependencia, interfaces.
- Notas, paquetes, objetos (enlaces), secuencia (mensajes, síncronos/asíncronos, creación/destrucción, recursión, alt/loop), actividad (acción, actividad, flujo, nodos de control, swimlanes), interacción en visión general, comunicación (numeración de mensajes), estados, componentes, despliegue (nodos, artefactos).
- Ejercicios 3-10 (objetos con fracciones, solitario, chat, componentes universidad, despliegue red).

## 4. temas/ppt/Diagramas de Actividad.ppt (28 diapositivas, convertido a pptx)

Tutorial de diagramas de actividades:
- Definición (técnica UML para lógica de procedimientos, procesos de negocio, flujo de trabajo; modela aspectos dinámicos).
- Diferencia con diagrama de flujo: el diagrama de actividad describe el PROBLEMA, el de flujo describe la SOLUCIÓN.
- Elementos: inicio (círculo negro), actividad (óvalo), transición (flecha), ramificación/branch (rombo), unión/merge (rombo), fork (barra negra; ramas obligadas vs branch condicional), fin (círculo concéntrico), swimlanes/andarieles (responsabilidades por unidad organizacional).
- Diagramas jerárquicos (actividad descompuesta en subactividades en nivel inferior), pseudoacción, decisiones.
- Ejemplo completo: compra de pasaje aéreo con actores PASAJERO/VENDEDOR/AEROLÍNEA (solicitar pasaje, verificar existencia del vuelo, dar detalles, informar alternativas y precios, seleccionar vuelo, solicitar pago, reservar plazas, confirmar plaza, emitir tiquete).

## 5. temas/docx/modelonegocio.docx (solo imagen EMF, sin texto)

Documento con una única imagen vectorial EMF (138 KB): un diagrama de actividades de un "Modelo de Inscripción" (instituto de inglés, por la naturaleza del proceso).
- Cadenas de texto extraídas del binario EMF en orden de dibujo:
  ABRIR GESTIÓN + GET FECHA ACTUAL → SOLICITAR CUPO → VERIFICAR CUPO → (decisión CUPO) → RELLENAR FORMULARIO → PRESENTAR FORMULARIO → VERIFICAR FORMULARIO → (DETALLAR ERROR / CORREGIR ERROR, bucle) → ASIGNAR FECHA EXAMEN → DAR EXAMEN → SACAR NOTA INGLÉS → ASIGNAR PARALELO → GENERAR PLAN PAGO → REALIZAR PRIMER PAGO → GENERAR COD ALUMNO → FIN (+ CUOTA).
- Uso en dataset: ejemplo de descripción de proceso de negocio representado como diagrama de actividades.

## Herramientas usadas
- LibreOffice headless (snap): docx→txt, ppt→pptx. El filtro txt no funciona para presentaciones; se convierte a pptx y se parsea el XML.
- Python (zipfile + ElementTree, sin dependencias): extracción de texto de pptx (diapositiva por diapositiva) y docx.
- Python + regex: extracción de cadenas UTF-16LE del binario EMF.
