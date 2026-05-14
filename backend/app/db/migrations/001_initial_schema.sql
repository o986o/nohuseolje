-- ============================================================
-- 한국형 은퇴 금융 플랫폼 — 초기 데이터베이스 스키마
-- PostgreSQL 16+ 기준
-- ============================================================

-- 확장 모듈
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_partman";  -- 파티셔닝용

-- ============================================================
-- 1. 사용자 테이블
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    name            VARCHAR(100),
    is_active       BOOLEAN DEFAULT TRUE,
    is_verified     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- 2. 사용자 프로파일 (온보딩 데이터)
-- ============================================================
CREATE TABLE user_profiles (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- 기본 정보
    birth_year              SMALLINT NOT NULL CHECK (birth_year BETWEEN 1930 AND 2000),
    birth_month             SMALLINT CHECK (birth_month BETWEEN 1 AND 12),
    gender                  VARCHAR(10) CHECK (gender IN ('male','female')),
    retirement_age          SMALLINT DEFAULT 65,
    target_death_age        SMALLINT DEFAULT 100,

    -- 거주지 & 가족
    residence_type          VARCHAR(20) DEFAULT 'regional',  -- employee / regional
    has_spouse              BOOLEAN DEFAULT FALSE,
    spouse_birth_year       SMALLINT,
    spouse_gender           VARCHAR(10),
    spouse_income_monthly   BIGINT DEFAULT 0,
    dependents_count        SMALLINT DEFAULT 0,

    -- 현재 소득
    current_age             SMALLINT,
    employment_status       VARCHAR(20) DEFAULT 'employed',  -- employed / self_employed / retired
    monthly_salary          BIGINT DEFAULT 0,
    business_income_annual  BIGINT DEFAULT 0,
    other_income_annual     BIGINT DEFAULT 0,

    -- 자산 현황
    total_financial_assets  BIGINT DEFAULT 0,
    domestic_stock          BIGINT DEFAULT 0,
    us_stock                BIGINT DEFAULT 0,
    other_overseas_stock    BIGINT DEFAULT 0,
    bonds                   BIGINT DEFAULT 0,
    cash_deposits           BIGINT DEFAULT 0,
    real_estate_value       BIGINT DEFAULT 0,
    real_estate_loan        BIGINT DEFAULT 0,
    other_assets            BIGINT DEFAULT 0,

    -- 연금 현황
    national_pension_monthly     BIGINT DEFAULT 0,
    pension_savings_balance      BIGINT DEFAULT 0,
    irp_balance                  BIGINT DEFAULT 0,
    isa_balance                  BIGINT DEFAULT 0,
    company_pension_balance      BIGINT DEFAULT 0,
    pension_start_age            SMALLINT DEFAULT 65,

    -- 생활비
    monthly_living_expense       BIGINT DEFAULT 0,
    monthly_medical_expense      BIGINT DEFAULT 0,
    monthly_housing_expense      BIGINT DEFAULT 0,

    -- 목표
    target_monthly_expense       BIGINT DEFAULT 0,
    risk_tolerance               VARCHAR(20) DEFAULT 'moderate',  -- conservative / moderate / aggressive

    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. 시나리오 (저장된 시뮬레이션 설정)
-- ============================================================
CREATE TABLE scenarios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    is_default      BOOLEAN DEFAULT FALSE,
    profile_snapshot JSONB NOT NULL,  -- 시뮬레이션 시점의 프로파일 스냅샷
    params          JSONB DEFAULT '{}',  -- 추가 파라미터
    policy_version  VARCHAR(20) DEFAULT '2026.1.0',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scenarios_user_id ON scenarios(user_id);
CREATE INDEX idx_scenarios_created_at ON scenarios(created_at DESC);

-- ============================================================
-- 4. 시뮬레이션 결과 (파티셔닝 — 사용자별)
-- ============================================================
CREATE TABLE simulation_results (
    id              UUID DEFAULT uuid_generate_v4(),
    scenario_id     UUID REFERENCES scenarios(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    simulation_type VARCHAR(50) NOT NULL,  -- cashflow / monte_carlo / stress_test / tax_optimization
    status          VARCHAR(20) DEFAULT 'pending',  -- pending / running / completed / failed
    params          JSONB DEFAULT '{}',
    result_summary  JSONB,  -- 핵심 지표 (빠른 조회용)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    PRIMARY KEY (id, user_id)
) PARTITION BY HASH (user_id);

CREATE TABLE simulation_results_p0 PARTITION OF simulation_results FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE simulation_results_p1 PARTITION OF simulation_results FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE simulation_results_p2 PARTITION OF simulation_results FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE simulation_results_p3 PARTITION OF simulation_results FOR VALUES WITH (MODULUS 4, REMAINDER 3);

CREATE INDEX idx_sim_results_scenario ON simulation_results(scenario_id);
CREATE INDEX idx_sim_results_user_created ON simulation_results(user_id, created_at DESC);

-- ============================================================
-- 5. 현금흐름 연도별 상세 결과
-- ============================================================
CREATE TABLE cashflow_yearly (
    id                  UUID DEFAULT uuid_generate_v4(),
    simulation_id       UUID NOT NULL,
    user_id             UUID NOT NULL,
    year                SMALLINT NOT NULL,
    age                 SMALLINT NOT NULL,

    -- 수입
    national_pension    BIGINT DEFAULT 0,
    private_pension     BIGINT DEFAULT 0,
    financial_income    BIGINT DEFAULT 0,
    rental_income       BIGINT DEFAULT 0,
    other_income        BIGINT DEFAULT 0,
    total_income        BIGINT DEFAULT 0,

    -- 지출
    living_expense      BIGINT DEFAULT 0,
    medical_expense     BIGINT DEFAULT 0,
    housing_expense     BIGINT DEFAULT 0,
    insurance_premium   BIGINT DEFAULT 0,
    income_tax          BIGINT DEFAULT 0,
    health_insurance    BIGINT DEFAULT 0,
    ltc_insurance       BIGINT DEFAULT 0,
    total_expense       BIGINT DEFAULT 0,

    -- 자산
    total_assets        BIGINT DEFAULT 0,
    financial_assets    BIGINT DEFAULT 0,
    real_estate         BIGINT DEFAULT 0,
    net_cashflow        BIGINT DEFAULT 0,

    -- 세금
    financial_income_tax    BIGINT DEFAULT 0,
    overseas_stock_tax      BIGINT DEFAULT 0,
    pension_tax             BIGINT DEFAULT 0,
    total_tax               BIGINT DEFAULT 0,

    created_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
) PARTITION BY HASH (user_id);

CREATE TABLE cashflow_yearly_p0 PARTITION OF cashflow_yearly FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE cashflow_yearly_p1 PARTITION OF cashflow_yearly FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE cashflow_yearly_p2 PARTITION OF cashflow_yearly FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE cashflow_yearly_p3 PARTITION OF cashflow_yearly FOR VALUES WITH (MODULUS 4, REMAINDER 3);

CREATE INDEX idx_cashflow_sim_year ON cashflow_yearly(simulation_id, year);

-- ============================================================
-- 6. 몬테카를로 결과 저장 (집계)
-- ============================================================
CREATE TABLE monte_carlo_results (
    id                      UUID DEFAULT uuid_generate_v4(),
    simulation_id           UUID NOT NULL,
    user_id                 UUID NOT NULL,

    num_simulations         INTEGER NOT NULL,
    survival_probability_90 FLOAT,
    survival_probability_95 FLOAT,
    survival_probability_100 FLOAT,
    depletion_probability   FLOAT,
    median_final_assets     BIGINT,
    p10_final_assets        BIGINT,
    p90_final_assets        BIGINT,
    expected_depletion_age  FLOAT,

    percentile_10_by_age    JSONB,  -- {age: amount}
    percentile_50_by_age    JSONB,
    percentile_90_by_age    JSONB,

    created_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
) PARTITION BY HASH (user_id);

CREATE TABLE monte_carlo_results_p0 PARTITION OF monte_carlo_results FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE monte_carlo_results_p1 PARTITION OF monte_carlo_results FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE monte_carlo_results_p2 PARTITION OF monte_carlo_results FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE monte_carlo_results_p3 PARTITION OF monte_carlo_results FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- ============================================================
-- 7. 건보료 이력 (연도별)
-- ============================================================
CREATE TABLE health_insurance_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    year            SMALLINT NOT NULL,
    subscriber_type VARCHAR(20),  -- employee / regional / dependent
    monthly_premium BIGINT,
    annual_premium  BIGINT,
    ltc_premium     BIGINT,
    is_dependent_eligible   BOOLEAN,
    dependency_risk_score   FLOAT,
    breakdown       JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, year)
);

-- ============================================================
-- 8. 세금 최적화 결과
-- ============================================================
CREATE TABLE tax_optimization_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id     UUID REFERENCES scenarios(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    year            SMALLINT,
    optimization_type VARCHAR(50),
    current_tax     BIGINT,
    optimized_tax   BIGINT,
    saving          BIGINT,
    strategy        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. 정책 버전 이력
-- ============================================================
CREATE TABLE policy_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_type     VARCHAR(50) NOT NULL,  -- tax / health_insurance / pension / macro
    version         VARCHAR(20) NOT NULL,
    effective_date  DATE NOT NULL,
    data            JSONB NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (policy_type, version)
);

-- ============================================================
-- 10. 업데이트 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_scenarios_updated_at
    BEFORE UPDATE ON scenarios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
