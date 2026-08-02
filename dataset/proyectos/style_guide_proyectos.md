# Guía de Estilo para Informes de Proyecto de Sistemas de Información

## 1. Estructura General del Documento

### 1.1. Orden de Secciones (Estándar Obligatorio)

```
1. PORTADA
2. ÍNDICE
3. PERFIL
   3.1. Introducción
   3.2. Antecedentes
   3.3. Justificación
   3.4. Descripción del Problema
   3.5. Formulación del Problema
   3.6. Objetivos
       3.6.1. Objetivo General
       3.6.2. Objetivos Específicos
   3.7. Alcance
   3.8. Entrevista (opcional)
4. ELEMENTOS DEL SISTEMA BASADO EN COMPUTADORAS
   4.1. Hardware
       4.1.1. Servidor
       4.1.2. Cliente
       4.1.3. Medios de Comunicación
       4.1.4. Otros Dispositivos
   4.2. Software
       4.2.1. Servidor
       4.2.2. Cliente
       4.2.3. Otro Software Adicional
   4.3. Datos
   4.4. Procesos
   4.5. Gente/Usuario
   4.6. Documentos de Respaldo
5. TECNOLOGÍA PARA EL DESARROLLO DEL SOFTWARE
   5.1. Estrategia para el Desarrollo del Software
   5.2. Metodología para el Desarrollo del Software
       5.2.1. Características del PUDS
       5.2.2. Características de UML
   5.3. Herramientas de Desarrollo
       5.3.1. Software
       5.3.2. Hardware
6. POSIBLES COSTOS
7. POSIBLES BENEFICIOS
   7.1. Tiempo
   7.2. Esfuerzo
   7.3. Costos
8. POSIBLES CLIENTES
9. MARCO TEÓRICO
10. CAPÍTULO 1: MÉTODO DE ISHIKAWA
    10.1. Identificar Problemas
        10.1.1. Lista de Problemas
        10.1.2. Depurar Problemas
        10.1.3. Lista Final de Problemas
        10.1.4. Propietarios de Problemas
        10.1.5. Análisis de Problemas
        10.1.6. Estimación y Cuantificación
        10.1.7. Alternativas de Cambio
        10.1.8. Conclusión y Recomendación
        10.1.9. Diagrama de Ishikawa
    10.2. Identificar las Principales Categorías
    10.3. Identificar las Causas
    10.4. Analizar y Discutir el Diagrama
11. CAPÍTULO 2: FLUJO DE TRABAJO - CAPTURA DE REQUISITOS
    11.1. Identificar Actores y Casos de Uso
        11.1.1. Actores
        11.1.2. Casos de Uso
    11.2. Priorizar Casos de Uso
    11.3. Detallar Casos de Uso
    11.4. Prototipar Interfaz de Usuario
    11.5. Estructurar Modelo de Casos de Uso
12. CAPÍTULO 3: FLUJO DE TRABAJO - ANÁLISIS
    12.1. Análisis de Arquitectura
        12.1.1. Identificar Paquetes
        12.1.2. Relacionar Paquetes y Casos de Uso
        12.1.3. Vista de Paquetes
    12.2. Analizar Casos de Uso - Diagrama de Comunicación
    12.3. Análisis de una Clase
    12.4. Análisis de Paquete
13. CAPÍTULO 4: FLUJO DE TRABAJO - DISEÑO
    13.1. Diseño de Arquitectura
        13.1.1. Diseño Físico (Diagrama de Despliegue)
        13.1.2. Diseño Lógico (Diagrama Organizado en Capas)
    13.2. Diseño de Datos
        13.2.1. Diseño de Datos Lógico
            13.2.1.1. Diagrama de Clases
            13.2.1.2. Mapeo
            13.2.1.3. Normalización
        13.2.2. Diseño de Datos Físico
            13.2.2.1. Tabla de Volumen
            13.2.2.2. Script SQL
            13.2.2.3. Diagrama Relacional
            13.2.2.4. Actualización de Tuplas
            13.2.2.5. Consultas
            13.2.2.6. Procedimientos Almacenados
            13.2.2.7. Disparadores (Triggers)
    13.3. Diseñar Casos de Uso (Diagrama de Secuencia)
14. CAPÍTULO 5: FLUJO DE TRABAJO - IMPLEMENTACIÓN
    14.1. Elección de Plataforma de Desarrollo
        14.1.1. Lenguajes de Programación
        14.1.2. Frameworks
        14.1.3. Base de Datos
        14.1.4. Servidor en la Nube
        14.1.5. Otros
    14.2. Implementación de la Arquitectura del Sistema
    14.3. Implementación de la Arquitectura del Subsistema
15. CAPÍTULO 6: FLUJO DE TRABAJO - PRUEBAS
    15.1. Planificar Pruebas
    15.2. Casos de Pruebas
16. CONCLUSIONES
17. RECOMENDACIONES
18. BIBLIOGRAFÍA
19. ANEXOS
```

