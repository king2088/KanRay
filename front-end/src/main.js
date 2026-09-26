import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import { i18n } from './i18n'
import router from './router'
import { pinia } from './stores'
import { useAppStore } from './stores/app'
import './assets/main.css'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia)
app.use(router)
app.use(i18n)
app.use(ElementPlus)

useAppStore(pinia).applyInitial()
useAppStore(pinia).loadConfig()

router.afterEach((to) => {
  if (to.path.startsWith('/big-screen')) {
    const onBeforeSubmit = (e) => e.preventDefault()
    document.addEventListener('submit', onBeforeSubmit, true)
    window.__bigScreenUnsubSubmit = () => document.removeEventListener('submit', onBeforeSubmit, true)
  } else {
    window.__bigScreenUnsubSubmit?.()
  }
})

app.mount('#app')