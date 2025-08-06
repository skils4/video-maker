# Інструкція для встановлення залежностей

## Backend

Встановіть залежності для backend:

```bash
cd backend
npm install
```

### Основні залежності:
- @ffprobe-installer/ffprobe
- @google-cloud/text-to-speech
- @google-cloud/vertexai
- @google/generative-ai
- @prisma/client
- axios
- bull
- cors
- dotenv
- express
- ffprobe-static
- fluent-ffmpeg
- multer
- prisma
- redis
- socket.io
- youtube-transcript

### Dev-залежності:
- nodemon

## Frontend

Встановіть залежності для frontend:

```bash
cd frontend
npm install
```

### Основні залежності:
- axios
- pinia
- socket.io-client
- vue
- vue-router

### Dev-залежності:
- @vitejs/plugin-vue
- vite
- vite-plugin-vue-devtools

## Додатково
- Переконайтесь, що у вас встановлено Node.js версії 20.19.0 або >=22.12.0 (для frontend).
- Для роботи з Google Cloud потрібен файл `gcloud-credentials.json` у backend.

---

## Швидкий старт

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

---

## Якщо потрібна окрема інструкція для розгортання — повідомте!
