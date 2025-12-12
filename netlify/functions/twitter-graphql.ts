import type { Handler } from '@netlify/functions';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { getStore } from '@netlify/blobs';

// Twitter GraphQL API endpoints
const TWITTER_GRAPHQL_BASE = 'https://api.twitter.com/graphql';

// 缓存配置：30 分钟
const CACHE_TTL_SECONDS = 30 * 60;

// 检测是否需要代理（仅本地开发环境）
const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const isLocalDev = process.env.NETLIFY_DEV === 'true' || !process.env.NETLIFY;

// 模拟浏览器 User-Agent
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 使用代理的 fetch（仅本地开发时）
const fetchWithProxy = async (url: string, options: any = {}) => {
  // 添加默认请求头
  const headers = {
    ...options.headers,
    'User-Agent': USER_AGENT,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  
  if (isLocalDev && PROXY_URL) {
    // 本地开发：使用代理
    const proxyAgent = new ProxyAgent(PROXY_URL || 'http://127.0.0.1:7897');
    return undiciFetch(url, {
      ...options,
      headers,
      dispatcher: proxyAgent,
    });
  } else {
    // 生产环境：直接访问
    return fetch(url, { ...options, headers });
  }
};

// Bearer token (public, used by Twitter web app)
const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// 从环境变量获取 Twitter cookies
const getTwitterCookies = () => {
  const ct0 = process.env.TWITTER_CT0 || '';
  const authToken = process.env.TWITTER_AUTH_TOKEN || '';
  return { ct0, authToken };
};

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const username = event.queryStringParameters?.username;
  const action = event.queryStringParameters?.action || 'user'; // user, tweets
  const countParam = event.queryStringParameters?.count;
  const count = countParam ? Math.max(1, Math.min(100, parseInt(countParam, 10) || 20)) : 20;

  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing username parameter' }),
    };
  }

  const { ct0, authToken } = getTwitterCookies();
  
  if (!ct0 || !authToken) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Twitter credentials not configured',
        hint: 'Set TWITTER_CT0 and TWITTER_AUTH_TOKEN environment variables'
      }),
    };
  }

  try {
    if (action === 'user') {
      // 获取用户信息
      const user = await fetchUserByScreenName(username, ct0, authToken);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok', user }),
      };
    } else if (action === 'tweets') {
      // 检查缓存（仅生产环境）
      if (process.env.NETLIFY) {
        try {
          const store = getStore('twitter-cache');
          const cacheKey = `tweets-${username}`;
          const cached = await store.get(cacheKey, { type: 'json' });
          if (cached) {
            console.log(`📦 Cache hit for @${username}`);
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ status: 'ok', tweets: cached, cached: true }),
            };
          }
        } catch (e) {
          console.log('Cache read error:', e);
        }
      }
      
      // 获取用户推文
      const tweets = await fetchUserTweets(username, ct0, authToken, count);
      
      // 存储到缓存（仅生产环境）
      if (process.env.NETLIFY) {
        try {
          const store = getStore('twitter-cache');
          const cacheKey = `tweets-${username}`;
          await store.setJSON(cacheKey, tweets, { metadata: { ttl: CACHE_TTL_SECONDS } });
          console.log(`💾 Cached tweets for @${username}`);
        } catch (e) {
          console.log('Cache write error:', e);
        }
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok', tweets }),
      };
    }
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid action' }),
    };
  } catch (error: any) {
    console.error('Twitter GraphQL error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch from Twitter',
        message: error.message 
      }),
    };
  }
};

