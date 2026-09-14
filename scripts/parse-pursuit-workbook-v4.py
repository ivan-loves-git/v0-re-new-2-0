#!/usr/bin/env python3
"""Read the exact received V4 source. Output is private JSON on stdout only."""
import hashlib
import json
from pathlib import Path
import runpy
import sys

# Reuse the existing standard-library XLSX reader, without changing V3's pinned parser.
reader = runpy.run_path(str(Path(__file__).with_name("parse-historical-pursuit-workbook.py")))
SHA = "f527683a09d1e67e2c01479c20529963b7b1760578ff558181cad18c7febfbd3"
STAGES = ["interest_confirmed", "nda_received", "nda_signed", "info_memo_received",
          "qa_with_ma_firm", "seller_meeting", "valuation", "loi_issued", "audits", "financing", "closing"]


def parse(path):
    if hashlib.sha256(Path(path).read_bytes()).hexdigest() != SHA:
        raise ValueError("The workbook is not the reviewed V4 source")
    rows = []
    for number, cells in reader["cell_rows"](path, "Synthese"):
        if number < 3:
            continue
        if not cells.get("A") and not cells.get("C"):
            continue
        stage_cells = dict(zip(STAGES, [cells.get(column) for column in "DEFGHIJKLMN"]))
        rows.append({"sourceRow": number, "repreneurName": cells.get("A"), "offerLabel": cells.get("B"),
                     "opportunityReference": cells.get("C"), "dropReason": cells.get("O"),
                     "completedSourceStages": [key for key, value in stage_cells.items() if reader["yes"](value)],
                     "notApplicableSourceStages": [key for key, value in stage_cells.items() if reader["not_applicable"](value)],
                     "sourceCells": stage_cells})
    if [row["sourceRow"] for row in rows] != list(range(3, 75)):
        raise ValueError("V4 must contain exactly Synthese rows 3 through 74")
    return {"source": {"file": "M&A Interest and pursuit V4.xlsx", "sha256": SHA, "sheet": "Synthese"}, "rows": rows}


if __name__ == "__main__":
    print(json.dumps(parse(sys.argv[1]), ensure_ascii=False, sort_keys=True))
