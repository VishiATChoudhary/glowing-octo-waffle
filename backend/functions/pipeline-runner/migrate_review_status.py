#!/usr/bin/env python3
"""
Migration script to add paper review status columns and pass_reason_tags table.

Usage:
    DB_PASS='your_password' python migrate_review_status.py
"""
import os
from google.cloud.sql.connector import Connector
from sqlalchemy import create_engine, text

# Connection configuration
INSTANCE_CONNECTION_NAME = os.environ.get("DB_INSTANCE", "waffle-mm:us-central1:paper-scraper-db")
DB_USER = os.environ.get("DB_USER", "pipeline_user")
DB_PASS = os.environ.get("DB_PASS", "")
DB_NAME = os.environ.get("DB_NAME", "papers_db")

if not DB_PASS:
    print("Error: DB_PASS environment variable is required")
    exit(1)

connector = Connector()


def get_connection():
    return connector.connect(
        INSTANCE_CONNECTION_NAME,
        "pg8000",
        user=DB_USER,
        password=DB_PASS,
        db=DB_NAME,
    )


engine = create_engine("postgresql+pg8000://", creator=get_connection)

# Migration statements
MIGRATIONS = [
    # Add review_status column to papers table
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'papers' AND column_name = 'review_status'
        ) THEN
            ALTER TABLE papers ADD COLUMN review_status VARCHAR(20) DEFAULT 'pending';
        END IF;
    END $$;
    """,
    # Add pass_reason column to papers table
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'papers' AND column_name = 'pass_reason'
        ) THEN
            ALTER TABLE papers ADD COLUMN pass_reason TEXT;
        END IF;
    END $$;
    """,
    # Add status_updated_at column to papers table
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'papers' AND column_name = 'status_updated_at'
        ) THEN
            ALTER TABLE papers ADD COLUMN status_updated_at TIMESTAMP;
        END IF;
    END $$;
    """,
    # Create pass_reason_tags table
    """
    CREATE TABLE IF NOT EXISTS pass_reason_tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    );
    """,
    # Create index on review_status for faster filtering
    """
    CREATE INDEX IF NOT EXISTS idx_papers_review_status ON papers (review_status);
    """,
]

if __name__ == "__main__":
    print(f"Connecting to {INSTANCE_CONNECTION_NAME}...")
    print(f"Database: {DB_NAME}")
    print(f"User: {DB_USER}")

    try:
        with engine.connect() as conn:
            print("Connected! Running migrations...")

            for i, stmt in enumerate(MIGRATIONS, 1):
                print(f"  Migration {i}/{len(MIGRATIONS)}...")
                conn.execute(text(stmt))
                conn.commit()

            print("\nMigrations completed successfully!")

            # Verify columns exist
            result = conn.execute(text("""
                SELECT column_name, data_type, column_default
                FROM information_schema.columns
                WHERE table_name = 'papers'
                AND column_name IN ('review_status', 'pass_reason', 'status_updated_at')
                ORDER BY column_name
            """))
            columns = [(row[0], row[1], row[2]) for row in result]
            print(f"\nNew papers columns:")
            for col in columns:
                print(f"  - {col[0]}: {col[1]} (default: {col[2]})")

            # Verify pass_reason_tags table exists
            result = conn.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'pass_reason_tags'
            """))
            tables = [row[0] for row in result]
            print(f"\npass_reason_tags table: {'exists' if tables else 'NOT FOUND'}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
    finally:
        connector.close()