### 1.2. Portada

**Formato obligatorio:**
```
UNIVERSIDAD AUTÓNOMA GABRIEL RENÉ MORENO
FACULTAD DE INGENIERÍA Y CIENCIAS DE LA COMPUTACIÓN Y
TELECOMUNICACIONES

GRUPO #[NÚMERO]

[TÍTULO DEL SISTEMA DE INFORMACIÓN]

Integrantes:
- [Nombre Completo] [Código]
- [Nombre Completo] [Código]
...

Materia: Sistemas de Información I
Sigla: INF 342
Docente: MSc. Ing. [Nombre del Docente]

Santa Cruz de la Sierra, Gestión [Período]
```

### 1.3. Índice

- Numeración decimal (1, 1.1, 1.1.1)
- Incluir todas las secciones hasta nivel 3
- Paginación alineada a la derecha

---

## 2. Reglas por Sección

### 2.0. Plantilla oficial del Perfil de Proyecto (fuente: pptx "PERFIL DE PROYECTO Y SISTEMAS")

La presentación oficial de la materia define la estructura canónica del perfil que todo informe debe seguir:

```
1. PERFIL
   1.1 INTRODUCCIÓN        1.2 ANTECEDENTES        1.3 JUSTIFICACIÓN
   1.4 DESCRIPCIÓN DEL PROBLEMA      1.5 FORMULACIÓN DEL PROBLEMA
   1.6 OBJETIVOS (1.6.1 General, 1.6.2 Específicos)
   1.7 ALCANCE             1.8 ENTREVISTA
2. ELEMENTOS DEL SISTEMA BASADO EN COMPUTADORAS
   2.1 HARDWARE (2.1.1 Servidor, 2.1.2 Cliente, 2.1.3 Medios de Comunicación, 2.1.4 Otros Dispositivos)
   2.2 SOFTWARE (2.2.1 Servidor, 2.2.2 Cliente, 2.2.3 Otro software adicional)
   2.3 DATOS    2.4 PROCESOS    2.5 GENTE/USUARIO    2.6 DOCUMENTO
3. TECNOLOGÍA PARA EL DESARROLLO DEL SOFTWARE
   3.1 Estrategia   3.2 Metodología (PUDS, UML)   3.3 Herramientas (Software/Hardware)
4. POSIBLES COSTOS
5. POSIBLES BENEFICIOS (5.1 Tiempo, 5.2 Esfuerzo, 5.3 Costos)
6. POSIBLES CLIENTES
7. ANEXOS
```

La plantilla de ENTREVISTA (sección 1.8) incluye: objetivo, número de entrevista, lugar, duración, datos de la empresa (nombre, privada/estatal), datos del entrevistado (nombre, cargo) y datos del entrevistador.

### 2.1. Perfil (Sección 3)

#### 2.1.1. Introducción
- **Longitud**: 30-70 líneas
- **Contenido**: Contexto general del problema, importancia de los sistemas de información, mención del dominio específico
- **Tono**: Formal, académico
- **Persona**: Tercera persona
- **Tiempo verbal**: Presente

#### 2.1.2. Antecedentes
- **Longitud**: 20-40 líneas
- **Contenido**: Investigación previa, trabajos relacionados, estado del arte
- **Formato**: Párrafos numerados o con viñetas

