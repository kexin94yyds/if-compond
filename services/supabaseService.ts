/**
 * Supabase 服务 - 处理数据库操作
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase 配置 - ymx94yyds's Project
const SUPABASE_URL = 'https://pgnxluovitiwgvzutjuh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbnhsdW92aXRpd2d2enV0anVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDI2OTUsImV4cCI6MjA4MDQ3ODY5NX0.jnhAqNfnS_3trkbxEzQyPZG8omRejsdXpj7GCBoU9m0';

let supabase: SupabaseClient | null = null;

/**
 * 获取 Supabase 客户端
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

/**
 * License 数据类型
 */
export interface LicenseRecord {
  id?: string;
  license_key: string;
  email: string;
  order_no?: string;
  product_id: string;
  product_name: string;
  amount: number;
  status: 'active' | 'inactive' | 'expired';
  activated_at?: string;
  created_at?: string;
  device_id?: string;
  max_activations: number;
  current_activations: number;
}

/**
 * 创建新密钥记录
 */
export async function createLicenseRecord(license: Omit<LicenseRecord, 'id' | 'created_at'>): Promise<{ success: boolean; data?: LicenseRecord; error?: string }> {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('contentdash_licenses')
      .insert([{
        ...license,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Create license error:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Create license exception:', error);
    return { success: false, error: '创建密钥记录失败' };
  }
}

/**
 * 通过密钥查询记录
 */
export async function getLicenseByKey(licenseKey: string): Promise<{ success: boolean; data?: LicenseRecord; error?: string }> {
  try {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('contentdash_licenses')
      .select('*')
      .eq('license_key', licenseKey.toUpperCase())
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, data: undefined }; // 未找到记录
      }
      console.error('Get license error:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Get license exception:', error);
    return { success: false, error: '查询密钥失败' };
  }
}

 export async function getLatestLicenseKeyByEmail(email: string): Promise<{ success: boolean; licenseKey?: string; error?: string }> {
   try {
     const client = getSupabaseClient();
 
     const { data, error } = await client
       .from('contentdash_licenses')
       .select('license_key, created_at')
       .eq('email', email)
       .order('created_at', { ascending: false })
       .limit(1)
       .maybeSingle();
 
     if (error) {
       return { success: false, error: error.message };
     }
 
     return { success: true, licenseKey: data?.license_key };
   } catch (error) {
     console.error('Get license by email exception:', error);
     return { success: false, error: '查询密钥失败' };
   }
 }

/**
 * 激活密钥
 */
export async function activateLicenseInDb(licenseKey: string, email: string, deviceId?: string): Promise<{ success: boolean; data?: LicenseRecord; error?: string }> {
  try {
    const client = getSupabaseClient();
    
    // 先查询密钥
    const { data: existing, error: queryError } = await client
      .from('contentdash_licenses')
      .select('*')
      .eq('license_key', licenseKey.toUpperCase())
      .single();
    
    if (queryError) {
      if (queryError.code === 'PGRST116') {
        return { success: false, error: '密钥不存在' };
      }
      return { success: false, error: queryError.message };
    }
    
    if (!existing) {
      return { success: false, error: '密钥不存在' };
    }
    
    // 检查激活次数
    if (existing.current_activations >= existing.max_activations) {
      return { success: false, error: '密钥激活次数已达上限' };
    }
    
    // 更新激活信息
    const { data, error } = await client
      .from('contentdash_licenses')
      .update({
        status: 'active',
        activated_at: new Date().toISOString(),
        email: email,
        device_id: deviceId,
        current_activations: existing.current_activations + 1,
      })
      .eq('license_key', licenseKey.toUpperCase())
      .select()
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Activate license exception:', error);
    return { success: false, error: '激活密钥失败' };
  }
}

/**
 * 反激活密钥
 */
export async function deactivateLicenseInDb(licenseKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient();
    
    const { error } = await client
      .from('contentdash_licenses')
      .update({
        status: 'inactive',
        device_id: null,
        current_activations: 0,
      })
      .eq('license_key', licenseKey.toUpperCase());
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Deactivate license exception:', error);
    return { success: false, error: '反激活密钥失败' };
  }
}
