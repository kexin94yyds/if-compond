/**
 * YouTube RSS Feed 服务
 * 使用 YouTube 官方 RSS feed 获取频道最新视频
 * 比 Gemini 更可靠，因为直接读取官方数据
 */

import { FeedItem } from '../types';

// RSS to JSON 代理服务（免费，无需 API key）
const RSS_PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';

// Channel ID 缓存（避免重复请求）
const channelIdCache: Record<string, string> = {};

/**
 * 通过多种方式获取 YouTube 频道的 Channel ID
 * 1. 先尝试 Netlify Function（生产环境）
 * 2. 再尝试 CORS 代理（开发环境备用）
 */
export const fetchChannelId = async (channelUrl: string): Promise<string | null> => {
  try {
    // 先检查缓存
    if (channelIdCache[channelUrl]) {
      return channelIdCache[channelUrl];
    }

    // 方法1: 尝试 Netlify Function（生产环境）
    try {
      const response = await fetch(
        `/.netlify/functions/get-youtube-channel?url=${encodeURIComponent(channelUrl)}`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.channelId) {
          channelIdCache[channelUrl] = data.channelId;
          console.log(`✅ Got channel ID via Netlify: ${data.channelId}`);
          return data.channelId;
        }
      }
    } catch (e) {
      console.log('Netlify function unavailable, trying CORS proxy...');
    }

    // 方法2: 尝试多个 CORS 代理
    const corsProxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(channelUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(channelUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(channelUrl)}`,
    ];
    
    let html = '';
    for (const proxyUrl of corsProxies) {
      try {
        const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
        if (response.ok) {
          html = await response.text();
          if (html.includes('youtube.com')) {
            console.log('✅ CORS proxy success:', proxyUrl.split('?')[0]);
            break;
          }
        }
      } catch (e) {
        console.log('Proxy failed, trying next...', proxyUrl.split('?')[0]);
      }
    }
    
    if (!html) {
      console.warn('All CORS proxies failed');
      return null;
    }
    
    // 从 HTML 中提取 channel ID
    let channelId = null;
    
    // 方法1: canonical link
    const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/([^"]+)"/);
    if (canonicalMatch) channelId = canonicalMatch[1];
    
    // 方法2: channelId in JSON
    if (!channelId) {
      const metaMatch = html.match(/"channelId":"([^"]+)"/);
      if (metaMatch) channelId = metaMatch[1];
    }
    
    // 方法3: browseId
    if (!channelId) {
      const browseMatch = html.match(/"browseId":"(UC[^"]+)"/);
      if (browseMatch) channelId = browseMatch[1];
    }

    if (channelId) {
      channelIdCache[channelUrl] = channelId;
      console.log(`✅ Got channel ID via CORS proxy: ${channelId}`);
      return channelId;
    }

    return null;
  } catch (error) {
    console.warn('Failed to fetch channel ID:', error);
    return null;
  }
};

/**
 * 从 YouTube 频道 URL 中提取 channel handle（@xxx 格式）
 */
export const extractYoutubeHandle = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // @handle 格式
    const handleMatch = pathname.match(/^\/@([^/?]+)/);
    if (handleMatch) return handleMatch[1];
    
    // /c/name 格式
    const cMatch = pathname.match(/^\/c\/([^/?]+)/);
    if (cMatch) return cMatch[1];
    
    return null;
  } catch {
    return null;
  }
};

/**
 * 已知的 YouTube 频道映射（硬编码热门频道）
 * 这是最可靠的方式，因为不受 CORS 或 API 限制
 */
const KNOWN_CHANNELS: Record<string, string> = {
  // AI/科技
  'Google': 'UCVHFbqXqoYvEWM1Ddxl0QKg',
  'OpenAI': 'UCXZCJLdBC09xxGZ6gcdrc6A',
  'Anthropic': 'UCrDwWp7EBBv4NwvScIpBDOA',
  'anthropic-ai': 'UCrDwWp7EBBv4NwvScIpBDOA',
  'Fireship': 'UCsBjURrPoezykLs9EqgamOA',
  'ThePrimeagen': 'UCUyeluBRhGPCW4rPe_UvBZQ',
  'Veritasium': 'UCHnyfMqiRRG1u-2MsSQLbXA',
  'rileybrownai': 'UCMcoud_ZW7cfxeIugBflSBw',
  'AIJasonZ': 'UCJ7wWv4Ty3VoSx9KWVOhZGg',
  
  // 开发者/编程
  'NetworkChuck': 'UC9x0AN7BWHpCDHSm9NiJFJQ',
  'networkchuck': 'UC9x0AN7BWHpCDHSm9NiJFJQ',
  'IndyDevDan': 'UC_x36zCEGilGpB1m-V4gmjg',
  'indydevdan': 'UC_x36zCEGilGpB1m-V4gmjg',
  'WebDevCody': 'UCsrVDPJBYeXItETFHG0qzyw',
  'webdevcody': 'UCsrVDPJBYeXItETFHG0qzyw',
  'TraversyMedia': 'UC29ju8bIPH5as8OGnQzwJyA',
  'traversymedia': 'UC29ju8bIPH5as8OGnQzwJyA',
  'TheNetNinja': 'UCW5YeuERMmlnqo4oq8vwUpg',
  'BenAwad': 'UC-8QAzbLcRglXeN_MY9blyw',
  
  // 中文科技/财经
  'TinaHuang1': 'UC2UXDak6o7rBm23k3Vv5dww',
  'hackbearterry': 'UC_whOg3XES3Fihic53fvo4Q',
  'HackBearTerry': 'UC_whOg3XES3Fihic53fvo4Q',
  'Tech_Shrimp': 'UCqB9aHjRxXCNRbMEfE3TVhA',
  'tech-shrimp': 'UCqB9aHjRxXCNRbMEfE3TVhA',
  
  // 航天
  'SpaceX': 'UCtI0Hodo5o5dUb67FeUjDeA',
  
  // 创业/商业
  'NavalR': 'UCh_dVD10YuSghle8g6yjePg',
  'eoglobal': 'UCDMkT5bTBwqFuDLSfSmM3ZA',
  'EntrepreneursOrganization': 'UCDMkT5bTBwqFuDLSfSmM3ZA',
  
  // 娱乐
  'MrBeast': 'UCX6OQ3DkcsbYNE6H8uQQuVA',
  'PewDiePie': 'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
  
  // 教育
  'TEDx': 'UCsT0YIqwnpJCM-mx7-gSA4Q',
  'TEDxTalks': 'UCsT0YIqwnpJCM-mx7-gSA4Q',
  'tedxtalks': 'UCsT0YIqwnpJCM-mx7-gSA4Q',
  'TED': 'UCAuUUnT6oDeKwE6v1NGQxug',
  'Kurzgesagt': 'UCsXVk37bltHxD1rDPwtNM8Q',
  '3Blue1Brown': 'UCYO_jab_esuFRV4b17AJtAw',
  
  // 更多开发者频道
  'henrikmdev': 'UCvmINlrza7JHB1zkIOuXEbw',
  'HenrikMDev': 'UCvmINlrza7JHB1zkIOuXEbw',
  // 以下频道 ID 需要验证，暂时注释
  // 'Zendicay': 'UCa1zuotKU4Weuw_fLRnPv0A',
  // 'itsbyrobin': 'UC0RhatS1pyxInC00YKjjBqQ',
  // 'Developete': 'UCwRXb5dUK4cvsHbx-rGzSgw',
  // 'jackneel': 'UCSVhiN7W7tnK4S9fbI6V0PA',
};

/**
 * 解析 YouTube RSS XML
 */
const parseYoutubeRSSXml = (xml: string): any[] => {
  const items: any[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    
    const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
    const linkMatch = entry.match(/<link[^>]*href="([^"]+)"/);
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
    const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    
    if (titleMatch && linkMatch) {
      items.push({
        title: titleMatch[1],
        link: linkMatch[1],
        pubDate: publishedMatch ? publishedMatch[1] : new Date().toISOString(),
        videoId: videoIdMatch ? videoIdMatch[1] : null,
      });
    }
  }
  
  return items;
};

/**
 * 通过 channel ID 获取 RSS feed
 * 使用多个代理以提高成功率
 */
export const fetchYoutubeRSS = async (channelId: string): Promise<any[]> => {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  
  // 方法1: 尝试 rss2json
  try {
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'ok' && data.items && data.items.length > 0) {
        console.log(`📺 RSS (rss2json): ${data.items.length} items`);
        return data.items;
      }
    }
  } catch (e) {
    console.log('rss2json failed, trying CORS proxy...');
  }
  
  // 方法2: 尝试 CORS 代理直接获取 XML
  const corsProxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`,
  ];
  
  for (const proxyUrl of corsProxies) {
    try {
      const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) continue;
      
      const xml = await response.text();
      if (xml.includes('<entry>')) {
        const items = parseYoutubeRSSXml(xml);
        if (items.length > 0) {
          console.log(`📺 RSS (XML): ${items.length} items`);
          return items;
        }
      }
    } catch (e) {
      console.log('CORS proxy failed, trying next...');
    }
  }
  
  console.log('All RSS methods failed for channel:', channelId);
  return [];
};

