export interface Subscription {
  id: string;
  url: string;
  name: string; // User defined or auto-generated alias
  platform: 'youtube' | 'twitter' | 'instagram' | 'other';
  addedAt: number;
  pinned?: boolean; // 置顶标记
}

export interface FeedItem {
  id: string;
  subscriptionId: string;
  title: string;
  link: string;
  date: string;
  publishedAt?: string;
  imageUrl?: string;
  platform: string;
  summary?: string;
  isReply?: boolean;
  isRetweet?: boolean;
}

export interface FetchResult {
  success: boolean;
  data?: FeedItem[];
  error?: string;
}