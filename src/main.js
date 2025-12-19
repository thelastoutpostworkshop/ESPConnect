import { createApp } from 'vue';
import App from './App.vue';
import { createI18n } from 'vue-i18n';
import { messages, detectLocale } from './locales';

import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

import '@mdi/font/css/materialdesignicons.css';
import './style.css';

const vuetify = createVuetify({
  components,
  directives,
});

const i18n = createI18n({
  legacy: false,
  locale: (typeof window !== 'undefined' && window.localStorage.getItem('esp32-locale')) || detectLocale(),
  fallbackLocale: 'en',
  messages,
});

createApp(App).use(vuetify).use(i18n).mount('#app');
