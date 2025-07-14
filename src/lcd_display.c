/*
 * Copyright (c) 2024 iSoftStone Education Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "lcd_display.h"
#include "lcd.h"       // 智能家居的LCD驱动头文件（已包含字库）
#include "iot_spi.h"
#include "iot_gpio.h"
#include "iot_errno.h"
#include "los_task.h"

// LCD驱动函数现在通过lcd.h头文件引入，不需要重复声明

// 静态变量
static bool g_lcd_initialized = false;
static LcdDisplayMode g_current_mode = LCD_MODE_REALTIME;
bool g_static_layout_initialized = false;  // 非静态，供外部访问

/**
 * @brief 初始化LCD
 * @return 0: 成功, 其他: 失败
 */
int LCD_Init(void)
{
    int ret;
    
    printf("Initializing LCD display...\n");
    
    ret = lcd_init();
    if (ret != 0) {
        printf("Failed to initialize LCD: %d\n", ret);
        return -1;
    }
    
    // 清屏为白色
    LCD_Clear(LCD_WHITE);
    
    // 简单的启动画面测试
    LCD_Clear(LCD_WHITE);
    LCD_ShowString(50, 100, "LCD Test OK", LCD_RED, LCD_WHITE, 24);

    LOS_Msleep(2000);  // 显示2秒启动画面

    // 强制重置静态布局标志，确保新布局被应用
    g_static_layout_initialized = false;

    g_lcd_initialized = true;
    printf("LCD display initialized successfully\n");
    
    return 0;
}

/**
 * @brief 反初始化LCD
 */
void LCD_Deinit(void)
{
    if (g_lcd_initialized) {
        lcd_deinit();
        g_lcd_initialized = false;
        g_static_layout_initialized = false;
        printf("LCD display deinitialized\n");
    }
}



/**
 * @brief 清屏
 * @param color 背景颜色
 */
void LCD_Clear(uint16_t color)
{
    printf("LCD_Clear: color=0x%04X, initialized=%d\n", color, g_lcd_initialized);
    if (g_lcd_initialized) {
        printf("LCD_Clear: Filling screen %dx%d with color 0x%04X\n", LCD_W, LCD_H, color);
        lcd_fill(0, 0, LCD_W, LCD_H, color);
        printf("LCD_Clear: Fill completed\n");
    }
}

/**
 * @brief 显示字符串
 */
void LCD_ShowString(uint16_t x, uint16_t y, const char *str, uint16_t fc, uint16_t bc, uint8_t sizey)
{
    printf("LCD_ShowString: x=%d, y=%d, text='%s', initialized=%d\n", x, y, str ? str : "NULL", g_lcd_initialized);
    if (g_lcd_initialized && str != NULL) {
        lcd_show_string(x, y, (const uint8_t *)str, fc, bc, sizey, 0);
    }
}

/**
 * @brief 显示实时数据界面
 * @param data 传感器数据
 */
