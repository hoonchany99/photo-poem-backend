const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const OpenAI = require('openai').OpenAI;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post('/recommend', async (req, res) => {
  try {
    const { imageUrl, base64Image, queryText, moodTag } = req.body;

    if ((!imageUrl && !base64Image) && (!queryText || queryText.trim().length === 0) && (!moodTag || moodTag.trim().length === 0)) {
      return res.status(400).json({ error: '사진, 사연, 또는 감정 태그 중 하나는 반드시 입력해야 합니다.' });
    }

    // 1) 사진이 있으면 GPT-4 Vision 모델로 이미지 설명 생성 (imageUrl만 지원, base64Image는 미지원 표시)
    let caption = '';
    if (imageUrl) {
      const messagesForImageCaption = [
        { role: 'system', content: 'You are a helpful assistant that describes images in concise Korean.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: '이 이미지를 간단하게 설명해줘.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ];

      const imageCaptionResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messagesForImageCaption,
        temperature: 0,
      });

      caption = imageCaptionResponse.choices[0].message.content.trim();
    } else if (base64Image) {
      caption = '[이미지 설명 불가: base64 이미지 데이터는 현재 지원되지 않습니다]';
    }

    // 2) 사진 설명 + story + moodTag 를 합쳐서 임베딩 텍스트 생성
    let queryForEmbedding = '';
    if (caption) queryForEmbedding += caption;
    if (queryText) queryForEmbedding += (queryForEmbedding ? ' ' : '') + queryText;
    if (moodTag) queryForEmbedding += (queryForEmbedding ? ' ' : '') + moodTag;

    console.log(queryForEmbedding);

    if (!queryForEmbedding.trim()) {
      return res.status(400).json({ error: '임베딩에 사용할 텍스트가 없습니다.' });
    }

    // 3) 임베딩 생성
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryForEmbedding,
    });

    let embedding = embeddingResponse.data[0].embedding;

    if (!Array.isArray(embedding)) {
      try {
        embedding = JSON.parse(embedding);
      } catch (e) {
        console.error('임베딩 JSON 파싱 실패:', e);
        return res.status(500).json({ error: '임베딩 데이터 형식 오류' });
      }
    }

    if (!Array.isArray(embedding)) {
      console.error('임베딩 데이터가 배열이 아닙니다.');
      return res.status(500).json({ error: '임베딩 데이터가 배열이 아닙니다.' });
    }

    const pgVectorString = '[' + embedding.join(',') + ']';

    // 4) DB에서 유사도 검색
    const result = await pool.query(
      `SELECT id, title, author, excerpt, source
       FROM poems
       ORDER BY embedding <#> $1::vector
       LIMIT 3`,
      [pgVectorString]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '추천할 시가 없습니다.' });
    }

    console.log(result);

    // 5) GPT에게 3개 시 중 가장 어울리는 시 하나 선택 요청
    const gptMessages = [
      {
        role: 'system',
        content: `너는 한국 시에 정통한 AI 전문가야. 아래 조건들을 고려해 3개의 시 중에서 사용자에게 가장 잘 어울리는 하나를 선택해.`,
      },
      {
        role: 'user',
        content:
          `사용자의 입력 정보는 다음과 같아:\n\n` +
          `사진 설명: ${caption || '없음'}\n` +
          `사연 또는 텍스트: ${queryText || '없음'}\n` +
          `기분 태그: ${moodTag || '없음'}\n\n` +
          `아래는 추천된 3개의 시야:\n\n` +
          result.rows.map((row, idx) =>
            `(${idx + 1}) 시 제목: ${row.title}, 시인: ${row.author}\n` +
            `내용: ${row.excerpt}\n출처: ${row.source}`
          ).join('\n\n') +
          `\n\n이 중에서 가장 어울리는 시 하나만 골라줘.`+
          `\n\n반드시 추천된 시 그대로 출력할 것. 아래의 출력 순서를 철저히 지킬 것. 출력 순서가 어긋나면 오답으로 간주한다:\n`+
          `- 반드시 첫 줄: 시 제목 (시 제목만)\n`+
          `- 반드시 둘째 줄: 시인 이름 (시인 이름만)\n`+
          `- 반드시 셋째 줄부터: 시 본문 (각 행은 \\n 으로 줄바꿈, 연과 연 사이는 반드시 \\n\\n 으로 구분)\n`+
          `- 시 내용이 끝난 후 반드시 빈 줄 한 줄을 포함할 것.\n`+
          `- 그 다음: 왜 이 시를 골랐는지 사진 설명, 사연 또는 텍스트 그리고 기분 태그와 연관지어 설명 (시와 설명 사이 반드시 빈 줄 포함)\n`+
          `- 설명 마지막 줄에 반드시 출처를 명시할 것. 출처는 설명 뒷부분에 자연스럽게 이어붙일 것.`,
      },
    ];

    const finalChoice = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: gptMessages,
      temperature: 0.3,
    });

    const finalText = finalChoice.choices[0].message.content;
    console.log('GPT 최종 응답 텍스트:', finalText);

    res.json({ poemText: finalText });
  } catch (err) {
    console.error('추천 API 오류:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;