import { createApp } from 'vue';
import App from './App.vue';
const app = createApp(App);
if (typeof document !== 'undefined' && document.getElementById('app')) {
  app.mount('#app');
}
export { app };
