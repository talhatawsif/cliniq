"""C1-C16 from SPEC.md M9. "Affirmed" means all five booleans are false."""
import pytest

from nlp import extract

FLAGS = ["negated", "family", "historical", "hypothetical", "uncertain"]


def state(e):
    on = [f for f in FLAGS if e[f]]
    return on[0] if on else "affirmed"


def got(text):
    ents = extract(text)
    for e in ents:  # offsets must point at the entity text
        assert text[e["start"] : e["end"]] == e["text"]
    return {e["text"].lower(): e for e in ents}


CASES = [
    ("C1", "Patient denies chest pain.", {"chest pain": "negated"}),
    ("C2", "No evidence of pneumonia on chest X-ray.", {"pneumonia": "negated"}),
    ("C3", "Nil chest pain or shortness of breath.", {"chest pain": "negated", "shortness of breath": "negated"}),
    ("C4", "Denies fever, chills or night sweats.", {"fever": "negated", "night sweats": "negated"}),
    ("C5", "No fever but has a productive cough.", {"fever": "negated", "productive cough": "affirmed"}),
    ("C6", "Myocardial infarction was ruled out.", {"myocardial infarction": "negated"}),
    ("C7", "Mother had breast cancer at age 50.", {"breast cancer": "family"}),
    ("C8", "FHx: IHD (father).", {"ihd": "family"}),
    ("C9", "Past history of myocardial infarction in 2015.", {"myocardial infarction": "historical"}),
    ("C10", "PMHx: HTN, T2DM.", {"htn": "affirmed", "t2dm": "affirmed"}),
    ("C11", "Possible pneumonia.", {"pneumonia": "uncertain"}),
    ("C12", "?UTI", {"uti": "uncertain"}),
    ("C13", "If she develops a fever, return to ED.", {"fever": "hypothetical"}),
    ("C14", "Type 2 diabetes mellitus, on metformin.", {"type 2 diabetes mellitus": "affirmed"}),
    ("C15", "Known asthma. No wheeze today.", {"asthma": "affirmed", "wheeze": "negated"}),
]


@pytest.mark.parametrize("name,text,expected", CASES, ids=[c[0] for c in CASES])
def test_context(name, text, expected):
    found = got(text)
    for term, want in expected.items():
        assert term in found, f"{term!r} not found in {list(found)}"
        assert state(found[term]) == want


def test_c4_chills_if_matched_is_negated():
    # "chills" is not a target term; if a future target list adds it, it must be negated too.
    assert all(state(e) == "negated" for e in extract("Denies fever, chills or night sweats."))


def test_c10_section_is_past_medical_history():
    assert {e["section"] for e in extract("PMHx: HTN, T2DM.")} == {"past_medical_history"}


def test_c16_nkda_has_no_affirmed_condition():
    assert [e for e in extract("Allergies: NKDA.") if state(e) == "affirmed"] == []


def test_offsets_on_a_multiline_note():
    text = "Diagnoses:\n1. Hypertension.\n\nAllergies: Nil known.\nNo chest pain."
    for e in extract(text):
        assert text[e["start"] : e["end"]] == e["text"]


def test_http_extract_and_validation():
    from fastapi.testclient import TestClient

    from main import app

    c = TestClient(app)
    r = c.post("/extract", json={"text": "Patient denies chest pain."})
    assert r.status_code == 200
    assert r.json()["entities"][0]["negated"] is True
    assert c.post("/extract", json={"text": ""}).status_code == 422
    assert c.post("/extract", json={"text": "x" * 50_001}).status_code == 422
    assert c.get("/health").json()["status"] == "ok"


def test_section_ends_at_a_blank_line():
    text = "Allergies: Nil known.\n\nShe has chest pain."
    assert [e["section"] for e in extract(text)] == ["unknown"]
    assert [e["family"] for e in extract("FHx: IHD.\n\nShe has asthma.")] == [True, False]


def test_history_heading_does_not_make_findings_historical():
    # Found by the extraction evaluation: "History:" is a heading, not "history of".
    e = {x["text"].lower(): x for x in extract("History: Dry cough with a sore throat. One week of orthopnoea.")}
    assert not any(v["historical"] for v in e.values())
    assert state(e["orthopnoea"]) == "affirmed"
    assert state(extract("Past history of myocardial infarction in 2015.")[0]) == "historical"  # C9 still holds


def test_unlikely_means_uncertain_not_negated():
    assert state(extract("Pneumonia unlikely.")[0]) == "uncertain"
    assert state(extract("Heart failure is unlikely given a normal examination.")[0]) == "uncertain"


def test_cues_do_not_run_across_a_full_stop_on_one_line():
    # Found by pasting a one-line note: "Denies chest pain." negated IHD, and "Father had IHD." made a later fever "family".
    e = {x["text"]: x for x in extract("PMHx: HTN, T2DM. Denies chest pain. FHx: Father had IHD. If she develops a fever, return.")}
    assert state(e["chest pain"]) == "negated"
    assert state(e["IHD"]) == "family"
    # On one line the "FHx:" section runs to the end of the paragraph, so the fever is withheld as family history: the safe
    # direction (a withheld finding is shown with its reason; a wrongly affirmed one would be written).
    assert state(e["fever"]) != "affirmed"
    assert state(e["HTN"]) == "affirmed"
    t = {x["text"]: x for x in extract("No fever. The patient has pneumonia. Mother had breast cancer. She has asthma.")}
    assert [state(t[k]) for k in ("fever", "pneumonia", "breast cancer", "asthma")] == ["negated", "affirmed", "family", "affirmed"]


def test_abbreviations_and_decimals_do_not_split_sentences():
    e = {x["text"]: x for x in extract("Dr. Smith saw her. Denies chest pain, no fever.")}
    assert state(e["chest pain"]) == "negated" and state(e["fever"]) == "negated"