/**
 * 从 RSS item 中提取视频 ID
 * 支持多种 YouTube URL 格式
 */
const extractVideoId = (link: string): string | null => {
  if (!link) return null;
  
  // 格式1: youtube.com/watch?v=VIDEO_ID
  const watchMatch = link.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  
  // 格式2: youtu.be/VIDEO_ID
  const shortMatch = link.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  
  // 格式3: youtube.com/embed/VIDEO_ID
  const embedMatch = link.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  
  // 格式4: youtube.com/shorts/VIDEO_ID
  const shortsMatch = link.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  
  console.log('Could not extract video ID from:', link);
  return null;
};

/**
 * 将 RSS 数据转换为 FeedItem
 */
export const rssToFeedItem = (
  rssItem: any, 
  subscriptionId: string,
  index: number
): FeedItem => {
  // 尝试从多个字段获取视频链接
  const videoLink = rssItem.link || rssItem.guid || rssItem.id || '';
  const videoId = extractVideoId(videoLink);
  
  // 如果从 link 提取失败，尝试从 thumbnail 提取
  let finalVideoId = videoId;
  if (!finalVideoId && rssItem.thumbnail) {
    const thumbMatch = rssItem.thumbnail.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
    if (thumbMatch) finalVideoId = thumbMatch[1];
  }
  
  // 计算相对时间
  const pubDate = new Date(rssItem.pubDate);
  const now = new Date();
  const diffMs = now.getTime() - pubDate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  let relativeDate = 'Recently';
  if (diffDays > 0) {
    relativeDate = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    relativeDate = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }
  
  return {
    id: `yt-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
    subscriptionId,
    title: rssItem.title || 'Untitled Video',
    link: videoLink || '#',
    date: relativeDate,
    // YouTube 缩略图 - 使用可靠的 hqdefault
    imageUrl: finalVideoId 
      ? `https://i.ytimg.com/vi/${finalVideoId}/hqdefault.jpg`
      : undefined,
    platform: 'YouTube',
    summary: rssItem.description 
      ? rssItem.description.replace(/<[^>]*>/g, '').substring(0, 150) + '...'
      : undefined
  };
};