void LCD_DisplayRealTimeData(const SensorData *data)
{
    if (!g_lcd_initialized || data == NULL || !data->data_valid) {
        return;
    }
    
    // 清屏为白色背景
    LCD_Clear(LCD_WHITE);

    // 标题栏 - 320x240全屏
    lcd_fill(0, 0, 320, 30, LCD_BLUE);

    // 显示英文标题（暂时不使用中文）
    LCD_ShowString(50, 8, "Landslide Monitor System", LCD_WHITE, LCD_BLUE, 16);

    // 状态指示器 - 基于倾斜角度
    float angle_magnitude = sqrtf(data->angle_x * data->angle_x + data->angle_y * data->angle_y);
    uint16_t status_color;
    const char* status_text;
    if (angle_magnitude < 5.0f) {
        status_color = LCD_GREEN;
        status_text = "SAFE";
    } else if (angle_magnitude < 10.0f) {
        status_color = LCD_YELLOW;
        status_text = "CAUTION";
    } else if (angle_magnitude < 15.0f) {
        status_color = LCD_ORANGE;
        status_text = "WARNING";
    } else {
        status_color = LCD_RED;
        status_text = "DANGER";
    }

    // 状态显示 - 大字体突出
    lcd_fill(20, 35, 300, 70, status_color);
    LCD_ShowString(90, 48, status_text, LCD_WHITE, status_color, 16);

    // 关键数据 - 倾斜角度
    LCD_ShowString(20, 85, "Tilt Angle:", LCD_BLACK, LCD_WHITE, 16);
    char angle_str[32];
    snprintf(angle_str, sizeof(angle_str), "X:%.1f  Y:%.1f deg", data->angle_x, data->angle_y);
    LCD_ShowString(20, 105, angle_str, LCD_RED, LCD_WHITE, 16);

    // 分割线
    lcd_fill(20, 130, 300, 132, LCD_GRAY);

    // 环境数据 - 使用英文标签
    LCD_ShowString(20, 140, "Temp:", LCD_BLACK, LCD_WHITE, 12);
    char temp_str[16];
    snprintf(temp_str, sizeof(temp_str), "%.1fC", data->sht_temperature);
    LCD_ShowString(60, 140, temp_str, LCD_BLUE, LCD_WHITE, 12);

    LCD_ShowString(160, 140, "Humidity:", LCD_BLACK, LCD_WHITE, 12);
    char humi_str[16];
    snprintf(humi_str, sizeof(humi_str), "%.1f%%", data->humidity);
    LCD_ShowString(220, 140, humi_str, LCD_BLUE, LCD_WHITE, 12);

    LCD_ShowString(20, 160, "Light:", LCD_BLACK, LCD_WHITE, 12);
    char light_str[16];
    snprintf(light_str, sizeof(light_str), "%.0f lux", data->light_intensity);
    LCD_ShowString(70, 160, light_str, LCD_ORANGE, LCD_WHITE, 12);

    LCD_ShowString(130, 160, "Accel:", LCD_BLACK, LCD_WHITE, 12);
    float accel_mag = sqrtf(data->accel_x*data->accel_x + data->accel_y*data->accel_y + data->accel_z*data->accel_z);
    char accel_str[16];
    snprintf(accel_str, sizeof(accel_str), "%.2fg", accel_mag);
    LCD_ShowString(180, 160, accel_str, LCD_ORANGE, LCD_WHITE, 12);

    // 底部信息栏
    lcd_fill(0, 200, 320, 240, LCD_GRAY);
    LCD_ShowString(10, 210, "Real-Time Mode", LCD_BLACK, LCD_GRAY, 12);
    LCD_ShowString(10, 225, "Press key to switch", LCD_BLACK, LCD_GRAY, 12);
}

/**
 * @brief 显示风险状态界面
 * @param assessment 风险评估结果
 */
