import React, { useState, useEffect, useMemo } from 'react';
import { ExternalLink, Calendar, Share2, PlayCircle } from 'lucide-react';
import { FeedItem } from '../types';

interface FeedCardProps {
  item: FeedItem;
  subscriptionName: string;
}

/**
 * 获取 YouTube 视频 ID
 * 支持多种 YouTube URL 格式，确保返回有效的 11 位视频 ID
 */
const getYoutubeVideoId = (link: string): string | null => {
    if (!link) return null;
    
    // 多种匹配模式
    const patterns = [
      /[?&]v=([a-zA-Z0-9_-]{11})/,              // youtube.com/watch?v=
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,         // youtu.be/
      /\/embed\/([a-zA-Z0-9_-]{11})/,           // youtube.com/embed/
      /\/shorts\/([a-zA-Z0-9_-]{11})/,          // youtube.com/shorts/
      /\/v\/([a-zA-Z0-9_-]{11})/,               // youtube.com/v/
    ];
    
    for (const pattern of patterns) {
      const match = link.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
};

/**
 * 获取 YouTube 缩略图 URL（使用更可靠的格式）
 * YouTube 缩略图格式优先级：hqdefault > mqdefault > sddefault > maxresdefault
 */
const getYoutubeThumbnail = (link: string, quality: 'hq' | 'mq' | 'sd' | 'maxres' = 'hq'): string | null => {
    const videoId = getYoutubeVideoId(link);
    if (!videoId) return null;
    
    const qualityMap = {
        'hq': 'hqdefault',
        'mq': 'mqdefault',
        'sd': 'sddefault',
        'maxres': 'maxresdefault'
    };
    
    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
};

const FeedCard: React.FC<FeedCardProps> = ({ item, subscriptionName }) => {
  const isVideo = item.platform.toLowerCase().includes('youtube') || item.link.includes('youtube') || item.link.includes('youtu.be');
  
  const isTwitter = item.platform.toLowerCase().includes('twitter') || item.platform.toLowerCase() === 'x' || item.link.includes('twitter.com') || item.link.includes('x.com');
  
  // 从 Twitter URL 提取用户名
  const getTwitterUsername = (link: string): string | null => {
    try {
      const match = link.match(/(?:twitter\.com|x\.com)\/([^/?]+)/);
      return match ? match[1] : null;
    } catch { return null; }
  };
  
  // 构建图片源列表（按优先级）
  const buildImageSources = (): string[] => {
    const sources: string[] = [];
    
    // 1. Gemini 提供的图片（如果有）
    if (item.imageUrl) {
      sources.push(item.imageUrl);
    }
    
    // 2. YouTube 缩略图
    if (isVideo) {
      const videoId = getYoutubeVideoId(item.link);
      if (videoId) {
        sources.push(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
      }
    }
    
    // 3. Twitter 用户头像作为备用（使用 unavatar.io）
    if (isTwitter) {
      const username = getTwitterUsername(item.link);
      if (username) {
        sources.push(`https://unavatar.io/twitter/${username}`);
      }
    }
    
    // 4. 默认占位符（使用渐变背景而不是随机图片）
    sources.push(`https://picsum.photos/seed/${encodeURIComponent(item.title)}/600/400`);
    
    return sources;
  };

  // 构建图片源列表（使用 useMemo 优化性能）
  const imageSources = useMemo(() => buildImageSources(), [item.imageUrl, item.link, item.title, isVideo, isTwitter]);
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageSrc, setImageSrc] = useState(imageSources[0]);

  // 当 item 改变时重置图片索引
  useEffect(() => {
    setCurrentImageIndex(0);
    setImageSrc(imageSources[0]);
  }, [imageSources]);

  // 图片加载错误时，尝试下一个源
  const handleImageError = () => {
    const nextIndex = currentImageIndex + 1;
    if (nextIndex < imageSources.length) {
      setCurrentImageIndex(nextIndex);
      setImageSrc(imageSources[nextIndex]);
    } else {
      // 所有源都失败了，使用默认占位符
      setImageSrc(`https://via.placeholder.com/600x400/1a1a1a/ffffff?text=${encodeURIComponent(item.title.substring(0, 20))}`);
    }
  };

  return (
    <div className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 flex flex-col h-full">
      {/* Image Container */}
      <a href={item.link} target="_blank" rel="noopener noreferrer" className="relative aspect-video overflow-hidden bg-zinc-800 block cursor-pointer">
        <img
          src={imageSrc}
          alt={item.title}
          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
          onError={handleImageError}
          loading="lazy"
          key={`${item.id}-${currentImageIndex}`} // 强制重新加载当源改变时
        />
        
        {/* Platform Badge */}
        <div className="absolute top-3 left-3 z-10">
            <span className="bg-black/70 backdrop-blur-md text-white text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded border border-white/10 shadow-lg">
                {item.platform}
            </span>
        </div>

        {/* Play Icon Overlay for Videos */}
        {isVideo && (
           <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
               <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform">
                   <PlayCircle className="text-white" size={32} fill="rgba(255,255,255,0.2)" />
               </div>
           </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-40" />
      </a>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 truncate max-w-[150px]">
                {subscriptionName}
            </span>
            <span className="flex items-center text-[10px] text-zinc-500 gap-1 ml-auto shrink-0">
                <Calendar size={10} />
                {item.date}
            </span>
        </div>

        <h3 className="text-lg font-bold text-zinc-100 mb-2 leading-tight group-hover:text-blue-400 transition-colors line-clamp-2">
          <a href={item.link} target="_blank" rel="noopener noreferrer">
            {item.title}
          </a>
        </h3>

        {item.summary && (
          <p className="text-sm text-zinc-400 line-clamp-3 mb-4 flex-1">
            {item.summary}
          </p>
        )}

        <div className="mt-auto pt-4 border-t border-zinc-800 flex items-center justify-between">
          <a 
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors group/link"
          >
            Visit Source
            <ExternalLink size={14} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
          </a>
          <button 
            className="text-zinc-500 hover:text-white transition-colors"
            title="Copy Link"
            onClick={(e) => {
                e.preventDefault();
                navigator.clipboard.writeText(item.link);
            }}
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedCard;