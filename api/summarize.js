const https = require('https');

module.exports = async (req, res) => {
  // CORS 설정
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
    const { apiKey, transcript, patientInfo } = req.body || {};
    const patientNameClean = (patientInfo || '환자').replace(/\s*\(.*?\)/, '').trim();

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDate = now.getDate();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const currentDay = days[now.getDay()];

    const systemPrompt = `당신은 의사와 환자의 진료실 대화 내용을 분석하여 환자(${patientNameClean}) 맞춤 안심 진료 리포트를 작성하는 전문 의료 AI 어시스턴트입니다.

오늘 기준 날짜는 ${currentYear}년 ${currentMonth}월 ${currentDate}일(${currentDay}요일)입니다.

[★ 최우선 필수 검증 단계: 실제 환자 진료 대화 여부 판별]
먼저 입력된 텍스트가 실제로 의사와 환자가 나눈 "의료/진료 관련 대화"인지 엄격하게 판별하세요.
다음과 같은 경우는 실제 진료 대화가 아닙니다:
- 원장님과 간호사/직원 간의 업무 지시나 잡담 (예: "김 간호사 오늘 주문한 거 언제 들어온대", "비품 다 떨어졌어요")
- 병원 내부 행정, 점심 메뉴, 안부 인사, 의미 없는 말소리 파편 (예: "사람들이 막", "오늘 날씨 좋네")
- 환자의 구체적인 증상(통증, 불편함 등)이나 의사의 진단/처방/복약 안내가 전혀 없는 경우

위와 같이 진료 대화가 아닌 경우, 절대로 억지로 내용을 상상해서 채우지 말고 반드시 아래와 같이 응답하세요:
{
  "isMedicalDialogue": false,
  "reason": "원장님/직원 간의 대화 또는 진료와 무관한 일상 대화로 감지되었습니다. 실제 환자 진료 대화를 녹음해 주세요."
}

[진료 대화가 확실할 때만 작성 규칙]
대화에 환자의 질환, 증상, 진단, 처방약 또는 진료 지침 중 최소 하나 이상이 명확히 포함된 경우에만 아래 형식으로 작성하세요:
{
  "isMedicalDialogue": true,
  "greeting": "${patientNameClean}, 오늘 진료받으시느라 수고 많으셨습니다. 빠른 쾌유를 위해 진료 내용을 정리해 드립니다.",
  "diagnosisSummary": "대화에 언급된 실제 진단과 환자 상태 요약 (대화에 없는 내용 지어내지 말 것)",
  "medicationGuide": "대화에 언급된 약 복용법 (약 언급이 없으면 '처방전 및 약국의 복약 안내를 참고해 주세요')",
  "lifestyleCare": [
    "대화에 기반한 생활 관리 수칙 1",
    "대화에 기반한 생활 관리 수칙 2"
  ],
  "nextVisitDate": "대화에 언급된 재방문일 (언급 없으면 '불편한 증상 지속 시 내원')",
  "cheeringMessage": "환자를 위한 따뜻한 응원 한마디"
}`;
  ],
  "nextVisitDate": "재방문 권장 일자 (예: ${currentMonth}월 12일(목) 또는 증상 지속 시 내원)",
  "cheeringMessage": "환자의 빠른 쾌유를 진심으로 응원하는 따뜻한 마무리 문장 (1~2문장)"
}`;

    const payload = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `[환자 정보: ${patientInfo || '김영희 님'}]\n\n[진료실 실제 대화 녹음 스크립트]:\n${transcript}` }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const openAiApiKey = apiKey || process.env.OPENAI_API_KEY;

    if (!openAiApiKey) {
      res.status(400).json({ error: 'OpenAI API 키가 필요합니다.' });
      return;
    }

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const gptReq = https.request(options, gptRes => {
      let gptData = '';
      gptRes.on('data', chunk => { gptData += chunk; });
      gptRes.on('end', () => {
        try {
          const parsed = JSON.parse(gptData);
          if (parsed.choices && parsed.choices[0]) {
            const resultJson = JSON.parse(parsed.choices[0].message.content);
            res.status(200).json(resultJson);
          } else {
            res.status(500).json({ error: 'AI 응답 파싱 실패', raw: parsed });
          }
        } catch (e) {
          res.status(500).json({ error: e.message });
        }
      });
    });

    gptReq.on('error', err => {
      res.status(500).json({ error: err.message });
    });

    gptReq.write(payload);
    gptReq.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