void LCD_DisplayRiskStatus(const RiskAssessment *assessment)
{
    if (!g_lcd_initialized || assessment == NULL) {
        return;
    }
    
    // 清屏
    LCD_Clear(LCD_BLACK);

    // 标题栏
    lcd_fill(0, 0, 240, 30, LCD_RED);
    LCD_ShowString(70, 8, "风险评估", LCD_WHITE, LCD_RED, 16);
    
    uint16_t risk_color;
    const char* risk_text;
    switch (assessment->level) {
        case RISK_LEVEL_SAFE:
            risk_color = LCD_GREEN;
            risk_text = "安全";
            break;
        case RISK_LEVEL_LOW:
            risk_color = LCD_YELLOW;
            risk_text = "低风险";
            break;
        case RISK_LEVEL_MEDIUM:
            risk_color = LCD_ORANGE;
            risk_text = "中风险";
            break;
        case RISK_LEVEL_HIGH:
            risk_color = LCD_RED;
            risk_text = "高风险";
            break;
        case RISK_LEVEL_CRITICAL:
            risk_color = LCD_RED;
            risk_text = "极危险";
            break;
        default:
            risk_color = LCD_GRAY;
            risk_text = "未知";
            break;
    }

    // 大的风险等级显示区域
    lcd_fill(20, 40, 220, 100, risk_color);
    LCD_ShowString(80, 65, risk_text, LCD_WHITE, risk_color, 24);
    
    // 置信度
    LCD_ShowString(10, 95, "Confidence:", LCD_BLACK, LCD_WHITE, 12);
    char conf_str[16];
    snprintf(conf_str, sizeof(conf_str), "%.1f%%", assessment->confidence * 100.0f);
    LCD_ShowString(100, 95, conf_str, LCD_BLUE, LCD_WHITE, 12);
    
    // 风险描述
    LCD_ShowString(10, 115, "Description:", LCD_BLACK, LCD_WHITE, 12);
    LCD_ShowString(10, 130, assessment->description, LCD_BLACK, LCD_WHITE, 12);
    
    // 各项风险因子
    LCD_ShowString(10, 155, "Risk Factors:", LCD_BLACK, LCD_WHITE, 12);
    
    char factor_str[32];
    snprintf(factor_str, sizeof(factor_str), "Tilt: %.2f", assessment->tilt_risk);
    LCD_ShowString(10, 170, factor_str, LCD_RED, LCD_WHITE, 12);
    
    snprintf(factor_str, sizeof(factor_str), "Vibration: %.2f", assessment->vibration_risk);
    LCD_ShowString(10, 185, factor_str, LCD_ORANGE, LCD_WHITE, 12);
    
    snprintf(factor_str, sizeof(factor_str), "Humidity: %.2f", assessment->humidity_risk);
    LCD_ShowString(120, 170, factor_str, LCD_BLUE, LCD_WHITE, 12);
    
    snprintf(factor_str, sizeof(factor_str), "Light: %.2f", assessment->light_risk);
    LCD_ShowString(120, 185, factor_str, LCD_GREEN, LCD_WHITE, 12);
    
    // 底部状态栏
    lcd_fill(0, 220, 240, 222, LCD_GRAY);
    LCD_ShowString(10, 225, "Mode: Risk Status", LCD_BLACK, LCD_WHITE, 12);
}

/**
 * @brief 显示趋势图界面
 * @param assessment 风险评估结果
 */
void LCD_DisplayTrendChart(const RiskAssessment *assessment)
{
    if (!g_lcd_initialized || assessment == NULL) {
        return;
    }
    
    // 清屏
    LCD_Clear(LCD_WHITE);
    
    // 标题
    LCD_ShowString(80, 5, "Trend Chart", LCD_BLUE, LCD_WHITE, 16);
    
    // 分割线
    lcd_fill(10, 25, 230, 27, LCD_GRAY);
    
    // 简化的趋势显示
    LCD_ShowString(10, 35, "Risk Trends:", LCD_BLACK, LCD_WHITE, 16);
    
    // 绘制简单的条形图
    int bar_width = 40;
    int bar_height_base = 60;
    int bar_y = 150;
    
    // 倾斜风险条
    int tilt_height = (int)(assessment->tilt_risk * bar_height_base);
    lcd_fill(20, bar_y - tilt_height, 20 + bar_width, bar_y, LCD_RED);
    LCD_ShowString(25, bar_y + 5, "Tilt", LCD_BLACK, LCD_WHITE, 12);
    
    // 振动风险条
    int vib_height = (int)(assessment->vibration_risk * bar_height_base);
    lcd_fill(70, bar_y - vib_height, 70 + bar_width, bar_y, LCD_ORANGE);
    LCD_ShowString(75, bar_y + 5, "Vib", LCD_BLACK, LCD_WHITE, 12);
    
    // 湿度风险条
    int humi_height = (int)(assessment->humidity_risk * bar_height_base);
    lcd_fill(120, bar_y - humi_height, 120 + bar_width, bar_y, LCD_BLUE);
    LCD_ShowString(125, bar_y + 5, "Humi", LCD_BLACK, LCD_WHITE, 12);
    
    // 光照风险条
    int light_height = (int)(assessment->light_risk * bar_height_base);
    lcd_fill(170, bar_y - light_height, 170 + bar_width, bar_y, LCD_GREEN);
    LCD_ShowString(175, bar_y + 5, "Light", LCD_BLACK, LCD_WHITE, 12);
    
    // 刻度线
    lcd_fill(15, bar_y - bar_height_base, 215, bar_y - bar_height_base + 1, LCD_GRAY);
    LCD_ShowString(5, bar_y - bar_height_base - 15, "1.0", LCD_GRAY, LCD_WHITE, 12);
    LCD_ShowString(5, bar_y - bar_height_base/2 - 5, "0.5", LCD_GRAY, LCD_WHITE, 12);
    LCD_ShowString(5, bar_y - 5, "0.0", LCD_GRAY, LCD_WHITE, 12);
    
    // 底部状态栏
    lcd_fill(0, 220, 240, 222, LCD_GRAY);
    LCD_ShowString(10, 225, "Mode: Trend Chart", LCD_BLACK, LCD_WHITE, 12);
}

