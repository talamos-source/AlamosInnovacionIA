---
program_slug: cdti-pid
last_updated: 2026-01-29   # fecha de la ficha fuente (texto principal y anexos)
fiche_review_date: 2026-06-19   # fecha en que se elaboró esta ficha para el agente
aliases:
  - "Proyectos de I+D"
  - "PID"
  - "CDTI PID"
  - "Proyecto de I+D CDTI"
  - "Ayuda Proyectos de I+D"
  - "Proyectos de Investigación y Desarrollo"
  - "Proyectos de I+D Individuales"
  - "Proyectos de I+D de Cooperación Nacional"
  - "Proyectos Orientados"
  - "PO CDTI"
organisms: ["CDTI"]
bdns_codes: []   # PENDIENTE: ayuda reembolsable; verificar variantes/convocatorias específicas (tipología h) que puedan registrar código.
exclusive_with: ["CDTI-LIC", "CDTI-LICA"]   # incompatible con otras ayudas públicas al MISMO proyecto (salvo excepciones CCAA con convenio CDTI)
similar_alternatives: ["CDTI-LIC", "CDTI-LICA", "EIC-Accelerator", "EIC-Pathfinder", "Neotec", "Misiones-CDTI"]
aid_type: "prestamo_parcialmente_reembolsable"
regime: "ayuda_estatal_id_art25_rgec"   # Art. 25 RGEC UE 651/2014 (I+D). NO es minimis.
project_typologies: ["a_individual","b_cooperacion_nacional","c_coop_internacional","d_coop_europea","e_capacitacion_tecnologica","f_tecnologias_duales","g_proyectos_orientados","h_convocatorias_especificas"]
success_rate: null   # DESCONOCIDO — no fabricar.
source_urls:
  ficha_oficial_pdf: "https://www.cdti.es/sites/default/files/2026-02/1._proyectos_de_id_2026_02_1.pdf"
  pagina_ayuda: "https://www.cdti.es/ayudas/proyectos-de-i-d"
  sede_electronica: "https://sede.cdti.gob.es"
---

# FICHA DE AYUDA PARA EL AGENTE DE MATCH
## Proyectos de I+D (PID) — CDTI

> **Uso en Discovery:** *fuzzy match* del título contra `aliases` + `organisms`. Si matchea → cargar esta ficha. Si no → flujo normal.
> **Relación con LIC/LICA:** PID es el instrumento de **I+D** del CDTI: investigación industrial + desarrollo experimental, con **riesgo tecnológico alto/medio** y **TRL más bajo**. Es el destino natural cuando un proyecto NO encaja en LIC/LICA por ser demasiado arriesgado / poco maduro. Regla rápida: **riesgo alto + TRL bajo → PID; innovación cercana a mercado + riesgo bajo → LIC/LICA.**
> Fuente: Ficha Proyectos de I+D, CDTI. Texto principal y anexos a 29/01/2026.

---

## 1. IDENTIFICACIÓN

- **Nombre:** Proyectos de I+D (PID)
- **Organismo:** CDTI
- **Tipo de instrumento:** Ayuda parcialmente reembolsable (tramo reembolsable + TNR).
- **Régimen de ayudas:** Ayuda estatal de I+D (Art. 25 RGEC UE 651/2014). **NO es minimis** → aplican límites de intensidad por tipo de actividad y tamaño (§4).
- **Convocatoria:** Abierta de forma continua todo el año (salvo tipología h, convocatorias específicas).
- **Canal de solicitud:** Sede electrónica CDTI (https://sede.cdti.gob.es), certificado del representante legal.

---

## 2. OBJETIVO / FINALIDAD (qué financia)

Proyectos de **investigación y desarrollo empresarial de carácter aplicado** para la **creación o mejora significativa** de un proceso productivo, producto o servicio, que demuestren un **aspecto tecnológico diferencial** sobre las tecnologías del mercado. Comprenden **investigación industrial** y/o **desarrollo experimental**.

### Tipologías de proyecto (campo `project_typologies`)
- **a) Individual nacional** — una única empresa.
- **b) Cooperación Nacional** — consorcio de 2 a 6 empresas (≥1 PYME, ≥2 autónomas entre sí), con coordinadora. Duración hasta 48 meses.
- **c) Cooperación Tecnológica Internacional** — EUREKA, IBEROEKA, PRIMA, bilaterales, unilaterales CDTI.
- **d) Cooperación Tecnológica Europea** — PIICE, IHI (Innovative Health Initiative), Partenariados de Horizonte Europa.
- **e) Capacitación Tecnológica** — licitaciones de grandes instalaciones (CERN, ESO, ITER, ESS, XFEL…) e ICTS.
- **f) Tecnologías Duales** — capacitación para Defensa y Seguridad (evaluación complementaria).
- **g) Proyectos Orientados (PO)** — individuales, gran tamaño, áreas estratégicas. **2026:** energías renovables e hidrógeno verde; descarbonización de industrias intensivas (siderometalurgia, química, transporte); movilidad sostenible de bajas/nulas emisiones; microprocesadores de vanguardia, fotónica integrada y chips cuánticos.
- **h) Convocatorias específicas** — condiciones según la convocatoria.

