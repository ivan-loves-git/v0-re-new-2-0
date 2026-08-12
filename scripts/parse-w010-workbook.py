#!/usr/bin/env python3
"""Parse Colin's final W-010 workbook into deterministic cutover JSON.

The script uses only Python's standard library, writes no source data to disk,
and refuses any workbook whose raw SHA-256 differs from the approved snapshot.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Any


EXPECTED_SHA256 = "a4b50611de0578a4a2b36f8c6da284c6e53d10b2fd4f418ab560dd31a9a0d6a5"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CELL_REF = re.compile(r"([A-Z]+)(\d+)")
OFFICE_ID = re.compile(r"CAB-[0-9]+(?:-[0-9]+)?", re.IGNORECASE)
SPLIT_LIST = re.compile(r"\s*[;,]\s*")
POSITION_SPLIT = re.compile(r"[\r\n]+|\s+et\s+", re.IGNORECASE)


def trimmed(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalized(value: Any) -> str:
    text = trimmed(value) or ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", text).strip().casefold()


def lower_email(value: Any) -> str | None:
    text = trimmed(value)
    return text.casefold() if text else None


def split_values(value: Any) -> list[str]:
    text = trimmed(value)
    if not text:
        return []
    return [item.strip() for item in SPLIT_LIST.split(text) if item.strip()]


def split_office_ids(value: Any) -> list[str]:
    return [match.upper() for match in OFFICE_ID.findall(trimmed(value) or "")]


def parse_decimal(value: Any) -> float | None:
    text = trimmed(value)
    if not text or normalized(text) == "nc":
        return None
    cleaned = text.replace(" ", "").replace(",", ".")
    return float(cleaned)


def parse_integer(value: Any) -> int | None:
    number = parse_decimal(value)
    if number is None:
        return None
    if not number.is_integer():
        raise ValueError(f"Expected an integer, received {value!r}")
    return int(number)


def append_note(existing: str | None, note: str) -> str:
    if not existing:
        return note
    if note in existing:
        return existing
    return f"{existing}\n\n{note}"


def french_month_date(value: Any, source_row: int) -> tuple[str, str, str]:
    """Return normalized date, precision, and parsing decision.

    Four numeric cells display as ``Nov-25`` but contain the Excel serial for
    2026-11-25 because the workbook format is ``mmm-d``. All four belong to the
    same November 2025 cohort as the surrounding month/year source values.
    """

    if isinstance(value, float):
        if value != 46351.0 or source_row not in {51, 56, 60, 64}:
            raise ValueError(
                f"Unexpected numeric opportunity date at row {source_row}: {value}"
            )
        return "2025-11-01", "month", "excel_nov_25_corrected_to_2025_11"

    text = normalized(value).replace(".", "")
    match = re.fullmatch(r"([a-z]+)-([0-9]{2})", text)
    if not match:
        raise ValueError(f"Unexpected month/year date at row {source_row}: {value!r}")
    month_token, year_token = match.groups()
    months = {
        "janv": 1,
        "fevr": 2,
        "mars": 3,
        "avr": 4,
        "mai": 5,
        "juin": 6,
        "juil": 7,
        "juillet": 7,
        "dec": 12,
    }
    month = months.get(month_token)
    if month is None:
        raise ValueError(f"Unsupported French month at row {source_row}: {value!r}")
    return f"20{year_token}-{month:02d}-01", "month", "text_month_year"


def parse_source_date(value: Any) -> str | None:
    if value is None or trimmed(value) is None:
        return None
    if isinstance(value, float):
        return (dt.date(1899, 12, 30) + dt.timedelta(days=value)).isoformat()
    match = re.fullmatch(
        r"([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})(?:\s+0:00:00)?",
        trimmed(value) or "",
    )
    if not match:
        raise ValueError(f"Unexpected source date: {value!r}")
    day, month, year = (int(part) for part in match.groups())
    return dt.date(year, month, day).isoformat()


def column_number(label: str) -> int:
    result = 0
    for char in label:
        result = result * 26 + ord(char) - 64
    return result


@dataclass
class Sheet:
    cells: dict[str, Any]

    def value(self, column: str, row: int) -> Any:
        return self.cells.get(f"{column}{row}")


class Workbook:
    def __init__(self, path: str):
        self.archive = zipfile.ZipFile(path)
        self.shared_strings = self._shared_strings()
        self.sheet_paths = self._sheet_paths()

    def _shared_strings(self) -> list[str]:
        root = ET.fromstring(self.archive.read("xl/sharedStrings.xml"))
        return [
            "".join(
                node.text or ""
                for node in item.iter(
                    "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"
                )
            )
            for item in root.findall("m:si", NS)
        ]

    def _sheet_paths(self) -> dict[str, str]:
        root = ET.fromstring(self.archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(
            self.archive.read("xl/_rels/workbook.xml.rels")
        )
        targets = {
            item.attrib["Id"]: item.attrib["Target"]
            for item in relationships.findall(f"{{{PKG_REL_NS}}}Relationship")
        }
        paths: dict[str, str] = {}
        for item in root.findall("m:sheets/m:sheet", NS):
            target = targets[item.attrib[f"{{{REL_NS}}}id"]].lstrip("/")
            if not target.startswith("xl/"):
                target = f"xl/{target}"
            paths[item.attrib["name"]] = target
        return paths

    def sheet(self, name: str) -> Sheet:
        root = ET.fromstring(self.archive.read(self.sheet_paths[name]))
        cells: dict[str, Any] = {}
        for node in root.findall(".//m:sheetData/m:row/m:c", NS):
            reference = node.attrib["r"]
            value_node = node.find("m:v", NS)
            value: Any = None if value_node is None else value_node.text
            cell_type = node.attrib.get("t")
            if cell_type == "s" and value is not None:
                value = self.shared_strings[int(value)]
            elif cell_type == "inlineStr":
                value = "".join(item.text or "" for item in node.findall(".//m:t", NS))
            elif cell_type == "b" and value is not None:
                value = value == "1"
            elif value is not None:
                try:
                    value = float(value)
                except ValueError:
                    pass
            cells[reference] = value
        return Sheet(cells)


def parse_workbook(path: str) -> dict[str, Any]:
    with open(path, "rb") as handle:
        source_hash = hashlib.sha256(handle.read()).hexdigest()
    if source_hash != EXPECTED_SHA256:
        raise ValueError(
            f"Workbook SHA-256 mismatch: expected {EXPECTED_SHA256}, got {source_hash}"
        )

    workbook = Workbook(path)
    cabinets = workbook.sheet("Cabinets")
    contacts_sheet = workbook.sheet("Contacts")
    opportunities_sheet = workbook.sheet("Opportunités")

    warnings: list[dict[str, Any]] = []
    firms: list[dict[str, Any]] = []
    offices: list[dict[str, Any]] = []
    cabinet_by_id: dict[str, dict[str, Any]] = {}

    for row in range(2, 433):
        source_id = (trimmed(cabinets.value("A", row)) or "").upper()
        name = trimmed(cabinets.value("B", row))
        level = normalized(cabinets.value("D", row))
        if not source_id or not name:
            raise ValueError(f"Cabinets row {row} lacks ID or name")
        parent_id = (
            (trimmed(cabinets.value("E", row)) or "").upper()
            if level == "bureau"
            else source_id
        )
        if not parent_id:
            raise ValueError(f"Cabinets row {row} lacks a parent firm")

        region_codes = [
            item.strip().upper()
            for item in split_values(cabinets.value("H", row))
            if item.strip()
        ]
        region_labels = split_values(cabinets.value("G", row))
        if source_id == "CAB-0014-05":
            region_codes = ["OC"]
            region_labels = ["Occitanie"]
            warnings.append(
                {
                    "severity": "warning",
                    "code": "office_region_corrected_from_explicit_comment",
                    "sourceSheet": "Cabinets",
                    "sourceRow": row,
                    "sourceKey": source_id,
                }
            )

        office = {
            "temporaryId": f"office:{source_id}",
            "sourceId": source_id,
            "parentFirmTemporaryId": f"firm:{parent_id}",
            "name": name,
            "isSyntheticDefault": False,
            "city": None,
            "regionCodes": region_codes,
            "geographyConfidence": (
                "confirmed"
                if normalized(cabinets.value("I", row)) == "ok"
                else ("review" if region_codes else None)
            ),
            "coverageNote": "; ".join(region_labels) or trimmed(cabinets.value("J", row)),
            "websiteUrl": trimmed(cabinets.value("K", row)),
            "internalNotes": trimmed(cabinets.value("AD", row)),
            "sourceRow": row,
        }
        offices.append(office)
        cabinet_by_id[source_id] = office

        if level != "bureau":
            firm = {
                "temporaryId": f"firm:{source_id}",
                "sourceId": source_id,
                "name": name,
                "status": (
                    "active"
                    if normalized(cabinets.value("V", row)) == "partenaire actif"
                    else "prospect"
                ),
                "category": trimmed(cabinets.value("F", row)),
                "networkLabel": trimmed(cabinets.value("C", row)),
                "websiteUrl": trimmed(cabinets.value("K", row)),
                "discoveryChannel": trimmed(cabinets.value("S", row)),
                "discoveryUrl": trimmed(cabinets.value("T", row)),
                "discoveredAt": parse_source_date(cabinets.value("U", row)),
                "internalNotes": trimmed(cabinets.value("AD", row)),
                "sourceRow": row,
            }
            firms.append(firm)

    firm_ids = {firm["temporaryId"] for firm in firms}
    if any(office["parentFirmTemporaryId"] not in firm_ids for office in offices):
        raise ValueError("At least one office lacks a canonical parent firm")

    contacts: list[dict[str, Any]] = []
    affiliations: list[dict[str, Any]] = []
    contact_by_email: dict[str, dict[str, Any]] = {}
    contacts_by_name: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    excluded_nameless = 0
    excluded_suppressed_nameless = 0

    def add_contact(
        *,
        temporary_id: str,
        first_name: str | None,
        last_name: str | None,
        email: str | None,
        phone: str | None,
        linkedin_url: str | None,
        email_suppressed: bool,
        office_ids: list[str],
        source_row: int,
        derived_from_opportunity: bool = False,
    ) -> dict[str, Any]:
        contact = {
            "temporaryId": temporary_id,
            "firstName": first_name,
            "lastName": last_name,
            "email": email,
            "phone": phone,
            "linkedinUrl": linkedin_url,
            "emailSuppressed": email_suppressed,
            "sourceRow": source_row,
            "derivedFromOpportunity": derived_from_opportunity,
            "affiliationTemporaryIds": [],
            "officeIds": office_ids,
        }
        contacts.append(contact)
        name_key = normalized(f"{first_name or ''} {last_name or ''}")
        contacts_by_name[name_key].append(contact)
        if email:
            if email in contact_by_email:
                raise ValueError(f"Duplicate contact email in workbook: {email}")
            contact_by_email[email] = contact

        for office_id in office_ids:
            if office_id not in cabinet_by_id:
                raise ValueError(
                    f"Contact row {source_row} references unknown office {office_id}"
                )
            affiliation_id = (
                f"affiliation:{temporary_id.replace(':', '_')}:{office_id}"
            )
            affiliation = {
                "temporaryId": affiliation_id,
                "parentContactTemporaryId": temporary_id,
                "officeTemporaryId": f"office:{office_id}",
                "jobTitle": trimmed(contacts_sheet.value("G", source_row))
                if not derived_from_opportunity
                else None,
                "sourceRow": source_row,
            }
            affiliations.append(affiliation)
            contact["affiliationTemporaryIds"].append(affiliation_id)
        return contact

    for row in range(2, 585):
        first_name = trimmed(contacts_sheet.value("F", row))
        last_name = trimmed(contacts_sheet.value("E", row))
        if not first_name and not last_name:
            if any(
                trimmed(contacts_sheet.value(column, row))
                for column in ("A", "I", "J", "K")
            ):
                excluded_nameless += 1
                if str(contacts_sheet.value("P", row)) in {"1", "1.0", "True"}:
                    excluded_suppressed_nameless += 1
                warnings.append(
                    {
                        "severity": "warning",
                        "code": "nameless_contact_excluded",
                        "sourceSheet": "Contacts",
                        "sourceRow": row,
                    }
                )
            continue

        base_office = (trimmed(contacts_sheet.value("A", row)) or "").upper()
        office_ids: list[str] = []
        for office_id in [base_office, *split_office_ids(contacts_sheet.value("H", row))]:
            if office_id and office_id not in office_ids:
                office_ids.append(office_id)
        add_contact(
            temporary_id=f"contact:{row}",
            first_name=first_name,
            last_name=last_name,
            email=lower_email(contacts_sheet.value("I", row)),
            phone=trimmed(contacts_sheet.value("J", row)),
            linkedin_url=trimmed(contacts_sheet.value("K", row)),
            email_suppressed=str(contacts_sheet.value("P", row)) in {"1", "1.0", "True"},
            office_ids=office_ids,
            source_row=row,
        )

    opportunity_rows: list[dict[str, Any]] = []
    positioned: list[dict[str, Any]] = []
    contact_link_count = 0
    derived_contacts = 0

    for row in range(2, 150):
        reference = trimmed(opportunities_sheet.value("A", row))
        office_id = (trimmed(opportunities_sheet.value("B", row)) or "").upper()
        description = trimmed(opportunities_sheet.value("J", row))
        if not reference or office_id not in cabinet_by_id or not description:
            raise ValueError(f"Opportunity row {row} lacks required source identity")

        primary_email = lower_email(opportunities_sheet.value("T", row))
        primary_contact = contact_by_email.get(primary_email or "")
        if primary_contact is None:
            raise ValueError(f"Opportunity row {row} has no primary contact match")

        primary_affiliation_id = next(
            (
                affiliation_id
                for affiliation_id, linked_office in zip(
                    primary_contact["affiliationTemporaryIds"],
                    primary_contact["officeIds"],
                    strict=True,
                )
                if linked_office == office_id
            ),
            None,
        )
        if primary_affiliation_id is None:
            raise ValueError(
                f"Opportunity row {row} primary contact is not affiliated to {office_id}"
            )

        selected_affiliations = [primary_affiliation_id]
        other_names = split_values(opportunities_sheet.value("S", row))
        other_emails = [
            email.casefold()
            for email in split_values(opportunities_sheet.value("U", row))
        ]
        candidate_contacts: dict[str, dict[str, Any]] = {}
        unmatched_emails: list[str] = []

        for email in other_emails:
            contact = contact_by_email.get(email)
            if contact:
                candidate_contacts[contact["temporaryId"]] = contact
            else:
                unmatched_emails.append(email)

        unmatched_names: list[str] = []
        for name in other_names:
            matches = contacts_by_name.get(normalized(name), [])
            if len(matches) == 1:
                candidate_contacts[matches[0]["temporaryId"]] = matches[0]
            elif not matches:
                unmatched_names.append(name)
            else:
                warnings.append(
                    {
                        "severity": "warning",
                        "code": "secondary_contact_name_ambiguous",
                        "sourceSheet": "Opportunités",
                        "sourceRow": row,
                        "sourceKey": reference,
                    }
                )

        # One row contains a complete named secondary contact not present in
        # Contacts. This is a source-backed creation, not an inferred identity.
        if (
            len(unmatched_names) == 1
            and len(unmatched_emails) == 1
            and row == 103
        ):
            name_parts = unmatched_names[0].split()
            derived = add_contact(
                temporary_id=f"contact:opportunity:{row}",
                first_name=name_parts[0],
                last_name=" ".join(name_parts[1:]) or None,
                email=unmatched_emails[0],
                phone=None,
                linkedin_url=None,
                email_suppressed=False,
                office_ids=[office_id],
                source_row=row,
                derived_from_opportunity=True,
            )
            candidate_contacts[derived["temporaryId"]] = derived
            derived_contacts += 1
            unmatched_names = []
            unmatched_emails = []

        # The malformed `.f` address is paired with an exact named contact whose
        # canonical workbook address ends in `.fr`; use the named contact.
        if row == 97 and unmatched_emails == ["hamza.benathmane@bred.f"]:
            unmatched_emails = []
            warnings.append(
                {
                    "severity": "warning",
                    "code": "secondary_email_typo_resolved_by_exact_name",
                    "sourceSheet": "Opportunités",
                    "sourceRow": row,
                    "sourceKey": reference,
                }
            )

        for email in unmatched_emails:
            warnings.append(
                {
                    "severity": "warning",
                    "code": "secondary_email_not_linked",
                    "sourceSheet": "Opportunités",
                    "sourceRow": row,
                    "sourceKey": reference,
                }
            )
        for _name in unmatched_names:
            warnings.append(
                {
                    "severity": "warning",
                    "code": "secondary_name_not_linked",
                    "sourceSheet": "Opportunités",
                    "sourceRow": row,
                    "sourceKey": reference,
                }
            )

        for contact in candidate_contacts.values():
            affiliation_id = next(
                (
                    candidate
                    for candidate, linked_office in zip(
                        contact["affiliationTemporaryIds"],
                        contact["officeIds"],
                        strict=True,
                    )
                    if linked_office == office_id
                ),
                None,
            )
            if affiliation_id is None:
                warnings.append(
                    {
                        "severity": "warning",
                        "code": "secondary_contact_cross_office_not_linked",
                        "sourceSheet": "Opportunités",
                        "sourceRow": row,
                        "sourceKey": reference,
                    }
                )
                continue
            if affiliation_id not in selected_affiliations:
                selected_affiliations.append(affiliation_id)

        revenue_source = trimmed(opportunities_sheet.value("K", row))
        internal_notes = trimmed(opportunities_sheet.value("V", row))
        if revenue_source == "20-30":
            revenue = None
            internal_notes = append_note(
                internal_notes,
                "Source revenue range: €20–30m; numeric field left blank pending review.",
            )
            warnings.append(
                {
                    "severity": "warning",
                    "code": "revenue_range_requires_numeric_review",
                    "sourceSheet": "Opportunités",
                    "sourceRow": row,
                    "sourceKey": reference,
                }
            )
        else:
            revenue = parse_decimal(revenue_source)

        date_added, date_precision, date_decision = french_month_date(
            opportunities_sheet.value("N", row), row
        )
        if date_decision == "excel_nov_25_corrected_to_2025_11":
            warnings.append(
                {
                    "severity": "warning",
                    "code": "excel_date_interpretation_corrected",
                    "sourceSheet": "Opportunités",
                    "sourceRow": row,
                    "sourceKey": reference,
                }
            )

        geo_confirmed = normalized(opportunities_sheet.value("F", row)) == "ok"
        sector_confirmed = normalized(opportunities_sheet.value("I", row)) == "ok"
        if not geo_confirmed:
            warnings.append(
                {
                    "severity": "warning",
                    "code": "opportunity_geography_review_required",
                    "sourceSheet": "Opportunités",
                    "sourceRow": row,
                    "sourceKey": reference,
                }
            )
        if not sector_confirmed:
            warnings.append(
                {
                    "severity": "warning",
                    "code": "opportunity_sector_review_required",
                    "sourceSheet": "Opportunités",
                    "sourceRow": row,
                    "sourceKey": reference,
                }
            )
        if row in {80, 81, 82, 83, 84, 85, 86, 97}:
            warnings.append(
                {
                    "severity": "warning",
                    "code": "generic_bpif_office_review_retained",
                    "sourceSheet": "Opportunités",
                    "sourceRow": row,
                    "sourceKey": reference,
                }
            )

        public_title = trimmed(opportunities_sheet.value("P", row))
        if not public_title:
            warnings.append(
                {
                    "severity": "warning",
                    "code": "public_title_missing_staff_only",
                    "sourceSheet": "Opportunités",
                    "sourceRow": row,
                    "sourceKey": reference,
                }
            )

        opportunity = {
            "temporaryId": f"opportunity:{row}",
            "reference": reference,
            "sourceOfficeTemporaryId": f"office:{office_id}",
            "sourceOfficeId": office_id,
            "description": description,
            "targetStatus": "draft",
            "sector": trimmed(opportunities_sheet.value("G", row)),
            "sectorDecision": "confirmed" if sector_confirmed else "review",
            "location": (
                trimmed(opportunities_sheet.value("D", row))
                if geo_confirmed
                else None
            ),
            "sourceLocation": trimmed(opportunities_sheet.value("D", row)),
            "sourceGeographyCode": (
                (trimmed(opportunities_sheet.value("E", row)) or "").upper()
                or None
            ),
            "locationDecision": "approved" if geo_confirmed else "review",
            "revenueMeur": revenue,
            "ebitdaKeur": parse_decimal(opportunities_sheet.value("L", row)),
            "headcount": parse_integer(opportunities_sheet.value("M", row)),
            "headcountRange": (
                str(parse_integer(opportunities_sheet.value("M", row)))
                if parse_integer(opportunities_sheet.value("M", row)) is not None
                else None
            ),
            "dateAdded": date_added,
            "dateAddedPrecision": date_precision,
            "dateParsingDecision": date_decision,
            "publicTitle": public_title,
            "teaserSummary": None,
            "internalNotes": internal_notes,
            "primaryAffiliationTemporaryId": primary_affiliation_id,
            "affiliationTemporaryIds": selected_affiliations,
            "sourceRow": row,
        }
        opportunity_rows.append(opportunity)
        contact_link_count += len(selected_affiliations)

        for token in POSITION_SPLIT.split(
            trimmed(opportunities_sheet.value("Q", row)) or ""
        ):
            name = re.sub(r"\s+", " ", token).strip().rstrip(" ?")
            if name:
                positioned.append(
                    {
                        "reference": reference,
                        "name": name,
                        "normalizedName": normalized(name),
                        "sourceRow": row,
                    }
                )

    if excluded_nameless != 9:
        raise ValueError(f"Expected 9 nameless exclusions, got {excluded_nameless}")
    expected = {
        "firms": 229,
        "offices": 431,
        "contacts": 575,
        "source_named_contacts": 574,
        "derived_contacts": 1,
        "affiliations": 603,
        "opportunities": 148,
        "opportunity_contact_links": 211,
        "position_entries": 26,
        "suppressed_contacts": 18,
        "excluded_suppressed_nameless_contacts": 1,
    }
    actual = {
        "firms": len(firms),
        "offices": len(offices),
        "contacts": len(contacts),
        "source_named_contacts": len(contacts) - derived_contacts,
        "derived_contacts": derived_contacts,
        "affiliations": len(affiliations),
        "opportunities": len(opportunity_rows),
        "opportunity_contact_links": contact_link_count,
        "position_entries": len(positioned),
        "suppressed_contacts": sum(
            1 for contact in contacts if contact["emailSuppressed"]
        ),
        "excluded_suppressed_nameless_contacts": excluded_suppressed_nameless,
    }
    if actual != expected:
        raise ValueError(f"Cutover aggregate mismatch: expected {expected}, got {actual}")

    warning_counts = dict(
        sorted(Counter(item["code"] for item in warnings).items())
    )
    return {
        "version": "w010-cutover-v1",
        "source": {
            "sha256": source_hash,
            "fingerprint": f"sha256:{source_hash}",
            "snapshotModifiedAt": "2026-07-28T09:23:43Z",
            "approvedBy": "Ivan Paudice",
        },
        "summary": {**actual, "warnings": len(warnings)},
        "warningCounts": warning_counts,
        "warnings": warnings,
        "firms": firms,
        "offices": offices,
        "contacts": contacts,
        "affiliations": affiliations,
        "opportunities": opportunity_rows,
        "positionedRepreneurs": positioned,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook")
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Print only aggregate counts and warning categories.",
    )
    args = parser.parse_args()
    data = parse_workbook(args.workbook)
    output = (
        {
            "version": data["version"],
            "source": data["source"],
            "summary": data["summary"],
            "warningCounts": data["warningCounts"],
        }
        if args.summary
        else data
    )
    json.dump(output, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, KeyError, zipfile.BadZipFile) as error:
        print(f"W-010 workbook parse failed: {error}", file=sys.stderr)
        raise SystemExit(1)
