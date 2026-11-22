const tls = require('tls');

// 🌟 네이버 SMTP 보안 계정 정보
const SMTP_HOST = 'smtp.naver.com';
const SMTP_PORT = 465;
const NAVER_USER = process.env.NAVER_USER || 'hayabusak';
const NAVER_PASS = process.env.NAVER_PASS || '4LND1WBNNGQF';
const NOTIFY_RECEIVER = process.env.NOTIFY_RECEIVER || 'hayabusak@naver.com';

function sendEmailViaNaverSmtp({ to, subject, htmlBody }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(SMTP_PORT, SMTP_HOST, () => {});
    socket.setEncoding('utf8');

    let step = 0;
    const fullUser = NAVER_USER.includes('@') ? NAVER_USER : `${NAVER_USER}@naver.com`;
    const usernameOnly = NAVER_USER.replace(/@naver\.com$/, '');
    const recipient = to || NOTIFY_RECEIVER;

    const timer = setTimeout(() => {
      try { socket.destroy(); } catch (e) {}
      reject(new Error('SMTP connection timeout'));
    }, 10000);

    socket.on('data', data => {
      const code = data.substring(0, 3);

      if (code === '220' && step === 0) {
        step = 1;
        socket.write('EHLO localhost\r\n');
      } else if (code === '250' && step === 1) {
        step = 2;
        socket.write('AUTH LOGIN\r\n');
      } else if (code === '334' && step === 2) {
        step = 3;
        socket.write(Buffer.from(usernameOnly).toString('base64') + '\r\n');
      } else if (code === '334' && step === 3) {
        step = 4;
        socket.write(Buffer.from(NAVER_PASS).toString('base64') + '\r\n');
      } else if (code === '235' && step === 4) {
        step = 5;
        socket.write(`MAIL FROM:<${fullUser}>\r\n`);
      } else if (code === '250' && step === 5) {
        step = 6;
        socket.write(`RCPT TO:<${recipient}>\r\n`);
      } else if (code === '250' && step === 6) {
        step = 7;
        socket.write('DATA\r\n');
      } else if (code === '354' && step === 7) {
        step = 8;
        const msg = [
          `From: =?UTF-8?B?${Buffer.from('토닥토닥노트 시스템').toString('base64')}?= <${fullUser}>`,
          `To: <${recipient}>`,
          `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
          '',
          Buffer.from(htmlBody).toString('base64'),
          '.',
          ''
        ].join('\r\n');
        socket.write(msg);
      } else if (code === '250' && step === 8) {
        clearTimeout(timer);
        socket.end('QUIT\r\n');
        resolve({ success: true });
      } else if (parseInt(code, 10) >= 400) {
        clearTimeout(timer);
        socket.end('QUIT\r\n');
        reject(new Error(`SMTP Error (${code}): ${data.trim()}`));
      }
    });

    socket.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email, doctorName, hospitalName, phone, plan } = req.body || {};

    if (!email || !hospitalName) {
      return res.status(400).json({ error: '가입자 정보가 누락되었습니다.' });
    }

    const now = new Date();
    // 한국 시간 (KST: UTC+9) 형식 변환
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    const dateStr = kstDate.toISOString().replace('T', ' ').substring(0, 19);

    const planLabel = (plan || 'Pro').toLowerCase() === 'pro' ? '⭐ 고급형(Pro)' : '🟢 기본형(Standard)';

    const subject = `🎉 [토닥토닥노트] 신규 원장님 가입 알림 - ${hospitalName} (${doctorName || '원장'})`;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%); padding: 28px 24px; color: white;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800;">🎉 신규 회원가입 알림</h2>
          <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">토닥토닥노트에 새로운 병원 원장님이 가입하셨습니다.</p>
        </div>

        <div style="padding: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14.5px;">
            <tr>
              <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; width: 110px; font-weight: 600;">병원명</td>
              <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 700; font-size: 16px;">🏥 ${hospitalName}</td>
            </tr>
            <tr>
              <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-weight: 600;">원장님</td>
              <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 700;">👨‍⚕️ ${doctorName || '원장'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-weight: 600;">아이디(이메일)</td>
              <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #0284c7; font-weight: 600;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-weight: 600;">병원 연락처</td>
              <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 600;">${phone || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-weight: 600;">가입 플랜</td>
              <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 800;">${planLabel}</td>
            </tr>
            <tr>
              <td style="padding: 12px 10px; color: #64748b; font-weight: 600;">가입 일시</td>
              <td style="padding: 12px 10px; color: #475569; font-weight: 600;">${dateStr} (KST)</td>
            </tr>
          </table>

          <div style="margin-top: 24px; text-align: center;">
            <a href="https://todak-note.vercel.app/master.html" target="_blank" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px;">
              👑 마스터 관리자 대시보드 열기
            </a>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 14px 20px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9;">
          토닥토닥노트 실시간 가입 알림 시스템 · 수신: ${NOTIFY_RECEIVER}
        </div>
      </div>
    `;

    await sendEmailViaNaverSmtp({
      to: NOTIFY_RECEIVER,
      subject,
      htmlBody
    });

    return res.status(200).json({ success: true, message: '알림 이메일 발송 완료' });
  } catch (err) {
    console.error('가입 알림 이메일 발송 오류:', err);
    // 가입 자체는 성공해야 하므로 메일 오류는 로그만 남기고 200/500 분기 처리
    return res.status(500).json({ success: false, error: err.message });
  }
};