> **Posicionamiento para el match:** PID admite proyectos de **mayor riesgo y menor madurez** que LIC/LICA, y **sin las exclusiones sectoriales de energía/transporte** de la LICA (de hecho, energía/H2 y descarbonización son prioridades del PO). Es el instrumento para deep-tech, biotech, semiconductores, etc.

### Madurez tecnológica (TRL) — *deducido*

> ⚠️ La ficha **no menciona TRL explícitamente**. Se **deduce** de que financia *investigación industrial* (más temprana) y *desarrollo experimental* (más avanzada), con "riesgo tecnológico" y "aspecto tecnológico diferencial".

- **TRL de inicio:** ~**3–4** (investigación industrial; concepto/validación en laboratorio).
- **TRL de fin:** ~**6–7** (desarrollo experimental; prototipo/piloto validado en entorno relevante), normalmente **sin llegar a producto comercial** (eso sería LIC).
- **Salto típico:** varios niveles dentro de la franja media (p. ej. TRL 4→7).

**Implicación para el match:**
- Proyecto con **riesgo alto / TRL 3–7** → **PID** (sweet spot).
- Proyecto cercano a mercado / TRL ≥7 con riesgo bajo → derivar a **LIC** (o **LICA** si zona asistida + activos).
- Idea pre-TRL 3 / sin componente empresarial → fuera (programas de investigación básica).

---

## 2.bis. ENCAJES SECTORIALES POSITIVOS (para discriminar el fit)

> PID es el más transversal de los tres y el menos restrictivo sectorialmente.

**Encaje FUERTE (subir fit):**
- Deep-tech / tecnologías habilitadoras (IA, robótica avanzada, nuevos materiales, composites).
- Biotecnología, biofarma, salud (incl. ensayos clínicos; subcontratación hasta 80%).
- Energía: renovables, hidrógeno verde, almacenamiento (¡prioridad PO!).
- Descarbonización industrial (siderometalurgia, química).
- Movilidad sostenible y transporte de bajas/nulas emisiones.
- Microelectrónica, fotónica, computación/chips cuánticos.
- Industria 4.0 con I+D real (no mera integración).
- Tecnologías duales / Defensa y Seguridad.

**Encaje DÉBIL (bajar fit):**
- Servicios profesionales, consultoría, e-commerce, contenidos sin I+D diferencial.
- SaaS que sea integración/configuración de tecnología existente (sin reto tecnológico).

> Las exclusiones sectoriales son **mínimas** (ver §3.3): básicamente exportación, productos nacionales, agrícola en ciertos supuestos y cierre de minas. **No** hay exclusión de energía/transporte/banda ancha (a diferencia de LICA).

---

## 3. CRITERIOS DE ELEGIBILIDAD (filtro de match — SÍ / NO)

### 3.1. Beneficiarios ELEGIBLES
- Empresas válidamente constituidas, personalidad jurídica propia, **domicilio fiscal en España**, que desarrollen el **proyecto de I+D en España**.
- Sociedades de capital (SL, SA, comanditaria por acciones); SAT, cooperativas, sociedades laborales, entidades públicas empresariales, etc.
- **Consorcios** de empresas (tipología b), con acuerdo privado de colaboración.
- Asociaciones/fundaciones solo si actividad económica regular + IAE ≥2 años.
- **PO (tipología g):** solo empresas con calificación crediticia ≥ **B- (satisfactoria)** (a nivel de grupo si consolida).

