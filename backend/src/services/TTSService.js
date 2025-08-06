// Імпортуємо наш основний сервіс Gemini
const geminiService = require('./geminiService'); 

class TTSService {
  constructor() {
    console.log('✅ TTS Service ініціалізовано як адаптер для Gemini Service');
  }

  /**
   * Отримує список доступних голосів з Gemini Service.
   * @param {string} languageCode - Цей параметр ігнорується, але залишений для сумісності.
   * @returns {Promise<Array<{name: string, gender: string}>>}
   */
  async getAvailableVoices(languageCode) {
    console.log(`🗣️  Запитую список голосів з Gemini...`);
    // Мова тепер неважлива, оскільки голоси Gemini не прив'язані до мови так жорстко.
    return geminiService.getAvailableVoices();
  }

  /**
   * Генерує аудіо, викликаючи відповідний метод з Gemini Service.
   * @param {string} text - Текст для озвучення.
   * @param {object} options - Опції, що надходять з фронтенду.
   * @returns {Promise<{url: string, filename: string}>}
   */
  async generateAudio(text, options = {}) {
    console.log(`🔊 Перенаправляю запит на генерацію аудіо до Gemini Service...`);
    
    // Створюємо об'єкт опцій для Gemini, перейменовуючи `ssmlTemplate` на `instruction` для ясності.
    const geminiOptions = {
      instruction: options.ssmlTemplate || '', // Використовуємо поле, що надходить з фронтенду.
      voiceName: options.voiceName,
      // Примітка: pitch та speakingRate з фронтенду тут не передаються напряму,
      // оскільки Gemini керується текстовою інструкцією. Користувач може сам написати
      // "говори швидше" або "вищим голосом" у полі для стилю.
    };
    
    // Викликаємо основний метод генерації аудіо з Gemini Service
    return geminiService.generateAudio(text, geminiOptions);
  }
}

module.exports = new TTSService();