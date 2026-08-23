#!/usr/bin/env python3
"""Read the approved historical pursuit workbook into neutral source facts.

This parser writes JSON to stdout only. It deliberately does not translate
workbook stages into WAVE gates, documents, timestamps, or live pursuit state.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile


EXPECTED_SHA256 = "6fa8b640dfcd385c2bd6dabf571ee01a4f51d09a53122f65c422c047ddb3f60f"
MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN}


def text(value):
    value = str(value or "").strip()
    return value or None


def normalized(value):
    value = unicodedata.normalize("NFKD", text(value) or "")
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", value).strip().casefold()


def cell_rows(path, sheet_name):
    archive = zipfile.ZipFile(path)
    strings = []
    if "xl/sharedStrings.xml" in archive.namelist():
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        strings = [
            "".join(part.text or "" for part in item.findall(".//m:t", NS))
            for item in root.findall("m:si", NS)
        ]
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
    sheet = next(
        item for item in workbook.findall("m:sheets/m:sheet", NS)
        if item.attrib["name"] == sheet_name
    )
    target = targets[sheet.attrib[f"{{{REL}}}id"]].lstrip("/")
    if not target.startswith("xl/"):
        target = f"xl/{target}"
    root = ET.fromstring(archive.read(target))
    for row in root.findall(".//m:sheetData/m:row", NS):
        values = {}
        for cell in row.findall("m:c", NS):
            reference = cell.attrib["r"]
            column = re.match(r"[A-Z]+", reference).group(0)
            value = cell.find("m:v", NS)
            rendered = value.text if value is not None else None
            if cell.attrib.get("t") == "s" and rendered is not None:
                rendered = strings[int(rendered)]
            elif cell.attrib.get("t") == "inlineStr":
                rendered = "".join(part.text or "" for part in cell.findall(".//m:t", NS))
            values[column] = text(rendered)
        yield int(row.attrib["r"]), values


def yes(value):
    return normalized(value) == "oui"


def not_applicable(value):
    return normalized(value) in {"n/a", "na"}


def parse(path):
    with open(path, "rb") as source:
        source_hash = hashlib.sha256(source.read()).hexdigest()
    if source_hash != EXPECTED_SHA256:
        raise ValueError(
            f"Workbook SHA-256 mismatch: expected {EXPECTED_SHA256}, got {source_hash}"
        )

    rows = []
    for row_number, row in cell_rows(path, "Synthese"):
        if row_number < 3:
            continue
        name, reference = text(row.get("A")), text(row.get("C"))
        if not name and not reference:
            continue
        if not name:
            raise ValueError(f"Synthese row {row_number} has no repreneur name")
        stage_cells = {
            "interest_confirmed": row.get("D"),
            "nda_received": row.get("E"),
            "nda_signed": row.get("F"),
            "info_memo_received": row.get("G"),
            "qa_with_ma_firm": row.get("H"),
            "seller_meeting": row.get("I"),
            "valuation": row.get("J"),
            "loi_issued": row.get("K"),
            "audits": row.get("L"),
            "financing": row.get("M"),
            "closing": row.get("N"),
        }
        completed = [stage for stage, value in stage_cells.items() if yes(value)]
        unavailable = [stage for stage, value in stage_cells.items() if not_applicable(value)]
        rows.append({
            "sourceRow": row_number,
            "repreneurName": name,
            "offerLabel": text(row.get("B")),
            # The sheet's header calls C 'Matchs', but row values are opportunity
            # references. Preserve that observed source fact rather than guessing.
            "opportunityReference": reference,
            "dropReason": text(row.get("O")),
            "completedSourceStages": completed,
            "notApplicableSourceStages": unavailable,
            "sourceCells": stage_cells,
        })
    if len(rows) != 60:
        raise ValueError(f"Expected exactly 60 Synthese data rows, got {len(rows)}")
    return {
        "source": {"file": "M&A Interest and pursuit V3.xlsx", "sha256": source_hash, "sheet": "Synthese"},
        "rows": rows,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook")
    args = parser.parse_args()
    print(json.dumps(parse(args.workbook), ensure_ascii=False, sort_keys=True))
