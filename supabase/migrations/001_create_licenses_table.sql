-- ContentDash 授权密钥表
CREATE TABLE IF NOT EXISTS contentdash_licenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    license_key VARCHAR(19) UNIQUE NOT NULL,
    order_no VARCHAR(50),
    email VARCHAR(255),
    product_id VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
    max_activations INTEGER NOT NULL DEFAULT 3,
    current_activations INTEGER NOT NULL DEFAULT 0,
    device_id VARCHAR(255),
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_licenses_key ON contentdash_licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_email ON contentdash_licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_order ON contentdash_licenses(order_no);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON contentdash_licenses(status);

-- 启用 RLS (Row Level Security)
ALTER TABLE contentdash_licenses ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户读取和更新（用于验证和激活）
CREATE POLICY "Allow anonymous read" ON contentdash_licenses
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous update" ON contentdash_licenses
    FOR UPDATE USING (true);

CREATE POLICY "Allow service insert" ON contentdash_licenses
    FOR INSERT WITH CHECK (true);

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contentdash_licenses_updated_at
    BEFORE UPDATE ON contentdash_licenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加注释
COMMENT ON TABLE contentdash_licenses IS 'ContentDash 授权密钥表';
COMMENT ON COLUMN contentdash_licenses.license_key IS '授权密钥，格式：XXXX-XXXX-XXXX-XXXX';
COMMENT ON COLUMN contentdash_licenses.order_no IS '关联的订单号';
COMMENT ON COLUMN contentdash_licenses.max_activations IS '最大激活次数';
COMMENT ON COLUMN contentdash_licenses.current_activations IS '当前激活次数';
