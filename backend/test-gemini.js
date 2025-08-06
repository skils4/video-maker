require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
  try {
    console.log('API Key:', process.env.GEMINI_API_KEY ? 'Є' : 'Немає');
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const text = "Одного ранку дівчинка побачила сніг. Вона вибігла на вулицю.";
    
    const prompt = `
    Розбий цей текст на блоки і створи описи для картинок.
    Поверни JSON масив.
    
    Приклад формату:
    [{"text": "речення", "imagePrompt": "опис картинки"}]
    
    Текст: ${text}
    `;
    
    console.log('Відправляю запит...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    
    console.log('Повна відповідь:');
    console.log(responseText);
    
  } catch (error) {
    console.error('Помилка:', error.message);
  }
}

testGemini();