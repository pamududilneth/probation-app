"""
Fills the ORIGINAL Word template (word/document.xml, untouched layout) with
the current form data and returns the resulting .docx as bytes.

Approach: rather than regenerating the document from scratch, we open the
exact uploaded template and insert new runs/paragraphs at precise, manually
mapped locations (row/cell/paragraph indices verified against the real
file) — so every label, merged cell, and column width stays exactly as
authored. We do not touch the floating HOD/CEO approval drawing canvas
(Word renders that as a positioned textbox, not plain cell text, and
editing it via python-docx risks corrupting the drawing) — instead, a
clearly labeled summary of those two decisions is inserted as a new
paragraph directly below it, before the SBU HR table.
"""
import io
from pathlib import Path

import docx

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

# Grade column index within the nested evaluation table (0-based cell index
# per row; A/B/C/D cells are partially merged so any index within the merge
# resolves to the same underlying cell).
GRADE_COLUMN = {"A": 2, "B": 4, "C": 5, "D": 6}
COMMENT_COLUMN = 7


def _insert_after(paragraph, match_substr, value, bold=False, skip=0):
    """Insert a new run containing `value` immediately after the run whose
    text contains `match_substr` — keeps the answer sitting right next to
    its label without disturbing the label's own formatting. Some labels
    keep their trailing colon in a separate run from the label text itself
    (e.g. "Employment Date" then ":" as two runs) — `skip` lets us anchor
    after that colon run instead of before it, so the value doesn't end up
    sitting in front of the colon."""
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
    """Writes into the paragraph at `index` if it exists (the template
    leaves blank spacer paragraphs under most free-text labels); otherwise
    appends a new one."""
    if not value:
        return
    if index < len(cell.paragraphs):
        cell.paragraphs[index].add_run(str(value))
    else:
        cell.add_paragraph(str(value))


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

    # The "Probation Progress Review of [Full Name] – [EPF Num]" heading
    # appears twice (top of document, and again above the evaluation table).
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

    # Row 5 — Employment Date (label and its colon are separate runs, so
    # skip past the colon before inserting the value)
    _insert_after(t.rows[5].cells[0].paragraphs[0], "Employment Date", data.get("empDate", ""), skip=1)

    # Row 6 — Supervisor's Name / Title (same separate-colon situation)
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
    if data.get("empSig") or data.get("empSigDate"):
        p11 = t.rows[11].cells[0].paragraphs[0]
        p11.add_run(f"   {data.get('empSig', '')}        (Signed {data.get('empSigDate', '')})")

    # Nested evaluation table (11 factor rows, rows 2..12 of the nested table)
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

    # Row 13 cell — Comments on Overall Progress / strengths / improvements
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
    if data.get("supSig") or data.get("supSigDate"):
        p17 = t.rows[17].cells[0].paragraphs[0]
        p17.add_run(f"   {data.get('supSig', '')}        (Signed {data.get('supSigDate', '')})")

    # HOD / CEO decisions — inserted as a new summary paragraph immediately
    # before the SBU HR table (see module docstring for why we don't edit
    # the drawing canvas directly).
    hod, ceo = data.get("hodDecision"), data.get("ceoDecision")
    if hod or ceo or data.get("hodSig") or data.get("ceoSig"):
        anchor_elem = doc.tables[1]._element
        for p in doc.paragraphs:
            if "SBU HR Division" in p.text:
                anchor_elem = p._element
                break
        lines = []
        if hod:
            label = DECISION_LABELS.get(hod, hod)
            extra = f" by {data.get('hodExtendDuration', '')}" if hod == "extend" else ""
            lines.append(
                f"Head of the Department Decision: {label}{extra}  —  "
                f"{data.get('hodSig', '')}  ({data.get('hodSigDate', '')})"
            )
        if ceo:
            label = DECISION_LABELS.get(ceo, ceo)
            extra = f" by {data.get('ceoExtendDuration', '')}" if ceo == "extend" else ""
            lines.append(
                f"CEO Decision: {label}{extra}  —  "
                f"{data.get('ceoSig', '')}  ({data.get('ceoSigDate', '')})"
            )
        for line in lines:
            new_p = doc.add_paragraph()
            run = new_p.add_run(line)
            run.bold = True
            anchor_elem.addprevious(new_p._element)

    # Table 1 — SBU HR
    t1 = doc.tables[1]
    if data.get("sbuComments"):
        t1.rows[0].cells[0].add_paragraph(str(data["sbuComments"]))
    if data.get("sbuSig") or data.get("sbuSigDate"):
        p_sbu = t1.rows[1].cells[0].paragraphs[0]
        p_sbu.add_run(f"   {data.get('sbuSig', '')}        (Signed {data.get('sbuSigDate', '')})")

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()