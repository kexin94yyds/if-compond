/**
 * Feed 服务 - 纯 RSS 实现
 * 不使用 AI，直接从 RSS 获取真实数据
 */

import { FeedItem, Subscription } from "../types";
import { fetchYoutubeLatest } from "./youtubeService";
import { fetchTwitterLatest, fetchTwitterMultiple, TwitterFetchOptions } from "./twitterService";

/**
 * 获取所有订阅的最新内容（仅使用 RSS）
 */
export const fetchFeedUpdates = async (
  subscriptions: Subscription[],
  options?: { forceRefresh?: boolean }
): Promise<FeedItem[]> => {
  if (subscriptions.length === 0) return [];

  const results: FeedItem[] = [];
  
  // 置顶的优先处理
  const sortedSubs = [...subscriptions].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  console.log(`📡 Fetching RSS feeds for ${sortedSubs.length} subscriptions...`);
  
  // 并行获取所有订阅
  const promises = sortedSubs.map(async (sub): Promise<FeedItem | FeedItem[] | null> => {
    try {
      // YouTube RSS
      if (sub.platform === 'youtube') {
        const result = await fetchYoutubeLatest(sub.url, sub.id);
        if (result) {
          console.log(`✅ YouTube: ${sub.name} -> ${result.title}`);
          return result;
        } else {
          console.log(`⚠️ ${sub.name}: 无一个月内的视频或获取失败`);
          return null;
        }
      }
      
      // Twitter RSS (通过 GraphQL API 获取多条推文)
      if (sub.platform === 'twitter') {
        const twitterOptions: TwitterFetchOptions = {
          forceRefresh: options?.forceRefresh,
          days: 30,
          replyLimit: 10,
        };
        const tweetResults = await fetchTwitterMultiple(sub.url, sub.id, 50, twitterOptions);
        if (tweetResults.length > 0) {
          console.log(`✅ Twitter: ${sub.name} -> ${tweetResults.length} tweets`);
          return tweetResults; // 返回数组
        } else {
          console.log(`⚠️ ${sub.name}: Twitter RSS 获取失败`);
          return null;
        }
      }
      
      // 其他平台暂不支持
      console.log(`⚠️ ${sub.name}: 平台 ${sub.platform} 暂不支持`);
      return null;
    } catch (error) {
      console.error(`❌ ${sub.name}: 获取失败`, error);
      return null;
    }
  });

  const allResults = await Promise.all(promises);
  
  // 过滤掉 null 结果，支持数组类型
  for (const result of allResults) {
    if (result) {
      if (Array.isArray(result)) {
        results.push(...result);
      } else {
        results.push(result);
      }
    }
  }

  console.log(`🎉 Successfully fetched ${results.length}/${subscriptions.length} feeds`);
  return results;
};

/**
 * 获取单个订阅的最新内容
 */
export const fetchSingleFeedUpdate = async (subscription: Subscription): Promise<FeedItem | null> => {
  const results = await fetchFeedUpdates([subscription]);
  return results.length > 0 ? results[0] : null;
};
