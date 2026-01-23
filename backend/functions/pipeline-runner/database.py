"""
Database Module - Cloud SQL PostgreSQL connection and operations.
Uses lazy initialization to avoid blocking at import time.
"""
import os
from google.cloud.sql.connector import Connector
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Connection configuration
INSTANCE_CONNECTION_NAME = os.environ.get("DB_INSTANCE", "waffle-mm:us-central1:paper-scraper-db")
DB_USER = os.environ.get("DB_USER", "pipeline_user")
DB_PASS = os.environ.get("DB_PASS", "")
DB_NAME = os.environ.get("DB_NAME", "papers_db")

# Lazy initialization - these are set on first use
_connector = None
_engine = None
_Session = None


def _get_connector():
    global _connector
    if _connector is None:
        _connector = Connector()
    return _connector


def get_connection():
    return _get_connector().connect(
        INSTANCE_CONNECTION_NAME,
        "pg8000",
        user=DB_USER,
        password=DB_PASS,
        db=DB_NAME,
    )


def _get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(
            "postgresql+pg8000://",
            creator=get_connection,
            pool_pre_ping=True,
            pool_recycle=300,
            pool_size=5,
            max_overflow=10,
        )
    return _engine


def Session():
    global _Session
    if _Session is None:
        _Session = sessionmaker(bind=_get_engine())
    return _Session()

# =============================================================================
# Papers
# =============================================================================


def save_papers(
    papers: list[dict],
    search_keywords: list[str],
    viability_scores: dict[str, dict] | None = None,
    flagged_ids: set[str] | None = None
) -> int:
    """
    Save papers with the keywords that found them.
    Optionally includes viability scores and flagged status.
    Returns count of new papers.
    """
    new_count = 0
    viability_scores = viability_scores or {}
    flagged_ids = flagged_ids or set()

    with Session() as session:
        for paper in papers:
            paper_id = paper["id"]
            viability = viability_scores.get(paper_id, {})
            is_flagged = paper_id in flagged_ids

            # Calculate aggregate viability score
            viability_score = None
            if viability:
                scores = [
                    viability.get("novelty", 0),
                    viability.get("marketSize", 0),
                    viability.get("feasibility", 0),
                    viability.get("timing", 0),
                ]
                if all(s > 0 for s in scores):
                    viability_score = sum(scores) / 4

            # Check if paper exists
            existing = session.execute(
                text("SELECT id, keywords FROM papers WHERE id = :id"),
                {"id": paper_id}
            ).fetchone()

            if existing:
                # Merge keywords (add new ones) and update viability if provided
                current_keywords = existing[1] or []
                merged = list(set(current_keywords + search_keywords))

                # Build update query dynamically based on what we have
                update_fields = ["keywords = :keywords"]
                params = {"id": paper_id, "keywords": merged}

                if is_flagged:
                    update_fields.append("flagged = :flagged")
                    params["flagged"] = True

                if viability:
                    update_fields.extend([
                        "viability_score = :viability_score",
                        "viability_novelty = :viability_novelty",
                        "viability_market_size = :viability_market_size",
                        "viability_feasibility = :viability_feasibility",
                        "viability_timing = :viability_timing",
                        "viability_analysis = :viability_analysis",
                    ])
                    params.update({
                        "viability_score": viability_score,
                        "viability_novelty": viability.get("novelty"),
                        "viability_market_size": viability.get("marketSize"),
                        "viability_feasibility": viability.get("feasibility"),
                        "viability_timing": viability.get("timing"),
                        "viability_analysis": viability.get("analysis"),
                    })

                session.execute(
                    text(f"UPDATE papers SET {', '.join(update_fields)} WHERE id = :id"),
                    params
                )
            else:
                # Insert new paper with keywords and viability
                session.execute(
                    text("""
                        INSERT INTO papers (id, title, abstract, authors, year, doi,
                                          arxiv_id, source, citations, url, pdf_url, keywords,
                                          flagged, viability_score, viability_novelty,
                                          viability_market_size, viability_feasibility,
                                          viability_timing, viability_analysis)
                        VALUES (:id, :title, :abstract, :authors, :year, :doi,
                                :arxiv_id, :source, :citations, :url, :pdf_url, :keywords,
                                :flagged, :viability_score, :viability_novelty,
                                :viability_market_size, :viability_feasibility,
                                :viability_timing, :viability_analysis)
                    """),
                    {
                        "id": paper_id,
                        "title": paper.get("title", ""),
                        "abstract": paper.get("abstract", ""),
                        "authors": paper.get("authors", []),
                        "year": paper.get("year"),
                        "doi": paper.get("doi"),
                        "arxiv_id": paper.get("arxivId"),
                        "source": paper.get("source", ""),
                        "citations": paper.get("citations"),
                        "url": paper.get("url"),
                        "pdf_url": paper.get("pdfUrl"),
                        "keywords": search_keywords,
                        "flagged": is_flagged,
                        "viability_score": viability_score,
                        "viability_novelty": viability.get("novelty"),
                        "viability_market_size": viability.get("marketSize"),
                        "viability_feasibility": viability.get("feasibility"),
                        "viability_timing": viability.get("timing"),
                        "viability_analysis": viability.get("analysis"),
                    }
                )
                new_count += 1
        session.commit()
    return new_count


