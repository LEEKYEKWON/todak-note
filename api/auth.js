// Vercel Serverless: 회원가입, 로그인 및 병원 프로필 클라우드 동기화 API
const fs = require('fs');
const path = require('path');

global._usersCache = global._usersCache || {};
const USERS_FILE = path.join('/tmp', 'todak_users.json');

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      Object.assign(global._usersCache, data);
    }
  } catch (e) { }
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(global._usersCache), 'utf-8');
  } catch (e) { }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  loadUsers();

  const action = req.query.action || req.body?.action;

  // 1. 회원가입 (POST /api/auth?action=signup)
  if (req.method === 'POST' && action === 'signup') {
    const { email, password, doctorName, hospitalName, phone, plan } = req.body || {};
    if (!email || !password || !hospitalName) {
      res.status(400).json({ error: '필수 가입 정보(이메일, 비밀번호, 병원명)가 누락되었습니다.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const newUser = {
      email: cleanEmail,
      password,
      doctorName: (doctorName || '원장').trim(),
      hospitalName: hospitalName.trim(),
      phone: (phone || '').trim(),
      plan: plan || 'Pro',
      joinedAt: new Date().toISOString()
    };

    global._usersCache[cleanEmail] = newUser;
    saveUsers();

    res.status(200).json({ success: true, user: newUser });
    return;
  }

  // 2. 로그인 (POST /api/auth?action=login)
  if (req.method === 'POST' && action === 'login') {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: '이메일과 비밀번호를 입력해 주세요.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = global._usersCache[cleanEmail];

    if (!user) {
      res.status(404).json({ error: '등록되지 않은 이메일 주소입니다. 회원가입을 먼저 진행해 주세요.' });
      return;
    }

    if (user.password !== password) {
      res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
      return;
    }

    res.status(200).json({ success: true, user });
    return;
  }

  // 3. 프로필 조회 (GET /api/auth?email=...) 및 전체 초기화 (GET /api/auth?action=reset_all)
  if (req.method === 'GET') {
    if (action === 'reset_all') {
      global._usersCache = {};
      saveUsers();
      res.status(200).json({ success: true, message: '서버의 모든 회원 계정이 완전히 삭제/초기화되었습니다.' });
      return;
    }

    const email = (req.query.email || '').trim().toLowerCase();
    if (!email || !global._usersCache[email]) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, user: global._usersCache[email] });
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
};

