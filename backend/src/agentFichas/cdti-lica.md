---
program_slug: cdti-lica
last_updated: 2026-01-29   # fecha de la ficha fuente (texto principal y anexos)
fiche_review_date: 2026-06-19   # fecha en que se elaboró esta ficha para el agente
aliases:
  - "Línea Directa de Expansión"
  - "LICA"
  - "LIC A"
  - "CDTI LICA"
  - "Línea Directa de Expansión CDTI"
  - "Convocatoria Línea Directa de Expansión"
  - "Ayuda LICA"
organisms: ["CDTI"]
bdns_codes: []   # PENDIENTE: ayuda reembolsable; no consta como subvención típica en BDNS. Verificar variantes (p. ej. LICA DANA).
exclusive_with: ["CDTI-LIC", "CDTI-PID", "EIC-Accelerator"]   # incompatible con cualquier otra ayuda (directa/indirecta, pública/privada) al MISMO proyecto
similar_alternatives: ["CDTI-LIC", "CDTI-PID", "ENISA"]   # si NO está en zona asistida → LIC; si es I+D de riesgo → PID
aid_type: "prestamo_parcialmente_reembolsable"
regime: "ayuda_regional_a_la_inversion"   # RGEC UE 651/2014 + Mapa de Ayudas Regionales España 2022-2027. ¡NO es minimis!
geographic_scope: "solo_zonas_asistidas"   # filtro crítico de match
success_rate: null   # DESCONOCIDO — no fabricar.
source_urls:
  ficha_oficial_pdf: "https://www.cdti.es/sites/default/files/2026-02/4._lica_2026_02.pdf"
  pagina_ayuda: "https://www.cdti.es/ayudas/linea-directa-de-expansion"
  sede_electronica: "https://sede.cdti.gob.es"
  mapa_ayudas_regionales: "Mapa Español de Ayudas Estatales de Finalidad Regional 2022-2027 (Decisión CE 17/03/2022, mod. 13/12/2023)"
---

# FICHA DE AYUDA PARA EL AGENTE DE MATCH
## Línea Directa de Expansión (LICA / LIC A) — CDTI

> **Uso en Discovery:** al procesar una call del EU Portal / BDNS / CDTI, hacer *fuzzy match* del título contra `aliases` + `organisms`. Si matchea → cargar esta ficha. Si no → flujo normal.
> **Relación con LIC:** LICA es la versión **regional** de la LIC. Misma filosofía de innovación cercana a mercado, pero con dos diferencias capitales: (1) **solo en zonas asistidas** y (2) **solo financia inversión en activos fijos** (no personal, ni servicios, ni consumibles). Si el proyecto NO está en zona asistida → derivar a **LIC**.
> Fuente: Ficha LICA, CDTI. Texto principal y anexos a 29/01/2026.

---

## 1. IDENTIFICACIÓN

