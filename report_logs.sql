-- 실시간 환자 활동 로그 테이블 (열람, 공유, 네이버 리뷰 클릭)
CREATE TABLE IF NOT EXISTS public.report_logs (
    id BIGSERIAL PRIMARY KEY,
    report_id TEXT,
    hospital_name TEXT,
    patient_name TEXT,
    action_type TEXT, -- 'view', 'share', 'review'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.report_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Full Access on report_logs" ON public.report_logs;
CREATE POLICY "Public Full Access on report_logs" ON public.report_logs FOR ALL USING (true) WITH CHECK (true);

