#!/usr/bin/env python3
"""Fail-closed source proof for the six W-098 legacy CRM date repairs."""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

EXPECTED_SHA256 = "7f139050605e1c90dee92db79e7b8f6211a554b625365b024d260eea36627225"
EXPECTED_SHEET = "2026.05.04 Source"
EXPECTED_FORMAT_ID = 17
EXPECTED_ROWS = (
    ("733e7e38-784a-4dbb-9815-f399a5fcab16", "Re-New - AU - 001", 7, "Re-New - AU - 004", 45992, "2025-12-01", "f07b748dbc4f9cb5703ad69f0f92276b5440c38a5229d5df4e3c9a9720c38259", "f07b748dbc4f9cb5703ad69f0f92276b5440c38a5229d5df4e3c9a9720c38259"),
    ("de8a550c-a77b-4a80-9c06-800aac8e109f", "Re-New - BFC - 001", 19, "Re-New - BFC - 001", 46023, "2026-01-01", "31c5a41f73ab0872315313bca912bc30d27117fb8b15831b03d0c98e74e52690", "31c5a41f73ab0872315313bca912bc30d27117fb8b15831b03d0c98e74e52690"),
    ("104edeab-0383-4e9a-9b40-b27385b41795", "Re-New - GE - 001", 29, "Re-New - GE - 001", 46023, "2026-01-01", "ff21a12a77d49b7d2a198a72952a61df69c0d59d750bf5b7dd7c04d6879e3f52", "ff21a12a77d49b7d2a198a72952a61df69c0d59d750bf5b7dd7c04d6879e3f52"),
    ("2650915e-f648-47ea-a4f8-b30abc47bcef", "Re-New - Idf - 003", 55, "Re-New - Idf - 003", 46023, "2026-01-01", "10d77cea3c4de605748ab36ce4d3a888d9711fd5a8d4cd7e3f08777964baf560", "10d77cea3c4de605748ab36ce4d3a888d9711fd5a8d4cd7e3f08777964baf560"),
    ("ab4847d8-09dd-4a54-ad6a-967a28bdaa4e", "Re-New - Idf - 015", 68, "Re-New - Idf - 016", 46146, "2026-05-01", "ffe6f1672620130067d325af8bf65d6ec1e5812f5a76df89dfab2eae635e4736", "76c420fcd78b9095a0a8c01a4985ea58684e003cdd9f1cb6851f1d2aa66f1c90"),
    ("1d0fc197-e26d-4274-9a74-04c6719c600e", "Re-New - PL - 002", 92, "Re-New - PL - 002", 46054, "2026-02-01", "29ab8e4bbd42a467185e7c66e64acf03f0f86def07bc7baf79ff23fd9ec0f954", "970b55724cb7ae94b33c1ff89f824218138b9c15a3f09db7d0379acb13524741"),
)
MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"m": MAIN_NS, "r": REL_NS}


def fail(message: str) -> None:
    raise ValueError(f"W-098 source preflight failed: {message}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(node.text or "" for node in item.iter(f"{{{MAIN_NS}}}t"))
        for item in root.findall("m:si", NS)
    ]


def sheet_path(archive: zipfile.ZipFile) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    if workbook.find("m:workbookPr", NS) is not None and workbook.find("m:workbookPr", NS).attrib.get("date1904") in {"1", "true"}:
        fail("the source workbook uses the unsupported 1904 date system")
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        if sheet.attrib.get("name") == EXPECTED_SHEET:
            target = targets.get(sheet.attrib[f"{{{REL_NS}}}id"])
            if not target:
                fail("the expected sheet has no workbook relationship")
            return target if target.startswith("xl/") else f"xl/{target}"
    fail(f"missing expected sheet {EXPECTED_SHEET!r}")


def format_ids(archive: zipfile.ZipFile) -> list[int]:
    root = ET.fromstring(archive.read("xl/styles.xml"))
    cell_xfs = root.find("m:cellXfs", NS)
    if cell_xfs is None:
        fail("the source workbook has no cell style table")
    return [int(cell.attrib.get("numFmtId", "0")) for cell in cell_xfs.findall("m:xf", NS)]


def cell_value(cell: ET.Element, strings: list[str]) -> str | None:
    value = cell.find("m:v", NS)
    if value is None or value.text is None:
        return None
    raw = value.text
    if cell.attrib.get("t") == "s":
        return strings[int(raw)]
    return raw


def excel_month(serial: int) -> str:
    # Format ID 17 is an Excel month/year display. The serial may carry an
    # arbitrary technical day (for example 46146 is 2026-05-04), which must
    # not turn a month-only source value into a claimed event day.
    value = dt.date(1899, 12, 30) + dt.timedelta(days=serial)
    return value.replace(day=1).isoformat()


def description_hash(value: str | None) -> str:
    normalized = "".join(
        character
        for character in unicodedata.normalize("NFKD", value or "")
        if not unicodedata.combining(character)
    )
    normalized = " ".join(normalized.split()).casefold()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def verify(workbook_path: Path) -> list[dict[str, object]]:
    if not workbook_path.is_file():
        fail("the supplied workbook cannot be read")
    if sha256(workbook_path) != EXPECTED_SHA256:
        fail("the workbook SHA-256 does not match the approved historical PDR source")

    with zipfile.ZipFile(workbook_path) as archive:
        strings = shared_strings(archive)
        styles = format_ids(archive)
        root = ET.fromstring(archive.read(sheet_path(archive)))
        rows = {int(row.attrib["r"]): row for row in root.findall("m:sheetData/m:row", NS)}
        verified: list[dict[str, object]] = []
        for opportunity_id, live_reference, row_number, source_reference, serial, expected_date, source_hash, live_hash in EXPECTED_ROWS:
            row = rows.get(row_number)
            if row is None:
                fail(f"missing source row {row_number} for {live_reference}")
            cells = {cell.attrib["r"]: cell for cell in row.findall("m:c", NS)}
            reference_cell = cells.get(f"A{row_number}")
            date_cell = cells.get(f"I{row_number}")
            if reference_cell is None or date_cell is None:
                fail(f"missing reference or date cell at source row {row_number}")
            if cell_value(reference_cell, strings) != source_reference:
                fail(f"source reference mismatch at row {row_number}")
            if cell_value(date_cell, strings) != str(serial):
                fail(f"date serial mismatch at row {row_number}")
            style_index = int(date_cell.attrib.get("s", "0"))
            if style_index >= len(styles) or styles[style_index] != EXPECTED_FORMAT_ID:
                fail(f"date format mismatch at row {row_number}")
            if excel_month(serial) != expected_date:
                fail(f"month conversion mismatch at row {row_number}")
            description_cell = cells.get(f"E{row_number}")
            if description_cell is None or description_hash(cell_value(description_cell, strings)) != source_hash:
                fail(f"source description fingerprint mismatch at row {row_number}")
            verified.append(
                {
                    "opportunityId": opportunity_id,
                    "liveReference": live_reference,
                    "liveDescriptionHash": live_hash,
                }
            )

    return verified


def main() -> int:
    args = sys.argv[1:]
    if len(args) != 1:
        fail("usage: pnpm w098:source-preflight -- /absolute/path/to/approved-workbook.xlsx")
    verified = verify(Path(args[0]).resolve())
    print(json.dumps({"records": verified}, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1)
