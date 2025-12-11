/**
 * 密钥服务 - 处理密钥的生成、验证和存储
 */

// 密钥格式: XXXX-XXXX-XXXX-XXXX (16位 + 3个分隔符 = 19字符)
const LICENSE_KEY_LENGTH = 19;
const LICENSE_STORAGE_KEY = 'contentdash_license';
const LICENSE_ACTIVATED_KEY = 'contentdash_activated';
const LICENSE_EMAIL_KEY = 'contentdash_license_email';

export interface LicenseInfo {
  key: string;
  email: string;
  activatedAt: string;
  expiresAt?: string;
  type: 'lifetime' | 'subscription';
}

export interface LicenseValidationResult {
  valid: boolean;
  error?: string;
  info?: LicenseInfo;
}

/**
 * 生成唯一密钥
 * 格式: XXXX-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符 0/O, 1/I/L
  const segments: string[] = [];
  
  for (let i = 0; i < 4; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  
  return segments.join('-');
}

/**
 * 验证密钥格式
 */
export function validateLicenseKeyFormat(key: string): boolean {
  if (!key || key.length !== LICENSE_KEY_LENGTH) return false;
  const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(key.toUpperCase());
}

/**
 * 格式化用户输入的密钥
 * 自动添加分隔符，转换为大写
 */
export function formatLicenseKey(input: string): string {
  // 移除所有非字母数字字符
  const cleaned = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  // 按4位分组
  const segments: string[] = [];
  for (let i = 0; i < cleaned.length && i < 16; i += 4) {
    segments.push(cleaned.slice(i, i + 4));
  }
  
  return segments.join('-');
}

/**
 * 检查是否已激活
 */
export function isLicenseActivated(): boolean {
  return localStorage.getItem(LICENSE_ACTIVATED_KEY) === 'true';
}

/**
 * 获取本地存储的密钥
 */
export function getStoredLicense(): string | null {
  return localStorage.getItem(LICENSE_STORAGE_KEY);
}

/**
 * 获取本地存储的邮箱
 */
export function getStoredEmail(): string | null {
  return localStorage.getItem(LICENSE_EMAIL_KEY);
}

/**
 * 保存密钥到本地
 */
export function saveLicenseLocally(key: string, email: string): void {
  localStorage.setItem(LICENSE_STORAGE_KEY, key);
  localStorage.setItem(LICENSE_EMAIL_KEY, email);
  localStorage.setItem(LICENSE_ACTIVATED_KEY, 'true');
}

/**
 * 清除本地密钥
 */
export function clearLocalLicense(): void {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
  localStorage.removeItem(LICENSE_EMAIL_KEY);
  localStorage.removeItem(LICENSE_ACTIVATED_KEY);
}

/**
 * 在线验证密钥
 */
export async function validateLicenseOnline(key: string): Promise<LicenseValidationResult> {
  try {
    const response = await fetch('/.netlify/functions/validate-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: key }),
    });
    
    const result = await response.json();
    
    if (result.success && result.valid) {
      return {
        valid: true,
        info: result.license,
      };
    }
    
    return {
      valid: false,
      error: result.error || '密钥无效',
    };
  } catch (error) {
    console.error('License validation error:', error);
    return {
      valid: false,
      error: '网络错误，请检查连接后重试',
    };
  }
}

/**
 * 激活密钥
 */
export async function activateLicense(key: string, email: string): Promise<LicenseValidationResult> {
  // 1. 格式验证
  const formattedKey = formatLicenseKey(key);
  if (!validateLicenseKeyFormat(formattedKey)) {
    return { valid: false, error: '密钥格式不正确' };
  }
  
  // 2. 验证邮箱
  if (!email || !email.includes('@')) {
    return { valid: false, error: '请输入有效的邮箱地址' };
  }
  
  // 3. 本地开发模式：直接保存（生产环境应调用后端验证）
  // TODO: 生产环境恢复在线验证
  try {
    // 保存到本地
    saveLicenseLocally(formattedKey, email);
    return {
      valid: true,
      info: {
        key: formattedKey,
        email: email,
        activatedAt: new Date().toISOString(),
        type: 'lifetime',
      },
    };
  } catch (error) {
    console.error('License activation error:', error);
    return {
      valid: false,
      error: '激活失败',
    };
  }
}

/**
 * 反激活密钥
 */
export async function deactivateLicense(): Promise<boolean> {
  const key = getStoredLicense();
  if (!key) return true;
  
  try {
    const response = await fetch('/.netlify/functions/deactivate-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: key }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      clearLocalLicense();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('License deactivation error:', error);
    return false;
  }
}
