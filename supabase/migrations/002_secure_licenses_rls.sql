-- Secure ContentDash 授权密钥表 RLS
-- 执行此脚本后，只有 service_role 可以读写，匿名用户完全无权限

-- 1. 移除所有旧的匿名策略
DROP POLICY IF EXISTS "Allow anonymous read" ON contentdash_licenses;
DROP POLICY IF EXISTS "Allow anonymous update" ON contentdash_licenses;
DROP POLICY IF EXISTS "Allow service insert" ON contentdash_licenses;

-- 2. 确保 RLS 开启
ALTER TABLE contentdash_licenses ENABLE ROW LEVEL SECURITY;

-- 3. 为 service_role 创建完整的读写策略
-- 注意：service_role 默认会绕过 RLS，但我们仍然显式创建策略以便于管理和审计

-- SELECT 策略：只有 service_role 可以读取
CREATE POLICY "Service role can select" ON contentdash_licenses
    FOR SELECT
    TO service_role
    USING (true);

-- INSERT 策略：只有 service_role 可以插入
CREATE POLICY "Service role can insert" ON contentdash_licenses
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- UPDATE 策略：只有 service_role 可以更新
CREATE POLICY "Service role can update" ON contentdash_licenses
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- DELETE 策略：只有 service_role 可以删除
CREATE POLICY "Service role can delete" ON contentdash_licenses
    FOR DELETE
    TO service_role
    USING (true);
