import { Subscription } from './types';

export const INITIAL_SUBSCRIPTIONS: Subscription[] = [
  { id: '1', url: 'https://twitter.com/SpaceX', name: 'SpaceX (X)', platform: 'twitter', addedAt: Date.now() },
  { id: '2', url: 'https://www.youtube.com/@Google', name: 'Google (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '3', url: 'https://www.youtube.com/@NavalR', name: 'NavalR (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '4', url: 'https://twitter.com/dotey', name: 'dotey (X)', platform: 'twitter', addedAt: Date.now() },
  { id: '5', url: 'https://www.youtube.com/@rileybrownai', name: 'rileybrownai (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '6', url: 'https://www.youtube.com/@Zendicay', name: 'Zendicay (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '7', url: 'https://www.youtube.com/@itsbyrobin', name: 'itsbyrobin (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '8', url: 'https://www.youtube.com/@Developete', name: 'Developete (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '9', url: 'https://www.youtube.com/@WebDevCody', name: 'WebDevCody (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '10', url: 'https://www.youtube.com/@NetworkChuck', name: 'NetworkChuck (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '11', url: 'https://www.youtube.com/@indydevdan', name: 'indydevdan (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '12', url: 'https://www.youtube.com/@henrikmdev', name: 'henrikmdev (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '13', url: 'https://www.youtube.com/@OpenAI', name: 'OpenAI (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '14', url: 'https://www.youtube.com/@TinaHuang1', name: 'TinaHuang1 (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '15', url: 'https://www.youtube.com/@tech-shrimp', name: 'tech-shrimp (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '16', url: 'https://www.youtube.com/@eoglobal', name: 'eoglobal (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '17', url: 'https://www.youtube.com/@anthropic-ai', name: 'anthropic-ai (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '18', url: 'https://www.youtube.com/@hackbearterry', name: 'hackbearterry (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '19', url: 'https://www.youtube.com/@jackneel', name: 'jackneel (YouTube)', platform: 'youtube', addedAt: Date.now() },
  { id: '20', url: 'https://www.youtube.com/@TEDx', name: 'TEDx (YouTube)', platform: 'youtube', addedAt: Date.now() },
];

export const PLATFORM_ICONS: Record<string, string> = {
  youtube: 'https://cdn.simpleicons.org/youtube/ff0000',
  twitter: 'https://cdn.simpleicons.org/x/white',
  instagram: 'https://cdn.simpleicons.org/instagram/e4405f',
  github: 'https://cdn.simpleicons.org/github/white',
  other: 'https://cdn.simpleicons.org/rss/white',
};

export const detectPlatform = (url: string): Subscription['platform'] => {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
  if (lower.includes('instagram.com')) return 'instagram';
  return 'other';
};

/**
 * 从 URL 中提取频道/用户名称
 * 支持各种格式：
 * - YouTube: @handle, /c/name, /channel/id, /user/name
 * - Twitter/X: /username
 * - Instagram: /username
 */
export const extractCreatorName = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathname = decodeURIComponent(urlObj.pathname);
    const platform = detectPlatform(url);
    
    if (platform === 'youtube') {
      // 处理 YouTube 各种格式
      // @handle 格式: youtube.com/@HackBear泰瑞
      const handleMatch = pathname.match(/^\/@([^/?]+)/);
      if (handleMatch) return handleMatch[1];
      
      // /c/name 格式: youtube.com/c/HackBear泰瑞
      const cMatch = pathname.match(/^\/c\/([^/?]+)/);
      if (cMatch) return cMatch[1];
      
      // /channel/ID 格式
      const channelMatch = pathname.match(/^\/channel\/([^/?]+)/);
      if (channelMatch) return `Channel: ${channelMatch[1].substring(0, 12)}...`;
      
      // /user/name 格式
      const userMatch = pathname.match(/^\/user\/([^/?]+)/);
      if (userMatch) return userMatch[1];
      
      return urlObj.hostname;
    }
    
    if (platform === 'twitter') {
      // twitter.com/username 或 x.com/username
      const twitterMatch = pathname.match(/^\/([^/?]+)/);
      if (twitterMatch && !['home', 'explore', 'notifications', 'messages', 'i'].includes(twitterMatch[1])) {
        return twitterMatch[1];
      }
      return urlObj.hostname;
    }
    
    if (platform === 'instagram') {
      // instagram.com/username
      const instaMatch = pathname.match(/^\/([^/?]+)/);
      if (instaMatch && !['explore', 'reels', 'stories', 'direct'].includes(instaMatch[1])) {
        return instaMatch[1];
      }
      return urlObj.hostname;
    }
    
    return urlObj.hostname;
  } catch (e) {
    console.error('Error extracting creator name:', e);
    return 'Unknown';
  }
};

/**
 * 标准化 URL，移除不必要的参数
 */
export const normalizeUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    // 移除一些不必要的参数
    const paramsToRemove = ['app', 'feature', 'sub_confirmation'];
    paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
    return urlObj.toString();
  } catch (e) {
    return url;
  }
};

/**
 * 验证 URL 是否是有效的订阅来源
 */
export const validateSubscriptionUrl = (url: string): { valid: boolean; error?: string } => {
  try {
    const urlObj = new URL(url);
    const platform = detectPlatform(url);
    
    if (platform === 'youtube') {
      // 检查是否是频道页面而不是视频页面
      if (urlObj.pathname.includes('/watch') || urlObj.pathname.includes('/shorts/')) {
        return { valid: false, error: '请输入 YouTube 频道主页链接，而不是视频链接' };
      }
    }
    
    if (platform === 'twitter') {
      // 检查是否是用户主页而不是具体推文
      if (urlObj.pathname.includes('/status/')) {
        return { valid: false, error: '请输入 Twitter 用户主页链接，而不是推文链接' };
      }
    }
    
    return { valid: true };
  } catch (e) {
    return { valid: false, error: '请输入有效的 URL' };
  }
};