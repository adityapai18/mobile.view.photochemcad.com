#!/usr/bin/env python3
"""
Extract a subset of the PhotoChemCAD SQLite database containing only compounds
whose database_name is "Common Compounds", plus all linked tables (absorptions,
emissions, normalized status, etc.).

Usage:
  python scripts/extract_common_compounds_db.py

Reads: assets/data/photochemcad.db
Writes: assets/data/photochemcad_common_compounds.db
"""

import sqlite3
import os

# Paths relative to project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DB = os.path.join(PROJECT_ROOT, "assets", "data", "photochemcad.db")
OUTPUT_DB = os.path.join(PROJECT_ROOT, "assets", "data", "photochemcad_common_compounds.db")
TARGET_DATABASE_NAME = "Common Compounds"


def get_compound_ids(conn: sqlite3.Connection) -> list[str]:
    """Return list of compound IDs where database_name = 'Common Compounds'."""
    cur = conn.execute(
        "SELECT id FROM compounds WHERE database_name = ?",
        (TARGET_DATABASE_NAME,),
    )
    return [row[0] for row in cur.fetchall()]


def get_schema(conn: sqlite3.Connection, table: str) -> str:
    """Return CREATE TABLE statement for the given table."""
    cur = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    )
    row = cur.fetchone()
    return row[0] if row else None


def get_index_sql(conn: sqlite3.Connection, table: str) -> list[str]:
    """Return CREATE INDEX/UNIQUE INDEX statements for indexes on the table."""
    cur = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL",
        (table,),
    )
    return [row[0] for row in cur.fetchall()]


def copy_table_schema(conn_src: sqlite3.Connection, conn_dst: sqlite3.Connection, table: str) -> None:
    """Create the table and its indexes in the destination DB."""
    schema = get_schema(conn_src, table)
    if not schema:
        return
    conn_dst.execute(schema)
    for idx_sql in get_index_sql(conn_src, table):
        conn_dst.execute(idx_sql)


def main() -> None:
    if not os.path.isfile(SOURCE_DB):
        print(f"Source database not found: {SOURCE_DB}")
        return

    # Remove existing output so we create a fresh DB (avoids "table already exists")
    if os.path.isfile(OUTPUT_DB):
        os.remove(OUTPUT_DB)

    # Use absolute path for ATTACH (SQLite requires it)
    source_abs = os.path.abspath(SOURCE_DB)
    conn_dst = sqlite3.connect(OUTPUT_DB)

    try:
        conn_dst.execute(f"ATTACH DATABASE ? AS src", (source_abs,))

        # 1) Get Common Compounds compound IDs from attached source
        cur = conn_dst.execute(
            "SELECT id FROM src.compounds WHERE database_name = ?",
            (TARGET_DATABASE_NAME,),
        )
        compound_ids = [row[0] for row in cur.fetchall()]
        if not compound_ids:
            print(f"No compounds found with database_name = '{TARGET_DATABASE_NAME}'")
            return
        print(f"Found {len(compound_ids)} compounds with database_name = '{TARGET_DATABASE_NAME}'")

        placeholders = ",".join("?" * len(compound_ids))

        # 2) Copy schema from source (need a connection to source for sqlite_master)
        conn_src = sqlite3.connect(SOURCE_DB)
        tables_to_copy = [
            "spectra_databases",
            "common_compound_categories",
            "solar_spectra",
            "compounds_absorptions_backup",
            "compounds_absorptions",
            "compound_absorption_normalized_status",
            "compounds_emissions_backup",
            "compounds_emissions",
            "compound_emission_normalized_status",
            "compounds",
        ]
        for table in tables_to_copy:
            copy_table_schema(conn_src, conn_dst, table)
        conn_src.close()

        # 3) Copy data from src.* into main.*

        # spectra_databases: row for Common Compounds (by name or by database_id from compounds)
        conn_dst.execute(
            "INSERT OR IGNORE INTO spectra_databases SELECT * FROM src.spectra_databases WHERE name = ?",
            (TARGET_DATABASE_NAME,),
        )
        cur = conn_dst.execute(
            "SELECT DISTINCT database_id FROM src.compounds WHERE database_name = ? AND database_id IS NOT NULL",
            (TARGET_DATABASE_NAME,),
        )
        for (did,) in cur.fetchall():
            conn_dst.execute(
                "INSERT OR IGNORE INTO spectra_databases SELECT * FROM src.spectra_databases WHERE id = ?",
                (did,),
            )

        # common_compound_categories: categories that appear in our compounds
        conn_dst.execute(
            f"""
            INSERT OR IGNORE INTO common_compound_categories
            SELECT DISTINCT c.* FROM src.common_compound_categories c
            INNER JOIN src.compounds comp ON comp.category_id = c.id
            WHERE comp.id IN ({placeholders})
            """,
            compound_ids,
        )

        # solar_spectra: copy all (global reference data)
        conn_dst.execute("INSERT OR IGNORE INTO solar_spectra SELECT * FROM src.solar_spectra")

        # compounds: only Common Compounds
        conn_dst.execute(
            f"INSERT INTO compounds SELECT * FROM src.compounds WHERE id IN ({placeholders})",
            compound_ids,
        )

        # Linked tables: only rows for our compound IDs
        for table in [
            "compounds_absorptions",
            "compounds_emissions",
            "compound_absorption_normalized_status",
            "compound_emission_normalized_status",
        ]:
            conn_dst.execute(
                f"INSERT INTO {table} SELECT * FROM src.{table} WHERE compound_id IN ({placeholders})",
                compound_ids,
            )

        conn_dst.execute(
            f"INSERT INTO compounds_absorptions_backup SELECT * FROM src.compounds_absorptions_backup WHERE compound_id IN ({placeholders})",
            compound_ids,
        )
        conn_dst.execute(
            f"INSERT INTO compounds_emissions_backup SELECT * FROM src.compounds_emissions_backup WHERE compound_id IN ({placeholders})",
            compound_ids,
        )

        conn_dst.commit()
        conn_dst.execute("DETACH DATABASE src")

        print(f"Written: {OUTPUT_DB}")

        # Summary
        cur = conn_dst.execute("SELECT COUNT(*) FROM compounds")
        n_comp = cur.fetchone()[0]
        cur = conn_dst.execute("SELECT COUNT(*) FROM compounds_absorptions")
        n_abs = cur.fetchone()[0]
        cur = conn_dst.execute("SELECT COUNT(*) FROM compounds_emissions")
        n_em = cur.fetchone()[0]
        print(f"  compounds: {n_comp}, absorptions: {n_abs}, emissions: {n_em}")
    finally:
        conn_dst.close()


if __name__ == "__main__":
    main()
