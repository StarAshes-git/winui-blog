export interface SiteFooterRecord {
  text: string;
  link: string;
}

export interface SocialLink {
  name: string;
  url: string;
}

export interface SiteInfo {
  intro: string;
  site_name: string;
  avatar_url: string;
  footer_record: SiteFooterRecord | null;
  social_links: SocialLink[];
  background_url: string;
}

export interface PostSummary {
  id: number;
  title: string;
  created_at: number;
  updated_at: number;
  views: number;
  tags: string[];
}

export interface PostDetail extends PostSummary {
  content: string;
}

export interface TagCount {
  name: string;
  count: number;
}

export interface PagedPosts {
  posts: PostSummary[];
  total: number;
}

export interface ProjectSummary {
  id: number;
  title: string;
  description: string;
  cover_url: string;
  project_url: string;
  demo_url: string;
  tags: string[];
  created_at: number;
  updated_at: number;
}

export interface Project extends ProjectSummary {}
