import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Globe, Link as LinkIcon, X, AlertCircle, CheckCircle, Loader2, Pin } from 'lucide-react';
import { Subscription } from '../types';
import { detectPlatform, PLATFORM_ICONS, extractCreatorName, validateSubscriptionUrl, normalizeUrl } from '../constants';

/**
 * 获取频道/用户头像 URL
 * 使用 unavatar.io 服务（免费，无 CORS 限制）
 */
const getAvatarUrl = (url: string, platform: string): string | null => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    if (platform === 'youtube') {
      // 提取 @handle 或频道名
      const handleMatch = pathname.match(/^\/@([^/?]+)/);
      if (handleMatch) {
        return `https://unavatar.io/youtube/${handleMatch[1]}`;
      }
      const cMatch = pathname.match(/^\/c\/([^/?]+)/);
      if (cMatch) {
        return `https://unavatar.io/youtube/${cMatch[1]}`;
      }
    }
    
    if (platform === 'twitter') {
      // 提取用户名
      const userMatch = pathname.match(/^\/([^/?]+)/);
      if (userMatch && !['home', 'explore', 'notifications', 'messages', 'i'].includes(userMatch[1])) {
        return `https://unavatar.io/twitter/${userMatch[1]}`;
      }
    }
    
    return null;
  } catch {
    return null;
  }
};

