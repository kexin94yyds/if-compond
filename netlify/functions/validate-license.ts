import { Handler } from '@netlify/functions';

/**
 * 密钥验证 API
 * 
 * 注意：这是一个简化的本地验证实现
 * 生产环境应该连接 Supabase 数据库进行验证
 */

// 简化的密钥存储（生产环境应使用数据库）
// 格式: { licenseKey: { email, activatedAt, isActive } }
const LICENSE_STORAGE: Record<string, {
  email: string;
  activatedAt: string;
  isActive: boolean;
  type: 'lifetime' | 'subscription';
}> = {};

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    const { licenseKey } = JSON.parse(event.body || '{}');

    if (!licenseKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '缺少密钥参数' }),
      };
    }

    // 验证密钥格式
    const keyPattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!keyPattern.test(licenseKey.toUpperCase())) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '密钥格式不正确' }),
      };
    }

    // 查询密钥（这里应该查询数据库）
    const license = LICENSE_STORAGE[licenseKey.toUpperCase()];

    if (!license) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          valid: false, 
          error: '密钥不存在' 
        }),
      };
    }

    if (!license.isActive) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          valid: false, 
          error: '密钥已被停用' 
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        valid: true,
        license: {
          key: licenseKey,
          email: license.email,
          activatedAt: license.activatedAt,
          type: license.type,
        },
      }),
    };
  } catch (error) {
    console.error('Validate license error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: '服务器错误' }),
    };
  }
};
