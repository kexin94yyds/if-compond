import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import FeedCard from './components/FeedCard';
import { Subscription, FeedItem } from './types';
import { INITIAL_SUBSCRIPTIONS, detectPlatform, normalizeUrl } from './constants';
import { fetchFeedUpdates, fetchSingleFeedUpdate } from './services/feedService';
import { Sparkles, LayoutGrid, AlertTriangle, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  // State for subscriptions, initialized from localStorage or defaults
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => {
    const saved = localStorage.getItem('subscriptions');
    return saved ? JSON.parse(saved) : INITIAL_SUBSCRIPTIONS;
  });

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

  const refreshFeed = useCallback(async () => {
    if (subscriptions.length === 0) {
      setError('请先添加订阅源');
      return;
    }
    
    setIsRefreshing(true);
    setError(null);
    setRefreshProgress(`正在获取 ${subscriptions.length} 个订阅的最新内容...`);
    
    try {
      const newItems = await fetchFeedUpdates(subscriptions);
      
      // 过滤有效的 items
      const validItems = newItems.filter(i => i.title && i.link && i.link !== '#');
      
      if (validItems.length === 0) {
        setError('未能获取到任何内容，请稍后重试');
      } else {
        setFeedItems(validItems);
        setLastUpdated(new Date());
        
        // 如果部分订阅没有获取到内容，显示警告
        if (validItems.length < subscriptions.length) {
          console.warn(`只获取到 ${validItems.length}/${subscriptions.length} 个订阅的内容`);
        }
      }
    } catch (err) {
      console.error("Failed to refresh feed", err);
      setError(err instanceof Error ? err.message : '获取内容失败，请检查网络连接后重试');
    } finally {
      setIsRefreshing(false);
      setRefreshProgress('');
    }
  }, [subscriptions]);

  // Get subscription name helper
  const getSubName = (subId: string) => {
    const sub = subscriptions.find(s => s.id === subId);
    return sub ? sub.name : 'Unknown Source';
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-200 font-sans">
      <Sidebar 
        subscriptions={subscriptions}
        onAddSubscription={handleAddSubscription}
        onRemoveSubscription={handleRemoveSubscription}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <Header 
          onRefresh={refreshFeed} 
          isRefreshing={isRefreshing}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          lastUpdated={lastUpdated}
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
          
          {feedItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {feedItems.map((item) => (
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
    </div>
  );
};

export default App;