- **Nombre:** Línea Directa de Expansión (LICA / LIC A)
- **Organismo:** CDTI
- **Tipo de instrumento:** Ayuda parcialmente reembolsable (préstamo con tramo no reembolsable).
- **Régimen de ayudas:** **Ayuda regional a la inversión** (RGEC UE 651/2014 + Mapa de Ayudas Regionales 2022-2027). **NO es minimis** (a diferencia de la LIC) → no aplica el tope de 300.000 €, pero sí los límites de intensidad regional (Anexo II).
- **Convocatoria:** Abierta de forma continua todo el año, hasta agotar fondos.
- **Canal de solicitud:** Sede electrónica CDTI (https://sede.cdti.gob.es), con certificado del representante legal.

---

## 2. OBJETIVO / FINALIDAD (qué financia)

Proyectos de **inversión** tecnológicamente innovadores que faciliten el **crecimiento** de la empresa en **regiones españolas más desfavorecidas** (zonas asistidas). Misma base que la LIC: proyectos individuales, aplicados, **muy cercanos al mercado**, riesgo tecnológico **medio/bajo**, corto periodo de recuperación, incorporando tecnologías emergentes.

Se financian **ayudas a la inversión inicial** ligadas a al menos uno de estos objetivos:
- **Creación** de un nuevo establecimiento.
- **Ampliación de la capacidad** de un establecimiento existente.
- **Diversificación** de la producción hacia productos/servicios que antes no se producían en él.
- **Transformación fundamental** del proceso global de producción/servicio.
- Inversión inicial que **crea una nueva actividad económica** (nuevo establecimiento o diversificación a actividad no similar — distinta categoría NACE de 4 dígitos).

> **Posicionamiento clave para el match:** LICA = inversión en **activos productivos** con salto tecnológico, **en zona asistida**. No es I+D (riesgo alto/TRL bajo → PID). No es para gasto de personal/servicios (→ LIC). No es mera ampliación de capacidad sin innovación.

### Madurez tecnológica (TRL) — *deducido*

> ⚠️ La ficha **no menciona TRL explícitamente**. Se **deduce** del mismo lenguaje que la LIC (cercano a mercado, riesgo medio/bajo, recuperación corta) aplicado a inversión en activos.

- **TRL de inicio:** ~**6–7** (tecnología demostrada en entorno relevante/operativo).
- **TRL de fin:** ~**8** (capacidad productiva nueva operativa), sin que el resultado sea mera comercialización.
- **Salto típico:** +1–2 niveles en la franja alta.

**Implicación:** TRL ≤5 (I+D de riesgo) → derivar a PID. Proyecto sin componente de inversión en activos → derivar a LIC.

---

## 2.bis. ENCAJES SECTORIALES POSITIVOS (para discriminar el fit)

> Igual que en LIC, pero con un matiz crítico: LICA financia **activos**, así que premia aún más los sectores intensivos en maquinaria/equipo, y penaliza con fuerza los modelos sin activo físico.

**Encaje históricamente FUERTE (subir fit) — siempre que estén EN zona asistida:**
- Manufactura avanzada / Industria 4.0 (nueva línea, robótica, automatización).
- Agroindustria con nueva capacidad productiva digitalizada.
- Automoción (proveedores tier-1 / tier-2).
- Logística con automatización (almacenes automáticos, AGV…).
- Textil técnico.
- Alimentación con procesos productivos nuevos / planta nueva.

**Encaje DÉBIL o NULO (bajar fit / derivar):**
- Consultoría, servicios profesionales, e-commerce, contenidos digitales.
- SaaS / software sin inversión en activos productivos → casi sin gasto elegible en LICA (mejor LIC).

> ⚠️ **Sectores EXCLUIDOS por normativa** (ver §3.3), no solo "débiles": acero, carbón/lignito, **transporte**, **energía** (producción/almacenamiento/transporte/distribución, **incluidas renovables y biocarburantes**), **banda ancha**, pesca/acuicultura, producción agrícola primaria. ⚠️ Ojo: **energía/renovables sí encajaba en LIC pero está EXCLUIDA en LICA.**

---

## 3. CRITERIOS DE ELEGIBILIDAD (filtro de match — SÍ / NO)

### 3.0. FILTRO GEOGRÁFICO (el más distintivo — aplicar PRIMERO)

El proyecto de inversión debe ejecutarse en una **zona asistida** del Mapa de Ayudas Regionales 2022-2027:

- **Zonas "a" (PYMES + GRANDES empresas):** Canarias, Andalucía, Extremadura, Castilla-La Mancha, Ceuta, Melilla, Región de Murcia.
- **Zonas "c" (SOLO PYMES; grandes empresas NO):** Aragón (excluida Zaragoza capital), Asturias, Islas Baleares, Cantabria, Castilla y León, Cataluña (parcial), Comunidad de Madrid (parcial), Comunidad Valenciana, Galicia, Navarra (parcial), La Rioja, País Vasco (parcial).

> Para zonas "parcialmente" asistidas hay que verificar municipio/distrito/sección censal en el Mapa vigente. **Si el establecimiento del proyecto NO está en zona asistida → LICA NO encaja → derivar a LIC.**

### 3.1. Beneficiarios ELEGIBLES
- Empresas válidamente constituidas, personalidad jurídica propia, **domicilio fiscal en España**, que desarrollen el **proyecto de inversión en zona asistida**.
- Sociedades de capital (SL, SA, comanditaria por acciones); SAT, cooperativas, sociedades laborales, entidades públicas empresariales, etc.
- En zonas "c": **solo PYMES**. En zonas "a": PYMES y grandes empresas.
- Asociaciones/fundaciones solo si actividad económica regular + IAE ≥2 años.

### 3.2. Beneficiarios EXCLUIDOS (descartar)
- Empresas con orden de recuperación pendiente (decisión CE).
- **Empresas en crisis** (art. 2.18 Reglamento UE 651/2014).
- Empresas/grupo con impagos de reembolsos de ayudas CDTI anteriores.
- Incumplidores de plazos de pago Ley 3/2004 (desde 01/08/2024).
- Personas físicas, autónomos, comunidades de bienes, sociedades civiles/colectivas.
- AIE, UTEs, sociedades de inversión mobiliaria y patrimoniales.
- Asociaciones/fundaciones/sin ánimo de lucro (salvo excepción 3.1).
- Organismos de investigación y centros públicos/privados de I+D+I.
- No estar al corriente con Hacienda/Seguridad Social.
- Entidades en países/territorios no cooperadores (lista UE).
- **Deslocalización:** la empresa NO puede haberse trasladado al establecimiento desde otro país del EEE en los 2 años previos, y se compromete a no hacerlo en los 2 años siguientes.

### 3.3. Sectores/actividades EXCLUIDOS (RGEC)
Acero · carbón · lignito · **transporte e infraestructura de transporte** · **energía** (producción, almacenamiento, transporte, distribución e infraestructuras) · **inversión en producción de energías renovables/biocarburantes/biomasa** · **banda ancha** · pesca y acuicultura (incl. transformación) · producción agrícola primaria · cierre de minas de carbón · actividades de exportación · ayudas condicionadas al uso de productos nacionales · transformación/comercialización de productos agrícolas en ciertos supuestos.

### 3.4. Reglas adicionales si hay cofinanciación FEDER 21-27
- Exclusiones FEDER (tabaco, nuclear, aeropuertos, militar exclusivo, GEI anexo I Directiva 2003/87/CE, etc.) — ver Anexo III de la ficha.
- Mantenimiento de la inversión en la zona ≥5 años (3 años PYME).
- (LICA cofinanciada con FEDER eleva el TNR — ver §4 / Anexo I.)

### 3.5. Inversiones ELEGIBLES (¡solo activos fijos nuevos!)
- **Activos materiales:** maquinaria y equipos **nuevos** que supongan innovación tecnológica y mejora de capacidad productiva.
- **Activos inmateriales:** patentes, licencias, conocimientos técnicos, otros derechos de PI/PII. Condiciones: usarse solo en el establecimiento beneficiario, ser amortizables, adquirirse a terceros no vinculados, permanecer ≥5 años (3 PYME).
  - **Grandes empresas:** activos inmateriales elegibles solo hasta **50%** del total de costes elegibles.
- **Diversificación:** los costes elegibles deben superar el **200% del valor contable** de los activos reutilizados (>3× ese valor).

### 3.6. Inversiones/gastos NO ELEGIBLES
- ⚠️ **Personal, materiales, consumibles, servicios externos, subcontrataciones, gastos generales, auditoría, validación DNSH** → **NO elegibles** en LICA (justo lo contrario que en LIC). LICA financia activos, no gasto corriente.
- Inversiones no vinculadas a procesos productivos.
- Mera sustitución (no es inversión inicial).
- Terrenos, edificios, obra civil, mobiliario, vehículos, carretillas, estanterías, etc.
- Amortización de equipos; leasing/renting; activos de segunda mano.
- Activos que se desplacen fuera del lugar del proyecto.
- Actualizaciones de software / adaptaciones de equipos.
- Refinanciación; costes fuera de mercado.
- Ampliación de capacidad sin innovación tecnológica relevante.
- Impuestos.

### 3.7. Efecto incentivador (requisito de timing)
La solicitud debe presentarse **antes de iniciar los trabajos** (primer pedido en firme de equipos o inicio de construcción). Compra de terrenos, permisos y estudios de viabilidad NO cuentan como inicio. El CDTI puede exigir acta notarial / comprobación física del no inicio.

---

## 4. PARÁMETROS PARA EL MATCH (presupuesto, financiación, plazos)

| Parámetro | Valor |
|---|---|
| **Presupuesto mínimo** | 175.000 € |
| **Presupuesto máximo** | **30.000.000 €** (vs 6 M€ en LIC) |
| **Cobertura de la ayuda** | Hasta **75%** del presupuesto |
| **Aportación mínima del beneficiario** | **25%** (recursos propios o financiación externa sin ayuda pública) |
| **Régimen** | Ayuda regional (NO minimis). Sujeta a **intensidad máxima** del Mapa Regional (Anexo II) |
| **Tramo no reembolsable (TNR)** | **10%** (fondos CDTI) / **15%–30%** (cofinanciación FEDER, según región y tamaño — Anexo I). Se calcula sobre el 75% del presupuesto |
| **Tipo de interés** | Fijo = **Euríbor 1 año + 0,75%** (mínimo 0,75% si Euríbor ≤0) |
| **Periodo de amortización** | **9 años**, con **1 año de carencia** de capital desde fin del proyecto |
| **Amortización** | Semestral (principal + intereses). Anticipada con penalización 1% |
| **Duración del proyecto** | Mínimo **9 meses**, máximo **24 meses**, hito único |
| **Fin de ejecución (si FEDER 21-27)** | 31/12/2029 (incluidas prórrogas) |
| **Garantías** | En general no se exigen; según evaluación financiera |
| **Compatibilidad** | **Incompatible** con cualquier otra ayuda (directa/indirecta, pública/privada) al mismo proyecto |

### TNR por región/tamaño (Anexo I — resumen)

| Región | Gran empresa (FEDER / CDTI) | Mediana (FEDER / CDTI) | Pequeña (FEDER / CDTI) |
|---|---|---|---|
| Andalucía, Melilla, Extremadura, Canarias | 30% / 10% | 30% / 10% | 30% / 10% |
| Castilla-La Mancha, Ceuta, Murcia | 20% / 10% | 30% / 10% | 30% / 10% |
| Cantabria, Galicia, CyL, C. Valenciana, Baleares, La Rioja, Asturias, Aragón(*), Cataluña(*), Madrid(*), Navarra(*), País Vasco(*) | N.A. (grandes no elegibles) | 15% / 10% | 25% / 10% |

> (*) Zonas parcialmente asistidas: verificar municipio en el Mapa. En estas zonas "c" las grandes empresas no son beneficiarias.

### Intensidad máxima de ayuda (Anexo II — resumen, % sobre costes elegibles)

| Región | Gran | Mediana | Pequeña |
|---|---|---|---|
| Canarias | 60% | 70% | 80% |
| Andalucía (salvo Almería/Cádiz/Córdoba), Extremadura, Melilla | 40% | 50% | 60% |
| Almería, Cádiz, Córdoba, Castilla-La Mancha, Ceuta, Murcia | 30–50% | 40–60% | 50–70% |
| Cantabria, Galicia, CyL, C. Valenciana, Baleares, La Rioja, Asturias, Aragón, Cataluña(*), Madrid(*), Navarra(*), País Vasco(*) | N.A. | 25% | 35% |

> La intensidad (equivalente de subvención bruta vía bonificación de tipo + TNR) no puede superar el límite regional vigente.

---

## 5. CRITERIOS DE EVALUACIÓN (base para generar TIPS)

> **Idénticos a la LIC.** Mínimo **50/100 total** + umbrales por bloque. Si no, se desestima.

| Bloque / Criterio | Puntuación máx. | Umbral |
|---|---|---|
| **Capacidad de la empresa y carácter innovador** | 70 | 35 |
| · A. Capacidad técnica (adecuación propuesta-estrategia; RRHH y capacidad tecnológica/productiva; capacidad de explotación y mercado) | 32 | 16 |
| · B. Calidad científico-técnica y grado de innovación (innovación; planificación; justificación del presupuesto; claridad de objetivos) | 38 | 19 |
| **Impacto socioeconómico, género y sostenibilidad** | 30 | 10 |
| · C. Inversión inducida e impacto socioeconómico (empleo, pymes, inversión privada movilizada, colaboración transnacional, accesibilidad) | 18 | — |
| · D. Perspectiva de género | 6 | — |
| · E. Sostenibilidad | 6 | — |
| **TOTAL** | **100** | **50** |

**Evaluación financiera** (paralela): solvencia y adecuación empresa-proyecto. Calificación: *mala con dificultades / deficiente / satisfactoria / buena / excelente*. A las "mala/deficiente" se les pueden exigir condiciones financieras adicionales.

---

## 6. REGLAS DE MATCH PARA EL AGENTE (lógica derivada)

Descartar la ayuda (NO encaja) si se cumple cualquiera de:
- ⚠️ El establecimiento del proyecto **NO está en zona asistida** → derivar a **LIC**.
- **Gran empresa** con proyecto en **zona "c"** (solo PYMES) → no elegible (revisar si encaja en zona "a").
- Entidad no empresa con personalidad jurídica / autónomo / sin ánimo de lucro sin actividad / organismo I+D.
- Empresa en crisis, impagos a CDTI, no al corriente con Hacienda/SS.
- Sector excluido (acero, carbón, transporte, **energía/renovables**, banda ancha, pesca, agrícola primario) sin separación de actividades.
- Deslocalización en los 2 años previos.
- Presupuesto < 175.000 € o > 30.000.000 €.
- El proyecto **no consiste en inversión en activos fijos nuevos** (es gasto de personal/servicios) → derivar a **LIC**.
- Es I+D de riesgo alto / TRL ≤5 → derivar a **PID**.
- Mera sustitución o ampliación de capacidad sin innovación.
- Ya iniciados los trabajos antes de solicitar (sin efecto incentivador).

Encaje fuerte (alta recomendación) si:
- Empresa española **ubicada en zona asistida** (PYME en zona "c"; PYME o gran empresa en zona "a").
- Proyecto de **inversión en maquinaria/equipos nuevos** con salto tecnológico, **TRL ~6-8**, riesgo medio/bajo.
- Objetivo: nueva planta, ampliación de capacidad, diversificación o transformación de proceso.
- Presupuesto 175 k€–30 M€, duración 9-24 meses, hito único.
- Aún no ha iniciado pedidos/obra (efecto incentivador intacto).

Sobre qué proyecto del roadmap aplicarla:
- El que implique **CAPEX productivo** (compra de activos) en el establecimiento de zona asistida.
- Que aporte aumento de capacidad **con innovación tecnológica** (no mera ampliación).
- Cerrable en ≤24 meses con un único hito.

---

## 7. TIPS DE ORIENTACIÓN DEL PROYECTO (cómo maximizar puntuación)

Contrastando objetivo de la ayuda ↔ criterios de evaluación:

- **Bloque B (38 pts):** dejar explícito el **grado de innovación tecnológica** de los activos adquiridos (no es una compra rutinaria) y **justificar cada partida** con oferta/presupuesto detallado de proveedor (requisito de elegibilidad). Planificación realista (hito único, ≤24 meses).
- **Bloque A (umbral 16/32):** demostrar **capacidad técnica y productiva** para integrar y explotar los nuevos activos, y alineación con la estrategia de crecimiento de la empresa.
- **Encaje con el objetivo regional:** enfatizar el **impacto en la zona asistida** — creación de empleo, efecto tractor sobre pymes locales, inversión privada movilizada (puntúa en Bloque C, 18 pts).
- **Tipo de inversión inicial:** identificar claramente cuál de los 4 supuestos aplica (nuevo establecimiento / ampliación de capacidad / diversificación / transformación de proceso) — y, si es diversificación, acreditar que los costes superan el 200% del valor contable de activos reutilizados.
- **Efecto incentivador:** ⚠️ NO firmar pedidos ni iniciar obra antes de presentar la solicitud; mencionar explícitamente que la inversión no se haría (o sería menor/en otro lugar) sin la ayuda.
- **Bloques D y E (6 pts c/u):** sumar medidas de perspectiva de género y de sostenibilidad ambiental.
- **TNR óptimo:** la cofinanciación FEDER eleva el TNR (15-30% según región/tamaño) frente al 10% de fondos CDTI — valorar el track FEDER si la región y el tamaño lo favorecen (p. ej. pequeña empresa en Andalucía/Canarias/Extremadura → TNR 30%).
- **No incluir gasto no elegible** (personal, servicios, consumibles, obra civil, segunda mano): en LICA esto es no elegible por definición y resta credibilidad al presupuesto.

---

## 8. CAMPOS QUE EL AGENTE DEBE PEDIR AL CLIENTE PARA ESTA AYUDA

- **Ubicación exacta del establecimiento del proyecto** (CCAA, provincia, municipio) → comprobar zona asistida y "a"/"c".
- Tamaño de empresa (PYME / gran empresa) — determinante en zonas "c".
- Forma jurídica y domicilio fiscal.
- Sector de actividad (¿alguno excluido: energía/renovables, transporte, acero, banda ancha…?).
- Situación: ¿empresa en crisis? ¿al corriente con Hacienda/SS y CDTI?
- ¿Ha habido deslocalización desde el EEE en los 2 años previos?
- **Naturaleza del proyecto:** ¿es inversión en activos fijos nuevos? ¿qué supuesto (nuevo establecimiento / ampliación / diversificación / transformación)?
- Presupuesto del proyecto (175 k€–30 M€) y desglose de activos materiales/inmateriales.
- Madurez tecnológica (TRL) y nivel de riesgo.
- Duración estimada (≤24 meses), hito único.
- ¿Se han iniciado pedidos/obra? (efecto incentivador).
- ¿Interés/elegibilidad FEDER? (afecta al TNR).

---

## 9. EJEMPLOS CANÓNICOS (patrones de referencia para calibrar el fit)

**Caso FIT ALTO — fitScore ≈ 95**
PYME industrial ubicada en **Extremadura** (zona "a"). Invierte 1,5 M€ en una nueva línea de producción automatizada (robótica + visión artificial) que amplía capacidad e incorpora un salto tecnológico. **TRL 7→8**, 18 meses. No ha iniciado pedidos.
→ *Encaje perfecto:* zona asistida, inversión en activos nuevos, ampliación de capacidad con innovación, impacto local en empleo. TNR 30% (pequeña/mediana en Extremadura).

**Caso FIT MEDIO — fitScore ≈ 60**
Gran empresa en **Cataluña (zona parcialmente asistida "c")** quiere invertir en maquinaria nueva.
→ *Riesgo de no elegibilidad:* en zonas "c" las **grandes empresas no son beneficiarias**. Hay que verificar municipio en el Mapa; si no es zona "a", **derivar a LIC**. Si fuera PYME, el fit subiría.

**Caso FIT BAJO — fitScore ≈ 30 (derivar)**
Empresa de software en **Madrid capital** quiere financiar desarrollo de una plataforma (gasto de personal, sin activos físicos).
→ *NO es LICA:* fuera de zona asistida + sin inversión en activos elegibles. Derivar a **LIC** (si hay innovación cercana a mercado) o a **PID** (si es I+D).

> El agente debe situar el proyecto del cliente respecto al caso más parecido y heredar su rango de fit y guidance.

---

## 10. TIPS DIFERENCIADOS POR PERFIL DE CLIENTE

- **PYME industrial en zona asistida:** perfil ideal. Énfasis en (a) salto tecnológico de los activos, (b) impacto local (empleo, efecto tractor), (c) track FEDER para maximizar TNR.
- **Gran empresa:** **verificar primero que el establecimiento está en zona "a"** (en zonas "c" no es beneficiaria). Recordar el límite del 50% en activos inmateriales.
- **Empresa de servicios / software:** normalmente **fuera de LICA** (sin activos elegibles) → derivar a LIC. Solo encaja si hay inversión real en equipos/maquinaria.
- **Proyecto de diversificación:** acreditar el umbral del 200% del valor contable de activos reutilizados; si no se cumple, replantear como ampliación o transformación.
- **Empresa con pedidos ya en firme:** ⚠️ probable pérdida del efecto incentivador → puede ser inelegible; valorar si queda inversión futura no comprometida.

---

## 11. ANTI-PATRONES DE REDACCIÓN (say / don't say)

> Pares utilizables tal cual en el `applicationGuidance`.

**❌ NUNCA usar en la propuesta:**
"investigación" · "riesgo tecnológico alto" · "I+D fundamental" · "TRL 3" · "PoC inicial" · "estudio de viabilidad" · "mera ampliación de capacidad" · "sustitución de equipos" · "ya hemos pedido la maquinaria".

**✅ SÍ usar:**
"inversión inicial" · "ampliación de capacidad con innovación tecnológica" · "transformación fundamental del proceso" · "salto tecnológico" · "creación de empleo en la zona" · "TRL 7→8" · "activos fijos nuevos" · "efecto incentivador" · "preparación para producción".

> Razón: el vocabulario de la izquierda posiciona el proyecto como I+D de riesgo o como gasto no elegible / inversión ya iniciada; el de la derecha lo alinea con la finalidad regional y de inversión de la LICA.

---

## 12. METADATOS Y FUENTES

- **Tipo de ayuda:** préstamo parcialmente reembolsable (ayuda regional a la inversión, no minimis).
- **Tasa de éxito histórica:** *desconocida* — no se incluye dato para no calibrar el `fitScore` con cifras inventadas. Rellenar `success_rate` si se obtiene fuente oficial.
- **Versión de la ficha fuente:** texto principal y anexos a 29/01/2026 (CDTI). Revisar vigencia si `last_updated` supera ~12 meses, y especialmente el Mapa de Ayudas Regionales (puede cambiar zonas/intensidades).
- **Fuentes:**
  - Página oficial de la ayuda: https://www.cdti.es/ayudas/linea-directa-de-expansion
  - Ficha PDF oficial (29/01/2026): https://www.cdti.es/sites/default/files/2026-02/4._lica_2026_02.pdf
  - Sede electrónica: https://sede.cdti.gob.es
  - Mapa Español de Ayudas Estatales de Finalidad Regional 2022-2027.
