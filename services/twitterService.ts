/**
 * Twitter RSS 服务
 * 使用免费的第三方服务获取 Twitter 内容
 */

import { FeedItem } from '../types';

// 缓存配置：缓存 30 分钟，避免 Twitter API 429 限制
const CACHE_TTL_MS = 30 * 60 * 1000;
const twitterCache: Map<string, { data: any[]; timestamp: number }> = new Map();

 export type TwitterFetchOptions = {
   forceRefresh?: boolean;
   days?: number;
   replyLimit?: number;
   limit?: number;
 };

const getCachedTweets = (username: string): any[] | null => {
  const cached = twitterCache.get(username);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`📦 Using cached data for @${username}`);
    return cached.data;
  }
  return null;
};

const setCachedTweets = (username: string, data: any[]) => {
  twitterCache.set(username, { data, timestamp: Date.now() });
};

export const clearTwitterCache = (username?: string) => {
  if (username) {
    twitterCache.delete(username);
    return;
  }
  twitterCache.clear();
};

// 多个 Nitter 实例（作为 Twitter RSS 代理）- 2024/12 更新
const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://xcancel.com',
  'https://nitter.poast.org',
  'https://nitter.catsarch.com',
  'https://nitter.privacyredirect.com',
  'https://nitter.tiekoetter.com',
];

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
 * 本地 Bridge Server 地址（用于爬取 Twitter）
 */
const BRIDGE_SERVER_URL = 'http://localhost:5050';

/**
 * 尝试通过 Twitter GraphQL API 获取推文（最可靠）
 */
const fetchFromGraphQL = async (username: string, options?: TwitterFetchOptions): Promise<any[] | null> => {
  const useCache = !options?.forceRefresh;
  if (useCache) {
    const cached = getCachedTweets(username);
    if (cached) {
      const need = options?.limit;
      if (!need || cached.length >= need) {
        return cached;
      }
      console.log(`📦 Cached data for @${username} has ${cached.length} tweets, need ${need}, refetching...`);
    }
  }
  
  try {
    // 使用相对路径，开发环境通过 Vite 代理，生产环境直接访问 Netlify Functions
    const baseUrl = '';
    
    console.log(`🐦 Trying Twitter GraphQL API for @${username}...`);
    
    const refreshParam = options?.forceRefresh ? '&refresh=1' : '';
    const countParam = options?.limit ? `&count=${encodeURIComponent(String(options.limit))}` : '';
    const response = await fetch(
      `${baseUrl}/.netlify/functions/twitter-graphql?username=${encodeURIComponent(username)}&action=tweets${refreshParam}${countParam}`,
      { signal: AbortSignal.timeout(15000) }
    );
    
    if (!response.ok) {
      console.log('GraphQL API returned:', response.status);
      return null;
    }
    
    const data = await response.json();
    if (data.status === 'ok' && data.tweets?.tweets?.length > 0) {
      console.log(`✅ Twitter GraphQL success, found ${data.tweets.tweets.length} tweets`);
      const tweets = data.tweets.tweets.map((tweet: any) => ({
        id: tweet.id,
        title: tweet.text?.substring(0, 150) || '',
        link: tweet.link,
        pubDate: tweet.createdAt,
        description: tweet.text,
        imageUrl: tweet.imageUrl,
        isReply: Boolean(tweet.isReply),
        isRetweet: Boolean(tweet.isRetweet),
      }));
      setCachedTweets(username, tweets);
      return tweets;
    }
    return null;
  } catch (error) {
    console.log('Twitter GraphQL not available:', error);
    return null;
  }
};

/**
 * 尝试通过本地 Bridge Server 获取 Twitter 内容
 */
