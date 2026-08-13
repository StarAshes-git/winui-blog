export interface SiteFooterRecord {
  text: string;
  link: string;
}

export interface SiteInfo {
  intro: string;
  site_name: string;
  avatar_url: string;
  footer_record: SiteFooterRecord | null;
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
