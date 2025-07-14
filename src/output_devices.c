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
#include "output_devices.h"
#include "iot_gpio.h"
#include "iot_pwm.h"
#include "iot_uart.h"
#include "iot_adc.h"
#include "iot_errno.h"
#include "los_task.h"

// 静态变量
static bool g_rgb_initialized = false;
static bool g_buzzer_initialized = false;
static bool g_motor_initialized = false;
static bool g_alarm_light_initialized = false;
static bool g_button_initialized = false;
static bool g_voice_initialized = false;

// 云端控制状态
static bool g_cloud_alarm_acknowledged = false;
static uint32_t g_last_cloud_command_time = 0;

static RGB_Color g_current_rgb_color = RGB_COLOR_OFF;
static bool g_alarm_muted = false;
static void (*g_button_callback)(ButtonState state) = NULL;

// 按键状态检测
static ButtonState g_button_state = BUTTON_STATE_RELEASED;
static uint32_t g_button_press_time = 0;

/**
 * @brief 初始化所有输出设备
 * @return 0: 成功, 其他: 失败
 */
int OutputDevices_Init(void)
{
    int ret;
    int error_count = 0;
    
    printf("Initializing output devices...\n");
    
    // 初始化RGB灯
    ret = RGB_Init();
    if (ret != 0) {
        printf("RGB initialization failed: %d\n", ret);
        error_count++;
    }
    
    // 初始化蜂鸣器
    ret = Buzzer_Init();
    if (ret != 0) {
        printf("Buzzer initialization failed: %d\n", ret);
        error_count++;
    }
    
    // 初始化电机
    ret = Motor_Init();
    if (ret != 0) {
        printf("Motor initialization failed: %d\n", ret);
        error_count++;
    }

    // 初始化报警灯
    ret = AlarmLight_Init();
    if (ret != 0) {
        printf("Alarm light initialization failed: %d\n", ret);
        error_count++;
    }

    // 初始化按键 (按键失败不影响系统运行)
    ret = Button_Init();
    if (ret != 0) {
        printf("Button initialization failed: %d (non-critical)\n", ret);
        // 不增加error_count，按键失败不影响系统运行
    }
    
    // 初始化语音模块
    ret = Voice_Init();
    if (ret != 0) {
        printf("Voice initialization failed: %d\n", ret);
        error_count++;
    }

    // 初始化LCD显示屏
    ret = LCD_Init();
    if (ret != 0) {
        printf("LCD initialization failed: %d\n", ret);
        error_count++;
    }

    printf("Output devices initialization completed, errors: %d\n", error_count);
    return error_count;
}

/**
 * @brief 反初始化输出设备
 */
void OutputDevices_Deinit(void)
{
    RGB_Off();
    Buzzer_Off();
    Motor_Off();
    
    if (g_rgb_initialized) {
        IoTGpioDeinit(RGB_PIN_RED);
        IoTGpioDeinit(RGB_PIN_GREEN);
        IoTGpioDeinit(RGB_PIN_BLUE);
        g_rgb_initialized = false;
    }
    
    if (g_buzzer_initialized) {
        IoTGpioDeinit(BUZZER_PIN);
        g_buzzer_initialized = false;
    }
    
    if (g_motor_initialized) {
        IoTGpioDeinit(MOTOR_PIN);
        g_motor_initialized = false;
    }
    
    if (g_button_initialized) {
        // ADC按键不需要特殊清理
        g_button_initialized = false;
    }
    
    if (g_voice_initialized) {
        IoTUartDeinit(VOICE_UART_BUS);
        g_voice_initialized = false;
    }

    // 反初始化LCD
    LCD_Deinit();

    printf("Output devices deinitialized\n");
}

/**
 * @brief 初始化RGB灯
 * @return 0: 成功, 其他: 失败
 */
int RGB_Init(void)
{
    int ret;
    
    printf("Initializing RGB LED...\n");
    
    // 初始化红色LED (PWM1)
    ret = IoTPwmInit(RGB_PWM_RED);
    if (ret != IOT_SUCCESS) {
        printf("Failed to init RGB red PWM\n");
        return -1;
    }

    // 初始化绿色LED (PWM7)
    ret = IoTPwmInit(RGB_PWM_GREEN);
    if (ret != IOT_SUCCESS) {
        printf("Failed to init RGB green PWM\n");
        return -2;
    }

    // 初始化蓝色LED (PWM0)
    ret = IoTPwmInit(RGB_PWM_BLUE);
    if (ret != IOT_SUCCESS) {
        printf("Failed to init RGB blue PWM\n");
        return -3;
    }
    
    // 设置PWM频率 (占空比必须在1-99范围内，0表示关闭用1代替)
    IoTPwmStart(RGB_PWM_RED, 1, PWM_FREQ_HZ);
    IoTPwmStart(RGB_PWM_GREEN, 1, PWM_FREQ_HZ);
    IoTPwmStart(RGB_PWM_BLUE, 1, PWM_FREQ_HZ);
    
    g_rgb_initialized = true;
    printf("RGB LED initialized successfully\n");
    
    return 0;
}

