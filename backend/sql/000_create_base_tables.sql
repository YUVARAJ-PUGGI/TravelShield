
USE travelshield;

-- ============================================
-- 1. USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    user_id INT NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 2. COUNTRIES
-- ============================================
CREATE TABLE IF NOT EXISTS countries (
    country_id INT NOT NULL AUTO_INCREMENT,
    country_name VARCHAR(100) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (country_id),
    UNIQUE KEY uq_countries_name (country_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 3. PLANS
-- ============================================
CREATE TABLE IF NOT EXISTS plans (
    plan_id INT NOT NULL AUTO_INCREMENT,
    plan_name VARCHAR(100) NOT NULL,
    description TEXT,
    coverage_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    deductible_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    base_daily_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency_code CHAR(3) NOT NULL DEFAULT 'USD',
    coverage_benefits JSON NULL,
    exclusions JSON NULL,
    eligibility_requirements JSON NULL,
    policy_conditions JSON NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (plan_id),
    UNIQUE KEY uq_plans_name (plan_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 4. QUOTES
-- ============================================
CREATE TABLE IF NOT EXISTS quotes (
    quote_id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    destination_country_id INT NOT NULL,
    plan_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    traveller_count INT NOT NULL DEFAULT 1,
    premium_amount DECIMAL(12,2) NOT NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'USD',
    quote_status VARCHAR(30) NOT NULL DEFAULT 'generated',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (quote_id),
    KEY idx_quotes_user_id (user_id),
    KEY idx_quotes_plan_id (plan_id),
    KEY idx_quotes_country_id (destination_country_id),
    CONSTRAINT fk_quotes_user
        FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_quotes_country
        FOREIGN KEY (destination_country_id)
        REFERENCES countries(country_id),
    CONSTRAINT fk_quotes_plan
        FOREIGN KEY (plan_id) REFERENCES plans(plan_id),
    CONSTRAINT chk_quotes_dates
        CHECK (end_date >= start_date),
    CONSTRAINT chk_quotes_travellers
        CHECK (traveller_count > 0),
    CONSTRAINT chk_quotes_premium
        CHECK (premium_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 5. POLICIES
-- ============================================
CREATE TABLE IF NOT EXISTS policies (
    policy_id INT NOT NULL AUTO_INCREMENT,
    policy_number VARCHAR(50) NOT NULL,
    user_id INT NOT NULL,
    quote_id INT NOT NULL,
    policy_status ENUM(
        'simulated_issued',
        'simulated_cancelled'
    ) NOT NULL DEFAULT 'simulated_issued',
    issue_date DATE NOT NULL,
    coverage_start_date DATE NOT NULL,
    coverage_end_date DATE NOT NULL,
    premium_amount DECIMAL(12,2) NOT NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (policy_id),
    UNIQUE KEY uq_policies_number (policy_number),
    UNIQUE KEY uq_policies_quote (quote_id),
    KEY idx_policies_user_id (user_id),
    CONSTRAINT fk_policies_user
        FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_policies_quote
        FOREIGN KEY (quote_id) REFERENCES quotes(quote_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 6. CLAIMS
-- ============================================
CREATE TABLE IF NOT EXISTS claims (
    claim_id INT NOT NULL AUTO_INCREMENT,
    claim_number VARCHAR(50) NOT NULL,
    user_id INT NOT NULL,
    policy_id INT NOT NULL,
    claim_status ENUM(
        'submitted',
        'under_review',
        'approved_demo',
        'declined_demo',
        'closed'
    ) NOT NULL DEFAULT 'submitted',
    incident_date DATE NOT NULL,
    description TEXT NOT NULL,
    claimed_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency_code CHAR(3) NOT NULL DEFAULT 'USD',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (claim_id),
    UNIQUE KEY uq_claims_number (claim_number),
    KEY idx_claims_user_id (user_id),
    KEY idx_claims_policy_id (policy_id),
    CONSTRAINT fk_claims_user
        FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_claims_policy
        FOREIGN KEY (policy_id) REFERENCES policies(policy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 7. CLAIM EVIDENCE DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS claim_evidence_documents (
    document_id INT NOT NULL AUTO_INCREMENT,
    claim_id INT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    storage_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (document_id),
    KEY idx_evidence_claim_id (claim_id),
    CONSTRAINT fk_evidence_claim
        FOREIGN KEY (claim_id) REFERENCES claims(claim_id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 8. PLAN BENEFITS
-- ============================================
CREATE TABLE IF NOT EXISTS plan_benefits (
    benefit_id INT NOT NULL AUTO_INCREMENT,
    plan_id INT NOT NULL,
    benefit_name VARCHAR(150) NOT NULL,
    benefit_category VARCHAR(100) DEFAULT NULL,
    description TEXT,
    benefit_limit DECIMAL(12,2) DEFAULT NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'USD',
    required_evidence JSON NULL,
    exclusions_conditions TEXT,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (benefit_id),
    KEY idx_benefits_plan_id (plan_id),
    CONSTRAINT fk_benefits_plan
        FOREIGN KEY (plan_id) REFERENCES plans(plan_id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 9. SEED COUNTRIES
-- ============================================
INSERT INTO countries (country_name, is_active)
VALUES
    ('Australia', 1),
    ('Germany', 1),
    ('United Kingdom', 1),
    ('United States', 1)
ON DUPLICATE KEY UPDATE
    is_active = VALUES(is_active);

-- ============================================
-- 10. SEED DEMO PLANS
-- Rates are illustrative educational values.
-- ============================================
INSERT INTO plans (
    plan_id,
    plan_name,
    description,
    coverage_amount,
    deductible_amount,
    base_daily_rate,
    currency_code,
    coverage_benefits,
    exclusions,
    eligibility_requirements,
    policy_conditions,
    is_active
)
VALUES
(
    1,
    'Essential',
    'Basic educational travel-plan example.',
    35000.00,
    100.00,
    2.00,
    'USD',
    JSON_ARRAY(
        JSON_OBJECT(
            'title', 'Emergency medical care',
            'description', 'Illustrative emergency medical benefit.',
            'limit', 'Included within the overall demo limit'
        ),
        JSON_OBJECT(
            'title', 'Baggage assistance',
            'description', 'Illustrative baggage assistance benefit.'
        )
    ),
    JSON_ARRAY(
        JSON_OBJECT(
            'title', 'Pre-existing conditions',
            'description', 'Not included in this illustrative demo.'
        )
    ),
    JSON_ARRAY(
        JSON_OBJECT(
            'title', 'Trip details',
            'description', 'Provide valid trip dates and traveller details.'
        )
    ),
    JSON_ARRAY(
        JSON_OBJECT(
            'title', 'Educational simulation',
            'description', 'This is not a real insurance policy.'
        )
    ),
    1
),
(
    2,
    'Comprehensive',
    'Expanded educational travel-plan example.',
    75000.00,
    50.00,
    3.50,
    'USD',
    JSON_ARRAY(
        JSON_OBJECT(
            'title', 'Emergency medical care',
            'description', 'Illustrative emergency medical benefit.'
        ),
        JSON_OBJECT(
            'title', 'Trip interruption',
            'description', 'Illustrative trip interruption benefit.'
        ),
        JSON_OBJECT(
            'title', 'Baggage assistance',
            'description', 'Illustrative baggage assistance benefit.'
        )
    ),
    JSON_ARRAY(
        JSON_OBJECT(
            'title', 'Pre-existing conditions',
            'description', 'Not included in this illustrative demo.'
        )
    ),
    JSON_ARRAY(
        JSON_OBJECT(
            'title', 'Trip details',
            'description', 'Provide valid trip dates and traveller details.'
        )
    ),
    JSON_ARRAY(
        JSON_OBJECT(
            'title', 'Educational simulation',
            'description', 'This is not a real insurance policy.'
        )
    ),
    1
),
(
    3,
    'Premium',
    'Higher-limit educational travel-plan example.',
    150000.00,
    0.00,
    5.00,
    'USD',
    JSON_ARRAY(
        JSON_OBJECT(
            'title', 'Emergency medical care',
            'description', 'Illustrative emergency medical benefit.'
        ),
        JSON_OBJECT(
            'title', 'Trip interruption',
            'description', 'Illustrative trip interruption benefit.'
        ),
        JSON_OBJECT(
            'title', 'Baggage assistance',
            'description', 'Illustrative baggage assistance benefit.'
        ),
        JSON_OBJECT(
            'title', 'Emergency assistance',
            'description', 'Illustrative assistance benefit.'
        )
    ),
    JSON_ARRAY(
        JSON_OBJECT(
            'title', 'Pre-existing conditions',
            'description', 'Not included in this illustrative demo.'
        )
    ),
    JSON_ARRAY(
        JSON_OBJECT(
            'title', 'Trip details',
            'description', 'Provide valid trip dates and traveller details.'
        )
    ),
    JSON_ARRAY(
        JSON_OBJECT(
            'title', 'Educational simulation',
            'description', 'This is not a real insurance policy.'
        )
    ),
    1
)
ON DUPLICATE KEY UPDATE
    description = VALUES(description),
    coverage_amount = VALUES(coverage_amount),
    deductible_amount = VALUES(deductible_amount),
    base_daily_rate = VALUES(base_daily_rate),
    currency_code = VALUES(currency_code),
    is_active = VALUES(is_active);

-- ============================================
-- 11. SEED EXAMPLE BENEFITS
-- ============================================
INSERT INTO plan_benefits (
    plan_id,
    benefit_name,
    benefit_category,
    description,
    benefit_limit,
    currency_code,
    required_evidence,
    exclusions_conditions,
    is_active
)
SELECT
    p.plan_id,
    b.benefit_name,
    b.benefit_category,
    b.description,
    b.benefit_limit,
    'USD',
    b.required_evidence,
    'Illustrative educational example only.',
    1
FROM plans p
JOIN (
    SELECT
        'Emergency medical assistance' AS benefit_name,
        'Medical' AS benefit_category,
        'Illustrative emergency assistance benefit.' AS description,
        5000.00 AS benefit_limit,
        JSON_ARRAY('Incident description', 'Supporting document')
            AS required_evidence
    UNION ALL
    SELECT
        'Baggage assistance',
        'Baggage',
        'Illustrative baggage assistance benefit.',
        500.00,
        JSON_ARRAY('Baggage incident description', 'Supporting document')
    UNION ALL
    SELECT
        'Trip interruption assistance',
        'Travel',
        'Illustrative trip interruption benefit.',
        1000.00,
        JSON_ARRAY('Trip interruption description', 'Supporting document')
) b
WHERE p.plan_id IN (1, 2, 3)
AND NOT EXISTS (
    SELECT 1
    FROM plan_benefits existing
    WHERE existing.plan_id = p.plan_id
      AND existing.benefit_name = b.benefit_name
);

-- ============================================
-- 12. VERIFY TABLES
-- ============================================
SHOW TABLES;

SELECT country_id, country_name, is_active
FROM countries;

SELECT plan_id, plan_name, coverage_amount,
       deductible_amount, base_daily_rate, currency_code
FROM plans;
