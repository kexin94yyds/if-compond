import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import FeedCard from './components/FeedCard';
import LicenseModal from './components/LicenseModal';
import { Subscription, FeedItem } from './types';
import { INITIAL_SUBSCRIPTIONS, detectPlatform, normalizeUrl } from './constants';
import { fetchFeedUpdates, fetchSingleFeedUpdate } from './services/feedService';
import { isLicenseActivated } from './services/licenseService';
import { Sparkles, LayoutGrid, AlertTriangle, RefreshCw } from 'lucide-react';

// 版本号 - 更新此值会清除旧数据并使用新的初始订阅
const APP_VERSION = '2.1.0';
const MAX_FREE_USES = 3; // 免费试用次数

const App: React.FC = () => {
  // State for subscriptions, initialized from localStorage
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => {
    const saved = localStorage.getItem('subscriptions');
    return saved ? JSON.parse(saved) : [];
  });
  
  // 检查版本并加载默认订阅
  useEffect(() => {
    const savedVersion = localStorage.getItem('appVersion');
    if (savedVersion !== APP_VERSION) {
      localStorage.removeItem('subscriptions');
      localStorage.removeItem('feedItems');
      localStorage.removeItem('lastUpdated');
      localStorage.setItem('appVersion', APP_VERSION);
      
      // 从 JSON 文件加载默认订阅
      fetch('/default-subscriptions.json')
        .then(res => res.json())
        .then((data: Subscription[]) => {
          setSubscriptions(data);
          localStorage.setItem('subscriptions', JSON.stringify(data));
        })
        .catch(() => {
          // 回退到 constants 中的默认值
          setSubscriptions(INITIAL_SUBSCRIPTIONS);
        });
    } else if (subscriptions.length === 0) {
      // 如果没有保存的订阅，尝试加载默认订阅
      fetch('/default-subscriptions.json')
        .then(res => res.json())
        .then((data: Subscription[]) => {
          setSubscriptions(data);
        })
        .catch(() => {
          setSubscriptions(INITIAL_SUBSCRIPTIONS);
        });
    }
  }, []);

  const [feedItems, setFeedItems] = useState<FeedItem[]>(() => {
      const saved = localStorage.getItem('feedItems');
      return saved ? JSON.parse(saved) : [];
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    const saved = localStorage.getItem('lastUpdated');
    return saved ? new Date(saved) : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'youtube' | 'twitter'>('all');

  const sortFeedItems = useCallback((items: FeedItem[]) => {
    return [...items].sort((a, b) => {
      // 1. 置顶订阅的内容优先
      const subA = subscriptions.find(s => s.id === a.subscriptionId);
      const subB = subscriptions.find(s => s.id === b.subscriptionId);
      const pinnedA = subA?.pinned ? 1 : 0;
      const pinnedB = subB?.pinned ? 1 : 0;
      if (pinnedB !== pinnedA) return pinnedB - pinnedA;

      // 2. 同等置顶状态下按发布时间排序
      const taRaw = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tbRaw = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      const ta = Number.isNaN(taRaw) ? 0 : taRaw;
      const tb = Number.isNaN(tbRaw) ? 0 : tbRaw;
      if (tb !== ta) return tb - ta;
      return b.id.localeCompare(a.id);
    });
  }, [subscriptions]);
  
  // 授权状态
  const [isActivated, setIsActivated] = useState(() => isLicenseActivated());
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  
  // 试用次数追踪
  const [usageCount, setUsageCount] = useState<number>(() => {
    const saved = localStorage.getItem('usageCount');
    return saved ? parseInt(saved, 10) : 0;
  });
  const remainingUses = Math.max(0, MAX_FREE_USES - usageCount);

  // Persist subscriptions
  useEffect(() => {
    localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
  }, [subscriptions]);

  // Persist feed items
  useEffect(() => {
    localStorage.setItem('feedItems', JSON.stringify(feedItems));
  }, [feedItems]);
  
  // Persist last updated time
  useEffect(() => {
    if (lastUpdated) {
      localStorage.setItem('lastUpdated', lastUpdated.toISOString());
    }
  }, [lastUpdated]);

  const handleAddSubscription = async (url: string, name: string) => {
    const normalizedUrl = normalizeUrl(url);
    const newSub: Subscription = {
      id: Date.now().toString(),
      url: normalizedUrl,
      name,
      platform: detectPlatform(url),
      addedAt: Date.now(),
    };
    setSubscriptions(prev => [...prev, newSub]);
    // 清除错误状态，因为用户添加了新订阅
    setError(null);
    
    // 自动获取新订阅的内容
    setRefreshProgress(`正在获取 ${name} 的最新内容...`);
    try {
      const feedItem = await fetchSingleFeedUpdate(newSub);
      if (feedItem && feedItem.title && feedItem.link !== '#') {
        // 添加到 feed 列表顶部
        setFeedItems(prev => [feedItem, ...prev]);
        setLastUpdated(new Date());
        console.log(`✅ Auto-fetched content for ${name}:`, feedItem.title);
      } else {
        console.warn(`⚠️ Could not fetch content for ${name}`);
      }
    } catch (err) {
      console.error(`Failed to auto-fetch for ${name}:`, err);
    } finally {
      setRefreshProgress('');
    }
  };

  const handleRemoveSubscription = (id: string) => {
    setSubscriptions(prev => prev.filter(s => s.id !== id));
    // 同时移除相关的 feed items
    setFeedItems(prev => prev.filter(item => item.subscriptionId !== id));
  };

  const handleTogglePin = (id: string) => {
    setSubscriptions(prev => prev.map(s => 
      s.id === id ? { ...s, pinned: !s.pinned } : s
    ));
  };

  // 导入订阅列表（合并去重）
  const handleImportSubscriptions = (imported: Subscription[]) => {
    setSubscriptions(prev => {
      const existingUrls = new Set(prev.map(s => normalizeUrl(s.url)));
      const newSubs = imported.filter(s => !existingUrls.has(normalizeUrl(s.url)));
      return [...prev, ...newSubs];
    });
  };

  const refreshFeed = useCallback(async () => {
    // 检查试用限制（已激活用户不受限制）
    if (!isActivated && usageCount >= MAX_FREE_USES) {
      // 清空内容，强制激活
      setFeedItems([]);
      localStorage.removeItem('feedItems');
      setIsLicenseModalOpen(true);
      setError('免费试用已结束，请激活以继续使用');
      return;
    }
    
    // 根据平台过滤器确定要更新的订阅
    const subsToRefresh = platformFilter === 'all' 
      ? subscriptions 
      : subscriptions.filter(s => s.platform === platformFilter);
    
    if (subsToRefresh.length === 0) {
      setError(platformFilter === 'all' ? '请先添加订阅源' : `没有 ${platformFilter === 'youtube' ? 'YouTube' : 'X'} 订阅源`);
      return;
    }
    
    setIsRefreshing(true);
    setError(null);
    const platformLabel = platformFilter === 'youtube' ? 'YouTube' : platformFilter === 'twitter' ? 'X' : '';
    setRefreshProgress(`正在获取 ${subsToRefresh.length} 个${platformLabel}订阅的最新内容...`);
    
    try {
      const newItems = await fetchFeedUpdates(subsToRefresh, { forceRefresh: true });
      
      // 过滤有效的 items
      const validItems = sortFeedItems(newItems.filter(i => i.title && i.link && i.link !== '#'));
      
      if (validItems.length === 0) {
        setError('未能获取到任何内容，请稍后重试');
      } else {
        // 如果是过滤刷新，只更新对应平台的 items，保留其他平台的
        if (platformFilter !== 'all') {
          setFeedItems(prev => {
            // 移除当前平台的旧 items，添加新的
            const otherPlatformItems = prev.filter(item => {
              const sub = subscriptions.find(s => s.id === item.subscriptionId);
              return sub && sub.platform !== platformFilter;
            });
            return sortFeedItems([...validItems, ...otherPlatformItems]);
          });
        } else {
          setFeedItems(validItems);
        }
        setLastUpdated(new Date());
        
        // 未激活用户增加使用次数
        if (!isActivated) {
          const newCount = usageCount + 1;
          setUsageCount(newCount);
          localStorage.setItem('usageCount', newCount.toString());
        }
        
        // 如果部分订阅没有获取到内容，显示警告
        if (validItems.length < subsToRefresh.length) {
          console.warn(`只获取到 ${validItems.length}/${subsToRefresh.length} 个订阅的内容`);
        }
      }
    } catch (err) {
      console.error("Failed to refresh feed", err);
      setError(err instanceof Error ? err.message : '获取内容失败，请检查网络连接后重试');
    } finally {
      setIsRefreshing(false);
      setRefreshProgress('');
    }
  }, [subscriptions, platformFilter, isActivated, usageCount, sortFeedItems]);

  // Get subscription name helper
  const getSubName = (subId: string) => {
    const sub = subscriptions.find(s => s.id === subId);
    return sub ? sub.name : 'Unknown Source';
  };

  // 根据平台过滤器过滤 feedItems
  const filteredFeedItems = useMemo(() => {
    if (platformFilter === 'all') return feedItems;
    return feedItems.filter(item => {
      const sub = subscriptions.find(s => s.id === item.subscriptionId);
      return sub && sub.platform === platformFilter;
    });
  }, [feedItems, subscriptions, platformFilter]);

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-200 font-sans">
      <Sidebar 
        subscriptions={subscriptions}
        onAddSubscription={handleAddSubscription}
        onRemoveSubscription={handleRemoveSubscription}
        onTogglePin={handleTogglePin}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        platformFilter={platformFilter}
        onPlatformFilterChange={setPlatformFilter}
      />

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <Header 
          onRefresh={refreshFeed} 
          isRefreshing={isRefreshing}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          lastUpdated={lastUpdated}
          subscriptions={subscriptions}
          onImportSubscriptions={handleImportSubscriptions}
          onOpenLicense={() => setIsLicenseModalOpen(true)}
          isActivated={isActivated}
          remainingUses={remainingUses}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {/* 错误提示 */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
              <AlertTriangle className="text-red-400 shrink-0" size={20} />
              <div className="flex-1">
                <p className="text-sm text-red-400">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                关闭
              </button>
            </div>
          )}
          
          {/* 加载进度 */}
          {isRefreshing && (
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
              <RefreshCw className="text-blue-400 animate-spin shrink-0" size={20} />
              <div className="flex-1">
                <p className="text-sm text-blue-400">{refreshProgress || '正在加载...'}</p>
              </div>
            </div>
          )}
          
          {filteredFeedItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredFeedItems.map((item) => (
                <FeedCard 
                  key={item.id} 
                  item={item} 
                  subscriptionName={getSubName(item.subscriptionId)}
                />
              ))}
            </div>
          ) : !isRefreshing && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20 px-4">
              <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800">
                <LayoutGrid className="text-zinc-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-zinc-100 mb-2">您的 Feed 还是空的</h3>
              <p className="text-zinc-500 max-w-md mx-auto mb-8">
                在左侧添加您喜欢的创作者，然后点击"更新 Feed"按钮，通过 Gemini AI 获取最新内容。
              </p>
              
              {subscriptions.length > 0 && (
                  <button 
                    onClick={refreshFeed}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 bg-zinc-100 hover:bg-white text-zinc-900 px-6 py-3 rounded-full font-semibold transition-all active:scale-95"
                  >
                    <Sparkles size={18} className="text-purple-600" />
                    <span>立即生成 Feed</span>
                  </button>
              )}
              
              {subscriptions.length === 0 && (
                <p className="text-zinc-600 text-sm mt-4">
                  💡 提示：支持 YouTube 频道、Twitter/X 用户主页链接
                </p>
              )}
            </div>
          )}
        </main>
      </div>
      
      {/* 授权弹窗 */}
      <LicenseModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
        onActivated={() => setIsActivated(true)}
      />
    </div>
  );
};

export default App;