def load_papers() -> list[dict]:
    """Load all papers."""
    with Session() as session:
        result = session.execute(text("SELECT * FROM papers ORDER BY created_at DESC"))
        return [dict(row._mapping) for row in result]


def get_papers_by_keywords(keywords: list[str]) -> list[dict]:
    """Get papers that match ANY of the given keywords."""
    with Session() as session:
        result = session.execute(
            text("SELECT * FROM papers WHERE keywords && :keywords"),
            {"keywords": keywords}
        )
        return [dict(row._mapping) for row in result]


# =============================================================================
# Researchers
# =============================================================================


def save_researchers(researchers: list[dict]) -> tuple[int, dict[str, str]]:
    """
    Save researchers, deduplicating by name.
    Returns (count of new researchers, mapping of input_id -> database_id).
    The mapping is used to fix authorship links.
    """
    new_count = 0
    id_mapping = {}  # Maps input researcher ID to actual database ID

    with Session() as session:
        for r in researchers:
            # Check if researcher exists BY NAME (case-insensitive)
            existing = session.execute(
                text("SELECT id FROM researchers WHERE LOWER(name) = LOWER(:name)"),
                {"name": r.get("name", "")}
            ).fetchone()

            if existing:
                # Researcher exists - use existing ID
                db_id = existing[0]
                id_mapping[r["id"]] = db_id

                # Update existing researcher with any new data
                session.execute(
                    text("""
                        UPDATE researchers SET
                            email = COALESCE(:email, email),
                            institution = COALESCE(:institution, institution),
                            lab = COALESCE(:lab, lab),
                            country = COALESCE(:country, country),
                            h_index = COALESCE(:h_index, h_index),
                            citations = COALESCE(:citations, citations),
                            enriched_at = COALESCE(:enriched_at, enriched_at)
                        WHERE id = :id
                    """),
                    {
                        "id": db_id,
                        "email": r.get("email"),
                        "institution": r.get("institution"),
                        "lab": r.get("lab"),
                        "country": r.get("country"),
                        "h_index": r.get("hIndex"),
                        "citations": r.get("citations"),
                        "enriched_at": r.get("enrichedAt"),
                    }
                )
            else:
                # New researcher - insert with the provided ID
                id_mapping[r["id"]] = r["id"]
                session.execute(
                    text("""
                        INSERT INTO researchers (id, name, email, institution, lab, country, h_index, citations)
                        VALUES (:id, :name, :email, :institution, :lab, :country, :h_index, :citations)
                    """),
                    {
                        "id": r["id"],
                        "name": r.get("name", ""),
                        "email": r.get("email"),
                        "institution": r.get("institution"),
                        "lab": r.get("lab"),
                        "country": r.get("country"),
                        "h_index": r.get("hIndex"),
                        "citations": r.get("citations"),
                    }
                )
                new_count += 1
        session.commit()
    return new_count, id_mapping


def load_researchers() -> list[dict]:
    """Load all researchers."""
    with Session() as session:
        result = session.execute(text("SELECT * FROM researchers ORDER BY created_at DESC"))
        return [dict(row._mapping) for row in result]


def load_researchers_with_papers() -> list[dict]:
    """Load all researchers with their associated papers."""
    with Session() as session:
        result = session.execute(text("""
            SELECT
                r.*,
                COALESCE(
                    json_agg(
                        json_build_object('id', p.id, 'title', p.title, 'keywords', p.keywords)
                    ) FILTER (WHERE p.id IS NOT NULL),
                    '[]'
                ) as associated_papers
            FROM researchers r
            LEFT JOIN authorship a ON r.id = a.researcher_id
            LEFT JOIN papers p ON a.paper_id = p.id
            GROUP BY r.id
            ORDER BY r.created_at DESC
        """))
        return [dict(row._mapping) for row in result]