/**
 * @brief 设置RGB颜色
 * @param color RGB颜色
 */
void RGB_SetColor(RGB_Color color)
{
    if (!g_rgb_initialized) {
        return;
    }

    // 实现真正的纯色：有颜色的通道启动PWM，无颜色的通道停止PWM
    if (color.red > 0) {
        uint16_t red_duty = (color.red * 98 / 4095) + 1;
        IoTPwmStart(RGB_PWM_RED, red_duty, PWM_FREQ_HZ);
    } else {
        IoTPwmStop(RGB_PWM_RED);
    }

    if (color.green > 0) {
        uint16_t green_duty = (color.green * 98 / 4095) + 1;
        IoTPwmStart(RGB_PWM_GREEN, green_duty, PWM_FREQ_HZ);
    } else {
        IoTPwmStop(RGB_PWM_GREEN);
    }

    if (color.blue > 0) {
        uint16_t blue_duty = (color.blue * 98 / 4095) + 1;
        IoTPwmStart(RGB_PWM_BLUE, blue_duty, PWM_FREQ_HZ);
    } else {
        IoTPwmStop(RGB_PWM_BLUE);
    }

    g_current_rgb_color = color;
}

/**
 * @brief 设置RGB亮度
 * @param brightness 亮度 (0-100)
 */
void RGB_SetBrightness(uint8_t brightness)
{
    if (!g_rgb_initialized) {
        return;
    }

    // 限制亮度范围
    if (brightness > 100) {
        brightness = 100;
    }

    // 根据亮度调整当前颜色
    RGB_Color adjusted_color;
    adjusted_color.red = (g_current_rgb_color.red * brightness) / 100;
    adjusted_color.green = (g_current_rgb_color.green * brightness) / 100;
    adjusted_color.blue = (g_current_rgb_color.blue * brightness) / 100;

    // 实现真正的纯色：有颜色的通道启动PWM，无颜色的通道停止PWM
    if (adjusted_color.red > 0) {
        uint16_t red_duty = (adjusted_color.red * 98 / 4095) + 1;
        IoTPwmStart(RGB_PWM_RED, red_duty, PWM_FREQ_HZ);
    } else {
        IoTPwmStop(RGB_PWM_RED);
    }

    if (adjusted_color.green > 0) {
        uint16_t green_duty = (adjusted_color.green * 98 / 4095) + 1;
        IoTPwmStart(RGB_PWM_GREEN, green_duty, PWM_FREQ_HZ);
    } else {
        IoTPwmStop(RGB_PWM_GREEN);
    }

    if (adjusted_color.blue > 0) {
        uint16_t blue_duty = (adjusted_color.blue * 98 / 4095) + 1;
        IoTPwmStart(RGB_PWM_BLUE, blue_duty, PWM_FREQ_HZ);
    } else {
        IoTPwmStop(RGB_PWM_BLUE);
    }
}

/**
 * @brief 根据风险等级设置RGB颜色
 * @param risk_level 风险等级
 */
void RGB_SetColorByRisk(RiskLevel risk_level)
{
    RGB_Color color;

    switch (risk_level) {
        case RISK_LEVEL_SAFE:
            color = (RGB_Color)RGB_COLOR_GREEN;     // 绿色：安全
            break;
        case RISK_LEVEL_LOW:
            color = (RGB_Color)RGB_COLOR_BLUE;      // 蓝色：低风险
            break;
        case RISK_LEVEL_MEDIUM:
            color = (RGB_Color)RGB_COLOR_RED;       // 红色：中等风险（改为红色，避免黄色混色问题）
            break;
        case RISK_LEVEL_HIGH:
            color = (RGB_Color)RGB_COLOR_RED;       // 红色：高风险
            break;
        case RISK_LEVEL_CRITICAL:
            color = (RGB_Color)RGB_COLOR_RED;       // 红色：危急
            break;
        default:
            color = (RGB_Color)RGB_COLOR_OFF;
            break;
    }

    RGB_SetColor(color);
}

