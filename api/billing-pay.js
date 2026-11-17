// 포트원(PortOne) V2 + 토스페이먼츠 빌링키 결제 API
const https = require('https');

const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET || 'I0pSzITbHmNNqFfa0hu9IpXwsHHkpV192iOz6JY2nN8Hu5UcSFYN3h2zVWq9kRNpaHF7PQPy8b5utJWT';
const PORTONE_STORE_ID = process.env.PORTONE_STORE_ID || 'store-ed701368-813e-452d-9b65-a9ae72006521';
const PORTONE_CHANNEL_KEY = process.env.PORTONE_CHANNEL_KEY || 'channel-key-d7e78062-c4a7-493a-9ef2-3c464a23b916';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // 1. 설정 정보 조회 (프론트엔드 SDK 초기화용)
  if (req.method === 'GET') {
    res.status(200).json({
      storeId: PORTONE_STORE_ID,
      channelKey: PORTONE_CHANNEL_KEY
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { billingKey, orderName, amount, customerEmail, customerName, customerPhone } = req.body || {};

    if (!billingKey) {
      res.status(400).json({ error: 'billingKey가 필요합니다.' });
      return;
    }

    const payAmount = Number(amount) || 89000;
    const paymentId = `todak-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const postData = JSON.stringify({
      channelKey: PORTONE_CHANNEL_KEY,
      orderName: orderName || '토닥토닥노트 정기구독',
      billingKey: billingKey,
      amount: {
        total: payAmount
      },
      currency: 'KRW',
      customer: {
        id: customerEmail || 'guest',
        name: {
          full: customerName || '원장'
        },
        email: customerEmail || 'doctor@hospital.com',
        phoneNumber: customerPhone || '010-0000-0000'
      }
    });

    const options = {
      hostname: 'api.portone.io',
      port: 443,
      path: `/payments/${encodeURIComponent(paymentId)}/billing-key`,
      method: 'POST',
      headers: {
        'Authorization': `PortOne ${PORTONE_API_SECRET}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const portoneReq = https.request(options, portoneRes => {
      let data = '';
      portoneRes.on('data', chunk => { data += chunk; });
      portoneRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (portoneRes.statusCode >= 400 || parsed.code) {
            res.status(400).json({
              error: parsed.message || '결제 승인 실패',
              details: parsed
            });
            return;
          }
          res.status(200).json({
            success: true,
            paymentId: paymentId,
            result: parsed
          });
        } catch (e) {
          res.status(200).json({ success: true, paymentId, raw: data });
        }
      });
    });

    portoneReq.on('error', err => {
      res.status(500).json({ error: err.message });
    });

    portoneReq.write(postData);
    portoneReq.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

