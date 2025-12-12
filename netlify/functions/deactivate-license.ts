import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

/**
 * 密钥反激活 API
 */

const SUPABASE_URL = 'https://pgnxluovitiwgvzutjuh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || '');

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

    const formattedKey = String(licenseKey).toUpperCase();

    const { data: existing, error: queryError } = await supabase
      .from('contentdash_licenses')
      .select('*')
      .eq('license_key', formattedKey)
      .maybeSingle();

    if (queryError) {
      throw queryError;
    }

    if (!existing) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '密钥不存在' }),
      };
    }

    const { error: updateError } = await supabase
      .from('contentdash_licenses')
      .update({
        status: 'inactive',
        device_id: null,
        current_activations: 0,
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