// 特效相关函数已移除，保持简单的RGB控制

/**
 * @brief 关闭RGB灯
 */
void RGB_Off(void)
{
    RGB_Color off_color = RGB_COLOR_OFF;
    RGB_SetColor(off_color);
}

/**
 * @brief 初始化蜂鸣器
 * @return 0: 成功, 其他: 失败
 */
int Buzzer_Init(void)
{
    int ret;
    
    printf("Initializing buzzer...\n");

    ret = IoTPwmInit(BUZZER_PWM);
    if (ret != IOT_SUCCESS) {
        printf("Failed to init buzzer PWM\n");
        return -1;
    }
    
    // 初始状态关闭
    IoTPwmStop(BUZZER_PWM);
    
    g_buzzer_initialized = true;
    printf("Buzzer initialized successfully\n");
    
    return 0;
}

/**
 * @brief 蜂鸣器响铃
 * @param duration_ms 持续时间 (毫秒)
 */
void Buzzer_Beep(uint32_t duration_ms)
{
    if (!g_buzzer_initialized || g_alarm_muted) {
        return;
    }
    
    // 开启蜂鸣器 (50%占空比, 2kHz频率)
    IoTPwmStart(BUZZER_PWM, 50, 2000);

    // 延时后关闭
    LOS_Msleep(duration_ms);
    IoTPwmStop(BUZZER_PWM);
}

/**
 * @brief 根据风险等级蜂鸣
 * @param risk_level 风险等级
 */
void Buzzer_BeepByRisk(RiskLevel risk_level)
{
    if (!g_buzzer_initialized || g_alarm_muted) {
        return;
    }
    
    switch (risk_level) {
        case RISK_LEVEL_SAFE:
            // 安全状态不响
            break;
        case RISK_LEVEL_LOW:
            // 低风险：1声短响 (滴)
            printf("ALARM: Low risk - 1 short beep\n");
            Buzzer_Beep(120);
            break;
        case RISK_LEVEL_MEDIUM:
            // 中风险：2声短响 (滴-滴)
            printf("ALARM: Medium risk - 2 short beeps\n");
            Buzzer_Beep(120);
            LOS_Msleep(100);
            Buzzer_Beep(120);
            break;
        case RISK_LEVEL_HIGH:
            // 高风险：3声短响 (滴-滴-滴)
            printf("ALARM: High risk - 3 short beeps\n");
            Buzzer_Beep(120);
            LOS_Msleep(80);
            Buzzer_Beep(120);
            LOS_Msleep(80);
            Buzzer_Beep(120);
            break;
        case RISK_LEVEL_CRITICAL:
            // 危急：长响-短响-长响 (滴——滴滴——)
            printf("ALARM: Critical risk - long-short-long pattern\n");
            Buzzer_Beep(500);  // 长响
            LOS_Msleep(150);
            Buzzer_Beep(100);  // 短响
            LOS_Msleep(80);
            Buzzer_Beep(100);  // 短响
            LOS_Msleep(150);
            Buzzer_Beep(500);  // 长响
            break;
    }
}

/**
 * @brief 关闭蜂鸣器
 */
void Buzzer_Off(void)
{
    if (g_buzzer_initialized) {
        IoTPwmStop(BUZZER_PWM);  // 完全停止PWM输出
    }
}

/**
 * @brief 初始化电机
 * @return 0: 成功, 其他: 失败
 */
int Motor_Init(void)
{
    int ret;

    printf("Initializing motor...\n");

    ret = IoTPwmInit(MOTOR_PWM);
    if (ret != IOT_SUCCESS) {
        printf("Failed to init motor PWM\n");
        return -1;
    }

    // 初始状态关闭 (使用最小占空比1代替0)
    IoTPwmStart(MOTOR_PWM, 1, PWM_FREQ_HZ);

    g_motor_initialized = true;
    printf("Motor initialized successfully\n");

    return 0;
}

/**
 * @brief 电机振动
 * @param duration_ms 持续时间 (毫秒)
 */
void Motor_Vibrate(uint32_t duration_ms)
{
    if (!g_motor_initialized) {
        return;
    }

    // 开启电机 (70%占空比)
    IoTPwmStart(MOTOR_PWM, 70, PWM_FREQ_HZ);

    // 延时后关闭
    LOS_Msleep(duration_ms);
    IoTPwmStart(MOTOR_PWM, 1, PWM_FREQ_HZ);  // 使用最小占空比代替0
}

