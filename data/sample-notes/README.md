# Sample notes

Twelve hand-written, entirely synthetic notes in Australian style (GP letters, referrals and
discharge summaries). Each belongs to one cohort patient (`index.json`) and agrees with that
patient's record; `npm run cohort:build` attaches them as `DocumentReference` resources.

They exist to exercise the note pipeline: negation ("denies", "nil", "no"), family history
("FHx"), uncertainty ("?", "unlikely"), hypotheticals ("if she develops…"), Australian
abbreviations and spellings (PMHx, HTN, T2DM, IHD, GORD, anaemia, frusemide), and at least one
diagnosis per note that is not yet on the patient's problem list.

No real person, clinician or organisation is described.