#### 2.1.3. Justificación
- **Longitud**: 20-40 líneas
- **Contenido**: Por qué es importante el proyecto, beneficios esperados, necesidad del sistema
- **Estructura**: Párrafos temáticos

#### 2.1.4. Descripción del Problema
- **Longitud**: 60-160 líneas
- **Contenido**: Problemas específicos organizados por sectores/áreas
- **Formato**: 
  - Subsecciones por sector/área del problema
  - Cada problema描述o en 1-3 párrafos
  - Incluir consecuencias y afectados

#### 2.1.5. Formulación del Problema
- **Longitud**: 5-15 líneas
- **Contenido**: Pregunta(s) concreta(s) que el proyecto responde
- **Formato**: Una o varias preguntas de investigación

#### 2.1.6. Objetivos
- **Longitud**: 20-40 líneas
- **Objetivo General**: 1-2 oraciones, verbo en infinitivo
- **Objetivos Específicos**: 4-10 items, verbos en infinitivo, medibles

#### 2.1.7. Alcance
- **Longitud**: 100-500 líneas (la sección más extensa del perfil)
- **Contenido**: Módulos funcionales del sistema
- **Formato**:
  ```
  [NÚMERO]. [NOMBRE DEL MÓDULO]
  [Descripción del módulo]
  
  [NÚMERO].[NÚMERO] RF[NÚMERO]: [Nombre del Requisito Funcional]
  [Descripción del requisito]
  ```
- **Cada módulo** debe tener:
  - Nombre descriptivo
  - Descripción breve
  - Lista de requisitos funcionales (RF)

### 2.2. Elementos del Sistema Basado en Computadoras (Sección 4)

#### 2.2.1. Hardware
- **Formato**: Tablas comparativas
- **Subsecciones**: Servidor, Cliente, Medios de Comunicación, Otros Dispositivos
- **Contenido mínimo por subsección**:
  - Servidor: OS, procesador, RAM, almacenamiento
  - Cliente: Dispositivo, especificaciones
  - Comunicación: Tipo de red, protocolo

#### 2.2.2. Software
- **Formato**: Tablas comparativas
- **Subsecciones**: Servidor, Cliente, Software Adicional
- **Contenido**: Nombre, versión, función

#### 2.2.3. Datos
- **Longitud**: 30-100 líneas
- **Contenido**: Descripción de las entidades de datos principales
- **Formato**: Lista de entidades con descripción

#### 2.2.4. Procesos
- **Longitud**: 15-30 líneas
- **Contenido**: Procesos principales del sistema actual

#### 2.2.5. Gente/Usuario
- **Longitud**: 10-30 líneas
- **Contenido**: Perfiles de usuario, roles identificados

### 2.3. Tecnología para el Desarrollo del Software (Sección 5)

#### 2.3.1. Estrategia
- **Longitud**: 5-10 líneas
- **Contenido**: Enfoque general del desarrollo

#### 2.3.2. Metodología
- **Longitud**: 40-70 líneas
- **Subsecciones obligatorias**:
  - Características del PUDS
  - Características de UML

#### 2.3.3. Herramientas
- **Formato**: Tablas
- **Subsecciones**: Software, Hardware

### 2.4. Marco Teórico (Sección 9)

- **Longitud**: 200-800 líneas
- **Contenido**: Fundamentos teóricos del proyecto
- **Formato**: Párrafos con citas bibliográficas
- **Estilo**: Explicativo, académico

### 2.5. Método de Ishikawa (Capítulo 1)

#### Estructura obligatoria:
```
1. IDENTIFICAR PROBLEMA
   1.1. Lista de Problemas (P1-P[N])
   1.2. Depurar Problemas (selección)
   1.3. Lista Final de Problemas
   1.4. Propietarios de Problemas (tabla)
   1.5. Análisis de Problemas
   1.6. Estimación y Cuantificación (tabla cualitativa + cuantitativa)
   1.7. Alternativas de Cambio (A1-A[N])
   1.8. Conclusión y Recomendación
   1.9. Diagrama de Ishikawa (figura)
2. IDENTIFICAR LAS PRINCIPALES CATEGORÍAS
3. IDENTIFICAR LAS CAUSAS
4. ANALIZAR Y DISCUTIR EL DIAGRAMA
```

