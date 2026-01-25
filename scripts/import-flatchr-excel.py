#!/usr/bin/env python3
"""
Flatchr Excel Import Script

Converts Bertrand's Flatchr Excel export to SQL INSERT statements
for the Re-New Platform database.

Usage:
    python3 scripts/import-flatchr-excel.py "/path/to/Candidates data.xlsx"

Output:
    Generates scripts/flatchr-import-{timestamp}.sql
"""

import pandas as pd
import sys
import os
from datetime import datetime
import re
import json

def parse_name(name_field: str) -> tuple[str, str]:
    """Parse 'First+Last' format to (first_name, last_name)"""
    if not name_field or pd.isna(name_field):
        return ('Unknown', 'Unknown')

    # Replace + with space and clean up
    name = str(name_field).replace('+', ' ').strip()

    # Remove email-like suffixes
    name = re.sub(r'@.*$', '', name)

    # Remove numbers
    name = re.sub(r'\d+', '', name)

    # Split into parts
    parts = name.split()

    if len(parts) == 0:
        return ('Unknown', 'Unknown')
    elif len(parts) == 1:
        return (parts[0].title(), 'Unknown')
    else:
        # First word is first name, rest is last name
        first = parts[0].title()
        last = ' '.join(parts[1:]).title()
        return (first, last)

def count_stars(stars_str: str) -> int:
    """Count star characters in rating string"""
    if not stars_str or pd.isna(stars_str):
        return 0
    return str(stars_str).count('★')

def escape_sql(value) -> str:
    """Escape value for SQL"""
    if value is None or pd.isna(value):
        return 'NULL'
    value = str(value).replace("'", "''")
    return f"'{value}'"

def array_to_sql(values: list) -> str:
    """Convert list to PostgreSQL array literal"""
    if not values:
        return 'NULL'
    # Use JSONB array format
    return f"'{json.dumps(values)}'::jsonb"