# =============================================================================
# Authorship
# =============================================================================


def save_authorship(links: list[dict], researcher_id_mapping: dict[str, str] = None) -> None:
    """
    Save authorship links.
    If researcher_id_mapping is provided, remaps researcher IDs to their database IDs.
    """
    with Session() as session:
        for link in links:
            # Remap researcher ID if mapping is provided
            researcher_id = link["researcherId"]
            if researcher_id_mapping and researcher_id in researcher_id_mapping:
                researcher_id = researcher_id_mapping[researcher_id]

            session.execute(
                text("""
                    INSERT INTO authorship (paper_id, researcher_id, role)
                    VALUES (:paper_id, :researcher_id, :role)
                    ON CONFLICT (paper_id, researcher_id) DO NOTHING
                """),
                {
                    "paper_id": link["paperId"],
                    "researcher_id": researcher_id,
                    "role": link.get("role", "author"),
                }
            )
        session.commit()


def load_authorship() -> list[dict]:
    """Load all authorship links."""
    with Session() as session:
        result = session.execute(text("SELECT paper_id, researcher_id, role FROM authorship"))
        return [{"paperId": row[0], "researcherId": row[1], "role": row[2]} for row in result]


# =============================================================================
# Viability
# =============================================================================


def save_viability(viability: dict[str, dict]) -> None:
    """Save viability scores for papers."""
    with Session() as session:
        for paper_id, scores in viability.items():
            session.execute(
                text("""
                    INSERT INTO viability (paper_id, novelty, market_size, feasibility, timing, analysis)
                    VALUES (:paper_id, :novelty, :market_size, :feasibility, :timing, :analysis)
                    ON CONFLICT (paper_id) DO UPDATE SET
                        novelty = EXCLUDED.novelty,
                        market_size = EXCLUDED.market_size,
                        feasibility = EXCLUDED.feasibility,
                        timing = EXCLUDED.timing,
                        analysis = EXCLUDED.analysis
                """),
                {
                    "paper_id": paper_id,
                    "novelty": scores.get("novelty"),
                    "market_size": scores.get("marketSize"),
                    "feasibility": scores.get("feasibility"),
                    "timing": scores.get("timing"),
                    "analysis": scores.get("analysis"),
                }
            )
        session.commit()


def load_viability() -> dict[str, dict]:
    """Load all viability scores."""
    with Session() as session:
        result = session.execute(text("SELECT * FROM viability"))
        return {
            row[0]: {
                "novelty": row[1],
                "marketSize": row[2],
                "feasibility": row[3],
                "timing": row[4],
                "analysis": row[5],
            }
            for row in result
        }


# =============================================================================
# Stats
# =============================================================================


def get_stats() -> dict:
    """Get database statistics."""
    with Session() as session:
        papers = session.execute(text("SELECT COUNT(*) FROM papers")).scalar()
        researchers = session.execute(text("SELECT COUNT(*) FROM researchers")).scalar()
        authorship = session.execute(text("SELECT COUNT(*) FROM authorship")).scalar()
        viability = session.execute(text("SELECT COUNT(*) FROM viability")).scalar()
        return {
            "papers": papers,
            "researchers": researchers,
            "authorship_links": authorship,
            "viability_scores": viability,
        }


def clear_all_data() -> dict:
    """
    Clear all data from the database.
    Returns counts of deleted rows.
    """
    with Session() as session:
        # Delete in order to respect foreign key constraints
        authorship_count = session.execute(text("DELETE FROM authorship")).rowcount
        viability_count = session.execute(text("DELETE FROM viability")).rowcount
        papers_count = session.execute(text("DELETE FROM papers")).rowcount
        researchers_count = session.execute(text("DELETE FROM researchers")).rowcount
        session.commit()

        return {
            "authorship_deleted": authorship_count,
            "viability_deleted": viability_count,
            "papers_deleted": papers_count,
            "researchers_deleted": researchers_count,
        }