#### Reglas de formato:
- **Problemas**: Numerados P1, P2, P3...
- **Categorías**: 5-7 categorías (espinas del pez)
- **Propietarios**: Tabla cruzada (problema × rol)
- **Estimación**: 
  - Cualitativa: Alta/Media/Baja
  - Cuantitativa: Número de afectados, frecuencia
- **Alternativas**: Numeradas A1, A2, A3...

### 2.6. Captura de Requisitos (Capítulo 2)

#### 2.6.1. Actores y Casos de Uso
- **Actores**: Lista descriptiva
- **Casos de Uso**: Tabla con ID, Nombre, Descripción

#### 2.6.2. Priorizar Casos de Uso
- **Formato**: Tabla por ciclo
- **Columnas**: ID, CU, Actor, Estado, Prioridad, Riesgo, Ciclo

#### 2.6.3. Detallar Casos de Uso
**Plantilla obligatoria para cada CU:**
```
CU[NÚMERO]: [NOMBRE]

Propósito: [Descripción del propósito]

Resumen: [Resumen breve]

Actores: [Lista de actores]

Actor iniciador: [Actor que inicia]

Flujo principal:
1. [Paso 1]
2. [Paso 2]
...

Precondición: [Condición previa]

Postcondición: [Estado resultado]

Excepciones:
EX-01: [Descripción]
EX-02: [Descripción]
```

#### 2.6.4. Prototipos
- Referencia a imágenes de wireframes/prototipos
- Un prototipo por cada CU

### 2.7. Análisis (Capítulo 3)

#### 2.7.1. Análisis de Arquitectura
- Identificar paquetes
- Relacionar paquetes con casos de uso
- Vista de paquetes

#### 2.7.2. Diagrama de Comunicación
- Un diagrama por cada CU
- Organizado por ciclos

#### 2.7.3. Análisis de Clase
- Diagramas de clases por CU
- Organizado por ciclos

### 2.8. Diseño (Capítulo 4)

#### 2.8.1. Diseño de Arquitectura
- **Físico**: Diagrama de despliegue
- **Lógico**: Diagrama organizado en capas

#### 2.8.2. Diseño de Datos
- **Lógico**: 
  - Diagrama de clases
  - Mapeo (entidad → tabla)
  - Normalización (1FN, 2FN, 3FN)
- **Físico**:
  - Tabla de volumen (atributo, tipo, tamaño, nulo, clave)
  - Script SQL completo (CREATE TABLE, INSERT, UPDATE, DELETE)
  - Diagrama relacional
  - Consultas SQL (simples, múltiples, subconsultas)
  - Procedimientos almacenados
  - Triggers

#### 2.8.3. Diagramas de Secuencia
- Un diagrama por cada CU
- Organizado por ciclos

### 2.9. Implementación (Capítulo 5)

- **Formato**: Tablas descriptivas
- **Contenido**: Tecnologías utilizadas con versiones y justificación

### 2.10. Pruebas (Capítulo 6)

#### 2.10.1. Planificar Pruebas
- Tipos de prueba
- Criterios de entrada/salida
- Usuarios de prueba

#### 2.10.2. Casos de Prueba
**Plantilla:**
```
CP-CU[NÚMERO]-[NÚMERO]: [Descripción]

Caso de Uso: CU[NÚMERO]
Tipo de Prueba: [Funcional/Integración/etc.]
Prioridad: [Alta/Media/Baja]

Entrada:
- Campo: [Valor] (Tipo: [Tipo])

Resultado Esperado:
1. [Resultado 1]
2. [Resultado 2]

Precondiciones: [Condiciones]
Postcondiciones: [Estado]

Procedimiento de Prueba:
1. [Paso 1]
2. [Paso 2]

Interfaz Requerida: [Nombre de pantalla]
```

### 2.11. Conclusiones

- **Longitud**: 30-50 líneas
- **Contenido**: Resumen de logros, cumplimiento de objetivos
- **Formato**: Párrafos o lista numerada

### 2.12. Recomendaciones

