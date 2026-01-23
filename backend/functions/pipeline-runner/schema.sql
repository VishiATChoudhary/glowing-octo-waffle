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

-- Papers table with keywords and viability scores
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
    flagged BOOLEAN DEFAULT FALSE,
    viability_score DECIMAL(3,2),
    viability_novelty INTEGER,
    viability_market_size INTEGER,
    viability_feasibility INTEGER,
    viability_timing INTEGER,
    viability_analysis TEXT,
    review_status VARCHAR(20) DEFAULT 'pending',
    pass_reason TEXT,
    status_updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Pass reason tags for reusable rejection reasons
CREATE TABLE IF NOT EXISTS pass_reason_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
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
