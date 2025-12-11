import React, { useRef } from 'react';
import { RefreshCw, Menu, Clock, Download, Upload, Key, Crown } from 'lucide-react';
import { Subscription } from '../types';
import { isLicenseActivated } from '../services/licenseService';

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenSidebar: () => void;
  lastUpdated: Date | null;
  subscriptions: Subscription[];
  onImportSubscriptions: (subs: Subscription[]) => void;
  onOpenLicense: () => void;
  isActivated: boolean;
}

// 格式化相对时间
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
};

const Header: React.FC<HeaderProps> = ({ onRefresh, isRefreshing, onOpenSidebar, lastUpdated, subscriptions, onImportSubscriptions, onOpenLicense, isActivated }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 导出订阅列表
  const handleExport = () => {
    const data = JSON.stringify(subscriptions, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contentdash-subscriptions-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入订阅列表
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as Subscription[];
        if (Array.isArray(imported) && imported.every(s => s.id && s.url && s.name)) {
          onImportSubscriptions(imported);
        } else {
          alert('无效的订阅文件格式');
        }
      } catch {
        alert('文件解析失败');
      }
    };
    reader.readAsText(file);
    // 清空 input 以便重复导入同一文件
    e.target.value = '';
  };

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button 
          onClick={onOpenSidebar}
          className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
        >
          <Menu size={24} />
        </button>
        <div>
          <h2 className="text-lg font-bold text-zinc-100 hidden md:block">最新动态</h2>
          <h2 className="text-lg font-bold text-zinc-100 md:hidden">ContentDash</h2>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {lastUpdated && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500">
            <Clock size={12} />
            <span>更新于 {formatRelativeTime(lastUpdated)}</span>
          </div>
        )}
        
        {/* 授权按钮 */}
        <button
          onClick={onOpenLicense}
          title={isActivated ? '已激活' : '激活授权'}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            isActivated
              ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
          }`}
        >
          {isActivated ? <Crown size={16} /> : <Key size={16} />}
          <span className="hidden sm:inline">{isActivated ? 'Pro' : '激活'}</span>
        </button>

        {/* 导入/导出按钮 */}
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="导入订阅"
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <Upload size={18} />
          </button>
          <button
            onClick={handleExport}
            title="导出订阅"
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <Download size={18} />
          </button>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
            ${isRefreshing 
              ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 active:scale-95'
            }
          `}
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          <span>{isRefreshing ? '同步中...' : '更新 Feed'}</span>
        </button>
      </div>
    </header>
  );
};

export default Header;