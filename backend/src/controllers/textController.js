const geminiService = require('../services/geminiService');

// Контролер для обробки тексту
class TextController {
  // Обробка власного тексту
  async processCustomText(req, res) {
    try {
      const { text, language = 'uk' } = req.body;
      
      if (!text || text.trim() === '') {
        return res.status(400).json({ 
          error: 'Текст не може бути порожнім' 
        });
      }

      console.log('Обробка тексту, довжина:', text.length);
      
      // Розбиваємо текст на блоки через Gemini
      const blocks = await geminiService.splitTextIntoBlocks(text, language);
      
      console.log(`Текст розбито на ${blocks.length} блоків`);
      
      res.json({ 
        success: true,
        message: 'Текст успішно розбито на блоки',
        totalBlocks: blocks.length,
        blocks: blocks.map((block, index) => ({
          id: index + 1,
          text: block.text,
          imagePrompt: block.imagePrompt,
          audioUrl: null, // Поки що пусто
          imageUrl: null  // Поки що пусто
        }))
      });
      
    } catch (error) {
      console.error('Помилка обробки тексту:', error);
      res.status(500).json({ 
        error: 'Помилка сервера при обробці тексту' 
      });
    }
  }

  // Рерайт тексту
  async rewriteText(req, res) {
    try {
      const { text } = req.body;
      
      if (!text || text.trim() === '') {
        return res.status(400).json({ 
          error: 'Текст для рерайту не може бути порожнім' 
        });
      }

      console.log('Текст для рерайту:', text.substring(0, 100) + '...');
      
      // Використовуємо Gemini для рерайту
      const rewrittenText = await geminiService.rewriteText(text);
      
      res.json({ 
        success: true,
        message: 'Текст успішно переписано',
        originalLength: text.length,
        rewrittenLength: rewrittenText.length,
        rewrittenText: rewrittenText
      });
      
    } catch (error) {
      console.error('Помилка рерайту:', error);
      res.status(500).json({ 
        error: 'Помилка сервера при рерайті тексту' 
      });
    }
  }

  // Обробка YouTube посилання
  async processYouTubeLink(req, res) {
    try {
      const { url } = req.body;
      
      if (!url || url.trim() === '') {
        return res.status(400).json({ 
          error: 'Посилання не може бути порожнім' 
        });
      }

      // Перевірка чи це YouTube посилання
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
      if (!youtubeRegex.test(url)) {
        return res.status(400).json({ 
          error: 'Це не схоже на YouTube посилання' 
        });
      }

      console.log('Отримано YouTube посилання:', url);
      
      // Поки що просто повертаємо успіх
      // Пізніше тут буде витягування субтитрів
      res.json({ 
        success: true,
        message: 'YouTube посилання отримано',
        url: url,
        subtitles: 'Субтитри будуть тут...' // Тимчасово
      });
      
    } catch (error) {
      console.error('Помилка обробки YouTube:', error);
      res.status(500).json({ 
        error: 'Помилка сервера при обробці YouTube посилання' 
      });
    }
  }
}

module.exports = new TextController();