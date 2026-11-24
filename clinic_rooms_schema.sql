-- ========================================================
-- 토닥토닥노트: 다인 진료실(Multi-Doctor) 슬롯 지원 스키마 추가
-- ========================================================

-- 1. users 테이블에 진료실 방 목록(JSONB) 컬럼 추가
-- 기본값: 1진료실(가입 시 등록한 원장명) 1개 방 자동 포함
ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_rooms JSONB DEFAULT '[]'::jsonb;

-- 2. 기존 가입된 회원들의 clinic_rooms 초기 데이터 생성 (기존 대표원장 1진료실로 자동 매핑)
UPDATE users 
SET clinic_rooms = jsonb_build_array(
  jsonb_build_object(
    'id', 'room_1',
    'roomName', '1진료실',
    'doctorName', COALESCE(doctor_name, '원장'),
    'isMain', true,
    'createdAt', NOW()
  )
)
WHERE clinic_rooms IS NULL OR clinic_rooms = '[]'::jsonb;
