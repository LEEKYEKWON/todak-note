-- ========================================================
-- 토닥토닥노트 (Todak Note) 엔터프라이즈 영구 데이터베이스 스키마
-- 의사 1만 명 및 수백만 건 환자 안심 리포트 영구 보존용
-- ========================================================

-- 1. 병원 프로필 및 브랜딩 영구 저장 테이블 (hospitals)
CREATE TABLE IF NOT EXISTS public.hospitals (
    hospital_name TEXT PRIMARY KEY,
    doctor_name TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    naver_review_url TEXT,
    plan TEXT DEFAULT 'Pro',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 환자 진료 리포트 영구 저장 테이블 (reports)
CREATE TABLE IF NOT EXISTS public.reports (
    id TEXT PRIMARY KEY,
    hospital_name TEXT,
    patient_name TEXT,
    diagnosis_summary TEXT,
    medication_guide TEXT,
    next_visit_date TEXT,
    next_visit_notice TEXT,
    lifestyle_care JSONB DEFAULT '[]'::jsonb,
    warm_message TEXT,
    hospital_id TEXT,
    logo_url TEXT,
    naver_review_url TEXT,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 원장님 및 데스크 계정 테이블 (users)
CREATE TABLE IF NOT EXISTS public.users (
    email TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    doctor_name TEXT,
    hospital_name TEXT,
    phone TEXT,
    plan TEXT DEFAULT 'Pro',
    billing_key TEXT,
    logo_url TEXT,
    naver_review_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (조회 속도 초고속 최적화)
CREATE INDEX IF NOT EXISTS idx_reports_hospital_name ON public.reports(hospital_name);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- RLS (보안 정책) 활성화 및 API 전체 접근 권한 허용 (Service Role / Anon Key)
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Full Access on hospitals" ON public.hospitals;
CREATE POLICY "Public Full Access on hospitals" ON public.hospitals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access on reports" ON public.reports;
CREATE POLICY "Public Full Access on reports" ON public.reports FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access on users" ON public.users;
CREATE POLICY "Public Full Access on users" ON public.users FOR ALL USING (true) WITH CHECK (true);