const fetchFromBridgeServer = async (username: string): Promise<any | null> => {
  try {
    console.log(`🔗 Trying Bridge Server for @${username}...`);
    
    const response = await fetch(`${BRIDGE_SERVER_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: username, limit: 10 }),
      signal: AbortSignal.timeout(30000) // 30秒超时
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.log('Bridge Server error:', error);
      return null;
    }
    
    const data = await response.json();
    if (data.status === 'success' && data.output) {
      console.log(`✅ Bridge Server success for @${username}`);
      // 解析输出，获取最新推文
      const lines = data.output.split('\n').filter((line: string) => line.match(/^\d{4}-\d{2}-\d{2}\t/));
      if (lines.length > 0) {
        const [date, ...contentParts] = lines[0].split('\t');
        return {
          title: contentParts.join('\t').substring(0, 150),
          link: `https://x.com/${username}`,
          pubDate: date,
          description: contentParts.join('\t'),
        };
      }
    }
    return null;
  } catch (error) {
    console.log('Bridge Server not available:', error);
    return null;
  }
};

/**
 * 尝试通过多种方式获取 Twitter 内容
 */
const fetchFromNitter = async (username: string, options?: TwitterFetchOptions): Promise<any[]> => {
  // 1. 首先尝试 Twitter GraphQL API（最可靠）
  const graphqlResult = await fetchFromGraphQL(username, options);
  if (graphqlResult && graphqlResult.length > 0) {
    return graphqlResult;
  }
  
  // 2. 尝试本地 Bridge Server
  const bridgeResult = await fetchFromBridgeServer(username);
  if (bridgeResult) {
    return [bridgeResult];
  }
  
  // 2. 检测是否在生产环境
  const isProduction = !Boolean((import.meta as any).env?.DEV);
  
  if (isProduction) {
    // 生产环境：使用 Netlify Function
    try {
      const response = await fetch(`/.netlify/functions/twitter-rss?username=${encodeURIComponent(username)}`, {
        signal: AbortSignal.timeout(15000)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok' && data.items && data.items.length > 0) {
          console.log(`✅ Netlify Function success, found ${data.items.length} items`);
          return data.items;
        }
      }
    } catch (error) {
      console.log('Netlify Function failed:', error);
    }
    return [];
  }
  
  // 3. 开发环境 fallback：尝试 Nitter 实例（通过 CORS 代理）
  for (const instance of NITTER_INSTANCES) {
    try {
      const rssUrl = `${instance}/${username}/rss`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
      
      console.log(`Trying Nitter instance: ${instance}`);
      
      const response = await fetch(proxyUrl, { 
        signal: AbortSignal.timeout(8000)
      });
      
      if (!response.ok) continue;
      
      const xml = await response.text();
      const items = parseRssXml(xml);
      
      if (items.length > 0) {
        console.log(`✅ Nitter success from ${instance}`);
        return items;
      }
    } catch (error) {
      console.log(`Nitter instance ${instance} failed:`, error);
    }
  }
  
  return [];
};

/**
 * 解析 RSS XML 为 items 数组
 */
const parseRssXml = (xml: string): any[] => {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    
    const title = extractXmlTag(itemXml, 'title');
    const link = extractXmlTag(itemXml, 'link');
    const pubDate = extractXmlTag(itemXml, 'pubDate');
    const description = extractXmlTag(itemXml, 'description');
    
    if (title || link) {
      items.push({
        title: decodeHtmlEntities(title || ''),
        link: link || '',
        pubDate: pubDate || '',
        description: decodeHtmlEntities(description || ''),
        content: description,
      });
    }
  }
  
  return items;
};

const extractXmlTag = (xml: string, tag: string): string | null => {
  // 处理 CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1];
  
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
};