/**
 * 尝试通过 RSS 获取 YouTube 频道最新视频
 * 如果失败则返回 null
 */
export const fetchYoutubeLatest = async (
  channelUrl: string,
  subscriptionId: string,
  channelId?: string // 可以直接传入 channel ID
): Promise<FeedItem | null> => {
  try {
    let resolvedChannelId = channelId;
    
    if (!resolvedChannelId) {
      // 尝试从已知频道映射中查找（支持不区分大小写）
      const handle = extractYoutubeHandle(channelUrl);
      if (handle) {
        // 先尝试精确匹配
        resolvedChannelId = KNOWN_CHANNELS[handle];
        
        // 如果没找到，尝试不区分大小写匹配
        if (!resolvedChannelId) {
          const lowerHandle = handle.toLowerCase();
          for (const [key, value] of Object.entries(KNOWN_CHANNELS)) {
            if (key.toLowerCase() === lowerHandle) {
              resolvedChannelId = value;
              break;
            }
          }
        }
        
        console.log(`Looking up handle @${handle} -> ${resolvedChannelId || 'not found in KNOWN_CHANNELS'}`);
      }
    }
    
    // 如果 KNOWN_CHANNELS 中没有，尝试通过 Netlify Function 获取
    if (!resolvedChannelId) {
      console.log('Channel not in KNOWN_CHANNELS, trying Netlify Function...');
      resolvedChannelId = await fetchChannelId(channelUrl);
    }
    
    if (!resolvedChannelId) {
      console.log('No channel ID available for:', channelUrl);
      return null;
    }
    
    console.log(`Fetching YouTube RSS for channel ID: ${resolvedChannelId}`);
    
    // 获取 RSS feed
    const items = await fetchYoutubeRSS(resolvedChannelId);
    if (items.length === 0) {
      console.log('No RSS items found');
      return null;
    }
    
    // 过滤条件：
    // 1. 排除 Shorts（URL 包含 /shorts/ 或标题包含 #shorts）
    // 2. 只保留最近一个月内的视频
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    
    const regularVideos = items.filter((item: any) => {
      const link = item.link || '';
      const title = (item.title || '').toLowerCase();
      
      // 检查是否是 Shorts
      const isShort = link.includes('/shorts/') || title.includes('#shorts') || title.includes('#short');
      if (isShort) {
        return false;
      }
      
      // 检查发布时间是否在一个月内
      const pubDate = new Date(item.pubDate);
      // 如果日期无效，假设是最近的视频
      if (isNaN(pubDate.getTime())) {
        console.log(`Invalid date for: ${item.title}, assuming recent`);
        return true;
      }
      if (pubDate < oneMonthAgo) {
        return false;
      }
      
      return true;
    });
    
    if (regularVideos.length === 0) {
      console.log('No recent regular videos found within the last month');
      // 严格模式：没有一个月内的视频就不显示
      return null;
    }
    
    // 返回最新的普通视频
    const latest = regularVideos[0];
    console.log(`Found latest regular video: ${latest.title}`);
    
    return rssToFeedItem(latest, subscriptionId, 0);
  } catch (error) {
    console.error('fetchYoutubeLatest failed:', error);
    return null;
  }
};
