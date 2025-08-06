// controllers/generationController.js
const ImagenService = require('../services/imagenService');
const TTSService = require('../services/TTSService');
const VideoService = require('../services/VideoService');
const { getIO } = require('../socket');

class GenerationController {
  constructor() {
    this.generateImage = this.generateImage.bind(this);
    this.generateAllImages = this.generateAllImages.bind(this);
    this.getVoices = this.getVoices.bind(this);
    this.generateAudio = this.generateAudio.bind(this);
    this.createVideo = this.createVideo.bind(this);
  }

  // --- ВИПРАВЛЕНО ТУТ ---
  // Логіку перевірки languageCode повністю видалено.
  async getVoices(req, res) {
    try {
      const voices = await TTSService.getAvailableVoices();
      res.json(voices);
    } catch (error) {
      console.error('Помилка в getVoices controller:', error);
      res.status(500).json({ error: 'Не вдалося завантажити список голосів' });
    }
  }

  async generateImage(req, res) {
    console.log('Увійшли в generationController.generateImage!');
    try {
      const { prompt, settings = {} } = req.body;
      if (!prompt || prompt.trim() === '') {
        return res.status(400).json({ error: 'Промпт не може бути порожнім' });
      }
      const imageData = await ImagenService.generateImage(prompt, settings);
      res.json({ 
        success: true, message: 'Зображення успішно згенеровано',
        imageUrl: imageData.url, provider: imageData.provider, model: imageData.model
      });
    } catch (error) {
      console.error('Помилка в generationController.generateImage:', error);
      res.status(500).json({ error: 'Помилка сервера при генерації зображення' });
    }
  }

  async generateAllImages(req, res) {
    console.log('Увійшли в generationController.generateAllImages!');
    try {
      const { blocks, settings = {} } = req.body;
      if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
        return res.status(400).json({ error: 'Немає блоків для генерації' });
      }
      res.json({ success: true, message: 'Масову генерацію запущено...' });
      const io = getIO();
      ImagenService.generateAllImages(blocks, settings, io);
    } catch (error) {
      console.error('Помилка запуску масової генерації в контролері:', error);
      res.status(500).json({ error: 'Не вдалося запустити масову генерацію' });
    }
  }

  async generateAudio(req, res) {
    console.log('Увійшли в generationController.generateAudio!');
    try {
      const { text, voiceSettings } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Текст не може бути порожнім' });
      }
      const audioData = await TTSService.generateAudio(text, voiceSettings);
      res.json({ success: true, message: 'Аудіо успішно згенеровано', audioUrl: audioData.url });
    } catch (error) {
      console.error('Помилка в generationController.generateAudio:', error);
      res.status(500).json({ error: 'Помилка сервера при генерації аудіо' });
    }
  }

  async createVideo(req, res) {
    console.log('Увійшли в generationController.createVideo!');
    try {
      // Коли multer обробляє multipart/form-data, текстові поля знаходяться в req.body,
      // а файл - в req.file.
      const config = JSON.parse(req.body.config);
      const musicFile = req.file; // Файл музики

      res.json({ message: 'Процес створення відео запущено...' });

      const io = getIO();
      VideoService.generateVideo(config, musicFile, io);

    } catch (error) {
      console.error('Помилка запуску створення відео:', error);
      res.status(500).json({ error: 'Не вдалося запустити процес створення відео' });
    }
  }
}

module.exports = new GenerationController();