const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
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
  username: string,
  index: number = 0
): FeedItem => {
  // 提取推文文本（去除 HTML 标签）
  const text = (rssItem.title || rssItem.description || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .substring(0, 150);
  
  const normalizedText = (text || '').trim();

  // 优先使用传入的图片 URL，否则尝试从内容中提取
  const imageUrl = rssItem.imageUrl || extractImageFromContent(rssItem.content || rssItem.description);
  
  const statusIdMatch = (rssItem.link || '').match(/\/status\/(\d+)/);
  const stableId = rssItem.id || statusIdMatch?.[1];
  const publishedAt = rssItem.pubDate || rssItem.publishedAt || undefined;

  const isReply = rssItem.isReply !== undefined && rssItem.isReply !== null
    ? Boolean(rssItem.isReply)
    : /^@/.test(normalizedText);
  const isRetweet = rssItem.isRetweet !== undefined && rssItem.isRetweet !== null
    ? Boolean(rssItem.isRetweet)
    : /^RT\s+@/i.test(normalizedText);

  return {
    id: stableId ? `tw-${subscriptionId}-${stableId}` : `tw-${subscriptionId}-${index}-${Date.now()}`,
    subscriptionId,
    title: text || `Tweet from @${username}`,
    link: rssItem.link || `https://twitter.com/${username}`,
    date: getRelativeTime(publishedAt || ''),
    publishedAt,
    imageUrl: imageUrl || undefined,
    platform: 'Twitter',
    summary: rssItem.description 
      ? rssItem.description.replace(/<[^>]*>/g, '').substring(0, 200)
      : undefined,
    isReply,
    isRetweet
  };
};

/**
 * 获取 Twitter 用户的最新推文（单条）
 */
export const fetchTwitterLatest = async (
  twitterUrl: string,
  subscriptionId: string
): Promise<FeedItem | null> => {
  const items = await fetchTwitterMultiple(twitterUrl, subscriptionId, 1);
  return items.length > 0 ? items[0] : null;
};

/**
 * 获取 Twitter 用户的多条推文
 */
export const fetchTwitterMultiple = async (
  twitterUrl: string,
  subscriptionId: string,
  limit: number = 10,
  options?: TwitterFetchOptions
): Promise<FeedItem[]> => {
  try {
    const username = extractTwitterUsername(twitterUrl);
    if (!username) {
      console.log('Cannot extract username from:', twitterUrl);
      return [];
    }
    
    console.log(`🐦 Fetching Twitter RSS for @${username}...`);
    
    const effectiveOptions: TwitterFetchOptions = {
      days: options?.days ?? 30,
      replyLimit: options?.replyLimit ?? 10,
      forceRefresh: options?.forceRefresh,
      limit
    };

    if (effectiveOptions.forceRefresh) {
      clearTwitterCache(username);
    }

    const items = await fetchFromNitter(username, effectiveOptions);
    
    if (items.length === 0) {
      console.log('No Twitter items found via RSS');
      return [];
    }
    
    console.log(`Found ${items.length} tweets for @${username}`);
    
    const feedItems = items.map((item: any, index: number) => rssToFeedItem(item, subscriptionId, username, index));

    const now = Date.now();
    const cutoff = now - (effectiveOptions.days ?? 30) * 24 * 60 * 60 * 1000;

    const recentItems = feedItems.filter((it) => {
      if (!it.publishedAt) return true;
      const t = new Date(it.publishedAt).getTime();
      if (Number.isNaN(t)) return true;
      return t >= cutoff;
    });

    recentItems.sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });

    const replyLimit = Math.max(0, Math.min(effectiveOptions.replyLimit ?? 10, limit));
    let selectedReplies = 0;
    const selected: FeedItem[] = [];
    const selectedIds = new Set<string>();

    for (const item of recentItems) {
      if (selected.length >= limit) break;
      const isReplyOrRt = Boolean(item.isReply || item.isRetweet);
      if (isReplyOrRt) {
        if (selectedReplies >= replyLimit) continue;
        selectedReplies += 1;
      }
      selected.push(item);
      selectedIds.add(item.id);
    }

    if (selected.length < limit) {
      for (const item of recentItems) {
        if (selected.length >= limit) break;
        if (selectedIds.has(item.id)) continue;
        selected.push(item);
        selectedIds.add(item.id);
      }
    }

    return selected;
  } catch (error) {
    console.error('fetchTwitterMultiple failed:', error);
    return [];
  }
};
