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

#ifndef __OUTPUT_DEVICES_H__
#define __OUTPUT_DEVICES_H__

#include <stdint.h>
#include <stdbool.h>
#include "landslide_monitor.h"
#include "lcd_display.h"

#ifdef __cplusplus
extern "C" {
#endif

// RGB灯引脚配置
#define RGB_PIN_RED                 GPIO0_PB5   // PWM1
#define RGB_PIN_GREEN               GPIO1_PD0   // PWM7
#define RGB_PIN_BLUE                GPIO0_PB4   // PWM0
#define RGB_PWM_RED                 EPWMDEV_PWM1_M1
#define RGB_PWM_GREEN               EPWMDEV_PWM7_M1
#define RGB_PWM_BLUE                EPWMDEV_PWM0_M1

// 蜂鸣器配置
#define BUZZER_PIN                  GPIO0_PC5   // PWM5
#define BUZZER_PWM                  EPWMDEV_PWM5_M0

// 电机配置
#define MOTOR_PIN                   GPIO0_PC6   // PWM6
#define MOTOR_PWM                   EPWMDEV_PWM6_M0

// 功能按键配置
#define BUTTON_PIN                  GPIO0_PC7

// 语音模块配置 (UART)
#define VOICE_UART_TX               GPIO0_PB2
#define VOICE_UART_RX               GPIO0_PB3
#define VOICE_UART_BUS              1

// PWM配置参数
#define PWM_FREQ_HZ                 1000        // PWM频率 1kHz
#define PWM_DUTY_MAX                4095        // 最大占空比 (12位)

// RGB颜色定义
typedef struct {
    uint16_t red;               // 红色分量 (0-4095)
    uint16_t green;             // 绿色分量 (0-4095)
    uint16_t blue;              // 蓝色分量 (0-4095)
} RGB_Color;

// 预定义颜色
#define RGB_COLOR_OFF       {0, 0, 0}
#define RGB_COLOR_RED       {4095, 0, 0}
#define RGB_COLOR_GREEN     {0, 4095, 0}
#define RGB_COLOR_BLUE      {0, 0, 4095}
#define RGB_COLOR_YELLOW    {4095, 4095, 0}
#define RGB_COLOR_ORANGE    {4095, 2048, 0}
#define RGB_COLOR_PURPLE    {4095, 0, 4095}
#define RGB_COLOR_WHITE     {4095, 4095, 4095}

// 蜂鸣器模式
typedef enum {
    BUZZER_MODE_OFF = 0,        // 关闭
    BUZZER_MODE_SINGLE,         // 单次响
    BUZZER_MODE_DOUBLE,         // 双响
    BUZZER_MODE_TRIPLE,         // 三响
    BUZZER_MODE_CONTINUOUS,     // 连续响
    BUZZER_MODE_PULSE           // 脉冲响
} BuzzerMode;

// 按键状态
typedef enum {
    BUTTON_STATE_RELEASED = 0,  // 释放
    BUTTON_STATE_PRESSED,       // 按下
    BUTTON_STATE_SHORT_PRESS,   // 短按
    BUTTON_STATE_LONG_PRESS     // 长按
} ButtonState;

// 语音播报内容
typedef enum {
    VOICE_MSG_SYSTEM_START = 0, // 系统启动
    VOICE_MSG_SAFE,             // 安全状态
    VOICE_MSG_LOW_RISK,         // 低风险
    VOICE_MSG_MEDIUM_RISK,      // 中风险
    VOICE_MSG_HIGH_RISK,        // 高风险
    VOICE_MSG_CRITICAL_RISK,    // 危急风险
    VOICE_MSG_SENSOR_ERROR,     // 传感器错误
    VOICE_MSG_SYSTEM_ERROR      // 系统错误
} VoiceMessage;

// 函数声明

// 输出设备初始化
int OutputDevices_Init(void);
void OutputDevices_Deinit(void);

// RGB灯控制
int RGB_Init(void);
void RGB_SetColor(RGB_Color color);
void RGB_SetColorByRisk(RiskLevel risk_level);
void RGB_SetBrightness(uint8_t brightness);  // 0-100%
void RGB_Blink(RGB_Color color, uint32_t interval_ms);
void RGB_Off(void);

// 蜂鸣器控制
int Buzzer_Init(void);
void Buzzer_SetMode(BuzzerMode mode);
void Buzzer_SetFrequency(uint32_t freq_hz);
void Buzzer_Beep(uint32_t duration_ms);
void Buzzer_BeepByRisk(RiskLevel risk_level);
void Buzzer_Off(void);

// 电机控制
int Motor_Init(void);
void Motor_SetSpeed(uint8_t speed);          // 0-100%
void Motor_Vibrate(uint32_t duration_ms);
void Motor_VibrateByRisk(RiskLevel risk_level);
void Motor_Off(void);

// 按键控制
int Button_Init(void);
ButtonState Button_GetState(void);
bool Button_IsPressed(void);
void Button_SetCallback(void (*callback)(ButtonState state));

// 语音播报
int Voice_Init(void);
void Voice_PlayMessage(VoiceMessage msg);
void Voice_PlayRiskStatus(RiskLevel risk_level);
void Voice_PlayCustom(const char *text);
bool Voice_IsBusy(void);

// 综合报警控制
void Alarm_SetRiskLevel(RiskLevel risk_level);
void Alarm_Mute(bool mute);
void Alarm_Test(void);

// 设备状态检查
bool RGB_IsInitialized(void);
bool Buzzer_IsInitialized(void);
bool Motor_IsInitialized(void);
bool Button_IsInitialized(void);
bool Voice_IsInitialized(void);
bool LCD_IsInitialized(void);

#ifdef __cplusplus
}
#endif

#endif // __OUTPUT_DEVICES_H__
