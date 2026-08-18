"""
Fills the ORIGINAL Word template (word/document.xml, untouched layout) with
the current form data and returns the resulting .docx as bytes.

Approach: rather than regenerating the document from scratch, we open the
exact uploaded template and insert new runs/paragraphs/images at precise,
manually mapped locations (row/cell/paragraph indices verified against the
real file) — so every label, merged cell, and column width stays exactly as
authored. Signature fields arrive as actual drawn images (canvas PNG data
URLs from the frontend), not typed names, and are embedded as real inline
pictures in the document. We do not touch the floating HOD/CEO approval
drawing canvas itself (Word renders that as a positioned textbox, and
editing it via python-docx risks corrupting the drawing) — instead, a
clearly labeled summary of those two decisions, including their signature
images, is inserted as new paragraphs directly below it, before the SBU HR
table.
"""
import base64
import io
from pathlib import Path

import docx
from docx.shared import Pt

TEMPLATE_PATH = Path(__file__).parent / "templates" / "probation_template.docx"

FACTORS_ORDER = [
    "job_knowledge", "quality_of_work", "responsibility", "dependability",
    "courtesy", "personal_tidiness", "relationships", "attendance",
    "initiative", "company_property", "overall_eval",
]

INTERVAL_LABELS = {"6": "6 Months", "12": "12 Months", "end": "Probationary Period End"}
RESULT_LABELS = {
    "contributor": "Contributor",
    "extended": "Probationary Period Extended",
    "not-suitable": "Not Suitable for Employment",
}
DECISION_LABELS = {"confirm": "Confirm", "extend": "Extend Probation", "not-suitable": "Not Suitable for Employment"}

GRADE_COLUMN = {"A": 2, "B": 4, "C": 5, "D": 6}
COMMENT_COLUMN = 7


def _insert_after(paragraph, match_substr, value, bold=False, skip=0):
    if not value:
        return False
    runs = paragraph.runs
    for i, run in enumerate(runs):
        if match_substr in run.text:
            anchor = runs[min(i + skip, len(runs) - 1)]
            new_run = paragraph.add_run(f" {value}")
            new_run.bold = bold
            anchor._element.addnext(new_run._element)
            return True
    return False


def _fill_blank_paragraph(cell, index, value):
    if not value:
        return
    if index < len(cell.paragraphs):
        cell.paragraphs[index].add_run(str(value))
    else:
        cell.add_paragraph(str(value))


def _decode_signature(value):
    """Signature fields arrive from the frontend as a canvas-drawn PNG data
    URL (e.g. 'data:image/png;base64,....'), not typed text — a typed name
    isn't a signature. Returns raw image bytes, or None if there's nothing
    (or something malformed) to embed."""
    if not value or not isinstance(value, str) or not value.startswith("data:image"):
        return None
    try:
        _, b64data = value.split(",", 1)
        return base64.b64decode(b64data)
    except Exception:
        return None


def _insert_image_after_label(paragraph, label_marker, image_bytes, height_pt=26):
    """Splits the run containing `label_marker` (e.g. 'Signature:') right
    after the label, inserts the actual signature image there, and puts
    whatever text originally followed the label (usually blank space and
    then a 'Date:' label) back afterwards, unchanged, so a later call to
    _insert_after(..., 'Date', ...) still finds it."""
    if not image_bytes:
        return False
    for run in list(paragraph.runs):
        if label_marker in run.text:
            idx = run.text.find(label_marker) + len(label_marker)
            before, after = run.text[:idx], run.text[idx:]
            run.text = before
            img_run = paragraph.add_run()
            img_run.add_picture(io.BytesIO(image_bytes), height=Pt(height_pt))
            run._element.addnext(img_run._element)
            if after:
                after_run = paragraph.add_run(after)
                after_run.bold = run.bold
                img_run._element.addnext(after_run._element)
            return True
    return False


def _replace_placeholder_runs(container_paragraphs, full_name, epf):
    for p in container_paragraphs:
        for run in p.runs:
            stripped = run.text.strip()
            if stripped == "Full Name":
                run.text = full_name or "________"
            elif stripped in ("EPF Num", "EFP Num"):
                run.text = epf or "________"


def _walk_all_paragraphs(doc):
    yield from doc.paragraphs

    def walk_tables(tables):
        for t in tables:
            for row in t.rows:
                for cell in row.cells:
                    yield from cell.paragraphs
                    if cell.tables:
                        yield from walk_tables(cell.tables)

    yield from walk_tables(doc.tables)


