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
    const { to, text, patientName, reportUrl } = req.body || {};
    const recipientPhone = (to || '').replace(/[^0-9]/g, '');

    if (!recipientPhone) {
      res.status(400).json({ error: '수신자 전화번호가 올바르지 않습니다.' });
      return;
    }

    const host = req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const fullReportUrl = reportUrl || `${protocol}://${host}/index.html`;

    const smsMessageText = text || `[토닥토닥노트] 안녕하세요 ${patientName || '환자'}님, 오늘 진료받으시느라 수고 많으셨습니다.\n\n원장님이 챙겨드리는 맞춤 진료 요약과 복약 안내 리포트가 도착했습니다.\n\n▶ 안심 리포트 보기:\n${fullReportUrl}`;

    const isLms = Buffer.byteLength(smsMessageText, 'euc-kr') > 90 || smsMessageText.length > 70;
    const msgType = isLms ? 'LMS' : 'SMS';

    const payload = JSON.stringify({
      messages: [
        {
          to: recipientPhone,
          from: SENDER_PHONE,
          text: smsMessageText,
          type: msgType,
          subject: isLms ? `[토닥토닥노트] ${patientName || '환자'}님 맞춤 진료 리포트` : undefined
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