### 3.2. Beneficiarios EXCLUIDOS (descartar)
- Empresas con orden de recuperación pendiente (decisión CE).
- **Empresas en crisis** (art. 2.18 Reglamento UE 651/2014); en concurso o que lo hayan solicitado.
- Empresas/grupo con impagos de reembolsos de ayudas CDTI anteriores.
- Incumplidores de plazos de pago Ley 3/2004 (desde 01/08/2024).
- Personas físicas, autónomos, comunidades de bienes, sociedades civiles/colectivas.
- AIE, UTEs, sociedades de inversión mobiliaria y patrimoniales.
- Asociaciones/fundaciones/sin ánimo de lucro (salvo excepción 3.1).
- Organismos de investigación y centros públicos/privados de I+D+I (pueden ser **subcontratados**, no beneficiarios).
- No estar al corriente con Hacienda/Seguridad Social.
- Entidades en países/territorios no cooperadores (lista UE).

### 3.3. Actividades EXCLUIDAS (RGEC — pocas)
- Ayudas condicionadas al uso de productos nacionales frente a importados.
- Transformación/comercialización de productos agrícolas en ciertos supuestos (ayuda según precio/cantidad o repercutida a productores primarios).
- Cierre de minas de carbón no competitivas.
- Actividades de exportación (cantidades exportadas, red de distribución, gastos corrientes de exportación).

### 3.4. Efecto incentivador (timing)
La solicitud debe presentarse **antes de iniciar el proyecto** (inicio de actividades de I+D o primer acuerdo con contratistas). Permisos y estudios de viabilidad NO cuentan como inicio. (En salud con ensayo clínico, el inicio es el reclutamiento del primer paciente.)

### 3.5. Gastos ELEGIBLES (amplios — gasto de I+D)
- **Personal** (investigadores, técnicos, auxiliares; también autónomo socio). Si FEDER, deben trabajar en la CCAA de desarrollo.
- **Instrumental y material** (amortización por el periodo de uso en el proyecto).
- **Investigación contractual, conocimientos y patentes** adquiridas/licenciadas a precio de mercado; **consultoría y servicios** exclusivos del proyecto (excluida la consultoría de solicitud de la ayuda).
- **Gastos generales** suplementarios derivados del proyecto.
- **Otros gastos de explotación** (materiales, suministros).
- **Auditoría:** máx. 2.000 € por entidad e hito.
- **Gestión y coordinación:** máx. 6.000 € por entidad e hito (8.000 € en tipologías c y d).
- **Informe DNSH** (entidad ENAC): máx. 2.000 € por proyecto (3.000 € líder de consorcio en tipología b).

### 3.6. Gastos NO ELEGIBLES
- Terrenos, locales y obra civil.
- Impuestos indirectos (IVA o equivalentes).
- Homologación / marcado CE (no son I+D).
- Alquiler de licencias o servicios en la nube (van en gastos generales), salvo gasto identificado y contabilizado para el proyecto.
- **Renting** (alquiler). El **leasing** sí es elegible si el activo se queda en la empresa y las cuotas equivalen a amortización.

### 3.7. Subcontratación
- Máx. **65%** del presupuesto elegible (hasta **80%** en biofarmacéutico por el coste de los ensayos).
- A entidades vinculadas: autorización previa + declaración responsable. (Excepción: Centros Tecnológicos vinculados conforme a DA 27ª Ley 38/2003.)

---

## 4. PARÁMETROS PARA EL MATCH (presupuesto, financiación, plazos)

| Parámetro | Valor |
|---|---|
| **Presupuesto mínimo** | **175.000 €** por empresa (consorcio: ninguna empresa autónoma > 70% del total) |
| **Presupuesto — Proyectos Orientados (g)** | mínimo **2.000.000 €**, máximo **30.000.000 €** |
| **Cobertura de la ayuda** | Hasta **85%** del presupuesto total aprobado |
| **Aportación mínima del beneficiario** | **15%** (recursos propios) |
| **Régimen** | Ayuda estatal de I+D (no minimis). Límite de **intensidad** (subvención bruta equivalente) según actividad/tamaño (ver tabla) |
| **Tipo de interés** | Fijo (bonificado). En **PO**: tipo de referencia CE − 50 pb, caso a caso. En tipologías c/d/e/f el interés solo se aplica al tramo reembolsable |
| **Periodo de amortización** | **10 o 15 años** desde el "centro de gravedad" del proyecto; primer reembolso 3 años después del centro de gravedad (mín. 2 años desde fin). Amortización semestral |
| **Duración del proyecto** | **12–36 meses** (tipología b: **12–48 meses**). Hitos de **9–18 meses** |
| **Fin de ejecución (si FEDER 21-27)** | 31/12/2029 (incluidas prórrogas) |
| **Garantías** | En general no se exigen; según evaluación financiera |
| **Compatibilidad** | Incompatible con otras ayudas públicas al mismo proyecto (salvo convenios CDTI–CCAA) |

