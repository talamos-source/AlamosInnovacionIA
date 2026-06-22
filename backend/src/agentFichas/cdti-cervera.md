---
program_slug: cdti-cervera
convocatoria_tipo: ventanilla_abierta_permanente   # NO es anual: convocatoria permanentemente abierta, solicitud continua (como LIC/LICA/PID).
fiche_review_date: 2026-06-19
fuente_ficha: "Ficha proyectos de I+D de Transferencia Cervera, CDTI (texto y anexos 29/01/2026)"
aliases:
  # Nota: NO incluir "Cervera" suelto — apellido común. Genera falsos
  # positivos con becas, premios o programas universitarios nominales
  # (ej. "Beca Cervera para estudios médicos", "Premio Cervera de
  # investigación pediátrica"). Aliases válidos son los que llevan
  # contexto inequívoco: "Transferencia", "CDTI" o el nombre completo.
  - "Transferencia Cervera"
  - "Proyectos de I+D de Transferencia Tecnológica Cervera"
  - "I+D Transferencia Cervera"
  - "Ayudas Cervera"
  - "CDTI Cervera"
organisms: ["CDTI"]
bdns_codes: []   # PENDIENTE: ayuda reembolsable; verificar registro.
exclusive_with: ["CDTI-PID"]   # incompatible con otra ayuda pública al MISMO proyecto (salvo convenios CCAA, EDF/EDIDP). No combinar con PID sobre el mismo proyecto.
similar_alternatives: ["CDTI-PID", "CDTI-LIC", "AEI-CPP-Colaboracion-Publico-Privada"]
aid_type: "prestamo_parcialmente_reembolsable"
regime: "ayuda_estatal_id_art25_rgec"   # Art. 25 RGEC. NO es minimis.
aid_object: "proyecto_id_individual_con_transferencia_de_centro_de_conocimiento"
target_company: "PYME_o_MIDCAP (<=1500 empleados); NO grandes empresas"
thematic_bound: true   # debe encajar en una 'tecnología prioritaria Cervera' (Anexo I) — lista relativamente estable
transfer_required: true # subcontratación obligatoria >=10% a centros generadores de conocimiento (Anexo II)
success_rate: null
source_urls:
  pagina_ayuda: "https://www.cdti.es/ayudas"   # buscar 'Cervera'
  sede_electronica: "https://sede.cdti.gob.es"
---

# FICHA DE AYUDA PARA EL AGENTE DE MATCH
## Proyectos de I+D de Transferencia Tecnológica "CERVERA" — CDTI

> **Uso en Discovery:** *fuzzy match* del título contra `aliases` + `organisms`. Si matchea → cargar esta ficha.
> **⚠️ Naturaleza propia:** Cervera es un **proyecto de I+D individual** (una empresa) **con transferencia obligatoria**: solo para **PYMES y MIDCAPS**, en **áreas tecnológicas prioritarias Cervera**, y con **subcontratación ≥10% a un centro generador de conocimiento**. Es **préstamo parcialmente reembolsable** (no subvención) y de **ventanilla permanentemente abierta** (solicitud continua, no competitiva). En la práctica = **PID + sello de transferencia + restricción de tamaño y temática + mayor cobertura (90%) y TNR fijo (33%)**.
> Fuente: Ficha CDTI de Transferencia Cervera. **Sin fechas (ventanilla abierta).**

---

## 1. IDENTIFICACIÓN

