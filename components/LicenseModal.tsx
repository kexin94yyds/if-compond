import React, { useState, useEffect, useRef } from 'react';
import { X, Key, CreditCard, Loader2, CheckCircle, AlertCircle, Mail, Sparkles } from 'lucide-react';
import {
  isLicenseActivated,
  getStoredLicense,
  getStoredEmail,
  formatLicenseKey,
  validateLicenseKeyFormat,
  activateLicense,
  deactivateLicense,
} from '../services/licenseService';
import {
  createPaymentOrder,
  pollPaymentStatus,
  DEFAULT_PRODUCT,
} from '../services/paymentService';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivated: () => void;
}

type TabType = 'activate' | 'purchase';

const LicenseModal: React.FC<LicenseModalProps> = ({ isOpen, onClose, onActivated }) => {
  const [activeTab, setActiveTab] = useState<TabType>('activate');
  const [licenseKey, setLicenseKey] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 支付相关状态
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const stopPollingRef = useRef<(() => void) | null>(null);
  
  // 已激活状态
  const [isActivated, setIsActivated] = useState(false);
  const [storedKey, setStoredKey] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen) {
      setIsActivated(isLicenseActivated());
      setStoredKey(getStoredLicense());
      // 预填充已存储的邮箱
      const savedEmail = getStoredEmail();
      if (savedEmail) {
        setEmail(savedEmail);
      }
      setError(null);
      setSuccess(null);
    }
    
    return () => {
      // 清理轮询
      if (stopPollingRef.current) {
        stopPollingRef.current();
      }
    };
  }, [isOpen]);
  
  const handleLicenseKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatLicenseKey(e.target.value);
    setLicenseKey(formatted);
    setError(null);
  };
  
  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('请输入密钥');
      return;
    }
    
    if (!validateLicenseKeyFormat(licenseKey)) {
      setError('密钥格式不正确，应为 XXXX-XXXX-XXXX-XXXX');
      return;
    }
    
    if (!email.trim() || !email.includes('@')) {
      setError('请输入有效的邮箱地址');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    const result = await activateLicense(licenseKey, email);
    
    setIsLoading(false);
    
    if (result.valid) {
      setSuccess('激活成功！');
      setIsActivated(true);
      setStoredKey(licenseKey);
      setTimeout(() => {
        onActivated();
        onClose();
      }, 1500);
    } else {
      setError(result.error || '激活失败');
    }
  };
  
  const handleDeactivate = async () => {
    setIsLoading(true);
    const success = await deactivateLicense();
    setIsLoading(false);
    
    if (success) {
      setIsActivated(false);
      setStoredKey(null);
      setLicenseKey('');
      setSuccess('已取消激活');
    } else {
      setError('取消激活失败');
    }
  };
  
  const handlePurchase = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('请输入有效的邮箱地址，密钥将发送至此邮箱');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    const result = await createPaymentOrder(email);
    
    if (result.success && result.codeUrl && result.orderNo) {
      setOrderNo(result.orderNo);
      setQrCodeUrl(result.codeUrl);
      setIsPaying(true);
      setIsLoading(false);
      
      // 开始轮询支付状态
      stopPollingRef.current = pollPaymentStatus(
        result.orderNo,
        (licenseKey) => {
          // 支付成功
          setIsPaying(false);
          setSuccess(`支付成功！您的密钥是: ${licenseKey}`);
          setLicenseKey(licenseKey);
          setActiveTab('activate');
        },
        (error) => {
          // 支付失败或超时
          setIsPaying(false);
          setError(error);
        }
      );
    } else {
      setIsLoading(false);
      setError(result.error || '创建订单失败');
    }
  };
  
  const handleCancelPayment = () => {
    if (stopPollingRef.current) {
      stopPollingRef.current();
    }
    setIsPaying(false);
    setOrderNo(null);
    setQrCodeUrl(null);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Key size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">授权管理</h2>
              <p className="text-xs text-zinc-500">
                {isActivated ? '已激活' : '激活或购买密钥'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* 已激活状态 */}
        {isActivated && storedKey ? (
          <div className="p-6">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="text-green-400" size={24} />
                <span className="text-green-400 font-semibold">已激活高级版</span>
              </div>
              <p className="text-zinc-400 text-sm font-mono bg-zinc-800 px-3 py-2 rounded-lg">
                {storedKey}
              </p>
            </div>
            
            <button
              onClick={handleDeactivate}
              disabled={isLoading}
              className="w-full py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : null}
              取消激活
            </button>
          </div>
        ) : isPaying ? (
          /* 支付中状态 */
          <div className="p-6">
            <div className="text-center mb-6">
              <p className="text-zinc-400 mb-4">请使用微信扫描二维码支付</p>
              <div className="bg-white p-4 rounded-xl inline-block mb-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl || '')}`}
                  alt="支付二维码"
                  className="w-48 h-48"
                />
              </div>
              <p className="text-xs text-zinc-500">订单号: {orderNo}</p>
              <div className="flex items-center justify-center gap-2 text-blue-400 mt-4">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">等待支付...</span>
              </div>
            </div>
            
            <button
              onClick={handleCancelPayment}
              className="w-full py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
            >
              取消支付
            </button>
          </div>
        ) : (
          /* 激活/购买表单 */
          <>
            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
              <button
                onClick={() => setActiveTab('activate')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'activate'
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Key size={16} className="inline mr-2" />
                输入密钥
              </button>
              <button
                onClick={() => setActiveTab('purchase')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'purchase'
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <CreditCard size={16} className="inline mr-2" />
                购买密钥
              </button>
            </div>
            
            <div className="p-6">
              {/* 错误/成功提示 */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle size={16} />
                  {success}
                </div>
              )}
              
              {/* 邮箱输入 */}
              <div className="mb-4">
                <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">
                  邮箱地址
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-zinc-500" size={18} />
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
                  />
                </div>
              </div>
              
              {activeTab === 'activate' ? (
                <>
                  {/* 密钥输入 */}
                  <div className="mb-6">
                    <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">
                      授权密钥
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 text-zinc-500" size={18} />
                      <input
                        type="text"
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        value={licenseKey}
                        onChange={handleLicenseKeyChange}
                        maxLength={19}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-white placeholder-zinc-600 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
                      />
                    </div>
                    <p className="mt-2 text-xs text-zinc-600">
                      购买后密钥将发送到您的邮箱
                    </p>
                  </div>
                  
                  <button
                    onClick={handleActivate}
                    disabled={isLoading || !licenseKey.trim()}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Key size={18} />
                    )}
                    激活密钥
                  </button>
                </>
              ) : (
                <>
                  {/* 购买信息 */}
                  <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-zinc-400">产品</span>
                      <span className="text-white font-medium">{DEFAULT_PRODUCT.productName}</span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-zinc-400">类型</span>
                      <span className="text-green-400">永久授权</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">价格</span>
                      <span className="text-2xl font-bold text-white">¥{DEFAULT_PRODUCT.price}</span>
                    </div>
                  </div>
                  
                  <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-blue-400 text-sm flex items-start gap-2">
                      <Sparkles size={16} className="shrink-0 mt-0.5" />
                      <span>支付成功后，密钥将自动显示并发送到您的邮箱</span>
                    </p>
                  </div>
                  
                  <button
                    onClick={handlePurchase}
                    disabled={isLoading || !email.trim()}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <CreditCard size={18} />
                    )}
                    微信支付 ¥{DEFAULT_PRODUCT.price}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LicenseModal;
