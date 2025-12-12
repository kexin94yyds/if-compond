import { Handler } from '@netlify/functions';

/**
 * 密钥反激活 API
 */

export const handler: Handler = async (event) => {
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

    // TODO: 生产环境应该：
    // 1. 查询数据库验证密钥
    // 2. 更新激活状态
    // 3. 记录反激活日志

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: '密钥已反激活',
      }),
    };
  } catch (error) {
    console.error('Deactivate license error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: '服务器错误' }),
    };
  }
};
