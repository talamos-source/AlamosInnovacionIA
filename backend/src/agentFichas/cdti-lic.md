---
program_slug: cdti-lic
last_updated: 2026-01-29   # fecha de la ficha fuente (texto principal y anexos)
fiche_review_date: 2026-06-19   # fecha en que se elaboró esta ficha para el agente
aliases:
  - "Línea Directa de Innovación"
  - "LIC"
  - "CDTI LIC"
  - "Línea Directa CDTI"
  - "LDI"
  - "Convocatoria Línea Directa de Innovación"
  - "Ayuda LIC"
organisms: ["CDTI"]
bdns_codes: []   # PENDIENTE: LIC es ayuda reembolsable; no consta como subvención típica en BDNS. Verificar variantes (p. ej. LIC DANA) que sí puedan registrar código.
exclusive_with: ["CDTI-PID", "EIC-Accelerator"]   # incompatible con cualquier otra ayuda al MISMO proyecto
similar_alternatives: ["CDTI-PID", "CDTI-LICA", "ENISA", "EIC-Pathfinder"]   # derivar aquí si no encaja
aid_type: "prestamo_parcialmente_reembolsable"
regime: "minimis"   # UE 2023/2831; posible cofinanciación FEDER 21-27
success_rate: null   # DESCONOCIDO — no fabricar. Rellenar si se obtiene dato oficial.
source_urls:
  ficha_oficial_pdf: "https://www.cdti.es/sites/default/files/2023-09/20230720_ficha_lic.pdf"   # PDF público (versión anterior; la base es la ficha 29/01/2026 aportada)
  pagina_ayuda: "https://www.cdti.es/ayudas/linea-directa-de-innovacion"
  sede_electronica: "https://sede.cdti.gob.es"
---

# FICHA DE AYUDA PARA EL AGENTE DE MATCH
## Línea Directa de Innovación (LIC) — CDTI

> **Uso en Discovery:** al procesar una call del EU Portal / BDNS / CDTI, hacer *fuzzy match* del título contra `aliases` + `organisms`. Si matchea → cargar esta ficha como contexto extra. Si no → flujo normal.

> Plantilla reutilizable. Cada sección está pensada para que el agente (1) decida si la ayuda **encaja**, (2) identifique **qué proyecto** del cliente encaja, y (3) genere **tips de orientación** contrastando criterios de evaluación con el objetivo de la ayuda.
> Fuente: Ficha proyectos LIC, CDTI. Texto principal y anexos actualizados a 29/01/2026.

---

## 1. IDENTIFICACIÓN

