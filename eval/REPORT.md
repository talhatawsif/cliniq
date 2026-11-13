# Extraction evaluation (2026-11-13)

- **N = 12 notes** (of 12), labelled by: Claude Sonnet 5.5 (AI). Labelled by reading each note, not from the pipeline's output. Not reviewed by a clinician.
- Extraction: precomputed. Coding: csiro terminology server, SNOMED CT-AU 20261031.
- Matching: a predicted span matches a gold span when their overlap is at least half of their union.

## How to read these numbers

- Gold labels cover **every** condition, symptom and clinical finding mentioned in a note, including ones the pipeline is not built to
  look for. The extractor only finds terms from its target list (`services/nlp/targets.json`, about 100 conditions and symptoms),
  so **recall is limited by design** and precision is the better measure of how much to trust what it writes.
- The extractor and its rules were fixed after a first run of this evaluation (a "History:" heading was marking findings historical;
  "unlikely" was read as negated; "CKD stage 2" was split). Those fixes are general. No note-specific terms were added to the
  target list to raise the score, because the notes are also the test set.
- Coding accuracy is measured only on mentions the extractor found and the labeller gave a code, so it is not a measure of coding
  coverage.
- Twelve notes, one labeller, no second opinion: treat the figures as a baseline, not a validation.

## Extraction (does it find the mentions)

| Precision | Recall | F1 | TP | FP | FN |
|---|---|---|---|---|---|
| 93.2% | 57.5% | 71.1% | 123 | 9 | 91 |

## Assertion (is the mention affirmed, negated, family, historical, hypothetical or uncertain), over matched mentions

Overall assertion accuracy: 99.2% (123 matched).

| Assertion | Precision | Recall | F1 | Gold count |
|---|---|---|---|---|
| affirmed | 100.0% | 98.6% | 99.3% | 72 |
| negated | 100.0% | 100.0% | 100.0% | 29 |
| family | 100.0% | 100.0% | 100.0% | 16 |
| historical | 0.0% | 0.0% | 0.0% | 0 |
| hypothetical | 100.0% | 100.0% | 100.0% | 4 |
| uncertain | 66.7% | 100.0% | 80.0% | 2 |

## Coding (top-1 SNOMED CT code, affirmed matched mentions with a gold code)

57 of 57 correct (100.0%).

## Per note

| Note | Gold | Predicted | Precision | Recall | F1 |
|---|---|---|---|---|---|
| 01-referral-nephrology.txt | 24 | 11 | 100.0% | 45.8% | 62.9% |
| 02-discharge-pneumonia.txt | 17 | 13 | 100.0% | 76.5% | 86.7% |
| 03-consult-diabetes-review.txt | 21 | 11 | 100.0% | 52.4% | 68.8% |
| 04-referral-podiatry.txt | 17 | 7 | 100.0% | 41.2% | 58.3% |
| 05-consult-cardiology.txt | 19 | 17 | 88.2% | 78.9% | 83.3% |
| 06-discharge-fall.txt | 16 | 8 | 100.0% | 50.0% | 66.7% |
| 07-consult-back-pain.txt | 17 | 8 | 87.5% | 41.2% | 56.0% |
| 08-consult-asthma-allergy.txt | 20 | 13 | 76.9% | 50.0% | 60.6% |
| 09-consult-adolescent.txt | 12 | 3 | 100.0% | 25.0% | 40.0% |
| 10-discharge-heart-failure.txt | 17 | 16 | 93.8% | 88.2% | 90.9% |
| 11-referral-weight-management.txt | 13 | 8 | 87.5% | 53.8% | 66.7% |
| 12-consult-cough.txt | 21 | 17 | 94.1% | 76.2% | 84.2% |

## Every error

