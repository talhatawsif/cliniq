"""medspaCy pipeline: sectioniser, target matcher from targets.json, ConText with Australian rules."""
import json
import re
from pathlib import Path

import sys

import spacy
from spacy.language import Language
from loguru import logger
from medspacy.context import ConTextRule
from medspacy.section_detection import SectionRule
from medspacy.target_matcher import TargetRule

# PyRuSH logs every sentence at DEBUG, which is patient text. Keep warnings only.
logger.remove()
logger.add(sys.stderr, level="WARNING")

TARGETS = Path(__file__).with_name("targets.json")

# Section headings (Australian clinical letters). No section marks its entities historical: a problem in
# "PMHx" is still a current problem unless ConText says otherwise.
SECTIONS = [
    ("past_medical_history", ["PMHx", "PMH", "Past medical history", "Past history", "Medical history"]),
    ("family_history", ["FHx", "FH", "Family history"]),
    ("allergies", ["Allergies", "Allergy", "Adverse reactions"]),
    ("medications", ["Medications", "Medicines", "Current medications"]),
    ("diagnoses", ["Diagnoses", "Diagnosis", "Problem list", "Active problems"]),
    ("history_of_presenting_complaint", ["HPC", "History of presenting complaint", "Presenting complaint", "Presentation"]),
    ("examination", ["Examination", "O/E", "On examination"]),
    ("investigations", ["Investigations", "Results", "ECG"]),
    ("assessment", ["Impression", "Assessment"]),
    ("plan", ["Plan", "Management", "Recommendations"]),
]

# (phrase, category, direction). Added to medspaCy's English defaults.
CONTEXT = [
    ("nil", "NEGATED_EXISTENCE", "FORWARD"),
    ("nil known", "NEGATED_EXISTENCE", "FORWARD"),
    ("NKDA", "NEGATED_EXISTENCE", "FORWARD"),
    ("denies", "NEGATED_EXISTENCE", "FORWARD"),
    ("denied", "NEGATED_EXISTENCE", "FORWARD"),
    ("not had", "NEGATED_EXISTENCE", "FORWARD"),
    ("no evidence of", "NEGATED_EXISTENCE", "FORWARD"),
    ("ruled out", "NEGATED_EXISTENCE", "BACKWARD"),
    ("was ruled out", "NEGATED_EXISTENCE", "BACKWARD"),
    ("is unlikely", "POSSIBLE_EXISTENCE", "BACKWARD"),
    ("unlikely", "POSSIBLE_EXISTENCE", "BACKWARD"),
    ("?", "POSSIBLE_EXISTENCE", "FORWARD"),
    ("possible", "POSSIBLE_EXISTENCE", "FORWARD"),
    ("query", "POSSIBLE_EXISTENCE", "FORWARD"),
    ("Mother", "FAMILY", "BIDIRECTIONAL"),
    ("Father", "FAMILY", "BIDIRECTIONAL"),
    ("Sister", "FAMILY", "BIDIRECTIONAL"),
    ("Brother", "FAMILY", "BIDIRECTIONAL"),
    ("family history of", "FAMILY", "FORWARD"),
    ("past history of", "HISTORICAL", "FORWARD"),
    ("history of", "HISTORICAL", "FORWARD"),
    ("if she develops", "HYPOTHETICAL", "FORWARD"),
    ("if he develops", "HYPOTHETICAL", "FORWARD"),
    ("if you develop", "HYPOTHETICAL", "FORWARD"),
    ("if", "HYPOTHETICAL", "FORWARD"),
    ("return if", "HYPOTHETICAL", "FORWARD"),
]


@Language.component("cliniq_sentence_breaks")
def sentence_breaks(doc):
    """PyRuSH does not split after a full stop that follows an abbreviation ("T2DM. Denies chest pain."), so a negation
    or family cue ran on into the next sentence. A full stop followed by a capital letter starts a sentence."""
    for i, tok in enumerate(doc[:-1]):
        nxt = doc[i + 1]
        if tok.text == "." and nxt.text[:1].isupper():
            nxt.is_sent_start = True
    return doc


def build() -> "spacy.Language":
    from medspacy.context import ConText  # noqa: F401  (registers the component)

    nlp = spacy.blank("en")
    nlp.add_pipe("medspacy_pyrush")
    nlp.add_pipe("cliniq_sentence_breaks")
    matcher = nlp.add_pipe("medspacy_target_matcher")
    rules = []
    for t in json.loads(TARGETS.read_text())["targets"]:
        for phrase in [t["term"], *t["synonyms"]]:
            # Abbreviations (HTN, T2DM) match as written; words match any case.
            pattern = [{"TEXT": phrase}] if re.fullmatch(r"[A-Z0-9]{2,6}", phrase) else phrase
            rules.append(TargetRule(literal=phrase, category=t["term"], pattern=pattern if not isinstance(pattern, str) else None))
    matcher.add(rules)
    # medspaCy's defaults, minus two rules that are wrong for clinical letters: a bare "history" marks everything under a
    # "History:" heading historical (so "History: dry cough, sore throat" was never written), and "unlikely" means
    # negated where a clinician means "probably not" (uncertain).
    context = nlp.add_pipe("medspacy_context", config={"rules": None})
    defaults = ConTextRule.from_json(context.DEFAULT_RULES_FILEPATH)
    context.add([r for r in defaults if r.literal.lower() not in ("history", "unlikely")])
    context.add([ConTextRule(p, c, direction=d) for p, c, d in CONTEXT])
    sectionizer = nlp.add_pipe("medspacy_sectionizer", config={"rules": None, "span_attrs": None})
    sectionizer.add([SectionRule(h, cat) for cat, heads in SECTIONS for h in heads])
    return nlp


NLP = build()


def extract(text: str) -> list[dict]:
    doc = NLP(text)
    out = []
    for e in doc.ents:
        section = e._.section_category or "unknown"
        title = e._.section_title
        # A heading governs its own paragraph only: a blank line ends the section (letters rarely repeat headings).
        if title is not None and re.search(r"\n\s*\n", text[title.end_char : e.start_char]):
            section = "unknown"
        out.append(
            {
                "text": e.text,
                "start": e.start_char,
                "end": e.end_char,
                "term": e.label_,
                "section": section,
                "negated": bool(e._.is_negated),
                "family": bool(e._.is_family) or section == "family_history",
                "historical": bool(e._.is_historical),
                "hypothetical": bool(e._.is_hypothetical),
                "uncertain": bool(e._.is_uncertain),
            }
        )
    return out