### Intensidad máxima de ayuda (subvención bruta equivalente)

| Actividad | Pequeña | Mediana | Gran |
|---|---|---|---|
| **Investigación industrial** | 70% | 60% | 50% |
| · con colaboración efectiva / región asistida (a) | 80% | 75% | 65% |
| · región asistida (c) | 75% | 65% | 55% |
| **Desarrollo experimental** | 45% | 35% | 25% |
| · con colaboración efectiva | 60% | 50% | 40% |

### Tramo no reembolsable (TNR) — proyectos de una sola empresa (a, c, d, e, f, g)

| Categoría | PYME | Gran empresa |
|---|---|---|
| FEDER en Andalucía, Canarias, C-LM, Ceuta, Extremadura, Melilla | No aplica | hasta 30% (Canarias) |
| FEDER en resto de CCAA | hasta 20% | No aplica |
| Coop. Internacional / Europea / Capacitación / Duales | hasta 30% | hasta 25% |
| **Proyectos Orientados (PO)** | hasta 33% | hasta 33% |
| Resto de proyectos de I+D (no incluidos arriba) | hasta 17% | hasta 10% |

> El TNR se calcula sobre el 75% del presupuesto (la cobertura extra hasta 85% no genera TNR adicional). Excepción PO: el 33% se calcula sobre toda la cobertura (hasta 85%). Pequeñas mid-cap (≤499 empleados) pueden recibir el TNR de PYME bajo condiciones FEDER. En cooperación nacional (tipología b) hay tabla propia y "prima de arrastre" de +5 pp para grandes con socios PYME financiables FEDER que ejecuten ≥30%.

---

## 5. CRITERIOS DE EVALUACIÓN (base para generar TIPS)

> ⚠️ **Distintos de LIC/LICA.** Total **100**, umbral global **50**. **Umbral duro: criterio B ≥ 20/40** — si no se supera, se desestima sin evaluar el resto.

| Criterio | Peso máx. | Umbral |
|---|---|---|
| **A. Plan de explotación comercial** (necesidad y potencial de mercado, posición competitiva, internacionalización, estrategia y riesgo comercial) | 30 | — |
| **B. Tecnología e innovación** (claridad, necesidad tecnológica, objetivos, **grado de innovación**, metodología/plan de trabajo, cooperación con centros de investigación, justificación del presupuesto, gestión PI, reto tecnológico) | 40 | **20** (eliminatorio) |
| **C. Capacidad de la empresa** (adecuación a estrategia, equilibrio del consorcio, experiencia, capacidad tecnológica/comercial/productiva, adecuación presupuesto-tamaño) | 20 | — |
| **D. Impacto socioeconómico, género, accesibilidad, sostenibilidad** (empleo, inversión privada, sello internacional, perspectiva de género, accesibilidad, sostenibilidad) | 10 | — |
| **TOTAL** | **100** | **50** |

> Subcriterios con más peso dentro de B: **grado de innovación (8)** y **reto tecnológico (6)**. En A, los cinco subcriterios pesan 6 cada uno.

**Evaluación financiera** (paralela): solvencia y adecuación empresa-proyecto. Calificación *mala/deficiente/satisfactoria/buena/excelente*; a "mala/deficiente" se exigen condiciones financieras. PO exige rating ≥ B-.

---

## 6. REGLAS DE MATCH PARA EL AGENTE (lógica derivada)

Descartar la ayuda (NO encaja) si:
- No es empresa con personalidad jurídica / es autónomo / sin ánimo de lucro sin actividad / organismo de I+D (estos van como subcontratados, no beneficiarios).
- Empresa en crisis, en concurso, con impagos a CDTI o no al corriente con Hacienda/SS.
- **PO (g):** empresa sin rating ≥ B-.
- Proyecto **sin componente real de I+D** / sin aspecto tecnológico diferencial (es innovación cercana a mercado → **LIC**; o inversión en activos → **LICA**).
- Presupuesto < 175.000 € por empresa (o < 2 M€ si PO).
- Proyecto ya iniciado antes de solicitar (sin efecto incentivador).
- Actividad excluida (exportación, productos nacionales, etc.).

