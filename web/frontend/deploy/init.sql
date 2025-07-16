-- 创建数据库表结构

-- 设备表
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) UNIQUE NOT NULL,
    device_name VARCHAR(200),
    device_type VARCHAR(50) DEFAULT 'sensor',
    status VARCHAR(20) DEFAULT 'online',
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    location_name VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IoT数据表
CREATE TABLE IF NOT EXISTS iot_data (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    event_time TIMESTAMP NOT NULL,
    temperature DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    illumination DECIMAL(8, 2),
    acceleration_x DECIMAL(8, 4),
    acceleration_y DECIMAL(8, 4),
    acceleration_z DECIMAL(8, 4),
    acceleration_total DECIMAL(8, 4),
    gyroscope_x DECIMAL(8, 4),
    gyroscope_y DECIMAL(8, 4),
    gyroscope_z DECIMAL(8, 4),
    gyroscope_total DECIMAL(8, 4),
    battery_level INTEGER,
    signal_strength INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, event_time)
);

-- 命令表
CREATE TABLE IF NOT EXISTS device_commands (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    command_type VARCHAR(50) NOT NULL,
    command_data JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP,
    executed_at TIMESTAMP,
    response_data JSONB,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 告警表
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    alert_level VARCHAR(20) DEFAULT 'warning',
    message TEXT,
    threshold_value DECIMAL(10, 4),
    actual_value DECIMAL(10, 4),
    status VARCHAR(20) DEFAULT 'active',
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 系统日志表
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    log_level VARCHAR(20) NOT NULL,
    module VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_iot_data_device_time ON iot_data(device_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_iot_data_time ON iot_data(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_commands_device_status ON device_commands(device_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_device_status ON alerts(device_id, status);

-- 插入默认管理员用户 (密码: admin123)
INSERT INTO users (username, email, password_hash, role) 
VALUES ('admin', 'admin@landslide-monitor.com', '$2b$10$rQZ9QmjKjKjKjKjKjKjKjOeRq9QmjKjKjKjKjKjKjKjKjKjKjKjKj', 'admin')
ON CONFLICT (username) DO NOTHING;

-- 插入示例设备数据
INSERT INTO devices (device_id, device_name, location_lat, location_lng, location_name) VALUES
('device_001', '监测点A', 22.684, 110.1881, '玉林师范学院'),
('device_002', '监测点B', 22.685, 110.1891, '玉林市区'),
('device_003', '监测点C', 22.686, 110.1901, '玉林郊区')
ON CONFLICT (device_id) DO NOTHING;

-- 创建视图：设备状态概览
CREATE OR REPLACE VIEW device_status_overview AS
SELECT 
    d.device_id,
    d.device_name,
    d.status,
    d.location_name,
    d.last_active_time,
    latest.temperature,
    latest.humidity,
    latest.acceleration_total,
    latest.gyroscope_total,
    CASE 
        WHEN d.last_active_time < NOW() - INTERVAL '10 minutes' THEN 'offline'
        ELSE d.status
    END as real_status
FROM devices d
LEFT JOIN LATERAL (
    SELECT temperature, humidity, acceleration_total, gyroscope_total
    FROM iot_data 
    WHERE device_id = d.device_id 
    ORDER BY event_time DESC 
    LIMIT 1
) latest ON true;

-- 创建函数：计算设备风险等级
CREATE OR REPLACE FUNCTION calculate_risk_level(
    p_temperature DECIMAL,
    p_humidity DECIMAL,
    p_acceleration DECIMAL,
    p_gyroscope DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    risk_score DECIMAL := 0;
BEGIN
    -- 温度风险 (异常范围: <0°C 或 >40°C)
    IF p_temperature IS NOT NULL THEN
        IF p_temperature < 0 OR p_temperature > 40 THEN
            risk_score := risk_score + 0.3;
        ELSIF p_temperature < 5 OR p_temperature > 35 THEN
            risk_score := risk_score + 0.1;
        END IF;
    END IF;
    
    -- 湿度风险 (异常范围: >90%)
    IF p_humidity IS NOT NULL THEN
        IF p_humidity > 90 THEN
            risk_score := risk_score + 0.2;
        ELSIF p_humidity > 80 THEN
            risk_score := risk_score + 0.1;
        END IF;
    END IF;
    
    -- 加速度风险 (异常范围: >2.0)
    IF p_acceleration IS NOT NULL THEN
        IF p_acceleration > 2.0 THEN
            risk_score := risk_score + 0.4;
        ELSIF p_acceleration > 1.0 THEN
            risk_score := risk_score + 0.2;
        END IF;
    END IF;
    
    -- 陀螺仪风险 (异常范围: >50°/s)
    IF p_gyroscope IS NOT NULL THEN
        IF p_gyroscope > 50 THEN
            risk_score := risk_score + 0.3;
        ELSIF p_gyroscope > 25 THEN
            risk_score := risk_score + 0.1;
        END IF;
    END IF;
    
    RETURN LEAST(risk_score, 1.0);
END;
$$ LANGUAGE plpgsql;
