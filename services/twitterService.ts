/**
 * Twitter RSS 服务
 * 使用免费的第三方服务获取 Twitter 内容
 */

import { FeedItem } from '../types';

// 多个 Nitter 实例（作为 Twitter RSS 代理）
const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.1d4.us',
];

// RSS to JSON 代理
const RSS_PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';

/**
 * 从 Twitter URL 提取用户名
 */
export const extractTwitterUsername = (url: string): string | null => {
  try {
    const match = url.match(/(?:twitter\.com|x\.com)\/([^/?]+)/);
    if (match && !['home', 'explore', 'notifications', 'messages', 'i', 'search'].includes(match[1])) {
      return match[1];
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * 尝试通过 Nitter RSS 获取推文
 */
const fetchFromNitter = async (username: string): Promise<any[]> => {
  for (const instance of NITTER_INSTANCES) {
    try {
      const rssUrl = `${instance}/${username}/rss`;
      const proxyUrl = `${RSS_PROXY}${encodeURIComponent(rssUrl)}`;
      
      console.log(`Trying Nitter instance: ${instance}`);
      
      const response = await fetch(proxyUrl, { 
        signal: AbortSignal.timeout(5000) // 5秒超时
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (data.status === 'ok' && data.items && data.items.length > 0) {
        console.log(`✅ Nitter success from ${instance}`);
        return data.items;
      }
    } catch (error) {
      console.log(`Nitter instance ${instance} failed:`, error);
    }
  }
  
  return [];
};

/**
 * 从 RSS item 中提取图片 URL
 */
const extractImageFromContent = (content: string): string | null => {
  if (!content) return null;
  
  // 尝试从 HTML 内容中提取图片
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/);
  if (imgMatch) return imgMatch[1];
  
  // 尝试提取 Twitter 图片 URL
  const twitterImgMatch = content.match(/https:\/\/pbs\.twimg\.com\/media\/[^\s"'<>]+/);
  if (twitterImgMatch) return twitterImgMatch[0];
  
  return null;
};

/**
 * 计算相对时间
 */
const getRelativeTime = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    return 'Just now';
  } catch {
    return 'Recently';
  }
};

/**
 * 将 RSS 数据转换为 FeedItem
 */
const rssToFeedItem = (
  rssItem: any,
  subscriptionId: string,
  username: string
): FeedItem => {
  // 提取推文文本（去除 HTML 标签）
  const text = (rssItem.title || rssItem.description || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .substring(0, 150);
  
  // 尝试提取图片
  const imageUrl = extractImageFromContent(rssItem.content || rssItem.description);
  
  return {
    id: `tw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    subscriptionId,
    title: text || `Tweet from @${username}`,
    link: rssItem.link || `https://twitter.com/${username}`,
    date: getRelativeTime(rssItem.pubDate),
    imageUrl: imageUrl || undefined,
    platform: 'Twitter',
    summary: rssItem.description 
      ? rssItem.description.replace(/<[^>]*>/g, '').substring(0, 200)
      : undefined
  };
};

/**
 * 获取 Twitter 用户的最新推文
 */
export const fetchTwitterLatest = async (
  twitterUrl: string,
  subscriptionId: string
): Promise<FeedItem | null> => {
  try {
    const username = extractTwitterUsername(twitterUrl);
    if (!username) {
      console.log('Cannot extract username from:', twitterUrl);
      return null;
    }
    
    console.log(`🐦 Fetching Twitter RSS for @${username}...`);
    
    // 尝试 Nitter RSS
    const items = await fetchFromNitter(username);
    
    if (items.length === 0) {
      console.log('No Twitter items found via RSS');
      return null;
    }
    
    // 过滤：只保留最近一个月的推文
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    
    const recentTweets = items.filter((item: any) => {
      const pubDate = new Date(item.pubDate);
      return pubDate > oneMonthAgo;
    });
    
    const latestItem = recentTweets.length > 0 ? recentTweets[0] : items[0];
    
    console.log(`Found latest tweet: ${latestItem.title?.substring(0, 50)}...`);
    
    return rssToFeedItem(latestItem, subscriptionId, username);
  } catch (error) {
    console.error('fetchTwitterLatest failed:', error);
    return null;
  }
};