/**
 * @brief 根据风险等级振动
 * @param risk_level 风险等级
 */
void Motor_VibrateByRisk(RiskLevel risk_level)
{
    if (!g_motor_initialized) {
        return;
    }

    switch (risk_level) {
        case RISK_LEVEL_SAFE:
            // 安全状态不振动
            break;
        case RISK_LEVEL_LOW:
            // 低风险：1次轻微振动
            printf("VIBRATION: Low risk - 1 light vibration\n");
            Motor_Vibrate(150);
            break;
        case RISK_LEVEL_MEDIUM:
            // 中风险：2次中等振动
            printf("VIBRATION: Medium risk - 2 medium vibrations\n");
            Motor_Vibrate(200);
            LOS_Msleep(150);
            Motor_Vibrate(200);
            break;
        case RISK_LEVEL_HIGH:
            // 高风险：3次强振动
            printf("VIBRATION: High risk - 3 strong vibrations\n");
            Motor_Vibrate(250);
            LOS_Msleep(120);
            Motor_Vibrate(250);
            LOS_Msleep(120);
            Motor_Vibrate(250);
            break;
        case RISK_LEVEL_CRITICAL:
            // 危急：持续强振动模式
            printf("VIBRATION: Critical risk - continuous strong pattern\n");
            Motor_Vibrate(400);  // 长振动
            LOS_Msleep(100);
            Motor_Vibrate(120);  // 短振动
            LOS_Msleep(60);
            Motor_Vibrate(120);  // 短振动
            LOS_Msleep(60);
            Motor_Vibrate(120);  // 短振动
            LOS_Msleep(100);
            Motor_Vibrate(400);  // 长振动
            break;
    }
}

/**
 * @brief 关闭电机
 */
void Motor_Off(void)
{
    if (g_motor_initialized) {
        IoTPwmStart(MOTOR_PWM, 1, PWM_FREQ_HZ);  // 使用最小占空比代替0
    }
}

// ==================== 报警灯控制函数 ====================

/**
 * @brief 初始化报警灯
 * @return 0: 成功, 其他: 失败
 */
int AlarmLight_Init(void)
{
    printf("Alarm light functionality integrated into RGB LED system\n");
    printf("RGB LED provides comprehensive visual indication with color coding\n");
    printf("This approach provides better visual feedback than simple on/off light\n");

    g_alarm_light_initialized = false;  // 标记为未初始化，功能由RGB LED承担
    return 0;  // 返回成功，不影响系统启动
}

/**
 * @brief 设置报警灯状态
 * @param state true: 开启, false: 关闭
 */
void AlarmLight_SetState(bool state)
{
    if (!g_alarm_light_initialized) {
        return;
    }

    static bool last_state = false;
    if (state == last_state) {
        return;  // 状态未改变，不需要操作
    }

    if (state) {
        IoTGpioSetOutputVal(ALARM_LIGHT_PIN, IOT_GPIO_VALUE1);
        printf("Alarm light ON\n");
    } else {
        IoTGpioSetOutputVal(ALARM_LIGHT_PIN, IOT_GPIO_VALUE0);
        printf("Alarm light OFF\n");
    }

    last_state = state;
}

/**
 * @brief 根据风险等级设置报警灯
 * @param risk_level 风险等级
 */
void AlarmLight_SetByRisk(RiskLevel risk_level)
{
    switch (risk_level) {
        case RISK_LEVEL_SAFE:
        case RISK_LEVEL_LOW:
            AlarmLight_SetState(false);  // 安全和低风险关闭
            break;
        case RISK_LEVEL_MEDIUM:
        case RISK_LEVEL_HIGH:
        case RISK_LEVEL_CRITICAL:
            AlarmLight_SetState(true);   // 中等以上风险开启
            break;
        default:
            AlarmLight_SetState(false);
            break;
    }
}

/**
 * @brief 报警灯闪烁
 * @param interval_ms 闪烁间隔(毫秒)
 */
void AlarmLight_Blink(uint32_t interval_ms)
{
    if (!g_alarm_light_initialized) {
        return;
    }

    static uint32_t last_toggle_time = 0;
    static bool current_state = false;
    uint32_t current_time = LOS_TickCountGet();

    if (current_time - last_toggle_time >= interval_ms) {
        current_state = !current_state;
        AlarmLight_SetState(current_state);
        last_toggle_time = current_time;
    }
}

/**
 * @brief 关闭报警灯
 */
