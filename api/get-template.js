const https = require('https');
const crypto = require('crypto');

const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || 'NCSK8Y3GEABTX0B0KKZJU8';
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || 'ANWFHRCJW1UD3OTT9TBJTO2XEQ1N3GED';
const KAKAO_TEMPLATE_ID = process.env.KAKAO_TEMPLATE_ID || 'KA01TP261113053545740Y0kVMg3uuuG';

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
  const templateId = req.query.id || KAKAO_TEMPLATE_ID;

  const options = {
    hostname: 'api.solapi.com',
    port: 443,
    path: `/kakao/v2/templates/sendable?templateId=${encodeURIComponent(templateId)}`,
    method: 'GET',
    headers: {
      'Authorization': getSolapiAuthHeader()
    }
  };

  const solapiReq = https.request(options, solapiRes => {
    let data = '';
    solapiRes.on('data', chunk => { data += chunk; });
    solapiRes.on('end', () => {
      try {
        res.status(200).json(JSON.parse(data));
      } catch (e) {
        res.status(200).send(data);
      }
    });
  });

  solapiReq.on('error', err => {
    res.status(500).json({ error: err.message });
  });

  solapiReq.end();
};