def generate_docx(data: dict) -> bytes:
    doc = docx.Document(str(TEMPLATE_PATH))

    full_name = data.get("fullName", "")
    epf = data.get("epfTop") or data.get("epfNum", "")

    _replace_placeholder_runs(list(_walk_all_paragraphs(doc)), full_name, epf)

    t = doc.tables[0]

    # Row 1 — Projected Probationary End Date: []
    for run in t.rows[1].cells[0].paragraphs[0].runs:
        if run.text.strip() == "[]":
            run.text = f"[{data.get('probEndDate', '')}]"

    # Row 2 — Review Interval
    interval = data.get("interval")
    if interval:
        label = INTERVAL_LABELS.get(interval) or data.get("intervalOther", "")
        note = t.rows[2].cells[0].add_paragraph()
        run = note.add_run(f"Selected: {label}")
        run.bold = True
        run.italic = True

    # Row 3 — EPF Number
    _insert_after(t.rows[3].cells[0].paragraphs[0], "EPF Number:", data.get("epfNum", ""))

    # Row 4 — Department / Designation
    p4 = t.rows[4].cells[0].paragraphs[0]
    _insert_after(p4, "Department:", data.get("dept", ""))
    _insert_after(p4, "Designation:", data.get("designation", ""))

    # Row 5 — Employment Date
    _insert_after(t.rows[5].cells[0].paragraphs[0], "Employment Date", data.get("empDate", ""), skip=1)

    # Row 6 — Supervisor's Name / Title
    p6 = t.rows[6].cells[0].paragraphs[0]
    _insert_after(p6, "Supervisor\u2019s Name", data.get("supName", ""), skip=1)
    _insert_after(p6, "Supervisor\u2019s Title", data.get("supTitle", ""), skip=1)

    # Row 7 — Leave records
    p7_1 = t.rows[7].cells[0].paragraphs[1]
    _insert_after(p7_1, "Absent without leave", data.get("leaveAwol", ""))
    _insert_after(p7_1, "No Pay", data.get("leaveNoPay", ""))
    p7_2 = t.rows[7].cells[0].paragraphs[2]
    _insert_after(p7_2, "Annual", data.get("leaveAnnual", ""))
    _insert_after(p7_2, "Casual", data.get("leaveCasual", ""))
    _insert_after(p7_2, "Medical", data.get("leaveMedical", ""))

    # Row 9 — Employee Development Plan
    _fill_blank_paragraph(t.rows[9].cells[0], 1, data.get("devPlan", ""))
    # Row 10 — Steps taken to enhance job performance
    _fill_blank_paragraph(t.rows[10].cells[0], 1, data.get("devSteps", ""))

    # Row 11 — Employee signature / date
    p11 = t.rows[11].cells[0].paragraphs[0]
    _insert_image_after_label(p11, "Signature:", _decode_signature(data.get("empSig")))
    _insert_after(p11, "Date", data.get("empSigDate", ""))

    # Nested evaluation table
    nested = t.rows[13].cells[0].tables[0]
    for i, factor in enumerate(FACTORS_ORDER):
        row = nested.rows[i + 2]
        grade = data.get(f"grade_{factor}")
        comment = data.get(f"comment_{factor}", "")
        if grade in GRADE_COLUMN:
            cell = row.cells[GRADE_COLUMN[grade]]
            para = cell.paragraphs[0] if cell.paragraphs else cell.add_paragraph()
            run = para.add_run("X")
            run.bold = True
        if comment:
            cell = row.cells[COMMENT_COLUMN]
            para = cell.paragraphs[0] if cell.paragraphs else cell.add_paragraph()
            para.add_run(str(comment))

    # Row 13 cell — Comments / strengths / improvements
    cell13 = t.rows[13].cells[0]
    _fill_blank_paragraph(cell13, 5, data.get("overallProgress", ""))
    _fill_blank_paragraph(cell13, 9, data.get("strengths", ""))
    _fill_blank_paragraph(cell13, 13, data.get("improvements", ""))

    # Row 14 — Overall Result of Review
    result = data.get("overallResult")
    if result:
        label = RESULT_LABELS.get(result, result)
        extra = f" (until {data.get('extendedUntil', '')})" if result == "extended" else ""
        note = t.rows[14].cells[0].add_paragraph()
        run = note.add_run(f"Selected: {label}{extra}")
        run.bold = True
        run.italic = True

    # Row 16 — Steps taken to assist employee
    _fill_blank_paragraph(t.rows[16].cells[0], 1, data.get("assistSteps", ""))

    # Row 17 — Supervisor signature / date
    p17 = t.rows[17].cells[0].paragraphs[0]
    _insert_image_after_label(p17, "Signature:", _decode_signature(data.get("supSig")))
    _insert_after(p17, "Date", data.get("supSigDate", ""))

    # HOD / CEO decisions — new summary paragraphs immediately before the
    # SBU HR table (see module docstring for why we don't edit the drawing
    # canvas directly).
    hod, ceo = data.get("hodDecision"), data.get("ceoDecision")
    if hod or ceo or data.get("hodSig") or data.get("ceoSig"):
        anchor_elem = doc.tables[1]._element
        for p in doc.paragraphs:
            if "SBU HR Division" in p.text:
                anchor_elem = p._element
                break

        for role_label, decision, extend_key, sig_key, sig_date_key in [
            ("Head of the Department", hod, "hodExtendDuration", "hodSig", "hodSigDate"),
            ("CEO", ceo, "ceoExtendDuration", "ceoSig", "ceoSigDate"),
        ]:
            if not (decision or data.get(sig_key)):
                continue
            new_p = doc.add_paragraph()
            label = DECISION_LABELS.get(decision, decision) if decision else "\u2014"
            extra = f" by {data.get(extend_key, '')}" if decision == "extend" else ""
            lead_run = new_p.add_run(f"{role_label} Decision: {label}{extra}    Signature: ")
            lead_run.bold = True
            sig_bytes = _decode_signature(data.get(sig_key))
            if sig_bytes:
                img_run = new_p.add_run()
                img_run.add_picture(io.BytesIO(sig_bytes), height=Pt(26))
            date_run = new_p.add_run(f"    Date: {data.get(sig_date_key, '')}")
            date_run.bold = True
            anchor_elem.addprevious(new_p._element)

    # Table 1 — SBU HR
    t1 = doc.tables[1]
    if data.get("sbuComments"):
        t1.rows[0].cells[0].add_paragraph(str(data["sbuComments"]))
    p_sbu = t1.rows[1].cells[0].paragraphs[0]
    _insert_image_after_label(p_sbu, "Signature:", _decode_signature(data.get("sbuSig")))
    _insert_after(p_sbu, "Date", data.get("sbuSigDate", ""))

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()