void AlarmLight_Off(void)
{
    AlarmLight_SetState(false);
}

// ==================== 按键控制函数 ====================

/**
 * @brief 初始化按键
 * @return 0: 成功, 其他: 失败
 */
// 按键功能已简化，移除未使用的中断回调函数

int Button_Init(void)
{
    printf("Button functionality disabled (hardware issues detected)\n");
    printf("System will operate in automatic monitoring mode\n");
    printf("Manual reset can be performed by system restart if needed\n");

    g_button_initialized = false;
    return 0;
}

/**
 * @brief 获取按键状态
 * @return 按键状态
 */
ButtonState Button_GetState(void)
{
    // 按键功能已禁用，直接返回释放状态
    return BUTTON_STATE_RELEASED;
}

/**
 * @brief 检查按键是否按下
 * @return true: 按下, false: 释放
 */
bool Button_IsPressed(void)
{
    if (!g_button_initialized) {
        return false;
    }

    // 使用ADC读取按键状态
    unsigned int adc_value = 0;
    int ret = IoTAdcGetVal(BUTTON_ADC_CHANNEL, &adc_value);
    if (ret != IOT_SUCCESS) {
        return false;
    }

    return !(adc_value >= BUTTON_RELEASED_MIN && adc_value <= BUTTON_RELEASED_MAX);  // 不在正常范围表示有按键按下
}

/**
 * @brief 设置按键回调函数
 * @param callback 回调函数
 */
void Button_SetCallback(void (*callback)(ButtonState state))
{
    g_button_callback = callback;
}

/**
 * @brief 初始化语音模块
 * @return 0: 成功, 其他: 失败
 */
int Voice_Init(void)
{
    int ret;
    IotUartAttribute uart_attr = {
        .baudRate = 9600,
        .dataBits = 8,
        .stopBits = 1,
        .parity = 0,
    };

    printf("Initializing voice module...\n");

    // 初始化UART
    ret = IoTUartInit(VOICE_UART_BUS, &uart_attr);
    if (ret != IOT_SUCCESS) {
        printf("Failed to init voice UART\n");
        return -1;
    }

    g_voice_initialized = true;
    printf("Voice module initialized successfully\n");

    return 0;
}

/**
 * @brief 语音播报消息
 * @param msg 消息类型
 */
void Voice_PlayMessage(VoiceMessage msg)
{
    if (!g_voice_initialized) {
        return;
    }

    const char* messages[] = {
        "System started",           // VOICE_MSG_SYSTEM_START
        "Status safe",              // VOICE_MSG_SAFE
        "Low risk detected",        // VOICE_MSG_LOW_RISK
        "Medium risk detected",     // VOICE_MSG_MEDIUM_RISK
        "High risk detected",       // VOICE_MSG_HIGH_RISK
        "Critical risk detected",   // VOICE_MSG_CRITICAL_RISK
        "Sensor error",             // VOICE_MSG_SENSOR_ERROR
        "System error"              // VOICE_MSG_SYSTEM_ERROR
    };

    if (msg < sizeof(messages) / sizeof(messages[0])) {
        Voice_PlayCustom(messages[msg]);
    }
}

/**
 * @brief 播放自定义文本
 * @param text 文本内容
 */
void Voice_PlayCustom(const char *text)
{
    if (!g_voice_initialized || text == NULL) {
        return;
    }

    // 发送语音播报命令 (简化实现)
    char cmd[128];
    snprintf(cmd, sizeof(cmd), "[v10][t5]%s", text);

    IoTUartWrite(VOICE_UART_BUS, (unsigned char*)cmd, strlen(cmd));

    printf("Voice: %s\n", text);
}

/**
 * @brief 综合报警控制
 * @param risk_level 风险等级
 */
void Alarm_SetRiskLevel(RiskLevel risk_level)
{
    // 设置RGB指示
    RGB_SetColorByRisk(risk_level);

    // 蜂鸣器报警
    Buzzer_BeepByRisk(risk_level);

    // 电机振动
    Motor_VibrateByRisk(risk_level);

    // 语音播报
    if (risk_level >= RISK_LEVEL_HIGH) {
        Voice_PlayMessage(VOICE_MSG_HIGH_RISK + (risk_level - RISK_LEVEL_HIGH));
    }
}

/**
 * @brief 设置报警静音
 * @param mute 是否静音
 */
void Alarm_Mute(bool mute)
{
    g_alarm_muted = mute;
    if (mute) {
        Buzzer_Off();
        Motor_Off();
    }
}