Encaje fuerte (alta recomendación) si:
- Empresa española con **proyecto de I+D de riesgo tecnológico**, **TRL ~3-7**, aspecto diferencial claro.
- Investigación industrial y/o desarrollo experimental con prototipo/piloto como resultado.
- Presupuesto ≥175 k€, duración 12-36 (48 si consorcio), hitos 9-18 meses.
- Sector deep-tech / biotech / energía-H2 / semiconductores / movilidad / dual.
- Si encaja en área prioritaria 2026 y es gran proyecto (≥2 M€) → valorar **PO** (TNR 33%).
- Si hay consorcio (≥2 empresas, ≥1 PYME) → **tipología b** (mayor intensidad por colaboración + duración hasta 48 m).
- Si hay dimensión internacional (EUREKA, Horizonte, bilaterales) → **tipología c/d** (TNR 30/25%).

Sobre qué proyecto del roadmap aplicarla:
- El proyecto **más exploratorio / de mayor riesgo** del roadmap (lo contrario que LIC/LICA).
- Que produzca conocimiento/prototipo nuevo, no un producto vendible directamente.

---

## 7. TIPS DE ORIENTACIÓN DEL PROYECTO (cómo maximizar puntuación)

Contrastando objetivo de la ayuda ↔ criterios de evaluación:

- **Criterio B (40 pts, UMBRAL ELIMINATORIO 20/40):** es el más importante. Maximizar **grado de innovación (8)** y **reto tecnológico (6)**: dejar explícito qué es nuevo frente al estado del arte y qué incertidumbre técnica se resuelve. Cuidar metodología, plan de trabajo y entregables. Justificar el presupuesto frente a los objetivos. **Si B < 20, el proyecto se cae** aunque el resto sea perfecto.
- **Criterio A (30 pts):** PID exige **plan de explotación comercial** sólido — necesidad y tamaño de mercado, posición competitiva, internacionalización y riesgo comercial. No basta con la excelencia técnica.
- **Criterio C (20 pts):** acreditar capacidad técnica, comercial y productiva, y la adecuación presupuesto-tamaño. En consorcio, demostrar **equilibrio y complementariedad** entre socios.
- **Criterio D (10 pts):** empleo, inversión privada movilizada, perspectiva de género, accesibilidad y sostenibilidad; en proyectos internacionales, probabilidad de obtener sello.
- **Apalancar tipología para más TNR/intensidad:**
  - Colaboración efectiva (consorcio con ≥1 PYME y nadie >70%) → intensidad más alta.
  - Dimensión internacional/europea (c/d) → TNR 30/25% + 8.000 € de gestión.
  - Área prioritaria 2026 y ≥2 M€ → **PO** (TNR 33% + interés rebajado).
- **Cooperación con organismos de investigación:** suma en B.6 y puede activar el tramo de "colaboración efectiva" si asumen ≥10% de costes y pueden publicar.
- **Efecto incentivador:** ⚠️ presentar la solicitud **antes** de iniciar las actividades de I+D o firmar con contratistas.
- **No incluir gasto no elegible** (obra civil, IVA, marcado CE, renting, nube genérica): se eliminará del presupuesto.

---

## 8. CAMPOS QUE EL AGENTE DEBE PEDIR AL CLIENTE PARA ESTA AYUDA

- Forma jurídica y domicilio fiscal; tamaño (pequeña/mediana/gran/mid-cap).
- ¿Proyecto individual o consorcio? (define tipología a vs b).
- ¿Dimensión internacional/europea? (EUREKA, Horizonte, bilateral…) → tipología c/d.
- ¿Encaja en áreas prioritarias 2026 y ≥2 M€? → PO (requiere rating ≥ B-).
- **Naturaleza del proyecto:** ¿hay reto/riesgo tecnológico real y aspecto diferencial? ¿investigación industrial o desarrollo experimental?
- Madurez tecnológica (TRL inicio/fin) y entregable esperado (prototipo/piloto).
- Presupuesto (≥175 k€/empresa; ≥2 M€ si PO) y desglose de gastos.
- CCAA de desarrollo (afecta a FEDER/TNR).
- Duración (12-36 / 48 meses) y nº de hitos (9-18 meses).
- Situación: ¿empresa en crisis? ¿concurso? ¿al corriente con Hacienda/SS y CDTI?
- ¿Se ha iniciado el proyecto? (efecto incentivador).
- ¿Subcontratación prevista? (≤65%, 80% biofarma).

---

## 9. EJEMPLOS CANÓNICOS (patrones de referencia para calibrar el fit)