- 01-referral-nephrology.txt: missed "diabetic kidney disease" (affirmed)
- 01-referral-nephrology.txt: missed "microalbuminuria" (affirmed)
- 01-referral-nephrology.txt: missed "rising creatinine" (affirmed)
- 01-referral-nephrology.txt: missed "haematuria" (negated)
- 01-referral-nephrology.txt: missed "frothy urine" (negated)
- 01-referral-nephrology.txt: missed "flank pain" (negated)
- 01-referral-nephrology.txt: missed "ankle oedema" (negated)
- 01-referral-nephrology.txt: missed "heartburn" (affirmed)
- 01-referral-nephrology.txt: missed "dysphagia" (negated)
- 01-referral-nephrology.txt: missed "weight loss" (negated)
- 01-referral-nephrology.txt: missed "polycystic kidney disease" (negated)
- 01-referral-nephrology.txt: missed "diabetes" (affirmed)
- 01-referral-nephrology.txt: missed "Renal artery stenosis" (uncertain)
- 02-discharge-pneumonia.txt: missed "right lower lobe consolidation" (affirmed)
- 02-discharge-pneumonia.txt: missed "Pulmonary embolism" (negated)
- 02-discharge-pneumonia.txt: missed "pleural effusion" (negated)
- 02-discharge-pneumonia.txt: missed "ischaemic ECG changes" (negated)
- 03-consult-diabetes-review.txt: missed "polyuria" (negated)
- 03-consult-diabetes-review.txt: missed "polydipsia" (negated)
- 03-consult-diabetes-review.txt: missed "blurred vision" (negated)
- 03-consult-diabetes-review.txt: missed "hypoglycaemic episodes" (negated)
- 03-consult-diabetes-review.txt: missed "low mood" (affirmed)
- 03-consult-diabetes-review.txt: missed "poor sleep" (affirmed)
- 03-consult-diabetes-review.txt: missed "loss of interest" (affirmed)
- 03-consult-diabetes-review.txt: missed "thoughts of self-harm" (negated)
- 03-consult-diabetes-review.txt: missed "peripheral neuropathy" (negated)
- 03-consult-diabetes-review.txt: missed "foot ulcers" (negated)
- 04-referral-podiatry.txt: missed "peripheral neuropathy" (affirmed)
- 04-referral-podiatry.txt: missed "Numbness and tingling" (affirmed)
- 04-referral-podiatry.txt: missed "foot ulcers" (negated)
- 04-referral-podiatry.txt: missed "claudication" (negated)
- 04-referral-podiatry.txt: missed "rest pain" (negated)
- 04-referral-podiatry.txt: missed "Reduced monofilament sensation" (affirmed)
- 04-referral-podiatry.txt: missed "callus" (negated)
- 04-referral-podiatry.txt: missed "skin breakdown" (negated)
- 04-referral-podiatry.txt: missed "Early Charcot changes" (uncertain)
- 04-referral-podiatry.txt: missed "ulcer" (hypothetical)
- 05-consult-cardiology.txt: extra "chest pain" (negated)
- 05-consult-cardiology.txt: extra "reflux" (affirmed)
- 05-consult-cardiology.txt: missed "exertional chest pain" (negated)
- 05-consult-cardiology.txt: missed "reflux symptoms" (affirmed)
- 05-consult-cardiology.txt: missed "murmurs" (negated)
- 05-consult-cardiology.txt: missed "ischaemic changes" (negated)
- 06-discharge-fall.txt: missed "Fracture of the left distal radius" (affirmed)
- 06-discharge-fall.txt: missed "Postural hypotension" (affirmed)
- 06-discharge-fall.txt: missed "loss of consciousness" (negated)
- 06-discharge-fall.txt: missed "undisplaced distal radius fracture" (affirmed)
- 06-discharge-fall.txt: missed "hip fracture" (negated)
- 06-discharge-fall.txt: missed "postural drop" (affirmed)
- 06-discharge-fall.txt: missed "hip fracture" (family)
- 06-discharge-fall.txt: missed "postural symptoms" (hypothetical)
- 07-consult-back-pain.txt: extra "anaemia" (affirmed)
- 07-consult-back-pain.txt: missed "iron deficiency anaemia" (affirmed)
- 07-consult-back-pain.txt: missed "colonic polyps" (affirmed)
- 07-consult-back-pain.txt: missed "saddle anaesthesia" (negated)
- 07-consult-back-pain.txt: missed "bladder or bowel disturbance" (negated)
- 07-consult-back-pain.txt: missed "weight loss" (negated)
- 07-consult-back-pain.txt: missed "cancer" (negated)
- 07-consult-back-pain.txt: missed "insomnia" (affirmed)
- 07-consult-back-pain.txt: missed "Sciatica" (uncertain)
- 07-consult-back-pain.txt: missed "leg weakness" (hypothetical)
- 07-consult-back-pain.txt: missed "numbness" (hypothetical)
- 08-consult-asthma-allergy.txt: extra "ASTHMA" (affirmed)
- 08-consult-asthma-allergy.txt: extra "wheeze" (negated)
- 08-consult-asthma-allergy.txt: extra "Asthma" (affirmed)
- 08-consult-asthma-allergy.txt: missed "nocturnal wheeze" (negated)
- 08-consult-asthma-allergy.txt: missed "exacerbations" (negated)
- 08-consult-asthma-allergy.txt: missed "sneezing" (affirmed)
- 08-consult-asthma-allergy.txt: missed "nasal blockage" (affirmed)
- 08-consult-asthma-allergy.txt: missed "anaphylaxis" (negated)
- 08-consult-asthma-allergy.txt: missed "chest tightness" (negated)
- 08-consult-asthma-allergy.txt: missed "eczema" (family)
- 08-consult-asthma-allergy.txt: missed "rhinitis" (affirmed)
- 08-consult-asthma-allergy.txt: missed "throat tightness" (hypothetical)
- 08-consult-asthma-allergy.txt: missed "difficulty breathing" (hypothetical)
- 09-consult-adolescent.txt: missed "fish allergy" (affirmed)
- 09-consult-adolescent.txt: missed "Fish allergy" (affirmed)
- 09-consult-adolescent.txt: missed "allergic reactions" (negated)
- 09-consult-adolescent.txt: missed "eczema" (negated)
- 09-consult-adolescent.txt: missed "acne vulgaris" (affirmed)
- 09-consult-adolescent.txt: missed "headaches" (negated)
- 09-consult-adolescent.txt: missed "venous thromboembolism" (negated)
- 09-consult-adolescent.txt: missed "comedonal acne" (affirmed)
- 09-consult-adolescent.txt: missed "breathing difficulty" (hypothetical)
- 10-discharge-heart-failure.txt: extra "heart failure" (affirmed)
- 10-discharge-heart-failure.txt: missed "Acute decompensated heart failure" (affirmed)
- 10-discharge-heart-failure.txt: missed "peripheral neuropathy" (affirmed)
- 11-referral-weight-management.txt: extra "osteoarthritis" (affirmed)
- 11-referral-weight-management.txt: missed "weight gain" (affirmed)
- 11-referral-weight-management.txt: missed "osteoarthritis of the right knee" (affirmed)
- 11-referral-weight-management.txt: missed "loud snoring" (affirmed)
- 11-referral-weight-management.txt: missed "Obstructive sleep apnoea" (uncertain)
- 11-referral-weight-management.txt: missed "diabetes" (negated)
- 11-referral-weight-management.txt: missed "sleep apnoea" (hypothetical)
- 12-consult-cough.txt: extra "cough" (uncertain)
- 12-consult-cough.txt: missed "runny nose" (affirmed)
- 12-consult-cough.txt: missed "ACE inhibitor cough" (uncertain)
- 12-consult-cough.txt: missed "exudate" (negated)
- 12-consult-cough.txt: missed "crackles" (negated)
- 12-consult-cough.txt: missed "Viral upper respiratory tract infection" (affirmed)
- 12-consult-cough.txt: "cough" labelled affirmed, predicted uncertain
