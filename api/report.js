// 환자 진료 리포트 영구 저장 및 조회 API - Supabase 연동
const { supabaseQuery } = require('./supabase');

// 메모리 백업 캐시
global._reportCache = global._reportCache || {};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // 1. 리포트 영구 저장 (POST /api/report)
  if (req.method === 'POST') {
    const { id, reportData } = req.body || {};
    if (!id || !reportData) {
      res.status(400).json({ error: 'id and reportData required' });
      return;
    }

    // 메모리 캐시 저장
    global._reportCache[id] = reportData;

    // 🌟 Supabase 클라우드 영구 저장 (1만 명 의사가 보낸 수백만 건 리포트 평생 보관)
    try {
      const dbPayload = {
        id: String(id),
        hospital_name: reportData.hospitalName || '',
        patient_name: reportData.patientName || '',
        diagnosis_summary: reportData.diagnosisSummary || '',
        medication_guide: reportData.medicationGuide || '',
        next_visit_date: reportData.nextVisitDate || '',
        next_visit_notice: reportData.nextVisitNotice || '',
        lifestyle_care: reportData.lifestyleCare || [],
        warm_message: reportData.warmMessage || '',
        hospital_id: reportData.hospitalId || '',
        logo_url: reportData.logoUrl || '',
        naver_review_url: reportData.naverReviewUrl || '',
        raw_data: reportData,
        created_at: new Date().toISOString()
      };

      await supabaseQuery('reports', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: JSON.stringify(dbPayload)
      });
    } catch (e) {
      console.warn("Supabase 리포트 저장 실패, 로컬 캐시 유지:", e);
    }

    res.status(200).json({ success: true, id });
    return;
  }

  // 2. 리포트 영구 조회 (GET /api/report?id=...)
  if (req.method === 'GET') {
    const { id } = req.query || {};
    if (!id) {
      res.status(400).json({ error: 'id parameter required' });
      return;
    }

    // 1순위: Supabase 영구 DB에서 조회
    try {
      const sbRes = await supabaseQuery(`reports?id=eq.${encodeURIComponent(id)}&select=*`);
      if (sbRes.ok && sbRes.data && sbRes.data.length > 0) {
        const row = sbRes.data[0];
        const reportData = row.raw_data || {
          hospitalName: row.hospital_name,
          patientName: row.patient_name,
          diagnosisSummary: row.diagnosis_summary,
          medicationGuide: row.medication_guide,
          nextVisitDate: row.next_visit_date,
          nextVisitNotice: row.next_visit_notice,
          lifestyleCare: row.lifestyle_care,
          warmMessage: row.warm_message,
          hospitalId: row.hospital_id,
          logoUrl: row.logo_url,
          naverReviewUrl: row.naver_review_url
        };
        global._reportCache[id] = reportData;
        res.status(200).json(reportData);
        return;
      }
    } catch (sbErr) {
      console.warn("Supabase 리포트 조회 실패, 캐시 확인:", sbErr);
    }

    // 2순위: 메모리 캐시 조회
    if (global._reportCache[id]) {
      res.status(200).json(global._reportCache[id]);
      return;
    }

    res.status(404).json({ error: 'Report not found' });
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
};