- **Nombre:** Proyectos de I+D de Transferencia Tecnológica "Cervera".
- **Organismo:** CDTI.
- **Tipo de instrumento:** **Ayuda parcialmente reembolsable** (tramo reembolsable + TNR). Posible cofinanciación FEDER 21-27.
- **Régimen:** Ayuda estatal de I+D (Art. 25 RGEC). **No es minimis.**
- **Convocatoria:** **Permanentemente abierta** (solicitud continua todo el año; no competitiva por plazos).
- **Canal de solicitud:** Sede electrónica del CDTI (https://sede.cdti.gob.es), certificado del representante legal.

---

## 2. OBJETIVO / FINALIDAD (qué financia)

Fortalecer las capacidades de innovación de **PYMES y MIDCAPS** mediante la **contratación de actividades de I+D a centros generadores de conocimiento** (o la ejecución de I+D en colaboración con ellos). Financia I+D empresarial **aplicada** para crear o mejorar significativamente un proceso/producto/servicio, con **aspecto tecnológico diferencial**; comprende **investigación industrial y/o desarrollo experimental**.

> **Dos condiciones esenciales y propias de Cervera:**
> 1. El proyecto debe encuadrarse en una **tecnología prioritaria Cervera** (Anexo I — §2.bis).
> 2. Debe **subcontratar ≥10%** del presupuesto a un **centro generador de conocimiento** (universidad, OPI, centro tecnológico… del Anexo II), y **mantener ese ≥10% al cierre** o se exige devolución.

### Madurez tecnológica (TRL) — *deducido*

> ⚠️ No fija TRL. Investigación industrial + desarrollo experimental → I+D de riesgo medio.
- **Rango orientativo:** ~**TRL 3-7** (como el PID).
- **Clave para el match:** I+D **individual con transferencia** desde un centro de conocimiento, en una temática Cervera, para una **PYME/MIDCAP**.

---

## 2.bis. TECNOLOGÍAS PRIORITARIAS CERVERA (filtro sectorial — Anexo I, lista estable)

> El proyecto debe encajar en una de estas **áreas temáticas** (eliminatorio):

- **Materiales avanzados** (nanomateriales, superficies funcionalizadas, materiales para energía/transporte/salud…).
- **Economía circular** (reducción de materias primas, reciclado/valorización, recuperación de suelos, tratamiento de aguas).
- **Transición energética** (renovables, almacenamiento — baterías/electrolizadores/pilas de combustible, hidrógeno).
- **Fabricación inteligente / Industria 4.0** (procesos flexibles automatizados, sensorización embebida).
- **Tecnologías para la salud.**
- **Cadena alimentaria segura y saludable.**
- **Deep learning / Inteligencia Artificial.**
- **Redes móviles avanzadas.**
- **Transporte inteligente.**
- **Protección de la información** (ciberseguridad).
- **Computación cuántica.**

> Si el proyecto encaja en una de estas áreas → fit potencial. Si no → no es Cervera (valorar PID, que no tiene restricción temática).

---

## 3. CRITERIOS DE ELEGIBILIDAD (filtro de match — SÍ / NO)

### 3.1. Beneficiarios ELEGIBLES (restricción de tamaño propia)
- **Solo PYMES y MIDCAPS** (MIDCAP = no PYME con **≤1.500 empleados**, con independencia de balance/facturación).
- Válidamente constituidas, **personalidad jurídica propia**, **domicilio fiscal en España**, proyecto de I+D en España.
- Sociedades de capital y entidades con actividad económica (SAT, cooperativas, sociedades laborales…).

> ⚠️ **Las grandes empresas (>1.500 empleados) NO son elegibles** (a diferencia del PID).

### 3.2. Beneficiarios EXCLUIDOS
- **Grandes empresas** (>1.500 empleados).
- Empresas con orden de recuperación CE pendiente.
- **Empresas en crisis** / en concurso.
- Empresas/grupo con impagos de reembolsos de ayudas CDTI.
- Incumplidores de plazos de pago (Ley 3/2004).
- Personas físicas, autónomos, comunidades de bienes, sociedades civiles/colectivas.
- AIE, UTEs, sociedades de inversión mobiliaria/patrimonial.
- Asociaciones/fundaciones/sin ánimo de lucro (salvo excepción IAE ≥2 años).
- Organismos de investigación y centros públicos/privados de I+D+I (estos van como **subcontratados**, no beneficiarios).
- No estar al corriente con Hacienda/SS; jurisdicciones no cooperadoras.

### 3.3. Requisito de transferencia (Art. 4) — propio de Cervera
- **Subcontratación ≥10%** del presupuesto a un **centro generador de conocimiento** (Anexo II). Puede ser uno o varios contratos.
- El **≥10% debe mantenerse o superarse al final**; si no, **devolución de la ayuda**.
- Cuidado con CGC **vinculados** a la empresa (relaciones laborales de administradores/empleados): el CDTI puede excluir esa subcontratación si no está justificada.

### 3.4. Actividades EXCLUIDAS (RGEC — pocas)
Productos nacionales vs importados · transformación/comercialización agrícola en ciertos supuestos · cierre de minas de carbón · actividades de exportación.

### 3.5. Efecto incentivador
Solicitud **antes de iniciar** el proyecto (inicio de I+D o primer acuerdo con contratistas).

### 3.6. Gastos ELEGIBLES / NO ELEGIBLES
- **Elegibles:** personal; instrumental/material (amortización); investigación contractual, conocimientos y patentes; consultoría exclusiva; gastos generales; otros gastos de explotación; auditoría (≤2.000 €/hito); gestión y coordinación (≤6.000 €/hito); informe DNSH (≤2.000 €).
- **NO elegibles:** terrenos, locales y obra civil; impuestos indirectos (IVA); homologación/marcado CE; renting; alquiler de licencias/nube genérica.
- **Subcontratación total:** máx 65% (80% biofarmacéutico). [La ≥10% a CGC es obligatoria dentro de esto.]

---

## 4. PARÁMETROS PARA EL MATCH (cobertura, plazos, condiciones)

| Parámetro | Valor |
|---|---|
| **Modalidad** | Ayuda parcialmente reembolsable (préstamo + TNR) |
| **Cobertura** | Hasta **90%** del presupuesto aprobado (empresa aporta ≥10%) |
| **Tramo no reembolsable (TNR)** | **33%** de la cobertura financiera |
| **Tipo de interés** | Euríbor a 1 año (0% si negativo); fijado a la aprobación |
| **Amortización** | **10 o 15 años** desde el centro de gravedad; primer reembolso 3 años después (mín. 2 desde fin). Semestral |
| **Presupuesto mínimo** | **175.000 €** (no se fija máximo explícito) |
| **Duración** | **12–36 meses**; hitos de **9–18 meses** |
| **Subcontratación a centro de conocimiento** | **≥10%** obligatorio (mantener al cierre) |
| **Régimen** | Ventanilla permanentemente abierta (no competitiva) |
| **Compatibilidad** | Incompatible con otra ayuda pública al mismo proyecto (salvo convenios CCAA, EDF/EDIDP) |
| **Tamaño** | Solo PYME / MIDCAP (≤1.500 empleados) |

### Intensidad máxima de ayuda (ESB)

| Actividad | Pequeña | Mediana | Gran* |
|---|---|---|---|
| **Investigación industrial** | 70% | 60% | 50%* |
| · con colaboración efectiva / región asistida (a) | 80% | 75% | 65% |
| · región asistida (c) | 75% | 65% | 55% |
| **Desarrollo experimental** | 45% | 35% | 25%* |
| · con colaboración efectiva | 60% | 50% | 40% |
| · región asistida (c) | 50% | 40% | 30% |

> *La columna "gran" de la tabla RGEC aplica a la mediana capitalización (MIDCAP); recordar que las grandes empresas reales (>1.500 empleados) **no son beneficiarias**. La cobertura financiera se recorta si la ESB supera el límite de intensidad.

---

## 5. CRITERIOS DE EVALUACIÓN (base para generar TIPS)

> ⚠️ **Idénticos al PID.** Total **100**, umbral global **50**. **Umbral duro: criterio B ≥ 20/40** (si no, desestimación sin evaluar el resto).

| Criterio | Peso máx. | Umbral |
|---|---|---|
| **A. Plan de explotación comercial** (necesidad y potencial de mercado, posición competitiva, internacionalización, estrategia/riesgo comercial) | 30 | — |
| **B. Tecnología e innovación** (claridad, necesidad y objetivos tecnológicos, **grado de innovación (8)**, metodología, **adecuación de los centros generadores de conocimiento (B.6)**, justificación del presupuesto, PI, **reto tecnológico (6)**) | 40 | **20** (eliminatorio) |
| **C. Capacidad de la empresa** (adecuación a estrategia, capacidad tecnológica/comercial/productiva, adecuación presupuesto-tamaño) | 20 | — |
| **D. Impacto socioeconómico, género y sostenibilidad** (empleo, inversión privada, sello internacional, género, accesibilidad, sostenibilidad) | 10 | — |
| **TOTAL** | **100** | **50** |

> Específico de Cervera: el subcriterio **B.6 valora la adecuación de las capacidades del centro generador de conocimiento** al proyecto → elegir bien el partner de transferencia puntúa.

---

## 6. REGLAS DE MATCH PARA EL AGENTE (lógica derivada)

Descartar la ayuda (NO encaja) si:
- La empresa es **gran empresa (>1.500 empleados)** → derivar a **PID**.
- El proyecto **no encaja en una tecnología prioritaria Cervera** → PID (sin restricción temática).
- No hay (ni habrá) **subcontratación ≥10% a un centro generador de conocimiento** → PID.
- No es empresa con personalidad jurídica / es autónomo / sin ánimo de lucro / organismo de I+D.
- Empresa en crisis, en concurso, con impagos a CDTI o no al corriente.
- Sin componente real de I+D / sin aspecto diferencial (es innovación cercana a mercado → LIC; inversión → LICA).
- Presupuesto < 175.000 €.
- Proyecto ya iniciado (sin efecto incentivador).

Encaje fuerte (alta recomendación) si:
- **PYME o MIDCAP** española con un proyecto de **I+D individual** (TRL ~3-7) en una **temática Cervera**.
- Va a **subcontratar ≥10% a una universidad/centro tecnológico/OPI** (transferencia).
- Busca financiación blanda con **alta cobertura (90%) y TNR 33%**.
- Presupuesto ≥175 k€, 12-36 meses.

Cómo encaja en el roadmap:
- Proyecto de I+D que la PYME/MIDCAP quiere apoyar en un **centro de conocimiento** (transferencia), en un área estratégica Cervera. Si no cumple temática/transferencia o es gran empresa → PID.

---

## 7. TIPS DE ORIENTACIÓN DEL PROYECTO (cómo maximizar puntuación)

- **Criterio B (40 pts, UMBRAL 20 eliminatorio):** maximizar **grado de innovación (8)** y **reto tecnológico (6)**; explicitar el aspecto diferencial frente al estado del arte. **Cuidar B.6:** justificar que el **centro generador de conocimiento** elegido tiene capacidades idóneas para el proyecto (clave en Cervera).
- **Transferencia bien diseñada:** que el ≥10% al centro de conocimiento aporte valor real (no un trámite); mantenerlo hasta el final (si baja, hay devolución).
- **Criterio A (30 pts):** plan de explotación comercial sólido (mercado, posición competitiva, internacionalización).
- **Criterio C (20 pts):** capacidad técnica, comercial y productiva de la empresa; adecuación presupuesto-tamaño.
- **Criterio D (10 pts):** empleo, inversión movilizada, perspectiva de género y sostenibilidad.
- **Encaje temático:** alinear con una tecnología prioritaria Cervera del Anexo I.
- **Aprovechar la cobertura (90%) y TNR (33%):** atractivo frente al PID (85% / TNR variable).
- **Efecto incentivador:** presentar antes de iniciar; no incluir gasto no elegible (obra civil, IVA, marcado CE, renting, nube genérica).

---

## 8. CAMPOS QUE EL AGENTE DEBE PEDIR AL CLIENTE PARA ESTA AYUDA

- Tamaño: ¿PYME o MIDCAP (≤1.500 empleados)? (si gran empresa → PID).
- ¿El proyecto encaja en una **tecnología prioritaria Cervera**? (¿cuál?).
- ¿Va a **subcontratar ≥10% a un centro generador de conocimiento**? ¿cuál (universidad/centro tecnológico/OPI)?
- ¿Hay reto/riesgo tecnológico real y aspecto diferencial? (investigación industrial / desarrollo experimental).
- Presupuesto (≥175 k€) y duración (12-36 meses).
- Situación: ¿empresa en crisis? ¿concurso? ¿al corriente con Hacienda/SS y CDTI?
- ¿Proyecto ya iniciado? (efecto incentivador).
- ¿Acepta financiación reembolsable (préstamo con TNR)?

---

## 9. EJEMPLOS CANÓNICOS (patrones de referencia para calibrar el fit)

**Caso FIT ALTO — score ≈ 90**
PYME industrial con un proyecto de **materiales avanzados** (TRL 4→7) que subcontrata el 15% a un centro tecnológico y una universidad para la caracterización del material. Presupuesto 500 k€, 24 meses.
→ *Encaje ideal:* tamaño correcto, temática Cervera, transferencia real (B.6 fuerte), I+D con reto tecnológico. Cobertura 90%, TNR 33%.

**Caso FIT MEDIO — score ≈ 60**
MIDCAP con buen proyecto pero con la subcontratación al centro de conocimiento justo en el 10% y poco articulada, o temática Cervera dudosa.
→ *Riesgo:* reforzar la transferencia (B.6) y confirmar el encaje temático; si la innovación es floja, peligra el umbral B.

**Caso FIT BAJO — score ≈ 25 (derivar)**
Gran empresa (>1.500 empleados), o proyecto sin centro de conocimiento, o fuera de las temáticas Cervera.
→ *No es Cervera:* derivar a **PID** (sin restricción de tamaño/temática/transferencia). Si es cercano a mercado → LIC; si inversión → LICA.

> El agente sitúa el caso del cliente respecto al más parecido y hereda su rango de fit y guidance.

---

## 10. TIPS DIFERENCIADOS POR PERFIL DE CLIENTE

- **PYME tecnológica:** perfil ideal; máxima intensidad (70%). Destacar el reto tecnológico y elegir bien el centro de conocimiento.
- **MIDCAP (≤1.500 empleados):** elegible (a diferencia de las grandes); cuidar adecuación presupuesto-tamaño (C.6).
- **Gran empresa:** no elegible → derivar a PID.
- **Empresa sin partner de transferencia:** ayudarla a identificar un centro generador de conocimiento (Anexo II) o derivar a PID si no procede.

---

## 11. ANTI-PATRONES DE REDACCIÓN (say / don't say)

> Pares utilizables en el `applicationGuidance`.

**❌ NUNCA usar:**
"gran empresa" · "sin colaboración con centros de conocimiento" · "fuera de las áreas Cervera" · "producto terminado listo para vender" · "riesgo tecnológico bajo" · "subcontratación simbólica al 10%".

**✅ SÍ usar:**
"transferencia de conocimiento desde un centro generador de conocimiento" · "tecnología prioritaria Cervera" · "investigación industrial / desarrollo experimental" · "aspecto tecnológico diferencial" · "reto tecnológico" · "PYME/MIDCAP" · "subcontratación relevante a universidad/centro tecnológico".

> Razón: Cervera exige **PYME/MIDCAP + temática Cervera + transferencia ≥10% a centro de conocimiento + I+D con reto**; el vocabulario de la izquierda revela inelegibilidad (tamaño/temática) o ausencia de transferencia.

---

## 12. METADATOS Y FUENTES

- **Tipo de ayuda:** préstamo parcialmente reembolsable (Art. 25 RGEC; no minimis), ventanilla abierta. Cobertura 90%, TNR 33%.
- **Distinción con PID:** Cervera = **PID con sello de transferencia** — solo PYME/MIDCAP, en temáticas Cervera, con subcontratación ≥10% a un centro generador de conocimiento; mayor cobertura (90% vs 85%) y TNR fijo (33%). PID es general (todo tamaño/temática, sin transferencia obligatoria).
- **Tecnologías prioritarias Cervera:** lista relativamente estable (Anexo I); el detalle de subtecnologías puede actualizarse — verificar la ficha vigente.
- **Criterios de evaluación:** idénticos al PID (umbral B 20/40 eliminatorio; total ≥50).
- **Tasa de éxito histórica:** *desconocida* — no se incluye para no calibrar el `fitScore` con cifras inventadas.
- **Fuentes:**
  - Página CDTI (buscar "Cervera"): https://www.cdti.es/ayudas
  - Ficha de Transferencia Cervera (CDTI) y Anexos (Anexo I tecnologías prioritarias, Anexo II centros generadores de conocimiento).
  - Sede electrónica: https://sede.cdti.gob.es
