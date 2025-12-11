/**
 * 支付服务 - 处理微信支付流程
 */

// 支付服务器地址（生产环境使用阿里云）
const PAYMENT_API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3003' 
  : 'https://wechat-y-server-vjfbztievl.cn-shanghai.fcapp.run';

export interface PaymentConfig {
  productId: string;
  productName: string;
  price: number;  // 元
  amount: number; // 分
}

export const DEFAULT_PRODUCT: PaymentConfig = {
  productId: 'contentdash_premium',
  productName: 'ContentDash 高级版',
  price: 99,     // 99元
  amount: 9900,  // 9900分
};

export interface CreatePaymentResult {
  success: boolean;
  orderNo?: string;
  codeUrl?: string;  // 微信支付二维码链接
  error?: string;
}

export interface PaymentStatusResult {
  success: boolean;
  status: 'pending' | 'success' | 'failed' | 'expired';
  licenseKey?: string;  // 支付成功后返回密钥
  error?: string;
}

/**
 * 创建支付订单
 */
export async function createPaymentOrder(
  email: string,
  product: PaymentConfig = DEFAULT_PRODUCT
): Promise<CreatePaymentResult> {
  try {
    const response = await fetch(`${PAYMENT_API_URL}/api/create-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: product.productId,
        videoTitle: product.productName,
        amount: product.amount,
        email: email,  // 传递邮箱用于生成密钥
      }),
    });
    
    const result = await response.json();
    
    if (result.success && (result.codeUrl || result.code_url)) {
      return {
        success: true,
        orderNo: result.orderNo,
        codeUrl: result.codeUrl || result.code_url,
      };
    }
    
    return {
      success: false,
      error: result.message || '创建订单失败',
    };
  } catch (error) {
    console.error('Create payment error:', error);
    return {
      success: false,
      error: '网络错误，请检查连接后重试',
    };
  }
}

/**
 * 查询支付状态
 */
export async function checkPaymentStatus(orderNo: string): Promise<PaymentStatusResult> {
  try {
    const response = await fetch(`${PAYMENT_API_URL}/api/payment-status/${orderNo}`);
    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        status: result.status,
        licenseKey: result.licenseKey,
      };
    }
    
    return {
      success: false,
      status: 'pending',
      error: result.message,
    };
  } catch (error) {
    console.error('Check payment status error:', error);
    return {
      success: false,
      status: 'pending',
      error: '网络错误',
    };
  }
}

/**
 * 轮询支付状态
 * 返回一个停止函数
 */
export function pollPaymentStatus(
  orderNo: string,
  onSuccess: (licenseKey: string) => void,
  onError?: (error: string) => void,
  intervalMs: number = 3000,
  timeoutMs: number = 5 * 60 * 1000  // 5分钟超时
): () => void {
  let intervalId: NodeJS.Timeout | null = null;
  let timeoutId: NodeJS.Timeout | null = null;
  
  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  // 开始轮询
  intervalId = setInterval(async () => {
    const result = await checkPaymentStatus(orderNo);
    
    if (result.status === 'success' && result.licenseKey) {
      stop();
      onSuccess(result.licenseKey);
    } else if (result.status === 'failed') {
      stop();
      onError?.('支付失败');
    } else if (result.status === 'expired') {
      stop();
      onError?.('订单已过期');
    }
  }, intervalMs);
  
  // 设置超时
  timeoutId = setTimeout(() => {
    stop();
    onError?.('支付超时，请重新发起');
  }, timeoutMs);
  
  return stop;
}