def parse_semicolon_list(value: str) -> list:
    """Parse semicolon-separated values into list"""
    if not value or pd.isna(value):
        return []
    return [v.strip() for v in str(value).split(';') if v.strip()]

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/import-flatchr-excel.py <excel-file>")
        sys.exit(1)

    excel_path = sys.argv[1]

    if not os.path.exists(excel_path):
        print(f"Error: File not found: {excel_path}")
        sys.exit(1)

    print(f"Reading Excel: {excel_path}")
    df = pd.read_excel(excel_path)

    # Deduplicate by Identifier (keep first occurrence)
    original_count = len(df)
    df = df.drop_duplicates(subset=['Identifier'], keep='first')
    dedup_count = original_count - len(df)

    print(f"Records: {original_count} total, {len(df)} unique ({dedup_count} duplicates removed)")

    # Generate SQL statements
    inserts = []

    for _, row in df.iterrows():
        first_name, last_name = parse_name(row.get('Name', ''))
        flatchr_id = row.get('Identifier', '')
        created_at = row.get('Application Date', datetime.now().isoformat())

        # Get total score
        tier1_score = row.get('Total Score')
        if pd.isna(tier1_score):
            tier1_score = 'NULL'
        else:
            tier1_score = int(tier1_score)

        # Get stars
        tier2_stars = count_stars(row.get('STARS', ''))

        # Map legacy questionnaire fields (Q1-Q17 in the old format)
        # Note: These are the OLD questionnaire, not v2
        q1 = row.get('Q1', '')  # Employment status
        q2 = row.get('Q2', '')  # Years experience
        q3 = row.get('Q3', '')  # Industry sectors
        q4 = row.get('Q4', '')  # M&A experience (Oui/Non)
        q5 = row.get('Q5', '')  # Team size
        q6 = row.get('Q6', '')  # Involved in M&A (Oui/Non)
        q7 = row.get('Q7', '')  # M&A details
        q8 = row.get('Q8', '')  # Executive roles
        q9 = row.get('Q9', '')  # Board experience (Oui/Non)
        q10 = row.get('Q10', '')  # Journey stages
        q11 = row.get('Q11', '')  # Target sectors
        q12 = row.get('Q12', '')  # Has identified targets (Oui/Non)
        q13 = row.get('Q13', '')  # Target details
        q14 = row.get('Q14', '')  # Investment capacity
        q15 = row.get('Q15', '')  # Funding status
        q16 = row.get('Q16', '')  # Network/training
        q17 = row.get('Q17', '')  # Open to co-acquisition (Oui/Non)

        # Convert Oui/Non to boolean
        def bool_val(v):
            if pd.isna(v):
                return 'NULL'
            return 'TRUE' if str(v).lower() in ['oui', 'yes', 'true', '1'] else 'FALSE'

        # Generate email placeholder (will need real emails)
        email = f"import-{flatchr_id}@placeholder.invalid"

        insert = f"""INSERT INTO repreneurs (
    flatchr_id, first_name, last_name, email, lifecycle_status, source,
    tier1_score, tier2_stars, needs_data_completion, created_at,
    q1_employment_status, q2_years_experience, q3_industry_sectors,
    q4_has_ma_experience, q5_team_size, q6_involved_in_ma, q7_ma_details,
    q8_executive_roles, q9_board_experience, q10_journey_stages,
    q11_target_sectors, q12_has_identified_targets, q13_target_details,
    q14_investment_capacity, q15_funding_status, q16_network_training,
    q17_open_to_co_acquisition, questionnaire_completed_at,
    created_by
) VALUES (
    {escape_sql(flatchr_id)}, {escape_sql(first_name)}, {escape_sql(last_name)},
    {escape_sql(email)}, 'lead', 'flatchr_import',
    {tier1_score}, {tier2_stars}, TRUE, {escape_sql(str(created_at))},
    {escape_sql(str(q1) if not pd.isna(q1) else None)},
    {escape_sql(str(q2) if not pd.isna(q2) else None)},
    {array_to_sql(parse_semicolon_list(q3))},
    {bool_val(q4)},
    {escape_sql(str(q5) if not pd.isna(q5) else None)},
    {bool_val(q6)},
    {escape_sql(str(q7) if not pd.isna(q7) else None)},
    {array_to_sql(parse_semicolon_list(q8))},
    {bool_val(q9)},
    {array_to_sql(parse_semicolon_list(q10))},
    {array_to_sql(parse_semicolon_list(q11))},
    {bool_val(q12)},
    {escape_sql(str(q13) if not pd.isna(q13) else None)},
    {escape_sql(str(q14) if not pd.isna(q14) else None)},
    {escape_sql(str(q15) if not pd.isna(q15) else None)},
    {array_to_sql(parse_semicolon_list(q16))},
    {bool_val(q17)},
    {escape_sql(str(created_at))},
    (SELECT id FROM auth.users LIMIT 1)
) ON CONFLICT (flatchr_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    tier1_score = COALESCE(EXCLUDED.tier1_score, repreneurs.tier1_score),
    tier2_stars = COALESCE(EXCLUDED.tier2_stars, repreneurs.tier2_stars),
    updated_at = NOW();"""

        inserts.append(insert)

    # Write SQL file
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    output_path = os.path.join(os.path.dirname(__file__), f'flatchr-import-{timestamp}.sql')

    sql_content = f"""-- Flatchr Excel Import: {len(df)} unique records
-- Generated: {datetime.now().isoformat()}
-- Source: {os.path.basename(excel_path)}
--
-- NOTE: All imported records have placeholder emails.
-- You'll need to update emails manually or from another source.
-- All records have needs_data_completion = TRUE (need v2 questionnaire data)

BEGIN;

{chr(10).join(inserts)}

COMMIT;

-- Summary
-- Records imported: {len(df)}
-- Duplicates removed: {dedup_count}
-- All records need:
--   1. Real email addresses
--   2. V2 questionnaire completion (WHO/WHEN scores)
"""

    with open(output_path, 'w') as f:
        f.write(sql_content)

    print(f"\nGenerated SQL: {output_path}")
    print(f"\nNext steps:")
    print(f"  1. Review the SQL file")
    print(f"  2. Run it on Supabase: psql or SQL Editor")
    print(f"  3. Update placeholder emails with real ones")
    print(f"  4. Complete v2 questionnaire for WHO/WHEN scores")

if __name__ == '__main__':
    main()
