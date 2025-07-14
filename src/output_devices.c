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
#include "iot_errno.h"
#include "los_task.h"

// 静态变量
static bool g_rgb_initialized = false;
static bool g_buzzer_initialized = false;
static bool g_motor_initialized = false;
static bool g_button_initialized = false;
static bool g_voice_initialized = false;

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
        IoTGpioDeinit(BUTTON_PIN);
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

    // 将0-4095范围转换为1-99范围，避免0值
    uint16_t red_duty = (color.red * 98 / 4095) + 1;
    uint16_t green_duty = (color.green * 98 / 4095) + 1;
    uint16_t blue_duty = (color.blue * 98 / 4095) + 1;

    IoTPwmStart(RGB_PWM_RED, red_duty, PWM_FREQ_HZ);
    IoTPwmStart(RGB_PWM_GREEN, green_duty, PWM_FREQ_HZ);
    IoTPwmStart(RGB_PWM_BLUE, blue_duty, PWM_FREQ_HZ);

    g_current_rgb_color = color;
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
            color = (RGB_Color)RGB_COLOR_GREEN;
            break;
        case RISK_LEVEL_LOW:
            color = (RGB_Color)RGB_COLOR_YELLOW;
            break;
        case RISK_LEVEL_MEDIUM:
            color = (RGB_Color)RGB_COLOR_ORANGE;
            break;
        case RISK_LEVEL_HIGH:
            color = (RGB_Color)RGB_COLOR_RED;
            break;
        case RISK_LEVEL_CRITICAL:
            color = (RGB_Color)RGB_COLOR_RED;
            break;
        default:
            color = (RGB_Color)RGB_COLOR_OFF;
            break;
    }
    
    RGB_SetColor(color);
}

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
            // 低风险：短响一次
            Buzzer_Beep(100);
            break;
        case RISK_LEVEL_MEDIUM:
            // 中风险：短响两次
            Buzzer_Beep(100);
            LOS_Msleep(100);
            Buzzer_Beep(100);
            break;
        case RISK_LEVEL_HIGH:
            // 高风险：长响一次
            Buzzer_Beep(500);
            break;
        case RISK_LEVEL_CRITICAL:
            // 危急：连续响
            for (int i = 0; i < 3; i++) {
                Buzzer_Beep(200);
                LOS_Msleep(100);
            }
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
        case RISK_LEVEL_LOW:
            // 安全和低风险不振动
            break;
        case RISK_LEVEL_MEDIUM:
            // 中风险：短振动
            Motor_Vibrate(200);
            break;
        case RISK_LEVEL_HIGH:
            // 高风险：长振动
            Motor_Vibrate(500);
            break;
        case RISK_LEVEL_CRITICAL:
            // 危急：连续振动
            for (int i = 0; i < 3; i++) {
                Motor_Vibrate(300);
                LOS_Msleep(200);
            }
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

/**
 * @brief 初始化按键
 * @return 0: 成功, 其他: 失败
 */
int Button_Init(void)
{
    int ret;

    printf("Initializing button...\n");

    ret = IoTGpioInit(BUTTON_PIN);
    if (ret != IOT_SUCCESS) {
        printf("Failed to init button pin: %d\n", ret);
        return -1;
    }

    // 设置为输入模式
    ret = IoTGpioSetDir(BUTTON_PIN, IOT_GPIO_DIR_IN);
    if (ret != IOT_SUCCESS) {
        printf("Failed to set button pin direction: %d\n", ret);
        return -1;
    }

    // 设置上拉电阻 (按键通常需要上拉)
    // 注意：某些版本可能不支持IoTGpioSetPull函数，跳过此设置
    // ret = IoTGpioSetPull(BUTTON_PIN, IOT_GPIO_PULL_UP);
    // if (ret != IOT_SUCCESS) {
    //     printf("Failed to set button pin pull-up: %d\n", ret);
    // }

    g_button_initialized = true;
    printf("Button initialized successfully\n");

    return 0;
}

/**
 * @brief 获取按键状态
 * @return 按键状态
 */
ButtonState Button_GetState(void)
{
    if (!g_button_initialized) {
        return BUTTON_STATE_RELEASED;
    }

    IotGpioValue value;
    IoTGpioGetInputVal(BUTTON_PIN, &value);

    static IotGpioValue last_value = IOT_GPIO_VALUE1;
    static uint32_t press_start_time = 0;
    uint32_t current_time = LOS_TickCountGet();

    if (value == IOT_GPIO_VALUE0 && last_value == IOT_GPIO_VALUE1) {
        // 按键按下
        press_start_time = current_time;
        g_button_state = BUTTON_STATE_PRESSED;
    } else if (value == IOT_GPIO_VALUE1 && last_value == IOT_GPIO_VALUE0) {
        // 按键释放
        uint32_t press_duration = current_time - press_start_time;

        if (press_duration > 2000) {
            g_button_state = BUTTON_STATE_LONG_PRESS;
        } else if (press_duration > 50) {
            g_button_state = BUTTON_STATE_SHORT_PRESS;
        } else {
            g_button_state = BUTTON_STATE_RELEASED;
        }

        // 调用回调函数
        if (g_button_callback != NULL) {
            g_button_callback(g_button_state);
        }
    }

    last_value = value;
    return g_button_state;
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

    IotGpioValue value;
    IoTGpioGetInputVal(BUTTON_PIN, &value);
    return (value == IOT_GPIO_VALUE0);
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
