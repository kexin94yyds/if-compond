import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pgnxluovitwgvzutjuh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_kcBRZs9qvR2tKuM1QZY0-w_-sjxkM1K';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * 密钥激活 API
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
    const { licenseKey, email } = JSON.parse(event.body || '{}');

    if (!licenseKey || !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '缺少必要参数' }),
      };
    }

    const formattedKey = licenseKey.toUpperCase();

    // 验证密钥格式
    const keyPattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!keyPattern.test(formattedKey)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '密钥格式不正确' }),
      };
    }

    // 验证邮箱格式
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '邮箱格式不正确' }),
      };
    }

    // 查询数据库验证密钥
    const { data: existing, error: queryError } = await supabase
      .from('contentdash_licenses')
      .select('*')
      .eq('license_key', formattedKey)
      .single();

    if (queryError) {
      if (queryError.code === 'PGRST116') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: '密钥不存在' }),
        };
      }
      throw queryError;
    }

    if (!existing) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '密钥不存在' }),
      };
    }

    // 检查激活次数
    if (existing.current_activations >= existing.max_activations) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '密钥激活次数已达上限' }),
      };
    }

    // 更新激活信息
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('contentdash_licenses')
      .update({
        status: 'active',
        activated_at: now,
        email: email,
        current_activations: existing.current_activations + 1,
      })
      .eq('license_key', formattedKey);

    if (updateError) {
      throw updateError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        license: {
          key: formattedKey,
          email: email,
          activatedAt: now,
          type: 'lifetime',
        },
      }),
    };
  } catch (error) {
    console.error('Activate license error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: '服务器错误' }),
    };
  }
};
