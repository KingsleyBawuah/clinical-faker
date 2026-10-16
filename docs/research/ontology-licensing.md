# Ontology licensing for bundled code subsets

Research for the "Ontology licensing & data-accuracy audit" item in [`docs/implementation.md`](../implementation.md). The question: what are the current redistribution terms for bundling small subsets of LOINC, RxNorm, ICD-10-CM, and UCUM (codes + display strings) inside an MIT-licensed npm package?

- **Sources:** primary sources only (Regenstrief, NLM, NCHS/CDC, CMS, WHO). Every source was fetched on **2026-10-15**.
- **Not legal advice.** This is an engineering reading of the published terms. Anything not confirmed from a primary source is marked **unverified**.
- **Scope assumption:** the package will bundle a few dozen code + display pairs per system to drive archetypes, and will not ship whole tables.

## Summary

| System | License / terms (URL) | Redistribution of a subset in an MIT package? | Required notice | Key restrictions |
| --- | --- | --- | --- | --- |
| **LOINC** | LOINC Copyright Notice and License, page "last updated on August 6, 2026" ([loinc.org/license](https://loinc.org/license/)) | **Yes.** Portions may be incorporated into "software programs", free of charge. | Fixed LOINC notice text (see [LOINC](#loinc)), visible where the package is downloaded | Do not change code or name fields. Every extracted code must ship with an official LOINC display name. No competing standard. No use of the trademark or implied endorsement. Third-party-copyright terms need their own notice. |
| **RxNorm** (SAB=RXNORM only) | RxNorm Terms of Service, "Last Reviewed: January 31, 2022" ([nlm.nih.gov](https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html)) | **Yes, for NLM-created normalized names and RxCUIs**, which are public domain. Content from other sources (SABs) is **no**, or depends on the source's UMLS category. | NLM's requested acknowledgement statement (see [RxNorm](#rxnorm)) | Use only SAB=RXNORM strings. Do not use the NLM name or logo, and do not imply endorsement. Keep the data current or clearly say it may be out of date. |
| **ICD-10-CM** | No license statement found on the NCHS page or in the FY2027 release files. UMLS lists ICD10CM as Category 4 ([UMLS license 2026AA](https://uts.nlm.nih.gov/uts/assets/LicenseAgreement.pdf)). WHO owns ICD-10 ([WHO FAQ](https://cdn.who.int/media/docs/default-source/publishing-policies/copyright/who-faq-licensing-icd-10.pdf?sfvrsn=b2c8a69a_0)). | **Yes (maintainer's position).** NCHS/CMS publish ICD-10-CM as a U.S. government work; no fee or license applies for use within the U.S. Taking it from UMLS would block redistribution outside the U.S. | None published by NCHS. An NCHS/WHO acknowledgement is recommended. | Source it from NCHS files, not UMLS. Do not alter code titles. Users outside the U.S. may need to contact WHO about licensing for ICD-10 modifications or international deployment. |
| **UCUM** | UCUM Copyright Notice and License, Version 1.1, June 2024 ([ucum.org/license](https://ucum.org/license)) | **Yes**, with conditions. The license allows reproducing and distributing "the Work" and building Software Applications that interoperate with it. Shipping a subset of unit codes is not addressed explicitly (**unverified**; see [UCUM](#ucum)). | Copyright notice, a reference to the license, a warranty disclaimer, and a license URL | No modifying, adding to, or deleting from the Work's content. No derivative works. No competing units standard. No use of the trademark. |

## LOINC

**License:** LOINC Copyright Notice and License, <https://loinc.org/license/> (canonical URL `https://loinc.org/license`; the page says "Last updated on August 6, 2026").

**Redistribution is allowed.** The page says: "Permission is hereby granted in perpetuity, without payment of license fees or royalties, to use, copy, or distribute the Licensed Materials for any commercial or non-commercial purpose, subject to the following terms and conditions". The clause on incorporating content into products (the license calls it "Section 10") covers this case directly: "portions of the Group 1 Artifacts or Group 3 Artifacts may be incorporated into other products and services, such as … software programs including mobile device applications … provided that" the conditions below are met. ([source](https://loinc.org/license/))

**Required notice:** the product must include this text verbatim:

> This material contains content from LOINC (http://loinc.org). LOINC is copyright © Regenstrief Institute, Inc. and the Logical Observation Identifiers Names and Codes (LOINC) Committee and is available at no cost under the license at http://loinc.org/license. LOINC® is a registered United States trademark of Regenstrief Institute, Inc.

- **Where the notice goes:** "Where the product or service is distributed via the Internet, this notice must be accessible on the same Internet page from which the product is available for download." For an npm package, that page is the npmjs.com package page, which renders the README. So the notice, or a link to it, should be in `README.md` as well as `THIRD_PARTY_NOTICES.md` (this placement is an *inferred* reading). ([source](https://loinc.org/license/))
- **Display names:** "Any information that is extracted from the Licensed Material must always be associated with the corresponding identifier from LOINC … and include the corresponding LOINC display name". The display name must be one of these: the fully-specified name, `SHORTNAME`, `LONG_COMMON_NAME`, or `DisplayName`. This means the package must ship the official LOINC string with each code. It cannot use a hand-written label. ([source](https://loinc.org/license/))
- **Version number:** including the LOINC version is "strongly encouraged, but not required". ([source](https://loinc.org/license/))

**Restrictions** ([source](https://loinc.org/license/)):

- **No competing standard:** the content may not be used "for the purpose of developing or promulgating a different standard for identifying patient observations".
- **No edits:** "The name of, or any contents of, any fields in the Group 1 Artifacts shall not be changed." Dropping records is allowed ("Records may be deleted from the LOINC Table … to deal with local requirements"), so a subset is fine. Any locally added code must start with `X`.
- **Third-party content:** some codes carry an `EXTERNAL_COPYRIGHT_NOTICE`. If a bundled code has one, that notice must also be included. The vital-signs codes the repo uses today are expected to have none, but this is **unverified** and should be checked per code during the data-accuracy audit.
- **Trademarks:** "no right to use the trademarks of Regenstrief Institute, Inc. is licensed hereunder". The names may not be used to suggest endorsement.
- **Messages are exempt:** codes may be used "in electronic records and electronic messages … without the need to include this Copyright Notice and License … in the message". Generated HL7 and FHIR output therefore does not need to carry the notice. The package itself still does.

## RxNorm

**Terms:** RxNorm Terms of Service, <https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html> ("Last Reviewed: January 31, 2022").

**Redistribution of NLM-created content is allowed.** The terms say: "The RxNorm terminology normalized names and codes (e.g. RXCUI) within the RxNorm dataset is created by the National Library of Medicine (NLM) and is in the public domain … Public domain information may be freely distributed and copied within and outside the U.S., but it is requested that in any subsequent use, NLM be given appropriate acknowledgement." ([source](https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html))

**Requested notice** (the terms say "request", not "must"; including it is recommended):

> This product uses publicly available data courtesy of the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.

NLM also asks for a citation of Nelson SJ et al., *J Am Med Inform Assoc* 2011;18(4):441-8 ([PMC3128404](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3128404/)) "If you use RxNorm in your work". ([source](https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html))

**Restrictions:**

- **Source restrictions (SAB, the source-vocabulary tag on each string):** "The full RxNorm dataset includes proprietary data from various terminology providers, each with a specific Source Restriction Level (SRL) category. Section 12 of the [UMLS] license agreement describes the categories and specific restrictions". ([source](https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html)) Examples from the UMLS 2026AA Appendix 1: `GS`, `NDDF` (FDB), and `MMX` (Micromedex RED BOOK) are **Category 3**. Category 3 forbids "incorporation … in any publicly accessible computer-based information system … including the Internet" and "publishing". `MMSL` (Multum) is Category 1. ([UMLS license](https://uts.nlm.nih.gov/uts/assets/LicenseAgreement.pdf))
- **Safe subset:** the RxNorm Current Prescribable Content "Includes SAB=RXNORM and SAB=MTHSPL data only; no other source provided data" and is offered with "No license required; public domain". NLM provides it "without any licensing restrictions". ([source](https://www.nlm.nih.gov/research/umls/rxnorm/docs/prescribe.html), "Last Reviewed: April 17, 2019") **Rule for this repo: bundle only RxCUIs whose display string has SAB=RXNORM.** That covers the normalized SCD/SBD/IN names, and the RxNorm REST API can confirm the source of each string.
- **Republishing:** redistributors must "maintain the most current version of all distributed data, or make known in a clear and conspicuous manner that the products/services/applications do not reflect the most current/accurate data available from NLM". A frozen subset in an npm package falls under the second option, so the notice must say this. ([source](https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html))
- **No NLM branding:** "Developers may not use the NLM name and/or logo in conjunction with their applications" and must not "indicate or imply that NLM has endorsed" them. ([source](https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html))

## ICD-10-CM

**No explicit license was found from the publisher.** The facts that were confirmed:

- **NCHS page:** <https://www.cdc.gov/nchs/icd/icd-10-cm/index.html> says "The World Health Organization (WHO), which owns and publishes ICD-10, authorized NCHS to develop ICD-10-CM" and "All modifications to ICD-10 must conform to WHO's established ICD structure and conventions." It has no copyright, public-domain, or license statement. ([source](https://www.cdc.gov/nchs/icd/icd-10-cm/index.html))
- **NCHS release files:** the FY2027 code-description release, <https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2027/icd10cm-code-descriptions-2027.zip>, contains no copyright, license, or public-domain text in any file (both PDFs and all `.txt` files were searched). ([source](https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2027/))
- **CMS page:** the CMS ICD-10 page, <https://www.cms.gov/medicare/coding-billing/icd-10-codes>, has no license terms. ([source](https://www.cms.gov/medicare/coding-billing/icd-10-codes))
- **WHO:** WHO states it "is the copyright holder of ICD-10". For national modifications it says "WHO is not responsible for these modifications. The authorities concerned should be contacted to obtain a licence", and it lists NCHS as the contact for ICD-10-CM. This FAQ is dated 2014 according to the PDF's metadata. ([source](https://cdn.who.int/media/docs/default-source/publishing-policies/copyright/who-faq-licensing-icd-10.pdf?sfvrsn=b2c8a69a_0))
- **UMLS:** UMLS 2026AA Appendix 1 lists `ICD10CM_2026` as "CATEGORY 4 RESTRICTIONS APPLY to U.S. UMLS USERS / CATEGORY 3 RESTRICTIONS APPLY to Non-U.S. UMLS USERS". Category 4 allows distribution "in the U.S., but only in combination with other UMLS Metathesaurus content" and forbids "altering the vocabulary source content". An npm package is distributed worldwide, so **ICD-10-CM codes must not be sourced from UMLS.** ([source](https://uts.nlm.nih.gov/uts/assets/LicenseAgreement.pdf))

**Conclusion for ICD-10-CM:**

- **Maintainer's position:** ICD-10-CM is usable. NCHS and CMS publish it as a U.S. government work, and no fee or license applies for use within the U.S. This is a maintainer decision, not an explicit grant found in an NCHS or CMS document. (A secondary search result described a CDC Stacks catalog entry labelling the Tabular List "Public Domain"; that page returned HTTP 403 when fetched.)
- **Outside the U.S.:** WHO owns ICD-10. Users outside the U.S. may need to contact WHO about licensing for ICD-10 modifications or international deployment. ([source](https://cdn.who.int/media/docs/default-source/publishing-policies/copyright/who-faq-licensing-icd-10.pdf?sfvrsn=b2c8a69a_0))
- **Recommendation:** source the codes from the NCHS release files only, never from UMLS. Use the code titles verbatim and attribute NCHS and WHO.

## UCUM

**License:** UCUM Copyright Notice and License, Version 1.1, June 2024, <https://ucum.org/license>. The page's preamble still says "Version 1.0 License", which is an inconsistency on Regenstrief's side. The license text itself points to `https://unitsofmeasure.org/license`.

**Grant (Section 2):** "a worldwide, non-exclusive, no-charge, royalty-free, revocable license to reproduce, publicly display, publicly perform, and distribute the Work, and to use the Work for the purposes of developing and commercializing Software Applications that will communicate with and interoperate with the Work." ([source](https://ucum.org/license))

**Conditions (Section 3):** "You may not: use the Work for the purpose of developing or promulgating a different standard for identifying units of measure; … use the Work in any way that expressly or implicitly change its meaning; add, delete, or modify the Work's content including field names, field contents, descriptions, and comments; or use the Work to create Derivative Works." ([source](https://ucum.org/license))

**Attribution (Section 3):** "If you reproduce or distribute copies of the Work in its entirety, … You must: provide … a. a copyright notice; b. a notice that refers to this License; c. a notice that refers to the disclaimer of warranties; and d. the text of or the URL or hyperlink to, this Copyright Notice and License." A URL is acceptable for electronic downloads. The Appendix gives this boilerplate: "Copyright 1999-2024 Regenstrief Institute, Inc. All rights reserved. Licensed under the UCUM License, Version 1.1 …". ([source](https://ucum.org/license))

**Interpretation (unverified):**

- **Not addressed:** the license does not explicitly cover bundling a handful of unit code strings such as `mm[Hg]`, `kg`, or `/min` as constants.
- **Readings that point both ways:** the attribution clause is triggered by distribution "in its entirety", which suggests a subset does not trigger it. But "add, delete, or modify the Work's content" could be read as forbidding a subset of the table. Section 12.1 adds that the license does not restrict "any use of the Work that could lawfully be made without permission".
- **Lowest-risk approach:** ship only the case-sensitive UCUM code strings, unchanged, with no UCUM table fields such as print symbols or definitions. Include the full UCUM notice anyway.
- **Related LOINC rule:** LOINC's own license (item G) requires a UCUM notice when "all or a portion of the UCUM table, UCUM codes, and UCUM definitions" are included. ([source](https://loinc.org/license/))

## Open questions

1. **UCUM subsets (unverified):** ask Regenstrief whether shipping a subset of UCUM code strings counts as "delete[ing] … the Work's content" under Section 3 ([license](https://ucum.org/license)).
2. **Per-code LOINC check:** confirm that no bundled LOINC code has an `EXTERNAL_COPYRIGHT_NOTICE` ([license](https://loinc.org/license/)). Do this in the data-accuracy audit.
3. **Per-string RxNorm check:** confirm that every bundled RxNorm display string has SAB=RXNORM ([terms](https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html)). Do this in the data-accuracy audit.
4. **Notice must ship in the tarball:** `package.json` `files` is currently `["dist"]`. Whether npm automatically includes a `THIRD_PARTY_NOTICES.md` is **unverified**, so list it in `files` explicitly. Also link it from `README.md` so it appears on the npm download page, which LOINC Section 10 requires ([license](https://loinc.org/license/)).

## Draft `THIRD_PARTY_NOTICES.md` outline

This is an outline only, not the final file. Fill in versions once the bundled data exists.

```markdown
# Third-party notices

clinical-faker is MIT-licensed. It bundles small subsets of the clinical
code systems below, which are NOT covered by the MIT license and remain
subject to their owners' terms. Generated output contains these codes.

## LOINC
- Bundled: <N> LOINC codes with their <LONG_COMMON_NAME|DisplayName>, LOINC version <x.yy>.
- Notice (verbatim, required):
  This material contains content from LOINC (http://loinc.org). LOINC is
  copyright © Regenstrief Institute, Inc. and the Logical Observation
  Identifiers Names and Codes (LOINC) Committee and is available at no cost
  under the license at http://loinc.org/license. LOINC® is a registered
  United States trademark of Regenstrief Institute, Inc.
- Third-party EXTERNAL_COPYRIGHT_NOTICE entries: <none | list>.

## RxNorm
- Bundled: <N> RxCUIs with SAB=RXNORM normalized names, RxNorm release <YYYY-MM-DD>.
- This product uses publicly available data courtesy of the U.S. National
  Library of Medicine (NLM), National Institutes of Health, Department of
  Health and Human Services; NLM is not responsible for the product and does
  not endorse or recommend this or any other product.
- This data is a fixed snapshot and may not reflect the most current or
  accurate data available from NLM.

## ICD-10-CM
- Bundled: <N> ICD-10-CM codes with titles, FY<YYYY> release from NCHS.
- ICD-10-CM is developed by the National Center for Health Statistics (NCHS),
  CDC, under authorization by the World Health Organization. ICD-10 is
  copyright © World Health Organization. Codes are unmodified.
- ICD-10-CM is published by NCHS and CMS as a U.S. government work; no fee
  or license applies for use within the United States.
- Users outside the United States may need to contact the World Health
  Organization about licensing for ICD-10 modifications or international
  deployment.

## UCUM
- Bundled: <N> UCUM unit code strings, unmodified.
- Copyright 1999-2024 Regenstrief Institute, Inc. All rights reserved.
  Licensed under the UCUM License, Version 1.1; see
  https://unitsofmeasure.org/license. Provided on an "AS IS" BASIS, WITHOUT
  WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
```

## Sources

- **LOINC:** Regenstrief Institute, LOINC Copyright Notice and License: <https://loinc.org/license/>
- **RxNorm terms:** NLM, RxNorm Terms of Service: <https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html>
- **RxNorm subset:** NLM, RxNorm Current Prescribable Content: <https://www.nlm.nih.gov/research/umls/rxnorm/docs/prescribe.html>
- **UMLS:** NLM, License Agreement for Use of the UMLS Metathesaurus (2026AA, 05/04/2026), including Section 12 and Appendix 1: <https://uts.nlm.nih.gov/uts/assets/LicenseAgreement.pdf>
- **ICD-10-CM (NCHS):** NCHS/CDC, ICD-10-CM: <https://www.cdc.gov/nchs/icd/icd-10-cm/index.html>
- **ICD-10-CM release files:** NCHS, FY2027 release files: <https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/2027/>
- **ICD-10 (CMS):** CMS, ICD-10: <https://www.cms.gov/medicare/coding-billing/icd-10-codes>
- **ICD-10 (WHO):** WHO, FAQ Licensing ICD-10: <https://cdn.who.int/media/docs/default-source/publishing-policies/copyright/who-faq-licensing-icd-10.pdf?sfvrsn=b2c8a69a_0>
- **UCUM:** Regenstrief Institute, UCUM Copyright Notice and License v1.1: <https://ucum.org/license>