interface SidebarProps {
  subscriptions: Subscription[];
  onAddSubscription: (url: string, name: string) => void | Promise<void>;
  onRemoveSubscription: (id: string) => void;
  onTogglePin: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  subscriptions, 
  onAddSubscription, 
  onRemoveSubscription,
  onTogglePin,
  isOpen,
  onClose
}) => {
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [suggestedName, setSuggestedName] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // 当 URL 改变时，自动提取名称建议
  useEffect(() => {
    if (!newUrl.trim()) {
      setSuggestedName('');
      setUrlError(null);
      return;
    }

    const timer = setTimeout(() => {
      setIsValidating(true);
      try {
        // 验证 URL
        const validation = validateSubscriptionUrl(newUrl);
        if (!validation.valid) {
          setUrlError(validation.error || '无效的 URL');
          setSuggestedName('');
          setIsValidating(false);
          return;
        }
        
        // 提取创作者名称
        const extracted = extractCreatorName(newUrl);
        const platform = detectPlatform(newUrl);
        const platformLabel = platform === 'youtube' ? 'YouTube' : 
                             platform === 'twitter' ? 'X' : 
                             platform === 'instagram' ? 'Instagram' : '';
        
        setSuggestedName(platformLabel ? `${extracted} (${platformLabel})` : extracted);
        setUrlError(null);
      } catch (e) {
        setUrlError('请输入有效的 URL');
        setSuggestedName('');
      }
      setIsValidating(false);
    }, 300); // 防抖

    return () => clearTimeout(timer);
  }, [newUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim() || isAdding) return;
    
    // 验证 URL
    const validation = validateSubscriptionUrl(newUrl);
    if (!validation.valid) {
      setUrlError(validation.error || '无效的 URL');
      return;
    }
    
    // 检查是否已存在
    const normalizedUrl = normalizeUrl(newUrl);
    const exists = subscriptions.some(sub => normalizeUrl(sub.url) === normalizedUrl);
    if (exists) {
      setUrlError('此链接已经订阅过了');
      return;
    }
    
    // 使用用户输入的名称，或建议的名称，或默认名称
    const finalName = newName.trim() || suggestedName || extractCreatorName(newUrl);
    
    // 开始添加
    setIsAdding(true);
    try {
      await onAddSubscription(normalizedUrl, finalName);
    } finally {
      setIsAdding(false);
    }
    
    setNewUrl('');
    setNewName('');
    setSuggestedName('');
    setUrlError(null);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-full w-80 bg-zinc-900 border-r border-zinc-800 
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:block
      `}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              ContentDash
            </h1>
            <button onClick={onClose} className="md:hidden text-zinc-400 hover:text-white">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mb-8 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1 uppercase tracking-wider">
                添加订阅
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-3 text-zinc-500" size={16} />
                <input
                  type="url"
                  placeholder="https://youtube.com/@channel 或 twitter.com/user"
                  className={`w-full bg-zinc-950 border rounded-lg py-2.5 pl-10 pr-10 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 transition-all ${
                    urlError 
                      ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' 
                      : suggestedName 
                        ? 'border-green-500/50 focus:ring-green-500/50 focus:border-green-500/50'
                        : 'border-zinc-800 focus:ring-blue-500/50 focus:border-blue-500/50'
                  }`}
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  required
                />
                {/* 状态指示器 */}
                <div className="absolute right-3 top-3">
                  {isValidating && <Loader2 size={16} className="text-zinc-500 animate-spin" />}
                  {!isValidating && urlError && <AlertCircle size={16} className="text-red-400" />}
                  {!isValidating && suggestedName && !urlError && <CheckCircle size={16} className="text-green-400" />}
                </div>
              </div>
              
              {/* 错误提示 */}
              {urlError && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {urlError}
                </p>
              )}
              
              {/* 识别到的名称提示 */}
              {suggestedName && !urlError && (
                <p className="mt-1.5 text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle size={12} />
                  识别为: {suggestedName}
                </p>
              )}
            </div>
            
            <input
              type="text"
              placeholder={suggestedName ? `自定义名称 (默认: ${suggestedName})` : "名称 (可选)"}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            
            <button
              type="submit"
              disabled={!!urlError || !newUrl.trim() || isAdding}
              className={`w-full font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all ${
                urlError || !newUrl.trim() || isAdding
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-100 hover:bg-white text-zinc-900 active:scale-[0.98]'
              }`}
            >
              {isAdding ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>正在获取内容...</span>
                </>
              ) : (
                <>
                  <Plus size={18} />
                  <span>添加来源</span>
                </>
              )}
            </button>
          </form>

          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <h2 className="text-xs font-semibold text-zinc-500 mb-4 uppercase tracking-wider">
              已订阅 ({subscriptions.length})
            </h2>
            <div className="space-y-2">
              {/* 置顶的排在前面 */}
              {[...subscriptions].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map((sub) => {
                // 安全地获取 hostname
                let hostname = '';
                try {
                  hostname = new URL(sub.url).hostname;
                } catch (e) {
                  hostname = sub.url;
                }
                
                return (
                  <div
                    key={sub.id}
                    className={`group flex items-center justify-between p-3 rounded-lg transition-colors border ${
                      sub.pinned 
                        ? 'bg-violet-900/20 border-violet-700/50 hover:bg-violet-900/30' 
                        : 'bg-zinc-800/50 hover:bg-zinc-800 border-transparent hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
                         {/* 尝试显示频道/用户头像，失败则显示平台图标 */}
                         <img 
                           src={getAvatarUrl(sub.url, sub.platform) || PLATFORM_ICONS[sub.platform] || PLATFORM_ICONS.other} 
                           alt={sub.name}
                           className={getAvatarUrl(sub.url, sub.platform) ? "w-full h-full object-cover" : "w-4 h-4 opacity-80"}
                           onError={(e) => {
                             // 头像加载失败，回退到平台图标
                             const img = e.target as HTMLImageElement;
                             img.src = PLATFORM_ICONS[sub.platform] || PLATFORM_ICONS.other;
                             img.className = "w-4 h-4 opacity-80";
                           }}
                         />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-zinc-200 truncate">
                          {sub.name}
                        </span>
                        <span className="text-xs text-zinc-500 truncate">
                          {hostname}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onTogglePin(sub.id)}
                        className={`p-2 transition-all ${
                          sub.pinned 
                            ? 'text-violet-400 opacity-100' 
                            : 'text-zinc-500 hover:text-violet-400 opacity-0 group-hover:opacity-100'
                        }`}
                        title={sub.pinned ? '取消置顶' : '置顶'}
                      >
                        <Pin size={16} className={sub.pinned ? 'fill-current' : ''} />
                      </button>
                      <button
                        onClick={() => onRemoveSubscription(sub.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-400 transition-all"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {subscriptions.length === 0 && (
                <div className="text-center py-8 px-4 border-2 border-dashed border-zinc-800 rounded-xl">
                  <Globe className="mx-auto text-zinc-600 mb-2" size={24} />
                  <p className="text-sm text-zinc-500">暂无订阅</p>
                  <p className="text-xs text-zinc-600 mt-1">添加 YouTube 或 Twitter 链接开始</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-zinc-800 text-xs text-zinc-600 text-center">
            Powered by Gemini 2.5 Flash
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;