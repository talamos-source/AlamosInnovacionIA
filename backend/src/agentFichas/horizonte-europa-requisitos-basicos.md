---
program_slug: horizonte-europa-requisitos-basicos
convocatoria_tipo: marco_transversal_no_por_topic   # NO es una call: es una capa de requisitos comunes. Los topics concretos abren/cierran con fechas y no se valoran aquí.
fiche_review_date: 2026-06-19
gestor: "Comisión Europea (Horizonte Europa) — agencias EACEA/REA/CINEA/HADEA y EIC según ámbito"
aliases:
  # ⚠️ REFINAMIENTO PREVENTIVO MASIVO — esta ficha es una "capa transversal",
  # no un programa concreto, así que solo debe activarse cuando el agente
  # ve calls que SÍ son inequívocamente Horizonte Europa. Los aliases
  # catastróficos eliminados:
  #
  # - 'Horizon' suelto    → Horizon Zero Dawn, horizon scanning, horizon line,
  #                          Horizon Forbidden West, Horizon Hobby drones, etc.
  # - 'HE' (2 chars)      → pronombre inglés 'he', sigla genérica.
  # - 'IA' (2 chars)      → Inteligencia Artificial — matchearía MILES de calls
  #                          tech no-Horizon. Catastrófico.
  # - 'RIA' (3 chars)     → nombre propio Ria, apellido común. Mantenemos
  #                          como 'Action RIA' / 'RIA action' que es seguro.
  # - 'CSA' (3 chars)     → Confederate States America, Canadian Standards
  #                          Association, CSA Cesc Catalunya FC. Igual:
  #                          mantenemos como 'Action CSA' / 'CSA action'.
  - "Horizonte Europa"
  - "Horizon Europe"
  - "Pilar II Horizonte Europa"
  - "Horizonte Europa Pilar II"
  - "HE Programme"
  - "Horizon Europe Programme"
  - "Horizon Europe RIA"
  - "Horizon Europe IA"
  - "Horizon Europe CSA"
  - "Research and Innovation Action"
  - "Coordination and Support Action"
organisms: ["Comisión Europea", "Horizonte Europa", "REA", "HADEA", "CINEA", "EACEA"]
bdns_codes: []
exclusive_with: []
similar_alternatives: ["EIC-Pathfinder", "EIC-Transition", "EIC-Accelerator", "EUREKA-clusters", "CDTI-PID-Cooperacion-Internacional"]
aid_type: "subvencion_eu"   # grants (RIA/CSA 100%, IA 70% con ánimo de lucro)
regime: "horizonte_europa_grant"
aid_object: "capa_de_requisitos_transversales (no es un instrumento concreto)"
topic_dependent: true   # ⚠️ el encaje real depende SIEMPRE del topic concreto (abre/cierra con fecha, no reabre)
collaboration_required: true   # regla general: >=3 socios de >=3 EM/asociados (salvo excepciones del topic)
success_rate: null
source_urls:
  portal: "Funding & Tenders Portal (Comisión Europea)"
  programa: "https://research-and-innovation.ec.europa.eu/funding/funding-opportunities/funding-programmes-and-open-calls/horizon-europe_en"
---

# FICHA DE REQUISITOS BÁSICOS — Horizonte Europa (capa transversal)

> **⚠️ Esto NO es una ficha de convocatoria.** En Horizonte Europa la financiación va **por topics** de los programas de trabajo, con **fechas concretas de apertura y cierre**, y **una vez cerrado un topic normalmente NO vuelve a abrir**. Por eso **no se pueden hacer fichas por topic**. Esta ficha recoge los **requisitos transversales comunes** que el agente puede aplicar como **capa base**; el **encaje real depende SIEMPRE del topic concreto** (alcance, TRL exigido, tipo de acción, presupuesto, condiciones de elegibilidad y salvedades).
> `topic_dependent: true` — el agente debe **localizar y contrastar el topic vigente** antes de afirmar encaje.

---

## 1. REGLA DE CONSORCIO (por defecto)

- **Por defecto:** el consorcio debe incluir **al menos 3 entidades jurídicas independientes**, establecidas en **3 Estados miembros o países asociados** distintos (al menos 1 en un Estado miembro de la UE).
- **⚠️ Salvedades:** **algunos topics tienen excepciones** (p. ej. acciones mono-beneficiario, CSA específicas, EIC, MSCA, ERC, cofund, etc.). **Verificar siempre las condiciones del topic.**