/**
 * @brief 显示系统信息界面
 * @param stats 系统统计信息
 */
void LCD_DisplaySystemInfo(const SystemStats *stats)
{
    if (!g_lcd_initialized || stats == NULL) {
        return;
    }
    
    // 清屏
    LCD_Clear(LCD_WHITE);
    
    // 标题
    LCD_ShowString(80, 5, "System Info", LCD_BLUE, LCD_WHITE, 16);
    
    // 分割线
    lcd_fill(10, 25, 230, 27, LCD_GRAY);
    
    // 运行时间
    LCD_ShowString(10, 35, "Uptime:", LCD_BLACK, LCD_WHITE, 12);
    char uptime_str[32];
    snprintf(uptime_str, sizeof(uptime_str), "%u seconds", stats->uptime_seconds);
    LCD_ShowString(70, 35, uptime_str, LCD_GREEN, LCD_WHITE, 12);
    
    // 数据采样次数
    LCD_ShowString(10, 55, "Samples:", LCD_BLACK, LCD_WHITE, 12);
    char samples_str[16];
    snprintf(samples_str, sizeof(samples_str), "%u", stats->data_samples);
    LCD_ShowString(80, 55, samples_str, LCD_BLUE, LCD_WHITE, 12);
    
    // 传感器错误次数
    LCD_ShowString(10, 75, "Sensor Errors:", LCD_BLACK, LCD_WHITE, 12);
    char errors_str[16];
    snprintf(errors_str, sizeof(errors_str), "%u", stats->sensor_errors);
    LCD_ShowString(120, 75, errors_str, LCD_RED, LCD_WHITE, 12);
    
    // 风险警报次数
    LCD_ShowString(10, 95, "Risk Alerts:", LCD_BLACK, LCD_WHITE, 12);
    char alerts_str[16];
    snprintf(alerts_str, sizeof(alerts_str), "%u", stats->risk_alerts);
    LCD_ShowString(100, 95, alerts_str, LCD_ORANGE, LCD_WHITE, 12);
    
    // 系统状态
    LCD_ShowString(10, 115, "System State:", LCD_BLACK, LCD_WHITE, 12);
    const char* state_text;
    uint16_t state_color;
    switch (stats->current_state) {
        case SYSTEM_STATE_RUNNING:
            state_text = "RUNNING";
            state_color = LCD_GREEN;
            break;
        case SYSTEM_STATE_WARNING:
            state_text = "WARNING";
            state_color = LCD_ORANGE;
            break;
        case SYSTEM_STATE_ERROR:
            state_text = "ERROR";
            state_color = LCD_RED;
            break;
        default:
            state_text = "UNKNOWN";
            state_color = LCD_GRAY;
            break;
    }
    LCD_ShowString(10, 135, state_text, state_color, LCD_WHITE, 16);
    
    // 底部状态栏
    lcd_fill(0, 220, 240, 222, LCD_GRAY);
    LCD_ShowString(10, 225, "Mode: System Info", LCD_BLACK, LCD_WHITE, 12);
}

