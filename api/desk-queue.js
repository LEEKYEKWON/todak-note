// 병원별 진료실 ➔ 데스크 실시간 대기열 API
const fs = require('fs');
const path = require('path');

global._deskQueueCache = global._deskQueueCache || {};
const QUEUE_FILE = path.join('/tmp', 'todak_desk_queue.json');

function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
      Object.assign(global._deskQueueCache, data);
    }
  } catch (e) { }
}

function saveQueue() {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(global._deskQueueCache), 'utf-8');
  } catch (e) { }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  loadQueue();

  // 1. 대기 환자 목록 조회 (GET /api/desk-queue?hospitalId=...) 및 전체 초기화 (?action=reset_all)
  if (req.method === 'GET') {
    if (req.query.action === 'reset_all') {
      global._deskQueueCache = {};
      saveQueue();
      res.status(200).json({ success: true, message: '모든 대기열 환자 데이터가 완전히 초기화되었습니다.' });
      return;
    }
    const hospitalId = (req.query.hospitalId || req.query.hosp || 'default').trim();
    const queue = global._deskQueueCache[hospitalId] || [];
    res.status(200).json({ success: true, queue });
    return;
  }

  // 2. 진료실에서 환자 리포트 데스크로 전송 및 상태 갱신 (POST /api/desk-queue)
  if (req.method === 'POST') {
    const { hospitalId, item } = req.body || {};
    const key = (hospitalId || 'default').trim();

    if (!item || !item.patientName) {
      res.status(400).json({ error: '환자 정보(item)가 올바르지 않습니다.' });
      return;
    }

    if (!global._deskQueueCache[key]) {
      global._deskQueueCache[key] = [];
    }

    // 중복 방지 (동일 ID 또는 동일 환자 전화번호&이름인 경우 최신 상태로 갱신)
    const cleanItemPhone = (item.phone || '').replace(/[^0-9]/g, '');
    const existingIndex = global._deskQueueCache[key].findIndex(q => 
      q.id === item.id || 
      (cleanItemPhone && cleanItemPhone.length >= 8 && (q.phone || '').replace(/[^0-9]/g, '') === cleanItemPhone)
    );
    if (existingIndex >= 0) {
      global._deskQueueCache[key][existingIndex] = { ...global._deskQueueCache[key][existingIndex], ...item, id: global._deskQueueCache[key][existingIndex].id };
    } else {
      global._deskQueueCache[key].unshift(item); // 최신 환자 맨 위에 추가
    }

    // 최대 50건 유지
    global._deskQueueCache[key] = global._deskQueueCache[key].slice(0, 50);
    saveQueue();

    res.status(200).json({ success: true, count: global._deskQueueCache[key].length });
    return;
  }

  // 3. 발송 완료 또는 삭제 (DELETE /api/desk-queue?hospitalId=...&id=...)
  if (req.method === 'DELETE') {
    const hospitalId = (req.query.hospitalId || req.body?.hospitalId || 'default').trim();
    const itemId = req.query.id || req.body?.id;

    if (!itemId) {
      res.status(400).json({ error: 'id가 필요합니다.' });
      return;
    }

    if (global._deskQueueCache[hospitalId]) {
      global._deskQueueCache[hospitalId] = global._deskQueueCache[hospitalId].filter(q => q.id !== itemId);
      saveQueue();
    }

    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
};