async function fetchUserByScreenName(screenName: string, ct0: string, authToken: string) {
  const variables = JSON.stringify({ screen_name: screenName });
  const features = JSON.stringify({
    hidden_profile_subscriptions_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: true,
    subscriptions_feature_can_gift_premium: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
  });

  const url = `${TWITTER_GRAPHQL_BASE}/xmU6X_CKVnQ5lSrCbAmJsg/UserByScreenName?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;

  const response = await fetchWithProxy(url, {
    headers: {
      'authorization': `Bearer ${decodeURIComponent(BEARER_TOKEN)}`,
      'cookie': `ct0=${ct0}; auth_token=${authToken}`,
      'x-csrf-token': ct0,
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': 'en',
    },
  });

  if (!response.ok) {
    throw new Error(`Twitter API returned ${response.status}`);
  }

  const data = await response.json() as any;
  const user = data?.data?.user?.result?.legacy;
  
  if (!user) {
    throw new Error('User not found');
  }

  return {
    id: data.data.user.result.rest_id,
    username: user.screen_name,
    name: user.name,
    description: user.description,
    profileImageUrl: user.profile_image_url_https?.replace('_normal', '_400x400'),
    followersCount: user.followers_count,
    followingCount: user.friends_count,
    tweetCount: user.statuses_count,
    verified: data.data.user.result.is_blue_verified,
  };
}

async function fetchUserTweets(screenName: string, ct0: string, authToken: string, count: number = 20) {
  // 先获取用户 ID
  const user = await fetchUserByScreenName(screenName, ct0, authToken);
  const userId = user.id;

  const variables = JSON.stringify({
    userId,
    count,
    includePromotedContent: false,
    withQuickPromoteEligibilityTweetFields: false,
    withVoice: true,
    withV2Timeline: true,
  });
  
  const features = JSON.stringify({
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_enhance_cards_enabled: false,
  });

  const url = `${TWITTER_GRAPHQL_BASE}/E3opETHurmVJflFsUBVuUQ/UserTweets?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;

  const response = await fetchWithProxy(url, {
    headers: {
      'authorization': `Bearer ${decodeURIComponent(BEARER_TOKEN)}`,
      'cookie': `ct0=${ct0}; auth_token=${authToken}`,
      'x-csrf-token': ct0,
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': 'en',
    },
  });

  if (!response.ok) {
    throw new Error(`Twitter API returned ${response.status}`);
  }

  const data = await response.json() as any;
  
  // 解析推文数据
  const tweets: any[] = [];
  const instructions = data?.data?.user?.result?.timeline_v2?.timeline?.instructions || [];
  
  for (const instruction of instructions) {
    if (instruction.type === 'TimelineAddEntries') {
      for (const entry of instruction.entries || []) {
        const tweet = entry?.content?.itemContent?.tweet_results?.result;
        if (tweet && tweet.__typename === 'Tweet') {
          const legacy = tweet.legacy;
          if (legacy) {
            // 提取媒体 - 优先从当前推文，然后从转推/引用推文中获取
            let media = legacy.extended_entities?.media || [];
            let imageUrl = media.find((m: any) => m.type === 'photo')?.media_url_https;
            
            // 如果当前推文没有图片，检查是否是转推
            if (!imageUrl && tweet.legacy?.retweeted_status_result?.result) {
              const rtLegacy = tweet.legacy.retweeted_status_result.result.legacy;
              if (rtLegacy) {
                const rtMedia = rtLegacy.extended_entities?.media || [];
                imageUrl = rtMedia.find((m: any) => m.type === 'photo')?.media_url_https;
              }
            }
            
            // 检查引用推文
            if (!imageUrl && tweet.quoted_status_result?.result?.legacy) {
              const qtLegacy = tweet.quoted_status_result.result.legacy;
              const qtMedia = qtLegacy.extended_entities?.media || [];
              imageUrl = qtMedia.find((m: any) => m.type === 'photo')?.media_url_https;
            }
            
            tweets.push({
              id: tweet.rest_id,
              text: legacy.full_text,
              createdAt: legacy.created_at,
              retweetCount: legacy.retweet_count,
              likeCount: legacy.favorite_count,
              replyCount: legacy.reply_count,
              imageUrl,
              link: `https://x.com/${screenName}/status/${tweet.rest_id}`,
            });
          }
        }
      }
    }
  }

  return {
    user,
    tweets: tweets.slice(0, count),
  };
}

export { handler };