/**
 * @brief 切换显示模式
 * @param mode 显示模式
 */
void LCD_SwitchMode(LcdDisplayMode mode)
{
    g_current_mode = mode;
}

/**
 * @brief 检查LCD是否已初始化
 * @return true: 已初始化, false: 未初始化
 */
bool LCD_IsInitialized(void)
{
    return g_lcd_initialized;
}

/* 暂时注释掉中文字库函数，避免编译错误 */
/*
int find_chinese_index_24x24(const char* chinese_char)
{
    // 实现代码暂时注释
    return -1;
}

void lcd_show_chinese_24x24(uint16_t x, uint16_t y, const char* text, uint16_t fc, uint16_t bc)
{
    // 实现代码暂时注释
}
*/

/**
 * @brief 初始化静态布局 (完全移植智能安防例程的布局)
 */
void LCD_InitStaticLayout(void)
{
    if (!g_lcd_initialized || g_static_layout_initialized) {
        return;
    }

    // 清屏为白色背景
    LCD_Clear(LCD_WHITE);

    // 现在使用32号字体的标题 - 更加醒目
    lcd_show_chinese(96, 0, (uint8_t *)"滑坡监测", LCD_RED, LCD_WHITE, 32, 0);
    lcd_draw_line(0, 33, LCD_W, 33, LCD_BLACK);
    lcd_show_chinese(5, 34, (uint8_t *)"传感器数据", LCD_RED, LCD_WHITE, 24, 0);
    lcd_show_string(101, 34, (const uint8_t *)": ", LCD_RED, LCD_WHITE, 24, 0);

    // 第一行：倾斜角度 (替换烟雾浓度)
    lcd_show_chinese(5, 58, (uint8_t *)"倾斜角度", LCD_RED, LCD_WHITE, 24, 0);
    lcd_show_string(101, 58, (const uint8_t *)": ", LCD_RED, LCD_WHITE, 24, 0);

    // 第二行：温度 (替换人体感应)
    lcd_show_chinese(5, 82, (uint8_t *)"温度", LCD_RED, LCD_WHITE, 24, 0);
    lcd_show_string(53, 82, (const uint8_t *)": ", LCD_RED, LCD_WHITE, 24, 0);

    lcd_draw_line(0, 131, LCD_W, 131, LCD_BLACK);
    lcd_show_chinese(5, 132, (uint8_t *)"环境状态", LCD_RED, LCD_WHITE, 24, 0);
    lcd_show_string(101, 132, (const uint8_t *)": ", LCD_RED, LCD_WHITE, 24, 0);

    // 第三行：湿度 (替换蜂鸣器)
    lcd_show_chinese(5, 156, (uint8_t *)"湿度", LCD_RED, LCD_WHITE, 24, 0);
    lcd_show_string(53, 156, (const uint8_t *)": ", LCD_RED, LCD_WHITE, 24, 0);

    // 第四行：光照 (替换报警灯)
    lcd_show_chinese(5, 180, (uint8_t *)"光照", LCD_RED, LCD_WHITE, 24, 0);
    lcd_show_string(53, 180, (const uint8_t *)": ", LCD_RED, LCD_WHITE, 24, 0);

    // 第五行：风险等级 (替换自动)
    lcd_show_chinese(5, 204, (uint8_t *)"风险", LCD_RED, LCD_WHITE, 24, 0);
    lcd_show_string(53, 204, (const uint8_t *)": ", LCD_RED, LCD_WHITE, 24, 0);

    g_static_layout_initialized = true;
    printf("LCD static layout initialized (Smart Security Layout Ported)\n");
}

