# ContentDash 待解决问题

## 🔴 高优先级

### YouTube 视频缩略图无法显示
**问题描述：** 虽然已实现多级回退机制（hqdefault -> mqdefault -> sddefault -> maxresdefault），但 YouTube 视频缩略图仍然无法正常加载。

**可能原因：**
1. YouTube 缩略图 API 访问问题（CORS、网络限制等）
2. 视频 ID 提取不正确
3. 缩略图 URL 格式问题
4. 浏览器安全策略限制

**待排查方向：**
- [ ] 检查浏览器控制台的具体错误信息
- [ ] 验证视频 ID 提取逻辑是否正确
- [ ] 测试直接访问缩略图 URL 是否可访问
- [ ] 考虑使用 YouTube Data API v3 获取缩略图（需要 API key）
- [ ] 检查是否有 CORS 问题，可能需要代理或使用其他图片源

**相关文件：**
- `components/FeedCard.tsx` - 图片加载逻辑
- `services/geminiService.ts` - 服务端缩略图生成

**创建时间：** 2025-01-02

---

## 🟡 中优先级

### 微信支付服务迁移到 ECS
**问题描述：** 当前使用阿里云函数计算（FC），按量计费可能欠费停服。计划迁移到 ECS 云服务器更稳定。

**ECS 服务器信息：**
- 实例：`iZbp1g23esqc6hb1lp7ew6Z`
- IP：`223.6.255.186`
- 区域：华东1（杭州）
- 配置：2 核 vCPU、2 GiB 内存
- 系统：CentOS 7.9 64位
- 到期：2026年12月11日
- SSH：root / ymx94yyds@Ymx

**迁移步骤：**
- [ ] SSH 登录 ECS
- [ ] 安装 Node.js 18+
- [ ] 上传微信支付服务代码
- [ ] 配置 PM2 进程管理
- [ ] 配置 Nginx 反向代理 + HTTPS
- [ ] 更新前端 `paymentService.ts` 的 API URL
- [ ] 测试完整支付流程

**相关文件：**
- `/Users/apple/Downloads/nativePaySDK/aliyun-deploy/` - 支付服务代码
- `/Users/apple/Downloads/nativePaySDK/aliyun-deploy.zip` - 部署包
- `services/paymentService.ts` - 前端支付服务 URL 配置

**创建时间：** 2025-12-11
