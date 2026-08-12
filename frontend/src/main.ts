import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { i18nKey, createI18n } from "./winui/components/i18n/index";
import "./winui/index.css";

const app = createApp(App);
app.provide(i18nKey, createI18n("zh-CN"));
app.use(router).mount("#app");
