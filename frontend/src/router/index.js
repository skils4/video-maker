import { createRouter, createWebHistory } from 'vue-router'
import VideoMaker from '../views/VideoMaker.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'video-maker',
      component: VideoMaker
    }
  ]
})

export default router