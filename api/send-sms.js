const https = require('https');
const crypto = require('crypto');

const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || 'NCSK8Y3GEABTX0B0KKZJU8';
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || 'ANWFHRCJW1UD3OTT9TBJTO2XEQ1N3GED';
const SENDER_PHONE = process.env.SENDER_PHONE || '01093442378';

function getSolapiAuthHeader() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', SOLAPI_API_SECRET)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { to, receiverPhone, text, patientName, reportUrl, hospitalName, summary, medication, nextDate } = req.body || {};
    const recipientPhone = (to || receiverPhone || '').replace(/[^0-9]/g, '');

    if (!recipientPhone) {
      res.status(400).json({ error: '수신자 전화번호가 올바르지 않습니다.' });
      return;
    }

    const host = req.headers.host || 'todak-note.vercel.app';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const finalReportUrl = reportUrl || `${protocol}://${host}/report.html`;

    const currentHosp = hospitalName || '연세바른내과의원';
    const currentPatient = patientName || '환자';

    let msgText = text;
    if (!msgText) {
      msgText = `[${currentHosp}]
${currentPatient}님, 안심 진료노트가 도착했습니다.

▶ 진료요약: ${summary ? summary.slice(0, 70) + '...' : '정상 소견'}
▶ 처방복약: ${medication ? medication.slice(0, 50) : '처방전 참고'}
▶ 다음내원: ${nextDate || '필요시 내원'}

아래 링크를 누르시면 큰 글씨 리포트와 일상 건강수칙을 확인하실 수 있습니다.
👉 진료 리포트 보기:
${finalReportUrl}`;
    }

    const isLms = Buffer.byteLength(msgText, 'euc-kr') > 90 || msgText.length > 70;
    const msgType = isLms ? 'LMS' : 'SMS';

    const payload = JSON.stringify({
      messages: [
        {
          to: recipientPhone,
          from: SENDER_PHONE,
          text: msgText,
          type: msgType,
          subject: isLms ? `[${currentHosp}] ${currentPatient}님 안심 진료 리포트` : undefined
        }
      ]
    });

    const options = {
      hostname: 'api.solapi.com',
      port: 443,
      path: '/messages/v4/send-many/detail',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getSolapiAuthHeader(),
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const solapiReq = https.request(options, solapiRes => {
      let solapiData = '';
      solapiRes.on('data', chunk => { solapiData += chunk; });
      solapiRes.on('end', () => {
        try {
          const parsed = JSON.parse(solapiData);
          if (solapiRes.statusCode >= 400 || parsed.errorCode || parsed.errorMessage) {
            res.status(400).json({
              error: parsed.errorMessage || parsed.message || `솔라피 오류 (${solapiRes.statusCode})`,
              details: parsed
            });
            return;
          }
          res.status(200).json({ success: true, type: msgType, solapi: parsed });
        } catch (e) {
          res.status(200).json({ success: true, raw: solapiData });
        }
      });
    });

    solapiReq.on('error', err => {
      res.status(500).json({ error: err.message });
    });

    solapiReq.write(payload);
    solapiReq.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
