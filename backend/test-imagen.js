require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testImagen() {
  try {
    console.log('API Key:', process.env.GEMINI_API_KEY ? 'Є' : 'Немає');
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Спробуємо різні моделі
    const models = [
      'gemini-pro-vision',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'imagen-3'
    ];
    
    console.log('\nПеревірка доступних моделей для генерації зображень:\n');
    
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        console.log(`✓ ${modelName} - доступна`);
      } catch (error) {
        console.log(`✗ ${modelName} - ${error.message}`);
      }
    }
    
    // Тест генерації через Gemini з промптом для зображення
    console.log('\n\nСпроба генерації зображення через gemini-2.0-flash-exp:');
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const prompt = `Generate an image of: A peaceful garden with colorful flowers and a small fountain`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    console.log('Відповідь:', response.text());
    
  } catch (error) {
    console.error('Помилка:', error.message);
    console.error('Деталі:', error);
  }
}

testImagen();