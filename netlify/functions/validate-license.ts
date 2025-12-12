import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pgnxluovitiwgvzutjuh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || '');

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
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: '服务器配置错误' }),
      };
    }

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

    const formattedKey = licenseKey.toUpperCase();
    const { data, error } = await supabase
      .from('contentdash_licenses')
      .select('*')
      .eq('license_key', formattedKey)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          valid: false,
          error: '密钥不存在',
        }),
      };
    }

    if (data.status !== 'active') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          valid: false,
          error: '密钥已被停用',
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
          key: formattedKey,
          email: data.email,
          activatedAt: data.activated_at || data.created_at,
          type: 'lifetime',
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
