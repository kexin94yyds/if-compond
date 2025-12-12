import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // 加载环境变量
    // 第三个参数 '' 表示加载所有变量（包括 VITE_ 开头的）
    const env = loadEnv(mode, process.cwd(), '');
    
    // 优先使用 VITE_GEMINI_API_KEY（Vite 标准），也支持 GEMINI_API_KEY（向后兼容）
    const apiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY;
    
    // 调试：检查环境变量是否加载
    if (mode === 'development') {
      console.log('🔧 Vite Config - 环境变量检查:', {
        'VITE_GEMINI_API_KEY': env.VITE_GEMINI_API_KEY ? `${env.VITE_GEMINI_API_KEY.substring(0, 10)}...` : '未找到',
        'GEMINI_API_KEY': env.GEMINI_API_KEY ? `${env.GEMINI_API_KEY.substring(0, 10)}...` : '未找到',
        '最终使用的 Key': apiKey ? `${apiKey.substring(0, 10)}...` : '未找到',
      });
    }
    
    return {
      server: {
        port: 3001, // 使用 3001 端口，避免与 zenflow (3000) 冲突
        host: '0.0.0.0',
        strictPort: false, // 如果 3001 被占用，自动尝试下一个可用端口
        proxy: {
          // 代理 Netlify Functions 请求到本地 functions 服务器
          '/.netlify/functions': {
            target: 'http://localhost:9999',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      // 注意：Vite 会自动暴露 VITE_ 开头的变量到 import.meta.env
      // 这里额外注入到 process.env 以支持向后兼容
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