- **Nombre:** Línea Directa de Innovación (LIC)
- **Organismo:** CDTI (Centro para el Desarrollo Tecnológico y la Innovación)
- **Tipo de instrumento:** Ayuda parcialmente reembolsable (préstamo con tramo no reembolsable).
- **Régimen de ayudas:** Minimis (Reglamento UE 2023/2831). Posible cofinanciación FEDER 21-27.
- **Convocatoria:** Abierta de forma continua todo el año (no competitiva por plazos; evaluación individual).
- **Canal de solicitud:** Sede electrónica CDTI (https://sede.cdti.gob.es), con certificado electrónico del representante legal.

---

## 2. OBJETIVO / FINALIDAD (qué financia)

Proyectos de **innovación tecnológica**: individuales, de una única empresa, **aplicados, muy cercanos al mercado**, con **riesgo tecnológico medio/bajo**, alta probabilidad de alcanzar objetivos técnicos y comerciales y **corto periodo de recuperación de la inversión**. Objetivo: mejorar la competitividad mediante la **incorporación de tecnologías emergentes**.

Actividades que SÍ encajan:
- Incorporación y adaptación activa de tecnologías emergentes en la empresa (incluida la adaptación/mejora de tecnologías a nuevos mercados).
- Aplicación de diseño industrial e ingeniería de producto/proceso para su mejora tecnológica.
- Aplicación de un método de producción o suministro nuevo o significativamente mejorado (cambios significativos en técnicas, equipos y/o software).

Actividades que NO se consideran innovación (descartar):
- Cambios o mejoras de importancia menor.
- Aumento de capacidad productiva con sistemas muy similares a los ya usados.
- Abandono de un proceso.

> **Posicionamiento clave para el match:** LIC ≠ I+D. Es para innovación **próxima a mercado** con TRL alto. Si el proyecto es investigación con riesgo tecnológico alto y TRL bajo, NO es LIC (derivar a otras líneas CDTI tipo PID).

### Madurez tecnológica (TRL) — *deducido*

> ⚠️ La ficha **no menciona TRL de forma explícita**. El rango siguiente se **deduce** de las características que sí define: innovación "muy cercana al mercado", riesgo tecnológico **medio/bajo**, alta probabilidad de alcanzar objetivos, corto periodo de recuperación, e incorporación de tecnologías emergentes; y de la exclusión expresa de proyectos cuyo "resultado sea **directamente comercializable**".

- **TRL de inicio:** ~**6–7** (tecnología ya demostrada en entorno relevante / operativo; el riesgo de I+D fundamental ya está resuelto).
- **TRL de fin:** ~**8** (sistema completo y cualificado, listo para producción), **rozando el 9 pero sin llegar a comercialización directa** — porque un resultado directamente comercializable no es elegible.
- **Salto típico esperado:** subir 1–2 niveles dentro de la franja alta (p. ej. de TRL 6/7 a TRL 8).

**Implicación para el match:** proyectos en TRL ≤5 (investigación / desarrollo experimental temprano, riesgo alto) **no encajan** en LIC → derivar a PID u otras líneas de I+D. Proyectos ya en TRL 9 (producto en venta) tampoco → no hay innovación que financiar.

---

## 2.bis. ENCAJES SECTORIALES POSITIVOS (para discriminar el fit, no solo elegibilidad)

> La elegibilidad (§3) dice quién **puede**; esto orienta el **fitScore** (≈60 vs ≈80) según afinidad histórica con el perfil de proyecto que LIC premia (inversión en activos productivos + salto tecnológico tangible).

**Encaje históricamente FUERTE (subir fit):**
- Manufactura avanzada / Industria 4.0.
- Agroindustria con digitalización de procesos.
- Automoción (proveedores tier-1 / tier-2).
- Energía (no fósil).
- Logística con automatización.
- Textil técnico.
- Alimentación con procesos productivos nuevos o significativamente mejorados.

**Encaje DÉBIL aunque elegibles (bajar fit / advertir riesgo en Bloque A):**
- Consultoría pura.
- SaaS sin componente físico / de proceso productivo.
- E-commerce.
- Contenidos digitales.
- Servicios profesionales.

> Motivo del fit débil: LIC valora inversión en **activos productivos** y salto tecnológico en proceso/producto; los modelos puramente digitales/servicios tienen difícil justificar CAPEX productivo y arriesgan el umbral del Bloque A.

---

## 3. CRITERIOS DE ELEGIBILIDAD (filtro de match — SÍ / NO)

### 3.1. Beneficiarios ELEGIBLES
- Empresas válidamente constituidas, con personalidad jurídica propia, **domicilio fiscal en España** y que **desarrollen el proyecto en España**.
- Sociedades de capital (SL, SA, comanditaria por acciones).
- Entidades cuya actividad principal sea económica: SAT, cooperativas, sociedades laborales, entidades públicas empresariales, sociedades mercantiles estatales, etc.
- Asociaciones y fundaciones **solo si** ejercen actividad económica regular y están de alta en IAE con ≥2 años de antelación a la solicitud.

### 3.2. Beneficiarios EXCLUIDOS (descartar automáticamente)
- Empresas sujetas a orden de recuperación pendiente por ayuda ilegal (decisión CE).
- **Empresas en crisis** (def. art. 2.18 Reglamento UE 651/2014).
- **Grandes empresas** sin calificación crediticia equivalente a **B- o superior**.
- Empresas/grupo con impagos de reembolsos de ayudas CDTI anteriores.
- Entidades que incumplan plazos de pago Ley 3/2004 (morosidad) — exigible desde 01/08/2024.
- Personas físicas, autónomos, comunidades de bienes, sociedades civiles, sociedades colectivas.
- AIE, UTEs, sociedades de inversión mobiliaria y patrimoniales.
- Asociaciones/fundaciones/entidades sin ánimo de lucro (salvo excepción 3.1).
- Organismos de investigación y centros públicos/privados de I+D+I.
- No estar al corriente de obligaciones tributarias o con la Seguridad Social.
- Entidades en países/territorios no cooperadores (lista UE).

### 3.3. Sectores EXCLUIDOS (minimis)
- Producción primaria de pesca/acuicultura.
- Transformación/comercialización de pesca/acuicultura cuando la ayuda dependa de precio/cantidad.
- Producción primaria de productos agrícolas.
- Transformación/comercialización de productos agrícolas en ciertos supuestos (ayuda según precio/cantidad o repercutida a productores primarios).
- Actividades ligadas a exportación (cantidades exportadas, red de distribución, gastos corrientes de exportación).
- Ayudas condicionadas al uso de productos nacionales frente a importados.

> Si la empresa opera en sector excluido **y** en otros, debe garantizar separación de actividades o de cuentas.

### 3.4. Exclusiones adicionales SOLO si hay cofinanciación FEDER 21-27
- Tecnología de **uso exclusivamente militar** (la dual SÍ es financiable).
- Desmantelamiento/construcción de centrales nucleares.
- Tabaco y productos del tabaco.
- Infraestructura aeroportuaria (salvo excepciones).
- Reducción de GEI de actividades del anexo I Directiva 2003/87/CE.
- Vertederos / tratamiento de desechos (salvo excepciones de economía circular).
- Producción/transporte/almacenamiento/combustión de combustibles fósiles (salvo excepciones).
- **Beneficiarios FEDER:** solo **PYMES** (salvo Canarias, donde también grandes empresas; y "pequeñas empresas de mediana capitalización" hasta 499 empleados en I+i).
- Obligación de mantener la inversión en la CCAA ≥5 años (3 años si PYME).
- Requiere informe **DNSH** ex-ante favorable (entidad acreditada por ENAC) antes de firmar contrato.

### 3.5. Gastos ELEGIBLES
- Activos fijos nuevos que supongan **salto tecnológico** relevante.
- Costes de personal.
- Materiales y consumibles.
- Servicios externos y subcontrataciones.
- Gastos generales.
- Auditoría del proyecto (máx. 2.000 €).
- Validación DNSH por entidad ENAC (máx. 2.000 €).

> Los gastos deben ser **posteriores** a la fecha de presentación de la solicitud.

### 3.6. Gastos NO ELEGIBLES (señales para depurar el alcance)
- Inversiones no vinculadas directamente a procesos productivos.
- Proyectos ya finalizados o en estado avanzado de desarrollo.
- Activos para alquilar a terceros; activos de segunda mano.
- Terrenos, edificios, obra civil, mobiliario, vehículos, carretillas, estanterías, etc.
- Leasing/renting; refinanciación; amortización de equipos.
- Costes fuera de mercado.
- Proyectos cuyo resultado sea **directamente comercializable**.
- Mera sustitución/adaptación sin innovación relevante; actualizaciones de software.
- Mera ampliación de capacidad sin diferencia tecnológica (de varios activos similares, solo el primero innovador es elegible).
- Impuestos directos e indirectos.

### 3.7. Subcontratación
- Máx. **80%** del presupuesto elegible (CDTI puede autorizar hasta 100% si está justificado).
- Subcontratación a entidades vinculadas: requiere autorización previa y declaración responsable.

---

## 4. PARÁMETROS PARA EL MATCH (presupuesto, financiación, plazos)

| Parámetro | Valor |
|---|---|
| **Presupuesto mínimo** | 175.000 € |
| **Presupuesto máximo** | 6.000.000 € |
| **Cobertura de la ayuda** | Hasta **75%** del presupuesto (hasta **85%** si cofinanciación FEDER) |
| **Aportación mínima del beneficiario** | 25% (si CDTI 75%) o 15% (si CDTI 85%), recursos propios o financiación externa sin ayuda pública |
| **Tramo no reembolsable (TNR)** | 7% (solo fondos CDTI) / 10% (cofinanciación FEDER). Se calcula siempre sobre el 75% del presupuesto |
| **Tipo de interés** | Fijo. Euríbor 1 año **+0,50%** (amortización 5 años) o **+1%** (amortización 7 años) |
| **Duración del proyecto** | Mínimo **9 meses**, máximo **24 meses**, hito único |
| **Límite minimis** | Máx. **300.000 €** de ayuda de minimis por "única empresa" en 3 años |
| **Fin de ejecución (si FEDER 21-27)** | 31/12/2029 (incluidas prórrogas) |
| **Anticipo** | Hasta 50% (máx. 300.000 €) sin garantías; hasta 75% con avales |
| **Garantías** | En general no se exigen; pueden requerirse según evaluación financiera |
| **Compatibilidad** | **Incompatible** con cualquier otra ayuda al mismo proyecto. Solo acumulable con otros minimis hasta el límite |

---

## 5. CRITERIOS DE EVALUACIÓN (base para generar TIPS)

> El proyecto debe alcanzar **≥50/100 en total** y superar los **umbrales por bloque**. Si no, se desestima.

| Bloque / Criterio | Puntuación máx. | Umbral |
|---|---|---|
| **Capacidad de la empresa y carácter innovador** | 70 | 35 |
| · A. Capacidad técnica de la empresa (adecuación propuesta-estrategia; RRHH y capacidad tecnológica/productiva; capacidad de explotación y alcance de mercado) | 32 | 16 |
| · B. Calidad científico-técnica y grado de innovación (grado de innovación; planificación; justificación del presupuesto; claridad de objetivos y presentación) | 38 | 19 |
| **Impacto socioeconómico, género y sostenibilidad** | 30 | 10 |
| · C. Inversión inducida e impacto socioeconómico (empleo, impacto en pymes, inversión privada movilizada, colaboración transnacional, accesibilidad) | 18 | — |
| · D. Perspectiva de género (orientación de la propuesta y medidas de la empresa) | 6 | — |
| · E. Sostenibilidad (medidas medioambientales y sostenibilidad de la propuesta) | 6 | — |
| **TOTAL** | **100** | **50** |

**Evaluación financiera** (paralela): análisis cuantitativo y cualitativo de solvencia y adecuación empresa-proyecto. Calificación: *mala con dificultades / deficiente / satisfactoria / buena / excelente*.
- PYMES "mala" o "deficiente": se pueden pedir condiciones financieras adicionales.
- Grandes empresas "mala" o "deficiente" (por debajo de B-): **desestimadas**.

---

## 6. REGLAS DE MATCH PARA EL AGENTE (lógica derivada)

Descartar la ayuda (NO encaja) si se cumple cualquiera de:
- La entidad NO es empresa con personalidad jurídica / es autónomo, asociación sin actividad económica, organismo de I+D, etc. (ver 3.2).
- Empresa en crisis, con impagos a CDTI o sin estar al corriente con Hacienda/SS.
- Sector excluido sin separación de cuentas (ver 3.3).
- Presupuesto del proyecto < 175.000 € o > 6.000.000 €.
- Ayuda de minimis ya consumida que dejaría margen < lo solicitado (límite 300.000 € / 3 años).
- El proyecto es I+D de riesgo alto / **TRL ≤5** → derivar a otra línea (no LIC).
- El producto ya está en venta (**TRL 9**, resultado directamente comercializable).
- Resultado directamente comercializable o mera sustitución/ampliación sin innovación.
- El proyecto ya está finalizado o muy avanzado.

Encaje fuerte (alta recomendación) si:
- Empresa española con producto/proceso a mejorar tecnológicamente, **TRL ~6-8** (deducido), riesgo medio/bajo y retorno a corto plazo.
- Necesidad de financiación de **1 proyecto individual** entre 175 k€ y 6 M€, con duración 9-24 meses.
- Busca financiación blanda (préstamo con TNR) y NO necesita subvención a fondo perdido pura.
- Puede aportar el 15-25% restante sin otra ayuda pública.

Sobre qué proyecto del roadmap aplicarla:
- Elegir el proyecto **más cercano a mercado** del roadmap (no el más exploratorio).
- Que tenga inversión en activos/personal vinculada a procesos productivos.
- Que pueda cerrarse en ≤24 meses con un único hito.

---

## 7. TIPS DE ORIENTACIÓN DEL PROYECTO (cómo maximizar puntuación)

Contrastando objetivo de la ayuda ↔ criterios de evaluación:

- **Bloque B (38 pts, el de mayor peso):** redactar la memoria dejando explícito el **grado de innovación** y el salto tecnológico respecto al estado del arte de la empresa. Cuidar planificación realista (hito único, 9-24 meses) y **justificar cada partida del presupuesto** — la "justificación del presupuesto" puntúa aquí.
- **Bloque A (umbral exigente, 16/32):** demostrar que la empresa tiene los **RRHH y capacidad tecnológica/productiva** para ejecutar, y un plan claro de **explotación comercial** (encaja con el carácter "cercano a mercado" de LIC). Alinear la propuesta con la estrategia de la empresa.
- **Encaje con el objetivo:** enfatizar **tecnología emergente** + riesgo medio/bajo + **corto periodo de recuperación**. Evitar lenguaje de "investigación" o riesgo alto (eso baja el encaje con LIC).
- **Bloque C (impacto):** cuantificar empleo creado, inversión privada movilizada y efecto en pymes; mencionar colaboración transnacional y accesibilidad si aplica.
- **Bloques D y E (6 pts cada uno):** incluir medidas concretas de **perspectiva de género** y de **sostenibilidad medioambiental** — son baratas de sumar y suben el total hacia el umbral de 50.
- **Evaluación financiera:** preparar cuentas anuales depositadas y, si la solvencia es ajustada, anticipar condiciones financieras (aval/ampliación de capital).
- **Si se quiere FEDER (cobertura 85% y TNR 10%):** verificar que es PYME (o pequeña mid-cap / Canarias), prever el **informe DNSH ex-ante (ENAC)** y el mantenimiento de la inversión (3 años PYME).
- **Evitar gastos no elegibles** en el presupuesto (obra civil, segunda mano, leasing, software estándar, impuestos): inflan el presupuesto pero serán eliminados y restan credibilidad.
- **Timing:** no iniciar gastos antes de presentar la solicitud (no serían elegibles).

---

## 8. CAMPOS QUE EL AGENTE DEBE PEDIR AL CLIENTE PARA ESTA AYUDA

- Forma jurídica y domicilio fiscal (¿empresa española con personalidad jurídica?).
- Tamaño (PYME / gran empresa / mid-cap) y calificación crediticia aproximada.
- Sector de actividad (¿alguno excluido?).
- Situación: ¿empresa en crisis? ¿al corriente con Hacienda/SS y CDTI?
- Presupuesto del proyecto candidato (rango 175 k€–6 M€).
- Madurez tecnológica (TRL) y nivel de riesgo del proyecto.
- Naturaleza de los gastos (¿personal, activos productivos…?).
- Duración estimada (≤24 meses) e hito único.
- Ayudas de minimis ya recibidas en los últimos 3 años.
- ¿Otra ayuda solicitada al mismo proyecto? (incompatibilidad).
- ¿Interés/elegibilidad para FEDER? (PYME, DNSH).

---

## 9. EJEMPLOS CANÓNICOS (patrones de referencia para calibrar el fit)

**Caso FIT ALTO — fitScore ≈ 95**
Empresa industrial, ~80 empleados. Integra un robot colaborativo + visión artificial para inspección de calidad en una línea de embotellado; reduce scrap un 30%. Presupuesto 800 k€, 18 meses, **TRL 7→8**.
→ *Encaje perfecto:* innovación de proceso cercana a mercado, riesgo medio/bajo, inversión en activos productivos, salto tecnológico claro, retorno corto. Bloques A y B sólidos.

**Caso FIT MEDIO — fitScore ≈ 65**
SaaS B2B de logística incorpora un módulo de IA para optimización de rutas. Presupuesto 250 k€.
→ *Encaja por tecnología emergente, pero débil en "inversión en activos productivos"* → riesgo de no superar el umbral del **Bloque A (16/32)**. Recomendar reforzar narrativa de activos tecnológicos (plataforma/infra como CAPEX) o valorar línea I+D alternativa.

**Caso FIT BAJO — fitScore ≈ 40 (derivar)**
Startup con prototipo de laboratorio de un nuevo material composite, **TRL 4**, riesgo tecnológico alto.
→ *NO es LIC* (es I+D temprana). Derivar a **CDTI PID** o **EIC Pathfinder**.

> El agente debe usar estos casos como anclas: situar el proyecto del cliente respecto al más parecido y heredar su rango de fit y su guidance.

---

## 10. TIPS DIFERENCIADOS POR PERFIL DE CLIENTE

> Parametriza la guidance genérica de §7 según el perfil detectado.

- **PYME industrial:** enfatizar (a) capacidad técnica del equipo (Bloque A), (b) **track FEDER al 85%** de cobertura, (c) **salto TRL claro y medible**. Suele ser el perfil de mayor fit.
- **PYME de servicios / SaaS:** ⚠️ ojo al **Bloque A** — preparar narrativa de "activos tecnológicos" (servidores, plataformas como CAPEX). Evaluar si conviene una **línea de I+D** en lugar de LIC.
- **Gran empresa:** verificar **rating ≥ B-** antes de nada; si no llega → **auto-descarte** (no puede ser beneficiaria). Recordar que FEDER solo aplica a PYME (salvo Canarias / pequeña mid-cap).
- **Tecnología ya en TRL 8 alto:** **acotar bien el delta** tecnológico del proyecto y **NO** afirmar que tras el proyecto se vende directamente (resultado directamente comercializable = no elegible).

---

## 11. ANTI-PATRONES DE REDACCIÓN (say / don't say)

> Pares utilizables tal cual en el `applicationGuidance` que genera el agente.

**❌ NUNCA usar en la propuesta:**
"investigación" · "riesgo tecnológico alto" · "producto terminado listo para venta" · "I+D fundamental" · "TRL 3" · "PoC inicial" · "estudio de viabilidad".

**✅ SÍ usar:**
"innovación tecnológica" · "incorporación de tecnología emergente" · "salto tecnológico" · "validación en entorno operativo" · "TRL 7→8" · "preparación para producción".

> Razón: el vocabulario de la izquierda posiciona el proyecto como I+D de riesgo (fuera de LIC); el de la derecha lo alinea con el objetivo de la línea (innovación cercana a mercado, riesgo medio/bajo).

---

## 12. METADATOS Y FUENTES

- **Tipo de ayuda:** préstamo parcialmente reembolsable (no subvención a fondo perdido).
- **Tasa de éxito histórica:** *desconocida* — no se incluye dato para no calibrar el `fitScore` con una cifra inventada. Rellenar `success_rate` en el frontmatter si se obtiene fuente oficial.
- **Versión de la ficha fuente:** texto principal y anexos a 29/01/2026 (CDTI). Revisar vigencia si `last_updated` supera ~12 meses.
- **Fuentes:**
  - Página oficial de la ayuda: https://www.cdti.es/ayudas/linea-directa-de-innovacion
  - Ficha PDF pública (versión anterior de referencia): https://www.cdti.es/sites/default/files/2023-09/20230720_ficha_lic.pdf
  - Sede electrónica (solicitud y justificación): https://sede.cdti.gob.es
