---
program_slug: cdti-misiones
convocatoria_tipo: anual_concurrencia_competitiva   # sale ANUALMENTE; fechas, año y dotación de la edición omitidos a propósito.
fiche_review_date: 2026-06-19
plan_marco: "Plan Estatal de Investigación Científica, Técnica y de Innovación 2024-2027 — Programa de Transferencia y Colaboración"
bases_reguladoras: "Orden CNU/161/2025, de 7 de febrero (mod. Orden CNU/331/2026)"
aliases:
  # Nota IMPORTANTE: "Misiones" es palabra genérica. Excluimos:
  #  - "Misiones" suelto (matchearía "Misiones diplomáticas/espaciales/humanitarias")
  #  - "Convocatoria Misiones" (matchearía "Convocatoria Misiones diplomáticas")
  # Los aliases restantes son INEQUÍVOCOS: o llevan "CDTI" o llevan
  # "Ciencia e Innovación" (frase única del programa). "Programa Misiones"
  # se acepta porque es estructura típica CDTI ("Programa X") y muy improbable
  # en otros contextos de financiación.
  - "Programa Misiones"
  - "Misiones Ciencia e Innovación"
  - "Misiones de Ciencia e Innovación"
  - "Ayudas Misiones CDTI"
  - "Misiones CDTI"
organisms: ["CDTI", "Ministerio de Ciencia, Innovación y Universidades"]
bdns_codes: []   # PENDIENTE: como subvención SÍ se publica en BDNS. Rellenar con el código de la edición.
exclusive_with: []   # subvención sujeta a límites de intensidad/acumulación RGEC; incompatible con otra ayuda para los mismos costes por encima de la intensidad máxima.
similar_alternatives: ["AEI-CPP-Colaboracion-Publico-Privada", "CDTI-PID-Cooperacion-Nacional", "EIC-Pathfinder"]
aid_type: "subvencion_no_reembolsable"
regime: "ayuda_estatal_id_art25_rgec"   # RGEC UE 651/2014. Concurrencia COMPETITIVA.
aid_object: "proyecto_id_cooperativo_gran_escala_liderado_por_empresas"
collaboration_required: true   # agrupación de 3-6 empresas + subcontratación obligatoria a organismos de investigación
mission_bound: true            # la propuesta DEBE encuadrarse en una de las "misiones" del año (cambian anualmente)
success_rate: null             # DESCONOCIDO — no fabricar.
source_urls:
  convocatoria_pdf: "Resolución de convocatoria Misiones Ciencia e Innovación (anual, aportada por la usuaria)"
  pagina_ayuda: "https://www.cdti.es/ayudas"   # buscar 'Misiones Ciencia e Innovación'
  sede_electronica: "https://sede.cdti.gob.es"
  bases_reguladoras_boe: "Orden CNU/161/2025, de 7 de febrero (BOE)"
---

# FICHA DE AYUDA PARA EL AGENTE DE MATCH
## Programa Misiones Ciencia e Innovación — CDTI

> **Uso en Discovery:** *fuzzy match* del título contra `aliases` + `organisms`. Si matchea → cargar esta ficha.
> **⚠️ Naturaleza propia:** Misiones financia **grandes proyectos de I+D en cooperación, liderados por empresas**, que dan respuesta a **retos estratégicos de la sociedad** ("misiones"). Es **subvención a fondo perdido**, en **concurrencia competitiva**, con **agrupación obligatoria de 3-6 empresas** y **subcontratación obligatoria a organismos de investigación**. Es el instrumento CDTI de **mayor presupuesto por proyecto** (3,5-10 M€).
> **⚠️ Las "misiones" (retos/sectores concretos) CAMBIAN CADA AÑO.** Esta ficha generaliza los **ámbitos temáticos recurrentes** para un match grueso; la **misión concreta de cada edición debe verificarse manualmente** (`mission_bound: true`).
> Fuente: Convocatoria Misiones (anual) bajo Orden CNU/161/2025. **Fechas, año y dotación de la edición omitidos a propósito.**

---

## 1. IDENTIFICACIÓN

