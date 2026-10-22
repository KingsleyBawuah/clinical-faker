# USCDI gap check

Research for [#46](https://github.com/KingsleyBawuah/clinical-faker/issues/46) on the 0.1.0 map ([#45](https://github.com/KingsleyBawuah/clinical-faker/issues/45)). The question: what does a patient from `createPatient()` (the `PatientGraph`, `.toHL7()` messages, and the `.toFHIR()` bundle) lack compared with the current USCDI? For each gap: how often HL7/FHIR integration-test pipelines need it, whether it needs a new entity type or only new data in an existing one, and which code system it uses. The goal is a pseudorealistic patient record. The decision about which gaps to fill belongs to [#50](https://github.com/KingsleyBawuah/clinical-faker/issues/50).

- **Sources:** primary sources only (ASTP/ONC, eCFR, HL7, NLM). All were fetched on **2026-10-21**.
- **Repo baseline:** `main` at `398c079`.
- **"Pipeline need"** is an engineering judgment about how often HL7 v2 / FHIR integration tests exercise the data (interface engines, EHR feeds, payer and public-health interfaces). It is **inferred**, not taken from a source.
- Code-system licensing for LOINC, RxNorm, ICD-10-CM, and UCUM is covered in [`ontology-licensing.md`](ontology-licensing.md). The new systems this check brings in (SNOMED CT, CPT, CVX, CDC Race & Ethnicity, SOPT) are **not** covered there. See [Licensing flags](#licensing-flags).

## Which USCDI version

| Fact | Source |
| --- | --- |
| **USCDI v7 (July 2026)** is the latest published version. Its version history says "Version 7, Publication, July 2026". v6 was published on July 24, 2025. | [USCDI v7 PDF](https://isp.healthit.gov/sites/default/files/2026-07/USCDI-Version-7-Standard-Document.pdf), [ISP USCDI page](https://isp.healthit.gov/united-states-core-data-interoperability-uscdi) |
| The **Certification Program** adopts only **USCDI v3** today. v1's adoption "expires on January 1, 2026". The eCFR is current as of 2026-10-20. | [45 CFR 170.213 (eCFR)](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-D/part-170/subpart-B/section-170.213) |
| The latest FHIR mapping is **US Core 9.0.0, which maps USCDI v6**. No US Core release maps v7 yet. | [US Core USCDI page](https://hl7.org/fhir/us/core/uscdi.html) |

This check is against **v7**, because the goal is the most complete realistic record. Elements that are new in v7 are marked *(v7)*. Integrators still mostly build against v3, so a gap marked *(v7)* matters less to them today.

## What a generated patient has today

The only archetype, `AdultHypertension` (`src/archetypes/adultHypertension.ts`), generates:

| Area | IR (`src/entities/types.ts`) | HL7 v2.5.1 | FHIR R4 |
| --- | --- | --- | --- |
| Demographics | first/last name, DOB, `Gender`, E.164 phone, MRN, one address | `PID-3,5,7,8,11,13` | `Patient` (identifier, name, telecom, gender, birthDate, address) |
| Encounter | class, period, free-text location, attending provider (NPI) | `PV1` | `Encounter` and `Practitioner`. `location` is dropped (`src/fhir/resources/encounter.ts`). |
| Conditions | ICD-10-CM code, onset date, rank | `DG1` | `Condition` with category `encounter-diagnosis` and `clinicalStatus` always `active` |
| Observations | BP, heart rate, potassium, creatinine (LOINC + UCUM, range, H/L/N flag) | `OBX` under `ORU^R01` | `Observation` (vital-signs or laboratory). BP becomes an `85354-9` panel. |
| Medications | RxNorm SCD code + free-text sig | **Not emitted.** `ORM^O01` is a vitals-panel order (`ORC`/`OBR`) with no pharmacy segments. | `MedicationRequest` (text-only `dosageInstruction`) |
| Allergies | text-only substance and reaction, criticality. The type exists, but `generator.ts` always produces `allergies: []`. | `AL1` | `AllergyIntolerance` |

## Covered (fully or mostly)

USCDI v7 elements the output already meets: First Name, Last Name, Date of Birth, Current Address, Phone Number, Patient Identifier *(v7)*, Encounter Date and Time, Encounter Diagnosis (ICD-10-CM), Problem (ICD-10-CM), Date of Onset, Laboratory Test / Value/Result / Result Unit of Measure / Result Reference Range / Result Interpretation (LOINC, UCUM, HL7 interpretation codes), Systolic/Diastolic Blood Pressure, Heart Rate, Medication (RxNorm), Medication Instructions (as text), and Medication Order (all FHIR only), Care Team Member Name / Identifier (the attending provider with an NPI). Vocabulary for each element is from the [v7 PDF](https://isp.healthit.gov/sites/default/files/2026-07/USCDI-Version-7-Standard-Document.pdf).

## Ranked gaps

Ranked by pipeline need first, then by build cost (cheaper ranks higher). "Existing" means new fields or data on a type that already exists. "New" means a new entity type, plus a new HL7 segment or message and a new FHIR resource builder.

| # | Gap (USCDI v7 class: elements) | Pipeline need *(inferred)* | Existing or new | Code system (USCDI v7) | HL7 v2.5.1 home | FHIR R4 home |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Patient Demographics:** Race, Ethnicity, Preferred Language | **High.** These are on almost every ADT feed and are needed for registry and quality reporting. | Existing (`Demographics`) | Race/Ethnicity: OMB SPD-15 **and** CDC Race & Ethnicity Code Set v1.4 (both required). Language: IETF RFC 5646 (BCP 47). | `PID-10` Race, `PID-22` Ethnic Group, `PID-15` Primary Language | Language: `Patient.communication.language` (base R4). Race and ethnicity have **no base-R4 field**; they need the US Core Race/Ethnicity extensions ([US Core](https://hl7.org/fhir/us/core/uscdi.html)). |
| 2 | **Vital Signs:** Body Height, Body Weight, BMI, Body Temperature, Respiratory Rate, Pulse Oximetry | **High.** Vitals panels are the most common `ORU` content. | Existing (`ObservationEntity` plus archetype data only). Temperature, respiratory rate, and SpO2 are already recognized by `vitalsProjection.ts` but no archetype generates them. | LOINC + UCUM. R4 core codes: height `8302-2` (cm), weight `29463-7` (kg), BMI `39156-5` (kg/m2), temperature `8310-5` (Cel), respiratory rate `9279-1` (/min), SpO2 `2708-6` (%) ([R4 vital signs](https://hl7.org/fhir/R4/observation-vitalsigns.html)) | `OBX` | `Observation` + R4 core vital-sign profiles |
| 3 | **Immunizations:** Immunization, Lot Number, Status, Record Source *(v7)* | **High.** `VXU^V04` to state immunization registries (IIS) is one of the most common public-health interfaces. | **New** (`ImmunizationEntity`, `VXU^V04` message, `RXA`/`RXR` segments) | CVX **and** NDC (both required) | `VXU^V04`: `RXA` (+`RXR` route) | `Immunization` (base R4) |
| 4 | **Health Insurance Information:** Coverage Status/Type/Period *(v7)*, Member/Subscriber/Group IDs, Payer *(v7)*, Plan *(v7)*, Relationship to Subscriber | **High** for ADT and billing feeds, which routinely carry `IN1`. | **New** (`CoverageEntity`, plus a payer org) | Coverage Type: Source of Payment Typology (SOPT). Other elements have no named vocabulary. | `IN1` (+`IN2`), optional `GT1` | `Coverage` + `Organization` (payer) |
| 5 | **Problems:** Condition Status *(v7)*, Date of Diagnosis, Date of Resolution, Health Concern; problem-list (not only encounter-diagnosis) | **Medium-High.** Problem-list sync and resolved conditions are standard test cases. | Existing (`ConditionEntity`: status, diagnosis date, resolution date, category) | SNOMED CT **or** ICD-10-CM for Problem (at least one). ICD-10-CM alone is conformant. | `DG1` (`DG1-19` attestation date); problem-list messages (`PPR`) are rare | `Condition.clinicalStatus` / `abatementDateTime` / `recordedDate`, category `problem-list-item` |
| 6 | **Health Status Assessments:** Tobacco and Nicotine Product Use *(revised in v7)*, Alcohol Use, Pregnancy Status | **Medium-High.** Smoking status is a long-standing must-have for quality and Meaningful Use-era tests. | Existing (`ObservationEntity`), **but** it needs a coded value (`CWE` / `valueCodeableConcept`). Today the value is only `number \| string`. | LOINC (question) + SNOMED CT (answer) | `OBX` with value type `CWE` | `Observation`, category `social-history` |
| 7 | **Encounter Information:** Encounter Type, Encounter Identifier, Encounter Disposition, Encounter Location (emitted in FHIR) | **Medium-High.** `PV1-19` visit number and `PV1-36` disposition drive ADT `A03` / visit-matching tests. | Existing (`Encounter`) | Location: NHSN HSLOC or SNOMED CT. Type and disposition have no named vocabulary (HL7 tables 0004/0112 are the usual choice; *inferred*). | `PV1-4`, `PV1-19`, `PV1-36`, `PV1-3` | `Encounter.type`, `.identifier`, `.hospitalization.dischargeDisposition`, `.location` → `Location` |
| 8 | **Procedures:** Procedure, Procedure Status *(v7)*, Reason for Referral | **Medium.** Seen in ADT (`PR1`) and claims-adjacent tests. | **New** (`ProcedureEntity`) | SNOMED CT **or** CPT/HCPCS **or** CDT; ICD-10-PCS optional. Licensing problem: see flags. | `PR1` (in `ADT^A01`/`A08`) | `Procedure` |
| 9 | **Patient Demographics:** Related Person's Name, Relationship Type (next of kin / emergency contact) | **Medium.** `NK1` shows up on most real ADT. | New sub-entity on `Demographics` (contacts) | No named vocabulary. HL7 table 0063 in v2 (*inferred*). | `NK1` | `Patient.contact` (base R4) or `RelatedPerson` |
| 10 | **Medications:** Dose, Dose Unit, Route, Medication Adherence, Dispense Status/Quantity *(v7)*, Medication Administration *(v7)* | **Medium.** Structured dosing matters for pharmacy (`RDE`/`RAS`) feeds. `RDE^O11` is already on the roadmap. | Existing (`MedicationEntity`: dose, unit, route); new for dispense/administration | Dose unit: UCUM. Route: SNOMED CT **or** NCI Thesaurus. Medication: RxNorm (already used) or NDC. | `RXO`/`RXE`/`RXR` (none emitted today) | `MedicationRequest.dosageInstruction.doseAndRate/route`; `MedicationDispense`; `MedicationAdministration` |
| 11 | **Laboratory:** Specimen Type, Specimen Identifier, Source Site, Condition, Collection Method *(v7)*, Collection Date and Time *(v7)*, Result Status; **Healthcare Information Attributes:** Diagnostic Report Date and Time *(v7)* | **Medium.** Lab-result pipelines expect `SPM` and a `DiagnosticReport` that groups results. | New (`Specimen`, report grouping); result status is existing data | SNOMED CT (specimen fields; HL7 SpecimenCondition is an alternative for condition) | `SPM`; `OBR-7`/`OBR-22`/`OBR-25`; `OBX-11` | `Specimen`, `DiagnosticReport` |
| 12 | **Patient Demographics:** Middle Name, Name Suffix, Previous Name, Phone Number Type, Email, Date of Death, Deceased Indicator *(v7)*, Sex | **Medium-Low.** They are cheap and help record-matching tests (middle name, suffix, aliases). | Existing (`Demographics`) | Phone: ITU-T E.123 + E.164 (already E.164). Sex: SNOMED CT `248152002` (Female) / `248153007` (Male). | `PID-5` components, `PID-9` alias, `PID-13`/`PID-14` with use codes, `PID-29`/`PID-30` | `Patient.name`, `.telecom.use/system=email`, `.deceased[x]`. Sex needs the US Core Individual Sex extension. |
| 13 | **Facility Information:** Facility Identifier, Type, Name, Address, Telecom *(v7)* | **Medium-Low.** `MSH-4`/`PV1-3` facility values are needed, but static values usually suffice. | New (`Facility`); today it is only the encounter's free-text `location` | No named vocabulary (Facility Telecom: E.123/E.164) | `MSH-4`, `PV1-3`, `PV1-39` | `Location`, `Organization` |
| 14 | **Clinical Notes:** Discharge Summary, Progress, H&P, Consultation, ED, Operative, Procedure, Referral *(v7)* notes | **Low-Medium.** `MDM^T02` document feeds exist, but most generators skip narrative. | New (`NoteEntity`) | LOINC note-type codes (e.g. "at minimum" Discharge summary, Progress note) | `MDM^T02` (`TXA` + `OBX`) | `DocumentReference` / `DiagnosticReport` |
| 15 | **Orders:** Laboratory, Diagnostic Imaging, Clinical Test, Procedure, Referral *(v7)*, Nutrition *(v7)*, Medical Device *(v7)*, Portable Medical Order | **Low-Medium.** `ORM` already exists for vitals. Lab orders would reuse it. | New (`OrderEntity`) or reuse observations | LOINC (lab, imaging, and clinical-test orders) | `ORM^O01` / `OML^O21` | `ServiceRequest` |
| 16 | **Care Team Members:** Role, Location, Telecom, Healthcare Agent *(v7)* | **Low.** | Existing (`Provider`) | Telecom: E.123/E.164 | `ROL`, `PV1-7..9,17` | `CareTeam`, `PractitionerRole` |
| 17 | **Patient Demographics:** Tribal Affiliation, Interpreter Needed, Previous Address, Occupation, Occupation Industry, Accommodation *(v7)* | **Low.** | Existing (`Demographics`) or `Observation` | Interpreter Needed: LOINC or SNOMED CT. Occupation: Occupational Data for Health. | `PID` / `OBX` | US Core extensions; `Observation` (occupation) |
| 18 | **Health Status Assessments (rest):** Functional, Disability, Mental/Cognitive Status, Physical Activity, SDOH Assessment, Nutrition Assessment *(v7)* | **Low.** | Existing (`Observation`, coded values as in #6) | LOINC (+ SNOMED CT for SDOH) | `OBX` | `Observation` / `QuestionnaireResponse` |
| 19 | **Family Health History; Goals and Preferences; Care Plans** | **Low.** | New | SNOMED CT / ICD-10-CM (family history); LOINC / SNOMED CT (goals) | Rarely in v2 | `FamilyMemberHistory`, `Goal`, `CarePlan` |
| 20 | **Medical Devices; Diagnostic Imaging; Clinical Tests; Adverse Events *(v7)*; Provenance; Appointment *(v7)*; Advance Directive** | **Low** for this library's audience. | New | FDA UDI; SNOMED CT; LOINC | `SIU` (appointments), others rare | `Device`, `ImagingStudy`/`DiagnosticReport`, `AdverseEvent`, `Provenance`, `Appointment` |

**Allergies and Intolerances** are out of scope here (tickets [#47](https://github.com/KingsleyBawuah/clinical-faker/issues/47) and [#51](https://github.com/KingsleyBawuah/clinical-faker/issues/51)). For reference, USCDI v7 lists Medication Allergy Intolerance (RxNorm), Drug Class Allergy Intolerance (SNOMED CT), Non-Medication Allergy Intolerance (SNOMED CT), Reaction (SNOMED CT), and Allergy Intolerance Criticality *(v7)*. `AllergyEntity` today has text-only substance and reaction, so a coded substance is a gap there too. Generation is a gap as well, since the array is always empty.

## Cheapest high-value slice

If #50 wants the most realism for the least build, these four touch only existing types plus data. They need no new entity:

1. **#2 vitals:** add height, weight, BMI, temperature, respiratory rate, and SpO2 to archetypes. Only LOINC + UCUM, both already licensed and verified.
2. **#1 demographics:** race, ethnicity, and language in `PID`. For FHIR, `Patient.communication` is base R4. Race and ethnicity force a decision on US Core extensions, which `docs/architecture.md` keeps on the roadmap.
3. **#5 problems:** problem-list category, status, and resolution date on `ConditionEntity`. The codes stay ICD-10-CM.
4. **#7 encounter:** type, visit number, and disposition; emit `location`.

The highest-value **new** entities are Immunization (#3) and Coverage (#4).

## Licensing flags

- **SNOMED CT** is the required or alternative vocabulary for many gaps (#5, #6, #8, #10–#12, #17–#19). NLM says that "Licensees of the UMLS Metathesaurus have free access to SNOMED CT" and that "Users should carefully read the license agreement before re-distributing any content in any type of application" ([NLM SNOMED CT licensing](https://www.nlm.nih.gov/healthit/snomedct/snomed_licensing.html)). Bundling SNOMED codes in an MIT npm package used worldwide is **unresolved** and needs its own licensing check before any SNOMED-only gap is built. Where USCDI allows an alternative (ICD-10-CM for problems, NCI Thesaurus for route), prefer it.
- **CPT** (#8) is AMA-owned. Redistribution is assumed to need an AMA license (**unverified**). For procedures, prefer HCPCS Level II or ICD-10-PCS (a U.S. government work, like ICD-10-CM; **unverified**).
- **CVX** (#3), **CDC Race & Ethnicity** (#1), and **SOPT** (#4): redistribution terms were **not checked**. CDC-published code sets are expected to be public domain (**unverified**).

## Noticed in passing

- `ORU^R01`'s `OBR-4` is a fixed vital-signs panel (`85353-1`, `src/hl7/segments/obr.ts`), so the potassium and creatinine lab results ship under a vitals order. This is already tracked for Phase 4 in `docs/implementation.md` and fits with #11.
- Medications appear only in FHIR. No HL7 message carries them (no `RXO`/`RXE`/`RDE`), so an HL7-only consumer sees no medications.
- `Condition.clinicalStatus` is hardcoded to `active` and the category is always `encounter-diagnosis` (`src/fhir/resources/condition.ts`). Problem-list consumers will see no problem list.
- Free-text `Encounter.location` is in the IR and `PV1-3` but is dropped from FHIR (`src/fhir/resources/encounter.ts`).

## Sources

- USCDI v7 standard document, July 2026: <https://isp.healthit.gov/sites/default/files/2026-07/USCDI-Version-7-Standard-Document.pdf>
- ASTP/ONC USCDI page (version list): <https://isp.healthit.gov/united-states-core-data-interoperability-uscdi>
- 45 CFR 170.213 (eCFR, current as of 2026-10-20): <https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-D/part-170/subpart-B/section-170.213>
- US Core 9.0.0 USCDI mapping: <https://hl7.org/fhir/us/core/uscdi.html>
- FHIR R4 vital signs profiles: <https://hl7.org/fhir/R4/observation-vitalsigns.html>
- NLM SNOMED CT licensing: <https://www.nlm.nih.gov/healthit/snomedct/snomed_licensing.html>
- HL7 v2.5.1 field positions (`PID-10/15/22/29/30`, `PV1-19/36`; `NK1`, `IN1`, `PR1`, `RXA`, `RXR`, `SPM` segments): taken from the repo's `hl7v2-dictionary` devDependency segment enums, not the HL7 standard text.
