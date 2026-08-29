#!/usr/bin/env python3
"""Read the approved W-163 workbook without persisting its confidential cells."""

from __future__ import annotations

import hashlib
import json
import os
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

EXPECTED_SHA256 = "ed3265fdae420ea8f2d5cb6876720e90a6be565cca654e6c42ad6d5d99c5eb20"
EXPECTED_REFERENCE_HEADER = "Ref. Mandat"
EXPECTED_TITLE_HEADER = "Titre sur plateforme"
EXPECTED_SHEET_NAME = "Opportunités"
EXPECTED_REFERENCE_COUNT = 150
EXPECTED_TARGET_COUNT = 39
MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"m": MAIN_NS, "r": REL_NS}


def fail(message: str) -> None:
    raise ValueError(f"W-163 workbook validation failed: {message}")


def external_private_path(path: Path, label: str) -> Path:
    if not path.is_absolute():
        fail(f"the {label} path must be absolute and outside this repository")
    resolved = path.resolve()
    repository_root = Path(__file__).resolve().parent.parent
    if resolved == repository_root or repository_root in resolved.parents:
        fail(f"the {label} path must remain outside this repository")
    return resolved


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def column_name(cell_reference: str) -> str:
    return "".join(character for character in cell_reference if character.isalpha())


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(node.text or "" for node in item.iter(f"{{{MAIN_NS}}}t"))
        for item in root.findall("m:si", NS)
    ]


def cell_value(cell: ET.Element, strings: list[str]) -> str:
    if cell.attrib.get("t") == "inlineStr":
        return "".join(node.text or "" for node in cell.iter(f"{{{MAIN_NS}}}t"))
    value = cell.find("m:v", NS)
    if value is None or value.text is None:
        return ""
    return strings[int(value.text)] if cell.attrib.get("t") == "s" else value.text


def only_sheet_path(archive: zipfile.ZipFile) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheets = workbook.findall("m:sheets/m:sheet", NS)
    if len(sheets) != 1:
        fail("the source must contain exactly one worksheet")
    if sheets[0].attrib.get("name") != EXPECTED_SHEET_NAME:
        fail("the single worksheet must be named Opportunités")
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
    relationship_id = sheets[0].attrib.get(f"{{{REL_NS}}}id")
    target = targets.get(relationship_id)
    if not target:
        fail("the worksheet has no workbook relationship")
    return target if target.startswith("xl/") else f"xl/{target}"


def parse(workbook_path: Path) -> list[dict[str, str]]:
    workbook_path = external_private_path(workbook_path, "workbook")
    if not workbook_path.is_file():
        fail("the supplied workbook cannot be read")
    if sha256(workbook_path) != EXPECTED_SHA256:
        fail("the workbook SHA-256 does not match the approved source")

    with zipfile.ZipFile(workbook_path) as archive:
        strings = shared_strings(archive)
        root = ET.fromstring(archive.read(only_sheet_path(archive)))
        rows = root.findall("m:sheetData/m:row", NS)
        if not rows:
            fail("the source worksheet is empty")

        def values(row: ET.Element) -> dict[str, str]:
            return {
                column_name(cell.attrib["r"]): cell_value(cell, strings).strip()
                for cell in row.findall("m:c", NS)
            }

        headers = values(rows[0])
        columns_by_header: dict[str, list[str]] = {}
        for column, value in headers.items():
            if value:
                columns_by_header.setdefault(value, []).append(column)
        reference_columns = columns_by_header.get(EXPECTED_REFERENCE_HEADER, [])
        title_columns = columns_by_header.get(EXPECTED_TITLE_HEADER, [])
        if len(reference_columns) != 1 or len(title_columns) != 1:
            fail("each required reference/title header must be present exactly once")
        reference_column = reference_columns[0]
        title_column = title_columns[0]

        source_references: set[str] = set()
        reviewed_titles: set[str] = set()
        targets: list[dict[str, str]] = []
        for row in rows[1:]:
            values_by_column = values(row)
            if not any(values_by_column.values()):
                continue
            reference = values_by_column.get(reference_column, "")
            title = values_by_column.get(title_column, "")
            if not reference:
                fail("a source data row has a blank mandate reference")
            if reference in source_references:
                fail("source mandate references must be unique")
            source_references.add(reference)
            if not title:
                continue
            if title in reviewed_titles:
                fail("reviewed platform titles must be unique")
            reviewed_titles.add(title)
            targets.append({"reference": reference, "publicTitle": title})

    if len(source_references) != EXPECTED_REFERENCE_COUNT:
        fail("the source reference count differs from the approved baseline")
    if len(targets) != EXPECTED_TARGET_COUNT:
        fail("the reviewed target count differs from the approved baseline")
    return targets


def write_private_handoff(output_path: Path, targets: list[dict[str, str]]) -> None:
    output_path = external_private_path(output_path, "private output")
    try:
        descriptor = os.open(output_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        fail("the private output path already exists")
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        json.dump(targets, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 4 or sys.argv[2] != "--private-output":
            fail("usage: parse-w163-platform-title-workbook.py /absolute/path/to/workbook.xlsx --private-output /absolute/path/outside/repository.json")
        write_private_handoff(Path(sys.argv[3]), parse(Path(sys.argv[1])))
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1)