/**
 * @brief 设置风险等级显示 (移植自智能安防的lcd_set_auto_state)
 */
void lcd_set_risk_level(const SensorData *data)
{
    float angle_magnitude = sqrtf(data->angle_x * data->angle_x + data->angle_y * data->angle_y);

    if (angle_magnitude < 5.0f) {
        lcd_show_chinese(77, 204, (uint8_t *)"安全", LCD_GREEN, LCD_WHITE, 24, 0);
    } else if (angle_magnitude < 10.0f) {
        lcd_show_chinese(77, 204, (uint8_t *)"注意", LCD_YELLOW, LCD_WHITE, 24, 0);
    } else if (angle_magnitude < 15.0f) {
        lcd_show_chinese(77, 204, (uint8_t *)"警告", LCD_ORANGE, LCD_WHITE, 24, 0);
    } else {
        lcd_show_chinese(77, 204, (uint8_t *)"危险", LCD_RED, LCD_WHITE, 24, 0);
    }
}

/**
 * @brief 只更新状态指示器 (使用智能安防的风险等级显示)
 */
void LCD_UpdateStatusOnly(const SensorData *data)
{
    if (!g_lcd_initialized || !data->data_valid) {
        return;
    }

    // 使用智能安防风格的风险等级更新
    lcd_set_risk_level(data);
}

/**
 * @brief 设置倾斜角度显示 (移植自智能安防的lcd_set_ppm)
 */
void lcd_set_tilt_angle(const SensorData *data)
{
    char buf[50] = {0};  // 使用char类型
    float angle_magnitude = sqrtf(data->angle_x * data->angle_x + data->angle_y * data->angle_y);
    sprintf(buf, "%.2f", angle_magnitude);
    lcd_show_string(119, 58, (const uint8_t *)buf, LCD_RED, LCD_WHITE, 24, 0);
    // 调整"度"字位置，给两位小数留出足够空间（约48像素宽度）
    lcd_show_chinese(167, 58, (uint8_t *)"度", LCD_RED, LCD_WHITE, 24, 0);
}

/**
 * @brief 设置温度显示 (移植自智能安防的lcd_set_body_induction)
 */
void lcd_set_temperature(const SensorData *data)
{
    char buf[50] = {0};  // 使用char类型
    sprintf(buf, "%.1fC", data->sht_temperature);  // 使用ASCII字符C替代℃
    lcd_show_string(71, 82, (const uint8_t *)buf, LCD_BLUE, LCD_WHITE, 24, 0);
}

/**
 * @brief 设置湿度显示 (移植自智能安防的lcd_set_beep_state)
 */
void lcd_set_humidity(const SensorData *data)
{
    char buf[50] = {0};  // 使用char类型
    sprintf(buf, "%.1f%%", data->humidity);
    lcd_show_string(71, 156, (const uint8_t *)buf, LCD_GREEN, LCD_WHITE, 24, 0);
}

/**
 * @brief 设置光照显示 (移植自智能安防的lcd_set_alarm_light_state)
 */
void lcd_set_light(const SensorData *data)
{
    char buf[50] = {0};  // 使用char类型
    sprintf(buf, "%.0flux", data->light_intensity);
    lcd_show_string(71, 180, (const uint8_t *)buf, LCD_ORANGE, LCD_WHITE, 24, 0);
}

/**
 * @brief 只更新数据数值 (使用智能安防的更新方式)
 */
void LCD_UpdateDataOnly(const SensorData *data)
{
    if (!g_lcd_initialized || !data->data_valid) {
        return;
    }

    // 使用智能安防风格的数据更新函数
    lcd_set_tilt_angle(data);
    lcd_set_temperature(data);
    lcd_set_humidity(data);
    lcd_set_light(data);
}
