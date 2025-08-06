const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class ImagenService {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'uploads', 'images');
    this.ensureDirectory();

    // Прив'язка методів для збереження контексту `this`
    this.generateImage = this.generateImage.bind(this);
    this.generateAllImages = this.generateAllImages.bind(this);
    this.generateViaVertex = this.generateViaVertex.bind(this);
    this.generateViaStableDiffusion = this.generateViaStableDiffusion.bind(this);
    this.generateViaPollinations = this.generateViaPollinations.bind(this);
    
    // Перевірка наявності Vertex AI credentials
    this.vertexAvailable = false;
    const credentialsPath = path.join(process.cwd(), 'gcloud-credentials.json');
    
    try {
      if (fs.existsSync(credentialsPath)) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
        this.vertexAI = new VertexAI({
          project: 'mindful-path-464920-e6', // Ваш ID проєкту
          location: 'us-central1',
        });
        this.vertexAvailable = true;
        console.log('✅ Vertex AI налаштовано');
      } else {
         console.warn('⚠️  Vertex AI недоступний: не знайдено gcloud-credentials.json');
      }
    } catch (error) {
      console.warn('⚠️  Vertex AI недоступний:', error.message);
    }
    
    this.defaultProvider = process.env.IMAGE_PROVIDER || 'pollinations';
    console.log('🎨 Провайдер за замовчуванням:', this.defaultProvider);
  }

  async ensureDirectory() {
    try {
      await fs.promises.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error('Помилка створення папки для зображень:', error);
    }
  }

  // Основний метод-маршрутизатор для генерації
  async generateImage(prompt, settings = {}) {
    const provider = settings.provider || this.defaultProvider;
    
    console.log(`\n🎨 Генерація через ${provider}`);
    console.log('📝 Промпт:', prompt.substring(0, 50) + '...');
    
    switch (provider) {
      case 'vertex':
        if (this.vertexAvailable) {
          return await this.generateViaVertex(prompt, settings);
        }
        throw new Error('Vertex AI недоступний, не знайдено ключ');
        
      case 'stable-diffusion':
        return await this.generateViaStableDiffusion(prompt, settings);
        
      case 'pollinations':
      default:
        return await this.generateViaPollinations(prompt, settings);
    }
  }

  // Генерація всіх зображень з оновленнями через WebSocket
  async generateAllImages(blocks, settings, io) {
    console.log(`\n🎨 Починаю масову генерацію ${blocks.length} зображень...`);
    
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      
      try {
        console.log(`\n📸 Блок ${i + 1}/${blocks.length}`);
        
        const imageData = await this.generateImage(
          block.imagePrompt || block.text, 
          settings
        );
        
        io.emit('image-generated', {
          blockId: block.id,
          imageUrl: imageData.url,
          success: true,
          model: imageData.model,
          provider: imageData.provider
        });
        
        if (settings.provider === 'vertex' && i < blocks.length - 1) {
          console.log('⏳ Чекаємо 1 секунду (rate limit)...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ Помилка для блоку ${block.id}:`, error.message);
        io.emit('generation-error', {
          blockId: block.id,
          error: error.message,
          success: false
        });
      }
    }
    
    console.log('\n✅ Масова генерація завершена!');
    io.emit('generation-complete', { message: 'Всі зображення згенеровано!' });
  }

  // --- МЕТОДИ ГЕНЕРАЦІЇ ---

  async generateViaVertex(prompt, settings) {
    console.log('🔷 Використовую Vertex AI...');
    const model = 'imagegeneration@006';
    const generativeModel = this.vertexAI.getGenerativeModel({ model });

    const request = {
      contents: [{ parts: [{ text: prompt }] }],
      generation_config: {
        sampleCount: 1,
        // aspectRatio: settings.aspectRatio || '16:9' // Цей параметр може бути не підтримуваним
      }
    };

    const [response] = await generativeModel.generateContent(request);
    const imageBase64 = response.candidates[0].content.parts[0].fileData.data;
    
    const filename = `vertex_${Date.now()}.png`;
    const filepath = path.join(this.outputDir, filename);
    await fs.promises.writeFile(filepath, Buffer.from(imageBase64, 'base64'));

    console.log('✅ Згенеровано через Vertex AI');
    return {
      url: `/uploads/images/${filename}`,
      filename: filename,
      model,
      provider: 'vertex'
    };
  }

  async generateViaStableDiffusion(prompt, settings) {
    console.log('🟦 Використовую Stable Diffusion...');
    if (!process.env.HUGGINGFACE_API_KEY) {
      throw new Error('Hugging Face API ключ не налаштовано в .env!');
    }

    try {
      const response = await axios({
        method: 'POST',
        url: 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`
        },
        data: { inputs: prompt },
        responseType: 'arraybuffer',
        timeout: 60000
      });

      const filename = `sd_${Date.now()}.png`;
      const filepath = path.join(this.outputDir, filename);
      await fs.promises.writeFile(filepath, response.data);

      console.log('✅ Згенеровано через Stable Diffusion');
      return {
        url: `/uploads/images/${filename}`,
        filename: filename,
        model: 'stable-diffusion-2.1',
        provider: 'stable-diffusion'
      };
    } catch (error) {
      if (error.response?.status === 503) {
        throw new Error('Модель Stable Diffusion зараз завантажується, спробуйте через хвилину.');
      }
      throw error;
    }
  }

  async generateViaPollinations(prompt, settings) {
    console.log('🟩 Використовую Pollinations.ai...');
    const dimensions = this.getImageDimensions(settings.aspectRatio || '16:9');
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dimensions.width}&height=${dimensions.height}&nologo=true`;
    
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
      }
    });
    
    const filename = `pollinations_${Date.now()}.png`;
    const filepath = path.join(this.outputDir, filename);
    await fs.promises.writeFile(filepath, response.data);
    
    console.log('✅ Згенеровано через Pollinations');
    return {
      url: `/uploads/images/${filename}`,
      filename: filename,
      model: 'pollinations-ai',
      provider: 'pollinations'
    };
  }

  getImageDimensions(aspectRatio) {
    const dimensions = {
      '16:9': { width: 1024, height: 576 },
      '9:16': { width: 576, height: 1024 },
      '1:1': { width: 1024, height: 1024 },
      '4:3': { width: 1024, height: 768 },
      '3:4': { width: 768, height: 1024 }
    };
    return dimensions[aspectRatio] || dimensions['16:9'];
  }
}

module.exports = new ImagenService();