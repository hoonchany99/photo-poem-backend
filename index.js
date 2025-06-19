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

const publicDomainPrompt = `
너는 한국의 실제 시를 추천하는 전문 시인 역할이다.

다음 조건을 반드시 지켜라:
1. 반드시 공공 도메인으로 저작권이 완전히 소멸된 한국 시만 추천할 것. 예: 윤동주, 김소월, 한용운, 정지용, 이상 등 1950년 이전 시인의 시만 추천.
2. 시는 반드시 다음 순서로 작성할 것:
   - 첫 줄: 시 제목
   - 둘째 줄: 시인 이름
   - 셋째 줄부터: 시 본문 (각 행은 \\n 으로 줄바꿈, 연과 연 사이는 반드시 \\n\\n 으로 구분)
3. 시가 너무 길 경우, 첫 연만 보여주고 반드시 “시가 너무 길어 첫 연만 보여드립니다.”라는 문구를 시에 대한 설명 앞부분에 반드시 포함할 것.
4. 시 본문이 끝난 후 빈 줄 하나를 추가할 것.
5. 이후 시에 대한 설명과 사용자의 감정 점수(0~10)에 어울리는 메시지를 자연스럽게 작성할 것.
6. 반드시 사진 속 사물 및 분위기와 감정 점수를 고려하여 적합한 시를 추천할 것.
7. 설명과 시가 절대 섞이지 않도록 분리해서 작성할 것.
8. 링크, 코드블록, 따옴표 등 특수문자는 포함하지 말 것.
9. 사람 관련 정보(얼굴, 나이, 성별 등)는 절대 언급하지 말 것.
10. 만약 저작권 있는 시를 추천하면 안 된다고 즉시 알리고 다시 추천해달라고 요청할 것.

아래는 예시 답변 형식이다:

서시  
윤동주  
죽는 날까지 하늘을 우러러\\n한 점 부끄럼이 없기를.\\n잎새에 이는 바람에도\\n나는 괴로워했다.\\n\\n

시가 너무 길어 첫 연만 보여드립니다. 이 시는 자신의 삶을 성찰하며 주어진 길을 묵묵히 걸어가겠다는 다짐을 담고 있습니다. 이미지 속의 따뜻하고 고요한 분위기와 잘 어울리며, 감정 점수가 3인 당신의 현재 잔잔한 마음에 잘 맞는 시입니다.
`;

app.post('/poem', async (req, res) => {
  try {
    const { imageBase64, emotionScore, retryCount = 0 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64가 필요합니다.' });
    }

    if (retryCount > 3) {
      return res.status(400).json({ error: '시 생성 재시도 한도 초과' });
    }

    // 1차 요청: 시 추천
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      messages: [
        { role: 'system', content: publicDomainPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `이 이미지를 보고 색감, 사물, 분위기를 분석하여 가장 어울리는 공공 도메인 한국의 시를 추천해줘. ` +
                `사람에 대한 정보는 절대 언급하지 말고, 사람은 존재하지 않는다고 가정할 것. ` +
                `감정 점수는 ${emotionScore} (0~10, 0은 잔잔한 상태, 10은 흥분된 상태)이며, 이에 맞는 시를 추천할 것. ` +
                `시가 너무 길면 첫 연만 보여주고, 그 사실을 반드시 명시할 것. ` +
                `링크는 절대 포함하지 말 것. ` +
                `출력 형식은 반드시 위 시스템 프롬프트 조건을 따를 것.`,
            },
            { type: 'image_url', image_url: { url: imageBase64 } },
          ],
        },
      ],
    });

    const responseText = completion.choices[0].message.content;

    // 저작권 있는 시 추천 시 재요청 처리
    if (
      /저작권|권리|소유권|권한|공공 도메인|저작권이 없|재추천|다시 추천/i.test(responseText) ||
      /저작권.*문제/i.test(responseText)
    ) {
      if (retryCount < 3) {
        // 재요청
        const retryCompletion = await openai.chat.completions.create({
          model: 'gpt-4o',
          temperature: 0.7,
          messages: [
            { role: 'system', content: publicDomainPrompt },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text:
                    `이전에 저작권 문제가 있는 시를 추천했습니다. ` +
                    `다시 공공 도메인 한국 시만 엄격히 추천해주세요. ` +
                    `감정 점수는 ${emotionScore} (0~10)이며, 시와 사진의 관련성을 최대한 고려해 주세요.`,
                },
                { type: 'image_url', image_url: { url: imageBase64 } },
              ],
            },
          ],
        });

        return res.json({ poem: retryCompletion.choices[0].message.content });
      } else {
        return res.status(400).json({ error: '적절한 시를 찾지 못했습니다. 다시 시도해 주세요.' });
      }
    }

    // 정상 응답
    res.json({ poem: responseText });
  } catch (error) {
    console.error('API 호출 실패:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`서버 실행 중: http://localhost:${port}`);
});