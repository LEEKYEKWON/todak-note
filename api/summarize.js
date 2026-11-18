const https = require('https');

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

[중요 검증 지침]
1. 입력된 대화가 실제 의사와 환자의 진료 대화인지 판단하세요.
2. 직원/간호사 간의 업무 지시나 잡담, 점심 메뉴, 의미 없는 말소리 파편 등 진료와 무관한 경우 반드시 "isMedicalDialogue": false 로 작성하세요.
3. 실제 진료 대화인 경우 "isMedicalDialogue": true 로 작성하세요.
4. 녹음 음성 특성상 오타나 부정확한 단어(예: "화가 가면서" ➔ "항암치료 하면서")가 있더라도, 전후 문맥을 고려하여 실제 의학적 맥락을 지능적으로 바르게 파악하세요.
5. [★핵심: 요약의 깊이와 풍성함]
   - 대화 분량에 맞춰 환자가 알아야 할 중요한 내용(현재 질환 상태, 검사/치료 경과, 향후 치료 계획, 부작용 및 대처법 등)을 절대 누락하지 마세요.
   - 단순 2~3줄로 축약하지 말고, 원장님이 설명해 주신 핵심 포인트를 문단이나 번호/글머리 기호(▶, •)로 알기 쉽게 정리하여 풍성하고 정성스럽게 작성하세요.
   - 단, 대화에 전혀 없는 가상의 진단이나 약물을 지어내지는 마세요.
6. 반드시 유효한 순수 JSON 객체 하나만 출력하세요.

JSON 출력 포맷:
{
  "isMedicalDialogue": true 또는 false,
  "reason": "isMedicalDialogue가 false일 때의 사유",
  "greeting": "${patientNameClean}, 오늘 진료받으시느라 수고 많으셨습니다. 빠른 쾌유를 위해 오늘 진료 내용을 자세히 정리해 드립니다.",
  "diagnosisSummary": "대화에 언급된 실제 진단, 치료 경과, 환자 상태에 대한 상세하고 친절한 설명 (중요 포인트별로 줄바꿈하여 읽기 쉽게 작성)",
  "medicationGuide": "대화에 언급된 약 복용 안내. 만약 대화 중 구체적인 복약 언급이 없다면 차갑게 '언급 없음'이라고 쓰지 말고 '오늘 맞춤 처방된 약의 정확한 복용 시간과 식전/식후 안내는 원외 약국 조제 시 약 봉투의 복약 안내문을 확인해 주세요.'와 같이 친절하게 작성하세요.",
  "lifestyleCare": [
    "대화에서 원장님이 권고한 식습관/운동/생활 수칙 1",
    "생활 수칙 2",
    "생활 수칙 3"
  ],
  "nextVisitDate": "대화에 언급된 다음 내원/치료 일자. 만약 구체적인 날짜 언급이 없다면 '진료 후 수납 데스크에서 다음 진료 예약 및 일정을 안내해 드립니다.'와 같이 데스크 안내 멘트로 작성하세요.",
  "cheeringMessage": "환자의 빠른 쾌유와 회복을 진심으로 응원하는 따뜻한 격려 문장"
}`;

    const payload = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `[환자 정보: ${patientInfo || '김영희 님'}]\n\n[진료실 실제 대화 녹음 스크립트]:\n${transcript}` }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    // 서버 기본 키 또는 클라이언트 전달 키
    const openAiApiKey = (apiKey && apiKey.startsWith('sk-')) ? apiKey : (process.env.OPENAI_API_KEY || '');

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
          if (parsed.error) {
            res.status(400).json({ error: parsed.error.message || 'OpenAI API 오류', details: parsed.error });
            return;
          }
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            const rawContent = parsed.choices[0].message.content;
            // JSON 마크다운 코드블록 제거 안전망
            const cleaned = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
            const resultJson = JSON.parse(cleaned);
            res.status(200).json(resultJson);
          } else {
            res.status(500).json({ error: 'AI 응답 형식이 올바르지 않습니다.', raw: parsed });
          }
        } catch (e) {
          res.status(500).json({ error: `응답 파싱 오류: ${e.message}`, raw: gptData });
        }
      });
    });

    gptReq.on('error', err => {
      res.status(500).json({ error: `통신 장애: ${err.message}` });
    });

    gptReq.write(payload);
    gptReq.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