---

## 2. INSTRUMENTOS DE FINANCIACIÓN (tipos de acción)

> Horizonte Europa usa distintos instrumentos según la fase del ciclo de I+D+i. El **tipo de acción lo fija el topic**.

| Instrumento | Para qué | Tasa de financiación | TRL |
|---|---|---|---|
| **RIA — Research and Innovation Actions** | Proyectos colaborativos centrados en **generar nuevo conocimiento**, explorar nuevas tecnologías o crear prototipos fundamentales | **100%** de costes elegibles | Suele **iniciar en TRL 2-4** y alcanzar **TRL 5-6** |
| **IA — Innovation Actions** | Actividades **más cercanas a mercado**: prototipado, testing, demostración, pilotaje, replicación de mercado | **70%** entidades con ánimo de lucro · **100%** entidades sin ánimo de lucro | Suele **iniciar en TRL 5** y apuntar a **TRL 6-8** |
| **CSA — Coordination and Support Actions** | **Sin I+D tradicional**: networking, coordinación, estandarización, comunicación, diálogo político | **100%** de costes elegibles | **No guiado por TRL** |

> Regla rápida para el match: **conocimiento nuevo / investigación → RIA**; **cerca de mercado / demostración → IA** (70% si empresa con ánimo de lucro); **coordinación/soporte/política → CSA**.

---

## 3. ESCALA TRL (referencia común)

- **TRL 1:** principios básicos observados.
- **TRL 2:** concepto tecnológico formulado.
- **TRL 3:** prueba de concepto experimental.
- **TRL 4:** tecnología validada en laboratorio.
- **TRL 5:** tecnología validada en entorno relevante.
- **TRL 6:** tecnología demostrada en entorno relevante (industrialmente relevante).
- **TRL 7:** demostración de prototipo de sistema en entorno operativo.
- **TRL 8:** sistema completo y cualificado.
- **TRL 9:** sistema real probado en entorno operativo (fabricación competitiva).

> El **TRL exigido lo marca el topic**. Cruzar el TRL del cliente con el del topic es parte del match.

---

## 4. CÓMO DEBE USARLO EL AGENTE (reglas de match)

1. **No prometer encaje sin topic.** Horizonte Europa solo "encaja" contra un **topic abierto** concreto; si no hay topic abierto que cuadre, marcar como **no accionable ahora** (los topics no reabren).
2. **Pre-filtros transversales** (esta ficha):
   - ¿Puede el cliente formar un **consorcio de ≥3 socios de ≥3 EM/asociados**? (salvo excepción del topic).
   - ¿El proyecto es **investigación (RIA)**, **cercano a mercado (IA)** o **coordinación (CSA)**? → orienta el tipo de acción y la **tasa** (IA = 70% si empresa con ánimo de lucro).
   - ¿El **TRL del cliente** es compatible con el rango típico del instrumento y, sobre todo, con el **TRL del topic**?
3. **Datos a pedir al cliente** (para preparar el match con el topic):
   - **TRL actual** de la tecnología.
   - ¿**Investigación fundamental** o **escalado/comercial**? (RIA vs IA).
   - Ámbito temático (para localizar el cluster/destination y topic correspondiente).
   - Capacidad de **consorcio internacional**.
4. **Derivaciones:**
   - Empresa que quiere ir **sola** o pyme innovadora individual → **EIC** (Pathfinder/Transition/Accelerator) o instrumentos nacionales (CDTI/AEI) / EUREKA.
   - Proyecto **nacional** sin consorcio europeo → CDTI/AEI.
   - I+D internacional colaborativa más ligera → **EUREKA / Eurostars**.

---

## 5. NOTAS

- **Gestión:** según el ámbito, gestionan REA, HADEA, CINEA, EACEA, ERCEA o el EIC; solicitud en el **Funding & Tenders Portal**.
- **Esta ficha es una capa de apoyo**, no sustituye la lectura del **Work Programme** y del **topic** concreto (alcance, elegibilidad, tipo de acción, TRL, presupuesto, salvedades de consorcio).
- **Tasa de éxito:** muy variable por topic — *no fabricar*.

## Fuentes
- Funding & Tenders Portal (Comisión Europea) y Work Programmes de Horizonte Europa.
- Definiciones RIA/IA/CSA, tasas y TRL: documentación oficial de Horizonte Europa y guías de referencia (aportadas por la usuaria).
