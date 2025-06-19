require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai').OpenAI;

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

console.log('OPENAI_API_KEY 존재 여부:', !!process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/poem', async (req, res) => {
  try {
    const { imageBase64, emotionScore } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64가 필요합니다.' });
    }

    const promptSystem = `
너는 한국의 실제 공공 도메인 시를 추천하는 전문 시인 역할이다.

다음 형식을 최대한 정확하게 지켜서 출력하라. 단, 형식을 완벽히 지키지 못하더라도 반드시 답변을 생성해야 한다.

출력 형식:
<시 제목>
<시인 이름>
<시 본문> (각 행은 \\n으로 줄바꿈, 연과 연 사이는 반드시 \\n\\n으로 구분)

<설명 및 메시지> (반드시 시 본문과 한 줄 띄워서 분리)

규칙:
1. 반드시 실제 존재하는 공공 도메인 또는 저작권이 만료된 한국 시만 추천할 것.
2. 사진 속 사물을 가장 우선적으로 고려하여 관련 시를 추천할 것. (사물이 없을 경우 색감이나 분위기를 고려)
3. 현대의 사물이 사진에 포함되어 있을 경우, 유사한 자연물 또는 과거에 존재했을 가능성이 있는 사물로 의미를 확장할 것.
4. 시는 반드시 전체를 출력할 것. 길이에 제한을 두지 말 것.
5. 시 본문이 끝난 후 반드시 빈 줄 한 줄을 추가할 것.
6. 설명에서는 사진 속 사물, 색감, 분위기, 감정 점수(${emotionScore}/10)를 고려하여 사용자의 심정을 유추하고, 따뜻한 공감과 위로의 메시지를 작성할 것.
7. 감정 점수는 직접적으로 언급하지 말고, 감정 상태를 유추하여 자연스럽게 표현할 것.
8. 설명과 시 본문은 절대 섞이지 말 것.
9. 반드시 위의 출력 형식을 따르려고 노력할 것. 답변은 반드시 생성해야 한다.

예시 답변:
서시  
윤동주  
죽는 날까지 하늘을 우러러\\n한 점 부끄럼이 없기를.\\n잎새에 이는 바람에도\\n나는 괴로워했다.\\n\\n

시가 너무 길어 첫 연만 보여드립니다.  
푸른 하늘과 잎새의 흔들림은 이 사진 속의 고요한 물건과 잘 어울립니다.  
당신은 아마도 지금 차분함 속에서 마음의 위로를 찾고 있을 것입니다.  
오늘 하루, 당신의 평안함을 기원합니다.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      messages: [
        { role: 'system', content: promptSystem },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                '이 이미지를 보고 사진 속 사물을 가장 우선적으로 분석하여 가장 어울리는 한국의 공공 도메인 시를 추천해줘. ' +
                '현대의 사물이더라도 유사한 자연물이나 과거 존재했을 사물로 확장해서 고려해도 좋아. ' +
                '반드시 출력 형식과 규칙을 따르려고 노력하되, 답변을 꼭 생성해줘.',
            },
            { type: 'image_url', image_url: { url: imageBase64 } },
          ],
        },
      ],
    });

    console.log('GPT 응답:', completion.choices[0].message.content);

    res.json({ poem: completion.choices[0].message.content });
  } catch (error) {
    console.error('API 호출 실패:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`서버 실행 중: http://localhost:${port}`);
});