**Caso FIT ALTO — fitScore ≈ 92**
PYME deep-tech desarrolla un nuevo material composite con incertidumbre técnica real. Investigación industrial + desarrollo experimental, **TRL 4→7**, prototipo validado en entorno relevante. Presupuesto 600 k€, 30 meses, 2 hitos. Tipología a.
→ *Encaje ideal:* riesgo tecnológico claro, aspecto diferencial, entregable de prototipo. Criterio B sólido.

**Caso FIT ALTO (PO) — fitScore ≈ 90**
Gran empresa con proyecto de hidrógeno verde de 5 M€ en área prioritaria 2026, rating B+. 
→ *Proyecto Orientado (g):* TNR 33%, interés bonificado caso a caso. Verificar rating ≥ B- (cumple).

**Caso FIT MEDIO/DERIVAR — fitScore ≈ 55**
Empresa con desarrollo a **TRL 8**, riesgo bajo, casi listo para mercado.
→ *No es el sweet spot de PID* (poco reto tecnológico → riesgo de no superar el umbral B 20/40). Derivar a **LIC** (o **LICA** si zona asistida + inversión en activos).

**Caso FIT BAJO — fitScore ≈ 25 (derivar/descartar)**
Autónomo / startup sin sociedad con una idea pre-TRL 3 y sin plan comercial.
→ *No elegible* (autónomo no es beneficiario; falta madurez y plan de explotación). Derivar a constituir sociedad + instrumentos de fases tempranas (p. ej. Neotec, EIC Pathfinder).

> El agente sitúa el proyecto del cliente respecto al caso más parecido y hereda su rango de fit y guidance.

---

## 10. TIPS DIFERENCIADOS POR PERFIL DE CLIENTE

- **PYME deep-tech / startup tecnológica consolidada:** perfil ideal. Énfasis en reto tecnológico (B) y en construir un plan de explotación comercial creíble (A), que suele ser su punto débil.
- **Gran empresa:** tipología a se financia **solo con fondos CDTI** (salvo Canarias). Para más TNR, valorar PO (área prioritaria) o cooperación internacional/europea. Cuidar adecuación presupuesto-tamaño (C.6).
- **Consorcio (tipología b):** explotar la "colaboración efectiva" (mayor intensidad) y la prima de arrastre; demostrar equilibrio y complementariedad; ninguna empresa >70%.
- **Empresa con proyecto cercano a mercado / TRL alto:** ⚠️ probablemente NO es PID (riesgo de caer por umbral B). Derivar a LIC/LICA.
- **Empresa de servicios/software sin reto tecnológico:** difícil superar el criterio B → reorientar o descartar.

---

## 11. ANTI-PATRONES DE REDACCIÓN (say / don't say)

> Pares utilizables tal cual en el `applicationGuidance`.

**❌ NUNCA usar en la propuesta:**
"producto terminado listo para vender" · "riesgo tecnológico bajo" · "mejora menor" · "integración de tecnología existente" · "sin incertidumbre técnica" · "TRL 9" · "ya está validado comercialmente" · "homologación / marcado CE como objetivo".

**✅ SÍ usar:**
"investigación industrial" · "desarrollo experimental" · "reto/incertidumbre tecnológica" · "aspecto tecnológico diferencial" · "grado de innovación frente al estado del arte" · "prototipo / validación en entorno relevante" · "TRL 4→7" · "plan de explotación comercial".

> Razón: PID premia el **reto tecnológico** (umbral B eliminatorio). El vocabulario de la izquierda posiciona el proyecto como innovación de bajo riesgo (eso es LIC/LICA, y aquí hace caer el criterio B); el de la derecha lo alinea con la finalidad de I+D.

---

## 12. METADATOS Y FUENTES

- **Tipo de ayuda:** préstamo parcialmente reembolsable (ayuda estatal de I+D, Art. 25 RGEC; no minimis).
- **Tasa de éxito histórica:** *desconocida* — no se incluye dato para no calibrar el `fitScore` con cifras inventadas.
- **Versión de la ficha fuente:** texto principal y anexos a 29/01/2026 (CDTI). Las **áreas prioritarias del PO se revisan anualmente** — actualizar para 2027.
- **Fuentes:**
  - Página oficial de la ayuda: https://www.cdti.es/ayudas/proyectos-de-i-d
  - Ficha PDF oficial (29/01/2026): https://www.cdti.es/sites/default/files/2026-02/1._proyectos_de_id_2026_02_1.pdf
  - Sede electrónica: https://sede.cdti.gob.es
