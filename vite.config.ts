import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function localNetlifyFunctions() {
  const functionsDir = path.resolve(__dirname, 'netlify/functions');

  return {
    name: 'local-netlify-functions',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url || '';
        if (!url.startsWith('/.netlify/functions/')) return next();

        const [pathname, query] = url.split('?');
        const parts = pathname.split('/').filter(Boolean);
        const fnName = parts[2];
        if (!fnName) return next();

        const fnPath = path.join(functionsDir, `${fnName}.ts`);
        if (!fs.existsSync(fnPath)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: any) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        req.on('end', async () => {
          try {
            const mod: any = await server.ssrLoadModule(`/netlify/functions/${fnName}.ts?t=${Date.now()}`);
            const handler = mod.handler;
            if (typeof handler !== 'function') {
              res.statusCode = 500;
              res.end('Invalid function module');
              return;
            }

            const body = chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined;
            const queryStringParameters = Object.fromEntries(new URLSearchParams(query || ''));

            const event = {
              httpMethod: req.method,
              headers: req.headers,
              path: pathname,
              queryStringParameters,
              body,
            };

            const result = await handler(event, {});

            res.statusCode = result?.statusCode ?? 200;
            if (result?.headers) {
              for (const [k, v] of Object.entries(result.headers)) {
                res.setHeader(k, String(v));
              }
            }
            res.end(result?.body ?? '');
          } catch (e) {
            res.statusCode = 500;
            res.end('Internal Server Error');
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    // 加载环境变量
    // 第三个参数 '' 表示加载所有变量（包括 VITE_ 开头的）
    const env = loadEnv(mode, process.cwd(), '');

    for (const [key, value] of Object.entries(env)) {
      process.env[key] = value;
    }
    
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
      },
      plugins: [localNetlifyFunctions(), react()],
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