def delete_paper(paper_id: str) -> bool:
    """
    Delete a specific paper and its related data.
    Returns True if the paper was deleted, False if not found.
    """
    with Session() as session:
        # Delete related authorship links first
        session.execute(
            text("DELETE FROM authorship WHERE paper_id = :id"),
            {"id": paper_id}
        )
        # Delete related viability scores
        session.execute(
            text("DELETE FROM viability WHERE paper_id = :id"),
            {"id": paper_id}
        )
        # Delete the paper
        result = session.execute(
            text("DELETE FROM papers WHERE id = :id"),
            {"id": paper_id}
        )
        session.commit()
        return result.rowcount > 0


# =============================================================================
# Paper Review Status
# =============================================================================


def update_paper_status(paper_id: str, status: str, pass_reason: str | None = None) -> bool:
    """
    Update the review status of a paper.
    Valid statuses: pending, saved, under_review, pass
    Returns True if updated, False if paper not found.
    """
    from datetime import datetime

    with Session() as session:
        result = session.execute(
            text("""
                UPDATE papers
                SET review_status = :status,
                    pass_reason = :pass_reason,
                    status_updated_at = :updated_at
                WHERE id = :id
            """),
            {
                "id": paper_id,
                "status": status,
                "pass_reason": pass_reason,
                "updated_at": datetime.utcnow(),
            }
        )
        session.commit()
        return result.rowcount > 0


def get_papers_filtered(
    status: str | None = None,
    location_query: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc"
) -> list[dict]:
    """
    Get papers with optional filtering and sorting.

    Args:
        status: Filter by review_status (pending, saved, under_review, pass)
        location_query: Search institution/country of associated researchers
        sort_by: Column to sort by (created_at, year, citations, viability_score)
        sort_order: asc or desc

    Returns:
        List of paper dicts with passed papers sorted to end when not filtering by status.
    """
    with Session() as session:
        # Base query with optional location join
        if location_query:
            # Join with authorship and researchers to filter by location
            base_query = """
                SELECT DISTINCT p.*
                FROM papers p
                JOIN authorship a ON p.id = a.paper_id
                JOIN researchers r ON a.researcher_id = r.id
                WHERE (r.institution ILIKE :location OR r.country ILIKE :location)
            """
            params = {"location": f"%{location_query}%"}
        else:
            base_query = "SELECT * FROM papers WHERE 1=1"
            params = {}

        # Add status filter
        if status:
            base_query += " AND p.review_status = :status" if location_query else " AND review_status = :status"
            params["status"] = status

        # Validate sort_by to prevent SQL injection
        valid_sort_columns = {"created_at", "year", "citations", "viability_score"}
        if sort_by not in valid_sort_columns:
            sort_by = "created_at"

        # Validate sort_order
        sort_order = "ASC" if sort_order.lower() == "asc" else "DESC"

        # Add ordering - push passed papers to end when not filtering by status
        table_prefix = "p." if location_query else ""
        if not status:
            base_query += f"""
                ORDER BY CASE WHEN {table_prefix}review_status = 'pass' THEN 1 ELSE 0 END,
                         {table_prefix}{sort_by} {sort_order}
            """
        else:
            base_query += f" ORDER BY {table_prefix}{sort_by} {sort_order}"

        result = session.execute(text(base_query), params)
        return [dict(row._mapping) for row in result]


# =============================================================================
# Pass Reason Tags
# =============================================================================


def get_pass_reason_tags() -> list[dict]:
    """Get all pass reason tags."""
    with Session() as session:
        result = session.execute(
            text("SELECT id, name, created_at FROM pass_reason_tags ORDER BY name")
        )
        return [{"id": row[0], "name": row[1], "createdAt": row[2].isoformat() if row[2] else None} for row in result]


def create_pass_reason_tag(name: str) -> dict | None:
    """
    Create a new pass reason tag.
    Returns the created tag or None if it already exists.
    """
    from datetime import datetime

    with Session() as session:
        # Check if tag already exists
        existing = session.execute(
            text("SELECT id FROM pass_reason_tags WHERE LOWER(name) = LOWER(:name)"),
            {"name": name}
        ).fetchone()

        if existing:
            return None

        # Insert new tag
        result = session.execute(
            text("""
                INSERT INTO pass_reason_tags (name, created_at)
                VALUES (:name, :created_at)
                RETURNING id, name, created_at
            """),
            {"name": name.strip(), "created_at": datetime.utcnow()}
        )
        row = result.fetchone()
        session.commit()

        if row:
            return {"id": row[0], "name": row[1], "createdAt": row[2].isoformat() if row[2] else None}
        return None
