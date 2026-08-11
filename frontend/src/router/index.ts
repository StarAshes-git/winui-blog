import { createRouter, createWebHashHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import PostView from "../views/PostView.vue";
import TagsView from "../views/TagsView.vue";
import AdminView from "../views/AdminView.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/post/:id", name: "post", component: PostView },
    { path: "/tags", name: "tags", component: TagsView },
    { path: "/admin", name: "admin", component: AdminView },
  ],
});

export default router;