- **Nombre:** Programa Misiones Ciencia e Innovación.
- **Organismo:** CDTI — Plan Estatal 2024-2027, Programa de Transferencia y Colaboración (bases: Orden CNU/161/2025).
- **Tipo de instrumento:** **Subvención (no reembolsable)**.
- **Régimen:** Ayuda estatal de I+D (Art. 25 RGEC), en **concurrencia competitiva**.
- **Convocatoria:** **Anual**, plazo de solicitud acotado.
- **Canal de solicitud:** Sede electrónica del CDTI (https://sede.cdti.gob.es); firma del representante de la agrupación.

---

## 2. OBJETIVO / FINALIDAD (qué financia)

Proyectos de **I+D en cooperación liderados por empresas** que persigan una **investigación relevante** para resolver **desafíos transversales y estratégicos** de la sociedad española, mejoren la base de conocimiento y tecnología de las empresas y **estimulen la cooperación público-privada**. La propuesta **debe encuadrarse en una de las "misiones"** del Anexo I de la convocatoria de cada año; si no encaja en ninguna, **se desestima**.

### Madurez tecnológica (TRL) — *deducido*

> ⚠️ No se fija TRL numérico, pero el proyecto debe tener **≥40% del presupuesto en investigación industrial** y el resto en desarrollo experimental → I+D de **riesgo medio-alto**, no cercana a mercado.

- **Rango orientativo:** ~**TRL 3-7** (investigación industrial + desarrollo experimental). Más exploratorio que LIC/LICA; comparable o algo más temprano que un PID grande.
- **Clave para el match:** gran proyecto **colaborativo de I+D alineado con un reto-misión**. No es inversión (LICA) ni innovación cercana a mercado (LIC).

---

## 2.bis. ÁMBITOS TEMÁTICOS RECURRENTES (extrapolados; la misión concreta cambia cada año)

> ⚠️ **Lista orientativa para match grueso, NO la lista oficial de un año.** Cada edición publica sus misiones concretas (p. ej. una misión específica de "redes eléctricas y almacenamiento" o de "salud de las mujeres"). El agente debe (1) usar estos ámbitos para un primer filtro de encaje y (2) **marcar para verificación manual** contra el Anexo I de la convocatoria vigente.

Ámbitos que recurren año tras año (con variaciones de redacción):
- **Energía y transición energética** (renovables, redes inteligentes, almacenamiento, hidrógeno/e-fuels, eficiencia).
- **Movilidad y transporte sostenible** (automoción, aeronáutica, conectividad, vehículo eléctrico/autónomo).
- **Salud y biomedicina** (terapias, diagnóstico, resistencia antimicrobiana, salud de las mujeres, biotecnología).
- **Agroalimentación y soberanía alimentaria** (producción sostenible, cadena agroalimentaria, bioeconomía).
- **Digitalización y tecnologías habilitadoras** (IA, microelectrónica/fotónica, ciberseguridad, datos).
- **Sostenibilidad, economía circular, agua y medioambiente** (descarbonización, gestión de recursos).
- **Seguridad, defensa y autonomía estratégica** (tecnologías duales, capacidades críticas).
- **Industria avanzada / fabricación** y, en algunas ediciones, **construcción/vivienda sostenible** o **turismo**.

> Si el proyecto del cliente encaja claramente en uno de estos ámbitos → fit potencial; **confirmar** que existe una misión equivalente en la convocatoria del año.

---

## 3. CRITERIOS DE ELEGIBILIDAD (filtro de match — SÍ / NO)

### 3.0. ESTRUCTURA DE LA AGRUPACIÓN (filtro más distintivo)
- Beneficiaria = **agrupación de empresas** sin personalidad jurídica (cada empresa es beneficiaria).
- **Mínimo 3 y máximo 6 empresas**; **al menos 2 autónomas entre sí**; **al menos 1 PYME**.
- Una empresa actúa como **representante/coordinadora**.
- **Ninguna empresa (ni grupo vinculado) > 70%** del presupuesto elegible.
- **Subcontratación obligatoria ≥15%** del presupuesto total elegible **a organismos de investigación** (universidades, OPIs, centros tecnológicos, institutos sanitarios, ICTS…), con participación relevante.

> Los **organismos de investigación NO son beneficiarios** (a diferencia del CPP de la AEI): participan **vía subcontratación**. Beneficiarias son solo **empresas**.

### 3.1. Entidades beneficiarias
- **Empresas** válidamente constituidas con **domicilio fiscal en España** (o establecimiento/sucursal en España si domicilio en la UE).
- Todas las integrantes deben cumplir los requisitos de beneficiario.

### 3.2. Entidades EXCLUIDAS
- Las del art. 13.2 y 13.3 Ley 38/2003 (incl. **morosidad** art. 13.3 bis); con reintegros pendientes.
- Orden de recuperación CE pendiente.
- Sin **cuentas anuales depositadas** al corriente.
- **Empresas en crisis** (art. 2.18 RGEC; se mira el grupo si consolida).
- Entidades en jurisdicciones no cooperativas / terceros países de alto riesgo.

### 3.3. Requisitos del proyecto (Art. 2)
- **Encuadrarse en una misión** del Anexo I del año (si no → desestimación).
- **Presupuesto elegible: mín. 3.500.000 € / máx. 10.000.000 €** (mín. **175.000 € por empresa**).
- **Investigación industrial ≥ 40%** del presupuesto elegible.
- **≥15% subcontratado a organismos de investigación**.
- **Duración: 3 o 4 años** (plurianual), inicio el ejercicio siguiente.
- **Ejecución en territorio español**.
- Distribución presupuestaria equilibrada por años.

### 3.4. Efecto incentivador (Art. 8)
Presentar la solicitud **antes de comenzar la actividad**.

---

## 4. PARÁMETROS PARA EL MATCH (cuantía, intensidad, plazos)

| Parámetro | Valor |
|---|---|
| **Modalidad** | Subvención (no reembolsable) |
| **Presupuesto elegible del proyecto** | **3.500.000 € – 10.000.000 €** |
| **Presupuesto mínimo por empresa** | **175.000 €** |
| **Duración** | **3 o 4 años** |
| **Subvención mínima por entidad** | **≥ 40%** de su presupuesto elegible |
| **Investigación industrial** | **≥ 40%** del presupuesto elegible |
| **Subcontratación a organismos de investigación** | **≥ 15%** del presupuesto total elegible (obligatorio) |
| **Subcontratación máxima por beneficiario** | **50%** (hasta **70%** en ensayos clínicos/preclínicos de salud) |
| **Costes indirectos** | 20% a tanto alzado sobre costes directos |
| **Consultoría de coordinación** | hasta 15.000 €/año (representante) · **Auditoría** 1.500 €/año · **Viajes de coordinación** 5.000 € |
| **Régimen** | Concurrencia competitiva |

### Intensidad máxima de ayuda (ESB; media ponderada según mezcla de actividades)

| Actividad | Pequeña | Mediana | Gran |
|---|---|---|---|
| **Investigación industrial** | 70% | 60% | 50% |
| · con colaboración efectiva | 80% | 75% | 65% |
| **Desarrollo experimental** | 45% | 35% | 25% |
| · con colaboración efectiva | 60% | 50% | 40% |

> "Colaboración efectiva" = ninguna empresa asume >70% de costes y al menos una es PYME, o colaboración entre empresas de ≥2 Estados UE/EEE (la subcontratación NO cuenta como colaboración efectiva).

### Costes ELEGIBLES / NO ELEGIBLES (resumen)
- **Elegibles:** personal; instrumental/material (amortización); investigación contractual, conocimientos y patentes; consultoría exclusiva del proyecto; gastos generales; auditoría; viajes de coordinación; tasas de ensayos clínicos.
- **NO elegibles:** gastos financieros; terrenos, locales y obra civil; impuestos indirectos (IVA); promoción y difusión; manutención; locomoción/viajes (salvo coordinación).

---

## 5. CRITERIOS DE EVALUACIÓN (base para generar TIPS)

> La convocatoria remite a las **bases (Orden CNU/161/2025, art. 20.a)** para criterios y pesos. **Dato confirmado:** elegible con **nota ≥ 50/100**. Concurrencia competitiva → se financia por orden de prelación hasta agotar presupuesto (con reservas por misión en algunas ediciones).

**Ejes de valoración (cualitativos; pesos exactos en las bases — `PENDIENTE` confirmar, no inventar):**
- **Calidad científico-técnica e innovación** del proyecto (reto tecnológico, objetivos, metodología).
- **Impacto** (científico, socioeconómico, alineamiento con la misión/reto, mercado y transferencia, sostenibilidad).
- **Capacidad del consorcio** (complementariedad, liderazgo empresarial, participación de organismos de investigación).
- **Adecuación del presupuesto** y del plan de trabajo.

> El agente NO debe inventar pesos; usar el umbral confirmado (≥50) y describir los ejes. Para pesos exactos: OCR/consulta de la Orden CNU/161/2025.

---

## 6. REGLAS DE MATCH PARA EL AGENTE (lógica derivada)

Descartar la ayuda (NO encaja) si:
- ⚠️ No hay **agrupación de 3-6 empresas** (≥2 autónomas, ≥1 PYME) → inelegible. Si el cliente va solo o con consorcio pequeño → CDTI PID / AEI CPP.
- El proyecto **no encaja en ninguna misión/ámbito** estratégico → desestimación (verificar misión del año).
- Presupuesto total < 3,5 M€ o > 10 M€.
- Investigación industrial < 40%, o sin subcontratar ≥15% a organismos de investigación.
- Empresa(s) en crisis, con morosidad, o sin cuentas depositadas.
- Es inversión (LICA) o innovación cercana a mercado (LIC), no I+D colaborativa.

Encaje fuerte (alta recomendación) si:
- Grupo de **3-6 empresas** (con ≥1 PYME y partners de investigación) con un **gran proyecto de I+D (3,5-10 M€, 3-4 años)** alineado con un **ámbito-misión** estratégico.
- Reparto equilibrado (ninguna empresa >70%), ≥40% investigación industrial, ≥15% a organismos de investigación.
- Vocación de impacto socioeconómico y transferencia, en territorio español.

Cómo encaja en el roadmap:
- Es el instrumento para el **proyecto tractor / de gran escala** del cliente, en colaboración, alineado con un reto país.
- Si el proyecto es más pequeño o sin misión → derivar a PID (cooperación) o, si la colaboración es con organismos de investigación como cobeneficiarios, a **CPP (AEI)**.

---

## 7. TIPS DE ORIENTACIÓN DEL PROYECTO (cómo maximizar puntuación)

- **Encaje con la misión (decisivo):** alinear explícitamente los objetivos con el reto-misión del año y sus "ámbitos de actuación"; si no encaja, no se evalúa.
- **Calidad e innovación:** dejar claro el **reto tecnológico** y el ≥40% de investigación industrial (no maquillar desarrollo experimental como investigación).
- **Consorcio sólido:** demostrar **complementariedad** entre las 3-6 empresas, liderazgo del representante y **participación relevante de organismos de investigación** (más allá del 15% mínimo).
- **Impacto y transferencia:** cuantificar impacto socioeconómico, empleo, inversión movilizada, sostenibilidad y plan de explotación/PI.
- **Equilibrio presupuestario:** reparto por años equilibrado, ninguna empresa >70%, mín. 175 k€/empresa.
- **Efecto incentivador:** presentar antes de iniciar.
- **Salud:** aprovechar el margen de subcontratación ampliado (70%) para ensayos clínicos/preclínicos.

---

## 8. CAMPOS QUE EL AGENTE DEBE PEDIR AL CLIENTE PARA ESTA AYUDA

- ¿Puede formar una **agrupación de 3-6 empresas** (≥2 autónomas, ≥1 PYME)? ¿quién lidera?
- ¿Tiene **partners de investigación** para subcontratar ≥15%?
- ¿El proyecto encaja en algún **ámbito-misión** estratégico? (verificar misión del año).
- Presupuesto total (3,5-10 M€) y por empresa (≥175 k€); reparto (ninguna >70%).
- % de **investigación industrial** (≥40%).
- Duración (3 o 4 años); ejecución en España.
- Tamaño de cada empresa (intensidad) y situación (crisis/morosidad/cuentas depositadas).
- ¿Proyecto ya iniciado? (efecto incentivador).

---

## 9. EJEMPLOS CANÓNICOS (patrones de referencia para calibrar el fit)

**Caso FIT ALTO — score ≈ 90**
Agrupación de 4 empresas (2 grandes + 2 PYME) lidera un proyecto de 7 M€, 4 años, sobre **almacenamiento energético y redes inteligentes** (ámbito-misión recurrente), con 45% de investigación industrial y 20% subcontratado a una universidad y un centro tecnológico.
→ *Encaje ideal:* consorcio correcto, alineado con misión, reparto equilibrado, fuerte componente de I+D y transferencia.

**Caso FIT MEDIO — score ≈ 60**
Buen proyecto colaborativo pero con investigación industrial al 35% o subcontratación a organismos por debajo del 15%, o encaje dudoso con la misión del año.
→ *Riesgo de exclusión o baja nota:* rebalancear actividades y confirmar la misión vigente.

**Caso FIT BAJO — score ≈ 25 (derivar)**
Empresa que quiere un proyecto individual de 800 k€, o un consorcio de 2 empresas sin partner de investigación, o un proyecto sin encaje en ninguna misión.
→ *No es Misiones:* derivar a **CDTI PID (cooperación)** o, si los organismos de investigación van como cobeneficiarios, a **CPP (AEI)**.

> El agente sitúa el caso del cliente respecto al más parecido y hereda su rango de fit y guidance.

---

## 10. TIPS DIFERENCIADOS POR PERFIL DE CLIENTE

- **Gran empresa tractora:** ideal como líder de la agrupación; cuidar que ninguna supere el 70% y que haya ≥1 PYME real.
- **PYME tecnológica:** valiosa para cumplir la composición y elevar intensidad (colaboración efectiva); destacar su aportación diferencial.
- **Cliente con proyecto pequeño / sin misión / sin consorcio:** no encaja → derivar a PID/CPP.
- **Proyecto de salud:** aprovechar subcontratación ampliada (70%) para ensayos clínicos.

---

## 11. ANTI-PATRONES DE REDACCIÓN (say / don't say)

> Pares utilizables en el `applicationGuidance`.

**❌ NUNCA usar:**
"proyecto individual" · "sin colaboración" · "cercano a mercado / sin riesgo" · "inversión productiva" · "sin relación con los retos estratégicos" · "consorcio de 2 empresas".

**✅ SÍ usar:**
"proyecto de I+D en cooperación liderado por empresas" · "agrupación de 3-6 empresas con participación de organismos de investigación" · "alineado con la misión / reto estratégico" · "investigación industrial" · "impacto socioeconómico y transferencia" · "cooperación público-privada".

> Razón: Misiones exige **gran consorcio empresarial + organismos de investigación + encaje en una misión**; el vocabulario de la izquierda revela ausencia de colaboración, escala o alineación con los retos (causas de inelegibilidad o baja nota).

---

## 12. METADATOS Y FUENTES

- **Tipo de ayuda:** subvención no reembolsable, concurrencia competitiva (Art. 25 RGEC). Gran proyecto de I+D colaborativo liderado por empresas, alineado con misiones-país.
- **Distinción con CPP (AEI):** ambas son colaborativas, pero **Misiones (CDTI)** = solo empresas beneficiarias (3-6), organismos de investigación vía subcontratación ≥15%, presupuesto 3,5-10 M€, subvención; **CPP (AEI)** = organismos de investigación cobeneficiarios, mezcla subvención+préstamo, mínimo 350 k€. El análogo CDTI más pequeño es el **PID de Cooperación Nacional**.
- **Misiones anuales:** los retos/sectores **cambian cada año**; esta ficha generaliza ámbitos recurrentes (`mission_bound: true`) → **verificar la misión concreta del año**.
- **Criterios de evaluación:** umbral confirmado (≥50); **pesos detallados en la Orden CNU/161/2025, art. 20.a — PENDIENTE de confirmar (no inventar).**
- **Tasa de éxito histórica:** *desconocida* — no se incluye para no calibrar el `fitScore` con cifras inventadas.
- **Fuentes:**
  - Página CDTI (buscar "Misiones Ciencia e Innovación"): https://www.cdti.es/ayudas
  - Bases reguladoras: Orden CNU/161/2025, de 7 de febrero (mod. Orden CNU/331/2026).
  - Convocatoria Misiones (anual): sede electrónica del CDTI — https://sede.cdti.gob.es
