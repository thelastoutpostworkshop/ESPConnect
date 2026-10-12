import { createApp } from 'vue';

import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import './style.css';

import vuetify from './plugins/vuetify';
import { i18n } from './plugins/i18n';

// Import only the selected root. Diagnostic sessions must never mount App's reader.
const root = new URLSearchParams(window.location.search).get('flashReadDiagnostic') === '1'
  ? import('./FlashReadDiagnostic.vue')
  : import('./App.vue');

void root.then(({ default: Root }) => {
  const app = createApp(Root);
  app.use(vuetify);
  app.use(i18n);
  app.mount('#app');
});
