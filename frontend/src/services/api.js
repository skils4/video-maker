// frontend/src/services/api.js

import axios from 'axios'
import { io } from 'socket.io-client'

// Базова URL нашого сервера
const API_URL = 'http://localhost:3000'

// Створюємо екземпляр axios для звичайних JSON-запитів
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Створюємо підключення Socket.io
export const socket = io(API_URL, {
  autoConnect: false
})

// API методи для роботи з текстом
export const textAPI = {
  processCustomText: (text, language = 'uk') => {
    return api.post('/api/text/custom', { text, language })
  },
  rewriteText: (text) => {
    return api.post('/api/text/rewrite', { text })
  },
  processYouTubeLink: (url) => {
    return api.post('/api/text/youtube', { url })
  }
}

// API методи для генерації
export const generationAPI = {
  generateImage: (prompt, settings) => {
    return api.post('/api/generate/image', { prompt, settings })
  },
  generateAllImages: (blocks, settings) => {
    return api.post('/api/generate/images-all', { blocks, settings })
  },
  
  // --- ВИПРАВЛЕНО ТУТ ---
  // Функція більше не приймає languageCode і не надсилає жодних параметрів.
  getVoices: () => {
    return api.get('/api/generate/voices');
  },
  
  generateAudio: (text, voiceSettings) => {
    return api.post('/api/generate/audio', { text, voiceSettings });
  },
  createVideo: (formData) => {
    return axios.post(`${API_URL}/api/generate/video`, formData);
  }
}

export default api