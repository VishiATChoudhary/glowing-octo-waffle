#!/usr/bin/env python3
"""
Database setup script - creates the schema for the papers database.
Run this once after creating the Cloud SQL instance.

Usage:
    DB_PASS='your_password' python setup_database.py
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

SCHEMA = """
-- Researchers table
CREATE TABLE IF NOT EXISTS researchers (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    institution VARCHAR(255),
    lab VARCHAR(255),
    country VARCHAR(100),
    h_index INTEGER,
    citations INTEGER,
    enriched_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Papers table with keywords
CREATE TABLE IF NOT EXISTS papers (
    id VARCHAR(100) PRIMARY KEY,
    title TEXT NOT NULL,
    abstract TEXT,
    authors TEXT[],
    year INTEGER,
    doi VARCHAR(100),
    arxiv_id VARCHAR(50),
    source VARCHAR(50),
    citations INTEGER,
    url TEXT,
    pdf_url TEXT,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Authorship links
CREATE TABLE IF NOT EXISTS authorship (
    paper_id VARCHAR(100) REFERENCES papers(id),
    researcher_id VARCHAR(100) REFERENCES researchers(id),
    role VARCHAR(50) DEFAULT 'author',
    PRIMARY KEY (paper_id, researcher_id)
);

-- Viability scores
CREATE TABLE IF NOT EXISTS viability (
    paper_id VARCHAR(100) PRIMARY KEY REFERENCES papers(id),
    novelty INTEGER,
    market_size INTEGER,
    feasibility INTEGER,
    timing INTEGER,
    analysis TEXT
);

-- Create index for fast keyword filtering
CREATE INDEX IF NOT EXISTS idx_papers_keywords ON papers USING GIN (keywords);
"""

if __name__ == "__main__":
    print(f"Connecting to {INSTANCE_CONNECTION_NAME}...")
    print(f"Database: {DB_NAME}")
    print(f"User: {DB_USER}")

    # Individual CREATE statements to ensure proper execution
    CREATE_STATEMENTS = [
        """CREATE TABLE IF NOT EXISTS researchers (
            id VARCHAR(100) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            institution VARCHAR(255),
            lab VARCHAR(255),
            country VARCHAR(100),
            h_index INTEGER,
            citations INTEGER,
            enriched_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS papers (
            id VARCHAR(100) PRIMARY KEY,
            title TEXT NOT NULL,
            abstract TEXT,
            authors TEXT[],
            year INTEGER,
            doi VARCHAR(100),
            arxiv_id VARCHAR(50),
            source VARCHAR(50),
            citations INTEGER,
            url TEXT,
            pdf_url TEXT,
            keywords TEXT[] NOT NULL DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS authorship (
            paper_id VARCHAR(100) REFERENCES papers(id),
            researcher_id VARCHAR(100) REFERENCES researchers(id),
            role VARCHAR(50) DEFAULT 'author',
            PRIMARY KEY (paper_id, researcher_id)
        )""",
        """CREATE TABLE IF NOT EXISTS viability (
            paper_id VARCHAR(100) PRIMARY KEY REFERENCES papers(id),
            novelty INTEGER,
            market_size INTEGER,
            feasibility INTEGER,
            timing INTEGER,
            analysis TEXT
        )""",
        """CREATE INDEX IF NOT EXISTS idx_papers_keywords ON papers USING GIN (keywords)""",
    ]

    try:
        with engine.connect() as conn:
            print("Connected! Creating schema...")

            for stmt in CREATE_STATEMENTS:
                print(f"  Executing: {stmt[:60]}...")
                conn.execute(text(stmt))
                conn.commit()

            print("Schema created successfully!")

            # Verify tables exist
            result = conn.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            """))
            tables = [row[0] for row in result]
            print(f"Tables created: {tables}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
    finally:
        connector.close()
