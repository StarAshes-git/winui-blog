import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: () => import("../views/AboutView.vue") },
    { path: "/posts", name: "posts", component: () => import("../views/HomeView.vue") },
    { path: "/post/:id", name: "post", component: () => import("../views/PostView.vue") },
    { path: "/tags", name: "tags", component: () => import("../views/TagsView.vue") },
    { path: "/admin", name: "admin", component: () => import("../views/AdminView.vue") },
    { path: "/works", name: "works", component: () => import("../views/WorksView.vue") },
  ],
});

export default router;
