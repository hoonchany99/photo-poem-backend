require('dotenv').config();
// routes/image.js
const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'image';

const sanitizeFileName = (name) => {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_.]/g, '_');
};

const router = express.Router();
const upload = multer(); // 메모리 저장

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '이미지 파일이 없습니다.' });
    }

    const buffer = req.file.buffer;
    const safeName = sanitizeFileName(req.file.originalname);
    const fileName = `${Date.now()}_${uuidv4()}_${safeName}`;

    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ error: 'Supabase 이미지 업로드 실패', details: uploadError.message });
    }

    const { data: publicData, error: urlError } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    if (urlError) {
      console.error('Supabase getPublicUrl error:', urlError);
      return res.status(500).json({ error: '공개 URL 생성 실패', details: urlError.message });
    }

    res.json({ publicUrl: publicData.publicUrl, fileName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '이미지 업로드 실패' });
  }
});

module.exports = router;