- **Longitud**: 40-100 líneas
- **Contenido**: Sugerencias para futuros desarrolladores y usuarios
- **Formato**: Lista numerada o por categorías

### 2.13. Bibliografía

- **Formato APA 7** o similar
- **Mínimo**: 5 referencias
- **Incluir**: Libros, documentación oficial, artículos

### 2.14. Anexos

- Entrevistas completas
- Documentación adicional
- Capturas de pantalla
- Scripts SQL completos

---

## 3. Reglas de Formato General

### 3.1. Numeración
- Usar numeración decimal: 1, 1.1, 1.1.1
- Máximo 3 niveles de profundidad
- Cada sección debe tener al menos 2 subsecciones

### 3.2. Tablas
- Encabezados en negrita
- Bordes visibles
- Contenido alineado
- Referenciadas en el texto: "ver Tabla X"

### 3.3. Figuras/Diagramas
- Numeradas: Figura 1, Figura 2...
- Título debajo de la figura
- Referenciadas en el texto: "ver Figura X"

### 3.4. Listas
- Viñetas para listas no ordenadas
- Números para listas ordenadas
- Sangría consistente

### 3.5. Código SQL
- Monoespaciado (Courier New o similar)
- Indentado correctamente
- Comentarios en cada bloque

### 3.6. Estilo de Escritura
- **Persona**: Tercera persona ("el sistema", "el usuario")
- **Tiempo verbal**: Presente para descripciones, pasado para antecedentes
- **Formalidad**: Alta (sin coloquialismos)
- **Claridad**: Oraciones claras y directas

### 3.7. Transiciones
- Usar conectores: "Además", "Por otro lado", "En consecuencia", "Sin embargo"
- Cada sección debe comenzar con una oración introductoria

---

## 4. Patrones de Contenido

### 4.1. Cantidad de Casos de Uso
- Mínimo: 20 casos de uso
- Máximo: 35 casos de uso
- Promedio: 25-28 casos de uso

### 4.2. Organización por Ciclos
- **Ciclo 1**: Cimientos (seguridad, estructura base)
- **Ciclo 2**: Núcleo (funcionalidad principal)
- **Ciclo 3**: Operación diaria (procesos recurrentes)
- **Ciclo 4**: Soporte (reportes, comunicaciones, avanzado)

### 4.3. Cantidad de Tablas SQL
- Mínimo: 15 tablas
- Promedio: 20-30 tablas

### 4.4. Procedimientos Almacenados
- Mínimo: 3 procedimientos
- Promedio: 5-8 procedimientos

### 4.5. Triggers
- Mínimo: 3 triggers
- Promedio: 5-8 triggers

### 4.6. Consultas SQL
- Mínimo: 15 consultas
- Tipos: Simples, Múltiples, Subconsultas
- Promedio: 25-30 consultas

### 4.7. Casos de Prueba
- Mínimo: 4 casos de prueba
- Promedio: 6-8 casos de prueba

---

## 5. Tecnologías Comunes

### 5.1. Frontend
- HTML5, CSS3, JavaScript
- React/Next.js o Vue.js o Angular
- Bootstrap o Tailwind CSS

### 5.2. Backend
- Node.js + Express o PHP + Laravel o Python + Django
- Java + Spring Boot

### 5.3. Base de Datos
- PostgreSQL (más común)
- MySQL
- MongoDB (menos común)

### 5.4. Herramientas de Modelado
- Enterprise Architect
- StarUML
- Draw.io
- Lucidchart

### 5.5. Control de Versiones
- Git + GitHub

---

## 6. Errores Comunes a Evitar

1. **Saltar secciones**: Todas las secciones del índice deben estar presentes
2. **Inconsistentes en numeración**: Verificar que la numeración sea consecutiva
3. **Tablas sin encabezado**: Toda tabla debe tener encabezados claros
4. **Figuras sin referencia**: Toda figura debe ser mencionada en el texto
5. **SQL sin comentarios**: Todo código SQL debe tener comentarios
6. **Objetivos no medibles**: Los objetivos específicos deben ser cuantificables
7. **Falta de normalización**: La base de datos debe estar en 3FN
8. **Casos de uso incompletos**: Cada CU debe tener todos los campos de la plantilla
