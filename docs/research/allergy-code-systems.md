# Allergy code systems: bundling and mapping to AL1 and AllergyIntolerance

Research for issue [#47](https://github.com/KingsleyBawuah/clinical-faker/issues/47) (part of map [#45](https://github.com/KingsleyBawuah/clinical-faker/issues/45)). The questions:

1. Which code systems can be bundled for drug, food, and environmental allergens, given [`ontology-licensing.md`](ontology-licensing.md)?
2. How does each map onto HL7 v2.5.1 `AL1` (tables 0127, 0128) and FHIR R4 `AllergyIntolerance`?
3. How is "no known allergies" expressed in each?
4. What does this mean for the current `AllergyEntity` (`src/entities/types.ts`)?

- **Sources:** primary sources only (NLM, FDA, SNOMED International, HL7). Every source was fetched on **2026-10-21**.
- **Not legal advice.** This is an engineering reading of the published terms. Anything not confirmed from a primary source is marked **unverified** or *inferred*.
- **Scope assumption:** as in `ontology-licensing.md`, a few dozen code + display pairs per system, never whole tables.

## Summary

| Allergen kind | Recommended system | Bundle-safe? | FHIR `system` URI | HL7 v2 coding system (Table 0396) |
| --- | --- | --- | --- | --- |
| **Drug** | RxNorm ingredient (`TTY=IN`), SAB=RXNORM names only | **Yes** (public domain; see [`ontology-licensing.md`](ontology-licensing.md#rxnorm)) | `http://www.nlm.nih.gov/research/umls/rxnorm` | `RXNORM` |
| **Food** | SNOMED CT substance, from the Global Patient Set (GPS) | **Likely yes** via GPS, CC BY-ND 4.0 (**unverified** for a subset in software; see [SNOMED CT](#snomed-ct)) | `http://snomed.info/sct` | `SCT` |
| **Environmental** | SNOMED CT substance, from the GPS | Same as food | `http://snomed.info/sct` | `SCT` |
| **Food / environmental (fallback)** | UNII (FDA) | **Yes** (public domain) | `http://fdasis.nlm.nih.gov` | `FDAUNII` |
| **"No known allergy" and reaction manifestations** | SNOMED CT, from the GPS | Same as food | `http://snomed.info/sct` | `SCT` |
| **Full SNOMED CT release** (not via GPS) | none | **No** for a worldwide npm package (needs membership or an Affiliate License) | | |

**Bottom line:**

- **Drugs:** RxNorm ingredients. Already cleared.
- **Foods, environment, NKA, reactions:** SNOMED CT through the GPS. This is the only option that matches what US Core binds to. It needs a one-line confirmation from SNOMED International (`gps@snomed.org`) that bundling a small unmodified subset in an MIT package is fine.
- **UNII:** fully safe, but it is not in the US Core allergen value set, so it is a fallback or secondary coding only.

## Licensing

### RxNorm

Already covered in [`ontology-licensing.md`](ontology-licensing.md#rxnorm). NLM-created RxCUIs and normalized names are public domain. Use only SAB=RXNORM strings, include NLM's acknowledgement, and say the snapshot may be out of date. ([terms](https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html))

For allergies, use **ingredient-level** concepts, not the clinical-drug (SCD) concepts `MedicationEntity` uses. US Core's current allergen value set takes RxNorm `TTY` in `IN`, `MIN`, `PIN`, `BN` ([VSAC 2.16.840.1.113762.1.4.1267.38](https://tx.fhir.org/r4/ValueSet?url=http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113762.1.4.1267.38)).

Sample ingredients checked on RxNav (all `TTY=IN`, not suppressed, "RxNorm Name" property present): `7980` penicillin G, `723` amoxicillin, `1191` aspirin, `10180` sulfamethoxazole, `5640` ibuprofen, `2670` codeine, `7052` morphine. ([RxNav properties API](https://rxnav.nlm.nih.gov/REST/rxcui/7980/allProperties.json?prop=names+sources))

RxNorm has no drug-class concepts such as "penicillins" or "sulfonamides". US Core codes those with SNOMED CT ([VSAC 1186.2](https://tx.fhir.org/r4/ValueSet?url=http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113762.1.4.1186.2), "Common drug classes", SNOMED CT only).

### UNII

- **What it is:** FDA's Global Substance Registration System generates UNIIs. ([FDA GSRS page](https://www.fda.gov/industry/fda-data-standards-advisory-board/fdas-global-substance-registration-system), "Content current as of 09/29/2026")
- **License:** no UNII-specific license exists on the FDA GSRS page or the precisionFDA UNII search page. The HL7 UNII code system resource quotes FDA's website policy as its copyright: "Unless otherwise noted, the contents of the FDA website (www.fda.gov) — both text and graphics — are not copyrighted. They are in the public domain and may be republished, reprinted and otherwise used freely by anyone without the need to obtain permission from FDA. Credit to the U.S. Food and Drug Administration as the source is appreciated but not required." ([FDA website policies](https://www.fda.gov/about-fda/about-website/website-policies); [HL7 UNII CodeSystem](https://terminology.hl7.org/5.1.0/CodeSystem-UNII.ttl))
- **Description (HL7 resource):** "A UNII is a non-proprietary, free, unique, unambiguous, nonsemantic, alphanumeric identifier". ([source](https://terminology.hl7.org/5.1.0/CodeSystem-UNII.ttl))
- **Caveat:** the precisionFDA page footer says "© 2026 U.S. Food and Drug Administration. All Rights Reserved." but links "Copyright" to the public-domain policy above. Reading it as public domain is *inferred* from that link. ([precisionFDA](https://precision.fda.gov/uniisearch))
- **Notice:** none required. A credit line to FDA is optional.
- **Sample codes checked** on the NCATS GSRS API: `QE1QX6B99R` PEANUT, `2LQ0UUW8IN` NATURAL LATEX RUBBER. ([GSRS](https://gsrs.ncats.nih.gov/api/v1/substances/QE1QX6B99R))

### SNOMED CT

**Full release: not bundle-safe.**

- NLM: "Licensees of the UMLS Metathesaurus have free access to SNOMED CT", free in IHTSDO Member territories including the U.S. "You need to notify and register your use with the IHTSDO BEFORE you use SNOMED CT in a Non-Member Country/Territory", and fees may apply there. "Users should carefully read the license agreement before re-distributing any content in any type of application." ([NLM SNOMED CT licensing](https://www.nlm.nih.gov/healthit/snomedct/snomed_licensing.html), "Last Reviewed: February 16, 2021")
- An npm package is downloaded worldwide, so content taken from the licensed release under the Affiliate License is not safe to bundle.

**Global Patient Set (GPS): likely bundle-safe.**

- **What it is:** "an open, and freely accessible collection of SNOMED CT terms". It lets systems in "both SNOMED CT Member and non-Member countries to share, store, and display" SNOMED CT-coded data "without requiring access to the full SNOMED CT terminology or a licensing agreement". No cost. ([snomed.org/gps](https://www.snomed.org/gps))
- **License:** "Creative Commons Attribution-NoDerivatives 4.0 International License". Modified material may not be distributed without SNOMED International's prior approval. Notice: "SNOMED CT is © and ® SNOMED International." ([snomed.org/gps](https://www.snomed.org/gps); [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/))
- **Content:** "all **active** SNOMED CT concepts from a given version of the International Edition", each with its FSN and US English preferred term. No relationships or hierarchies: "a flat collection of identifiers and terms". ([GPS content](https://docs.snomed.org/implementation-guides/gps-implementation-guide/global-patient-set-content.md))
- **Subsets:** SNOMED International offers GPS tooling for "creating smaller, implementer-friendly lists". ([snomed.org/gps](https://www.snomed.org/gps)) Creative Commons says an unaltered excerpt used inside a larger work "generally" does not create an adaptation, but it depends on the jurisdiction, and database extraction is judged "both quantitatively and qualitatively". ([CC FAQ](https://creativecommons.org/faq/))
- **Unverified:** no GPS page explicitly addresses bundling GPS IDs and terms in redistributed software. Ask `gps@snomed.org` before bundling.
- **Rules if cleared:** copy IDs and terms verbatim from a GPS release obtained from SNOMED International. Record the GPS version. Ship the CC BY-ND attribution in `THIRD_PARTY_NOTICES.md`.
- **US Edition concepts are not in the GPS.** The GPS is International Edition only. `1631000175102` "Patient not asked" (used by US Core, below) carries the US namespace `1000175` (*inferred* from the SCTID format), so it is not covered.

Sample International concepts checked via [tx.fhir.org `$lookup`](https://tx.fhir.org/r4/CodeSystem/$lookup?system=http://snomed.info/sct&code=716186003) (International Edition 2025-02-01):

| SCTID | Display | Use |
| --- | --- | --- |
| `716186003` | No known allergy | NKA |
| `409137002` | No known drug allergy | NKDA |
| `429625007` | No known food allergy | NKFA |
| `428607008` | No known environmental allergy | |
| `716184000` | No known latex allergy | |
| `762952008` | Peanut | Food substance |
| `111088007` | Latex | Environmental substance |
| `256259004` | Pollen | Environmental substance |
| `39579001` | Anaphylaxis | Reaction manifestation |
| `247472004` | Wheal | Reaction manifestation (hives) |
| `271807003` | Eruption | Reaction manifestation (rash) |

## What standards expect for the substance code

- **Base FHIR R4:** `AllergyIntolerance.code` is `0..1` with an **example** binding to "AllergyIntolerance Substance/Product, Condition and Negation Codes" (`http://hl7.org/fhir/ValueSet/allergyintolerance-code`). That value set is SNOMED CT (`418038007` "Propensity to adverse reactions to substance" and its descendants, some intolerances, and `716186003` "No known allergy") plus the substance-code value set. Any system, or text only, is conformant. ([AllergyIntolerance](https://hl7.org/fhir/R4/allergyintolerance.html); [value set](https://hl7.org/fhir/R4/valueset-allergyintolerance-code.html))
- **US Core 9.0.0** (roadmap only; `docs/architecture.md` targets base R4): `code` is mandatory with an **extensible** binding to VSAC "Allergen Concepts (Medications, Foods, and Environmental Substances) including refutations" (`http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113762.1.4.1267.43`). ([US Core AllergyIntolerance](https://hl7.org/fhir/us/core/StructureDefinition-us-core-allergyintolerance.html)) That value set is made of ([definition on tx.fhir.org](https://tx.fhir.org/r4/ValueSet?url=http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113762.1.4.1267.43)):
  - RxNorm `IN`/`MIN`/`PIN`/`BN` (`…1267.38`).
  - SNOMED CT medicinal products, descendants of `763760008` (`…1267.39`).
  - SNOMED CT foods, descendants of `59533004` and `255620007` (`…1267.40`).
  - SNOMED CT environmental substances such as `111088007` latex and `256259004` pollen (`…1267.41`).
  - SNOMED CT refutations (`…1186.5`): `409137002`, `428607008`, `429625007`, `716184000`, `716186003`.
- **UNII is not in the US Core value set.** Under an extensible binding, a UNII-only coding for a food that has a SNOMED CT concept would not conform (*inferred* from the extensible-binding rule quoted on the US Core page). UNII is fine as an extra coding next to SNOMED CT, or for base-R4-only output.

## Mapping onto HL7 v2.5.1 `AL1`

Field definitions from HL7 v2.5.1 ([Caristix AL1](https://hl7-definition.caristix.com/v2/HL7v2.5.1/Segments/AL1); same data via its API):

| Field | Name | Type | Opt. | Rpt | Len | Table | IR source today | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AL1-1 | Set ID | SI | R | 1 | 4 | | `setId` | No change |
| AL1-2 | Allergen Type Code | CE | O | 1 | 250 | 0127 | empty (no IR field) | Populate from a new IR `category`: drug `DA`, food `FA`, environment `EA` |
| AL1-3 | Allergen Code/Mnemonic/Description | CE | **R** | 1 | 250 | | `^substance^` (uncoded) | `code^display^RXNORM`, `code^display^SCT`, or `code^display^FDAUNII` |
| AL1-4 | Allergy Severity Code | CE | O | 1 | 250 | 0128 | `criticality` mapped to `MI`/`SV`/`U` | Keep (see criticality vs. severity below) |
| AL1-5 | Allergy Reaction Code | ST | O | * | **15** | | `reaction` | Watch the 15-character limit; consider repeating per manifestation |
| AL1-6 | Identification Date | DT | B | 1 | 8 | | none | Leave empty (backward-compatible field, withdrawn in v2.7) |

- **AL1-3 text:** "This element may conform to some external, standard coding system (that must be identified), or it may conform to local, largely textual or mnemonic descriptions." So the current uncoded form is valid. A coded form must name its coding system in CE.3. ([AL1-3](https://hl7-definition.caristix.com/v2/HL7v2.5.1/Segments/AL1))
- **Coding-system codes:** `RXNORM`, `SCT`, and `FDAUNII` do not appear in the v2.5.1 snapshot of Table 0396, only from v2.6/v2.7 on. HL7 says Table 0396 "is maintained outside of the published Version 2 standards", so the current entries are valid in v2.5.1 messages. ([HL7 Terminology v2-0396](https://terminology.hl7.org/CodeSystem-v2-0396.json); [Caristix 0396 v2.5.1](https://hl7-definition.caristix.com/v2/HL7v2.5.1/Tables/0396))
- **Table 0127 Allergen Type** (user-defined): `AA` Animal Allergy, `DA` Drug allergy, `EA` Environmental Allergy, `FA` Food allergy, `LA` Pollen Allergy, `MA` Miscellaneous allergy, `MC` Miscellaneous contraindication, `PA` Plant Allergy. ([Caristix 0127](https://hl7-definition.caristix.com/v2/HL7v2.5.1/Tables/0127))
- **Table 0128 Allergy Severity** (user-defined): `MI` Mild, `MO` Moderate, `SV` Severe, `U` Unknown. ([Caristix 0128](https://hl7-definition.caristix.com/v2/HL7v2.5.1/Tables/0128))
- **AL1-5 length:** max length is 15 (ST). "Shortness of breath" is 19 characters. If the IR keeps free-text reactions, either pick short display strings or code the reaction. *Inferred:* many receivers ignore lengths, but the generator's job is conformant output.

## Mapping onto FHIR R4 `AllergyIntolerance`

Element bindings ([R4 AllergyIntolerance](https://hl7.org/fhir/R4/allergyintolerance.html)):

| Element | Card. | Binding | IR source today | Recommendation |
| --- | --- | --- | --- | --- |
| `clinicalStatus` | 0..1 | Required: `active`/`inactive`/`resolved` | fixed `active` | Keep |
| `verificationStatus` | 0..1 | Required: `unconfirmed`/`confirmed`/`refuted`/`entered-in-error` | fixed `confirmed` | Keep |
| `type` | 0..1 | Required: `allergy`/`intolerance` | none | Optional; `allergy` for all 0127 codes except `MC` |
| `category` | 0..* | Required: `food`/`medication`/`environment`/`biologic` | none | From a new IR `category` |
| `criticality` | 0..1 | Required: `low`/`high`/`unable-to-assess` | `criticality` | Keep |
| `code` | 0..1 | Example | `{ text: substance }` | Add a `coding` (RxNorm / SNOMED CT / UNII), keep `text` |
| `patient` | 1..1 | | patient ref | Keep |
| `reaction.manifestation` | 1..* | Example (SNOMED CT clinical findings) | `{ text: reaction }` | Optionally add SNOMED CT coding |
| `reaction.severity` | 0..1 | Required: `mild`/`moderate`/`severe` | none | Optional future IR field |

- **Invariants ait-1/ait-2:** `clinicalStatus` SHALL be present unless `verificationStatus` is `entered-in-error`, and SHALL NOT be present if it is. The current builder satisfies this. ([source](https://hl7.org/fhir/R4/allergyintolerance.html))
- **Criticality vs. severity:** "Criticality refers to the likelihood the allergy/intolerance could result in significant harm." "Severity refers to the degree of manifestation of the reaction symptom." "Moderate breathing difficulty would have high criticality while a severe rash would have low criticality." ([source](https://hl7.org/fhir/R4/allergyintolerance.html))

### Cross-walk (HL7 v2-to-FHIR IG)

The HL7 v2-to-FHIR IG v1.0.0 maps AL1 to AllergyIntolerance as follows ([segment map](https://hl7.org/fhir/uv/v2mappings/ConceptMap-segment-al1-to-allergyintolerance.html)):

- **AL1-2 → `category`** ([0127 → category](https://hl7.org/fhir/uv/v2mappings/ConceptMap-table-hl70127-to-allergy-intolerance-category.html)):
  - `DA` → `medication`
  - `FA` → `food`
  - `EA`, `PA`, `LA` → `environment`
  - `AA` → `biologic`
  - `MA`, `MC` are not mapped.
- **AL1-2 → `type`:** every 0127 code → `allergy` except `MC` (not mapped). ([0127 → type](https://hl7.org/fhir/uv/v2mappings/ConceptMap-table-hl70127-to-allergy-intolerance-type.html))
- **AL1-3 → `code`:** CWE → CodeableConcept, direct.
- **AL1-4 → `criticality`** "only if severity is used as criticality": `SV` → `high`, `MI` → `low`; `MO` and `U` are not mapped. ([0128 → criticality](https://hl7.org/fhir/uv/v2mappings/ConceptMap-table-hl70128-to-allergy-intolerance-criticality.html))
- **AL1-4 → `reaction.severity`** otherwise: `SV` → `severe`, `MO` → `moderate`, `MI` → `mild`; `U` is not mapped. ([0128 → reaction.severity](https://hl7.org/fhir/uv/v2mappings/ConceptMap-table-hl70128-to-reaction-event-severity.html))
- **AL1-5 → `reaction.manifestation.text`.**
- **Fixed:** `clinicalStatus` = `active`, needed for ait-1.

**What this means for the repo:** the existing `criticality` → `AL1-4` mapping (`low`→`MI`, `high`→`SV`, `unable-to-assess`→`U`) is the reverse of the IG's "severity used as criticality" path. That keeps the round trip consistent for `low` and `high`. The IG does not map `U` back to `unable-to-assess`. Sending `U` for it is a reasonable reverse mapping, but it is *inferred*, not sourced.

## "No known allergies"

**FHIR R4:**

- **Preferred form:** "it is generally preferred to use a code for 'No known allergies'", for example SNOMED CT `716186003` "No known allergy (situation)", in `AllergyIntolerance.code`. ([source](https://hl7.org/fhir/R4/allergyintolerance.html))
- **When an allergy is found later:** "If a new allergy is discovered, the negated allergy record must be updated with the 'refuted' verificationStatus". ([source](https://hl7.org/fhir/R4/allergyintolerance.html))
- **Narrower negations:** `409137002` (drug), `429625007` (food), `428607008` (environmental), and `716184000` (latex) are all International Edition concepts.
- **US Core 9.0.0:** patient asked and none reported → `716186003` with `verificationStatus` = `confirmed`. Patient not asked → `1631000175102` "Patient not asked" (US Edition, so not in the GPS) with `verificationStatus` `unconfirmed` or omitted. ([US Core](https://hl7.org/fhir/us/core/StructureDefinition-us-core-allergyintolerance.html))
- **Recommended shape:** `clinicalStatus` = `active`, `verificationStatus` = `confirmed`, `code.coding` = SNOMED CT `716186003` with `text` "No known allergy". No `criticality` and no `reaction`.

**HL7 v2.5.1:**

- **No base-standard mechanism.** The AL1 field definitions describe only a present allergen. ([AL1](https://hl7-definition.caristix.com/v2/HL7v2.5.1/Segments/AL1))
- **Omitting AL1** is ambiguous. It reads the same as "not recorded".
- **Recommended (*inferred*, common interface practice, no normative source found):** one AL1 with `AL1-3` = `716186003^No known allergy^SCT`, and `AL1-2`/`AL1-4`/`AL1-5` empty. This mirrors the FHIR form, so both outputs say the same thing.

**Repo implication:** today `allergies: []` (always empty in `src/generator.ts`) can't tell "no known allergies" apart from "not asked". Both formats need a way to express that difference.

## Gaps in the current `AllergyEntity`

`AllergyEntity` is `{ id, substance: string, reaction?: string, criticality?: AllergyCriticality }` (`src/entities/types.ts`).

1. **No coded substance.** `AL1-3` and `code` are text only. This needs something like `substance: { system: "rxnorm" | "snomed" | "unii", code, display }`. A closed `system` union keeps the FHIR URI and the v2 0396 code mappings exhaustive, the same pattern `AssigningAuthority` uses.
2. **No category.** `AL1-2` is empty and FHIR `category` is missing. This needs `category: "medication" | "food" | "environment"`, mapped to `DA` / `FA` / `EA`. `biologic`/`AA` can be added later.
3. **No "no known allergies" state.** This needs either a patient-level `allergyStatus` (`"none-known" | "not-asked" | "recorded"`) or an NKA entity variant. The first is simpler and keeps `AllergyEntity` a real allergen.
4. **The reaction is a single free-text string.** FHIR allows `1..*` manifestations; v2 AL1-5 repeats and has a 15-character limit. An optional SNOMED CT code (GPS) per manifestation would also add `reaction.manifestation.coding`.
5. **No reaction severity.** This is optional. `criticality` → `AL1-4` is acceptable per the IG's "severity used as criticality" path, so no change is required.

## Open questions

1. **GPS subset in software (unverified):** confirm with SNOMED International (`gps@snomed.org`) that bundling a few dozen unmodified GPS concept IDs plus FSN/preferred terms in an MIT-licensed npm package, with CC BY-ND attribution, is allowed. If the answer is no, foods and environmental allergens fall back to UNII plus text, and NKA in FHIR becomes text-only (still base-R4-conformant).
2. **UNII copyright line:** precisionFDA shows "All Rights Reserved" while linking to FDA's public-domain policy. Low risk, but worth a note in `THIRD_PARTY_NOTICES.md` crediting FDA.
3. **"Patient not asked":** the only US Core code for it (`1631000175102`) is US Edition and outside the GPS. Options: represent "not asked" by emitting nothing (base R4) or by text-only `code`.
4. **Drug classes** ("penicillins", "sulfonamides"): RxNorm has no class concepts, and the US Core class set is SNOMED CT. If archetypes need class allergies, they depend on the GPS answer in question 1. MED-RT was not researched.

## Sources

- **RxNorm terms:** NLM, RxNorm Terms of Service: <https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html>
- **RxNorm concepts:** NLM, RxNav REST API: <https://rxnav.nlm.nih.gov/REST/rxcui/7980/allProperties.json?prop=names+sources>
- **UNII (GSRS):** FDA, Global Substance Registration System: <https://www.fda.gov/industry/fda-data-standards-advisory-board/fdas-global-substance-registration-system>
- **UNII search:** precisionFDA, UNII search: <https://precision.fda.gov/uniisearch>
- **FDA website policies** (public-domain statement): <https://www.fda.gov/about-fda/about-website/website-policies>
- **UNII CodeSystem:** HL7 Terminology, UNII CodeSystem: <https://terminology.hl7.org/5.1.0/CodeSystem-UNII.ttl>
- **UNII substances:** NCATS GSRS API: <https://gsrs.ncats.nih.gov/api/v1/substances/QE1QX6B99R>
- **SNOMED CT licensing:** NLM, SNOMED CT licensing: <https://www.nlm.nih.gov/healthit/snomedct/snomed_licensing.html>
- **SNOMED GPS:** SNOMED International, Global Patient Set: <https://www.snomed.org/gps>
- **SNOMED GPS content:** SNOMED International, GPS content: <https://docs.snomed.org/implementation-guides/gps-implementation-guide/global-patient-set-content.md>
- **CC BY-ND 4.0:** Creative Commons, license: <https://creativecommons.org/licenses/by-nd/4.0/>
- **CC FAQ:** Creative Commons, FAQ: <https://creativecommons.org/faq/>
- **SNOMED CT concept lookups:** tx.fhir.org: <https://tx.fhir.org/r4/CodeSystem/$lookup?system=http://snomed.info/sct&code=716186003>
- **FHIR AllergyIntolerance:** HL7, FHIR R4 AllergyIntolerance: <https://hl7.org/fhir/R4/allergyintolerance.html>
- **FHIR code value set:** HL7, FHIR R4 allergyintolerance-code value set: <https://hl7.org/fhir/R4/valueset-allergyintolerance-code.html>
- **US Core AllergyIntolerance:** HL7, US Core 9.0.0 AllergyIntolerance: <https://hl7.org/fhir/us/core/StructureDefinition-us-core-allergyintolerance.html>
- **VSAC allergen value set:** via tx.fhir.org: <https://tx.fhir.org/r4/ValueSet?url=http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113762.1.4.1267.43>
- **HL7 v2.5.1 definitions:** Caristix, AL1 and Tables 0127, 0128, 0396: <https://hl7-definition.caristix.com/v2/HL7v2.5.1/Segments/AL1>
- **Table 0396:** HL7 Terminology, v2-0396: <https://terminology.hl7.org/CodeSystem-v2-0396.json>
- **v2-to-FHIR AL1 map:** HL7, v2-to-FHIR IG v1.0.0, AL1 → AllergyIntolerance: <https://hl7.org/fhir/uv/v2mappings/ConceptMap-segment-al1-to-allergyintolerance.html>
