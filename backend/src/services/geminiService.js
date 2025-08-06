const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const wav = require('wav'); // Залежність для роботи з WAV-файлами

// Список голосів, підтримуваних TTS-моделями
const GEMINI_VOICES = [
  "Zephyr","Puck","Charon","Kore","Fenrir","Leda","Orus","Aoede","Callirrhoe",
  "Autonoe","Enceladus","Iapetus","Umbriel","Algieba","Despina","Erinome",
  "Algenib","Rasalgethi","Laomedeia","Achernar","Alnilam","Schedar","Gacrux",
  "Pulcherrima","Achird","Zubenelgenubi","Vindemiatrix","Sadachbia",
  "Sadaltager","Sulafat"
];

class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_key_here') {
      console.warn('⚠️  Gemini API ключ не налаштовано! Використовую демо-режим.');
      this.demoMode = true;
    } else {
      console.log('✅ Gemini API ключ знайдено, працюємо в повному режимі');
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      
      // Використовуємо точну модель для TTS з офіційної документації
      this.ttsModel = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-tts" });
      
      // Окрема модель для текстових завдань
      this.textModel = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" }); 
      
      this.demoMode = false;
    }
  }

  getAvailableVoices() {
    return GEMINI_VOICES.map(voice => ({
      name: voice,
      gender: 'SSML_VOICE_GENDER_UNSPECIFIED'
    }));
  }

  async generateAudio(text, options = {}) {
    if (this.demoMode) {
      throw new Error("Генерація аудіо недоступна в демо-режимі.");
    }

    const {
      instruction = '',
      voiceName = 'Kore' // Голос за замовчуванням з документації
    } = options;

    try {
      // Формуємо промпт, як у документації
      const prompt = instruction ? `${instruction}: ${text}` : text;
      console.log(`🔊 Запит до TTS. Голос: ${voiceName}. Промпт: "${prompt.slice(0, 90)}..."`);
      
      // Створюємо конфігурацію, як у документації
      const generationConfig = {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      };

      const result = await this.ttsModel.generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      });

      // Отримуємо дані аудіо
      const audioData = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) {
        throw new Error('API не повернув аудіодані.');
      }
      
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      // Зберігаємо файл у форматі WAV
      const outputDir = path.join(process.cwd(), 'uploads', 'audio');
      await fs.promises.mkdir(outputDir, { recursive: true });

      const filename = `audio_${Date.now()}.wav`; // Змінено розширення на .wav
      const filepath = path.join(outputDir, filename);

      // Використовуємо бібліотеку wav для збереження PCM даних
      await new Promise((resolve, reject) => {
        const writer = new wav.FileWriter(filepath, {
          channels: 1,
          sampleRate: 24000, // Стандартна частота для моделей Google TTS
          bitDepth: 16,
        });
        writer.on('finish', resolve);
        writer.on('error', reject);
        writer.write(audioBuffer);
        writer.end();
      });

      console.log(`✅ Аудіофайл збережено: ${filename}`);

      return {
        url: `/uploads/audio/${filename}`,
        filename: filename
      };

    } catch (error) {
      console.error('❌ Помилка генерації аудіо в Gemini TTS:', error);
      throw new Error('Не вдалося згенерувати аудіо через Gemini TTS.');
    }
  }

  // --- Методи для роботи з текстом ---

  _getPrompt(fileName, replacements = {}) {
    const promptTemplate = fs.readFileSync(
      path.join(__dirname, '../prompts', fileName),
      'utf-8'
    );
    
    let prompt = promptTemplate;
    for (const key in replacements) {
      prompt = prompt.replace(`\${${key}}`, replacements[key]);
    }
    return prompt;
  }

  async splitTextIntoBlocks(text, targetLanguage = 'uk') {
    try {
      if (this.demoMode) {
        return this.demoSplitText(text);
      }

      const languageMap = {
        'uk': 'українською мовою',
        'en': 'in English',
        'ru': 'на русском языке'
      };
      const outputLanguage = languageMap[targetLanguage] || languageMap['uk'];
      
      const prompt = this._getPrompt('splitTextPrompt.txt', { text, outputLanguage });

      // Використовуємо модель для тексту
      const result = await this.textModel.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();
      
      const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const blocks = JSON.parse(jsonMatch[0]);
        const validBlocks = blocks
          .filter(block => 
            block.text && block.imagePrompt && 
            typeof block.text === 'string' && typeof block.imagePrompt === 'string'
          )
          .map((block, index) => ({
            id: index + 1,
            text: block.text.trim(),
            originalText: block.originalText?.trim() || block.text.trim(),
            imagePrompt: block.imagePrompt.trim()
          }));
        
        if (validBlocks.length === 0) {
          throw new Error('Gemini повернув невалідні блоки');
        }
        return validBlocks;
      }
      
      throw new Error('Не вдалось знайти JSON у відповіді Gemini');
      
    } catch (error) {
      console.error('Помилка Gemini (splitTextIntoBlocks):', error.message);
      return this.demoSplitText(text);
    }
  }

  async rewriteText(text) {
    try {
      if (this.demoMode) {
        return this.demoRewriteText(text);
      }
      const prompt = this._getPrompt('rewritePrompt.txt', { text });
      // Використовуємо модель для тексту
      const result = await this.textModel.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Помилка рерайту:', error);
      return this.demoRewriteText(text);
    }
  }

  // ... (решта ваших демо-методів без змін) ...

  demoSplitText(text) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const blocks = [];
    for (let i = 0; i < sentences.length; i += 2) {
      const blockText = sentences.slice(i, i + 2).join(' ').trim();
      blocks.push({
        id: i / 2 + 1,
        text: blockText,
        originalText: blockText,
        imagePrompt: `Scene ${Math.floor(i/2) + 1}: A visual representation of "${blockText.slice(0, 50)}"`
      });
    }
    return blocks;
  }

  demoRewriteText(text) {
    return `[DEMO] ${text} [Для справжнього рерайту потрібен API ключ]`;
  }
}

module.exports = new GeminiService();