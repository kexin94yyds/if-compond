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



