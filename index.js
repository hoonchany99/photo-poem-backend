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
    const { imageBase64, moodTag, story } = req.body;

    if ((!imageBase64 && (!story || story.trim() === '')) && (!moodTag || moodTag.trim() === '')) {
      return res.status(400).json({ error: '사진, 사연, 감정 중 하나는 반드시 필요합니다.' });
    }

    // 감정 점수 대신 moodTag(기분 태그) 설명 포함
    const promptSystem = `
너는 한국의 실제 시를 추천하는 전문 시인 역할이다.

다음 조건을 반드시 지켜라:

1. 반드시 1950년대 이전에 출판되어 저작권이 만료된 한국 시집에 수록된 시만 추천할 것.

2. 시는 반드시 다음 순서로 작성할 것:
   - 첫 줄: 시 제목
   - 둘째 줄: 시인 이름
   - 셋째 줄부터: 시 본문 (각 행은 \\n 으로 줄바꿈, 연과 연 사이는 반드시 \\n\\n 으로 구분)

3. 시 본문은 반드시 전체를 출력할 것.

4. 시 본문이 끝난 후 반드시 빈 줄 하나를 추가할 것.

5. 이후 시에 대한 설명과, 사용자가 올린 사진, 작성한 사연("${story}"), 선택한 기분("${moodTag}")을 최대한 반영하여, 시와 어울리는 이유와 사진을 올린 사람의 심정을 추측해 격려, 위로, 응원의 말을 자연스럽게 작성할 것.

6. 설명과 시가 절대 섞이지 않도록 분리해서 작성할 것.

7. 링크, 코드블록, 따옴표 등 특수문자는 포함하지 말 것.

8. 사람 관련 정보(얼굴, 나이, 성별 등)는 절대 언급하지 말 것.

9. 1950년대 이전 시이므로 현대 사물과 완벽히 맞지 않을 수 있으나, 최대한 시와 사진, 사연, 기분 사이의 관련성을 고려하여 추천할 것.

10. 반드시 아래 형식을 정확히 준수할 것.

아래는 예시 답변 형식이다:

서시  
윤동주  
죽는 날까지 하늘을 우러러\\n한 점 부끄럼이 없기를.\\n잎새에 이는 바람에도\\n나는 괴로워했다.\\n\\n

이 시는 자신의 삶을 성찰하며 주어진 길을 묵묵히 걸어가겠다는 다짐을 담고 있습니다.  
사진과 사용자의 기분, 사연을 반영하여, 사진을 올린 분께도 이 시처럼 힘들고 어려운 상황 속에서도 흔들리지 않고 앞으로 나아가길 응원합니다.
`;

    const messages = [
      { role: 'system', content: promptSystem },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              '이 이미지를 보고 사물, 색감, 분위기를 분석하여 가장 어울리는 한국의 저작권 만료된 공공 도메인 시를 추천해줘. ' +
              '사람 관련 정보는 절대 언급하지 말고, 사람은 존재하지 않는다고 가정할 것. ' +
              '링크는 절대 포함하지 말 것. ' +
              '출력 형식은 반드시 위 시스템 프롬프트 조건을 따를 것. ' +
              `사용자의 기분 태그는 "${moodTag}"임을 참고하라.` +
              `사용자의 현재 사연은 "${story}"임을 참고하라.`,
          },
        ],
      },
    ];

    if (imageBase64) {
      messages[1].content.push({ type: 'image_url', image_url: { url: imageBase64 } });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      messages,
    });

    console.log('GPT 응답:', completion.choices[0].message.content);

    res.json({ poem: completion.choices[0].message.content });
  } catch (error) {
    console.error('API 호출 실패:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`서버 실행 중: http://localhost:${port}`);
});