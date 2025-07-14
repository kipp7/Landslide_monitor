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
#include <unistd.h>
#include <math.h>
#include "los_task.h"
#include "los_sem.h"
#include "los_mux.h"
#include "cmsis_os.h"
#include "ohos_init.h"
#include "landslide_monitor.h"
#include "sensors.h"
#include "output_devices.h"
#include "lcd.h"  // 添加LCD头文件以使用颜色定义

// 全局变量
static SystemState g_system_state = SYSTEM_STATE_INIT;
static SensorData g_latest_sensor_data;
static ProcessedData g_latest_processed_data;
static RiskAssessment g_latest_risk_assessment;
static SystemStats g_system_stats;
static LcdDisplayMode g_lcd_mode = LCD_MODE_REALTIME;

// 线程ID
static UINT32 g_sensor_thread_id = 0;
static UINT32 g_data_proc_thread_id = 0;
static UINT32 g_risk_eval_thread_id = 0;
static UINT32 g_display_thread_id = 0;
static UINT32 g_alarm_thread_id = 0;

// 同步对象
static UINT32 g_data_mutex = 0;
static UINT32 g_sensor_sem = 0;

// 数据缓冲区
static SensorData g_sensor_buffer[DATA_BUFFER_SIZE];
static uint32_t g_buffer_index = 0;
static bool g_buffer_full = false;

// 错误信息
static char g_error_message[128] = {0};

// 内部函数声明
static void SensorCollectionTask(void);
static void DataProcessingTask(void);
static void RiskEvaluationTask(void);
static void DisplayTask(void);
static void AlarmTask(void);
static int InitializeHardware(void);
static int CreateTasks(void);
static void UpdateSystemStats(void);
static void AddSensorDataToBuffer(const SensorData *data);
static void ProcessSensorData(ProcessedData *processed);
static void EvaluateRisk(const ProcessedData *processed, RiskAssessment *assessment);
static void ButtonEventHandler(ButtonState state);

/**
 * @brief 初始化山体滑坡监测系统
 * @return 0: 成功, 其他: 失败
 */
int LandslideMonitorInit(void)
{
    int ret;
    
    printf("Initializing Landslide Monitoring System...\n");
    
    // 初始化系统状态
    g_system_state = SYSTEM_STATE_INIT;
    memset(&g_system_stats, 0, sizeof(g_system_stats));
    memset(&g_latest_sensor_data, 0, sizeof(g_latest_sensor_data));
    memset(&g_latest_processed_data, 0, sizeof(g_latest_processed_data));
    memset(&g_latest_risk_assessment, 0, sizeof(g_latest_risk_assessment));
    
    // 创建互斥锁
    ret = LOS_MuxCreate(&g_data_mutex);
    if (ret != LOS_OK) {
        snprintf(g_error_message, sizeof(g_error_message), "Failed to create mutex: %d", ret);
        return -1;
    }
    
    // 创建信号量
    ret = LOS_SemCreate(0, &g_sensor_sem);
    if (ret != LOS_OK) {
        snprintf(g_error_message, sizeof(g_error_message), "Failed to create semaphore: %d", ret);
        return -2;
    }
    
    // 初始化硬件
    ret = InitializeHardware();
    if (ret != 0) {
        snprintf(g_error_message, sizeof(g_error_message), "Hardware initialization failed: %d", ret);
        return -3;
    }
    
    printf("Landslide monitoring system initialized successfully\n");
    return 0;
}

/**
 * @brief 启动山体滑坡监测系统
 * @return 0: 成功, 其他: 失败
 */
int LandslideMonitorStart(void)
{
    int ret;
    
    if (g_system_state != SYSTEM_STATE_INIT) {
        snprintf(g_error_message, sizeof(g_error_message), "System not in init state");
        return -1;
    }
    
    printf("Starting landslide monitoring system...\n");

    // 设置系统状态为运行 (在创建任务之前设置)
    g_system_state = SYSTEM_STATE_RUNNING;
    g_system_stats.current_state = SYSTEM_STATE_RUNNING;
    g_system_stats.lcd_mode = g_lcd_mode;

    // 创建任务
    ret = CreateTasks();
    if (ret != 0) {
        snprintf(g_error_message, sizeof(g_error_message), "Failed to create tasks: %d", ret);
        g_system_state = SYSTEM_STATE_ERROR;  // 任务创建失败时设置错误状态
        return -2;
    }
    
    // 播放启动语音
    Voice_PlayMessage(VOICE_MSG_SYSTEM_START);
    
    // 设置按键回调
    Button_SetCallback(ButtonEventHandler);
    
    printf("Landslide monitoring system started successfully\n");
    return 0;
}

/**
 * @brief 停止山体滑坡监测系统
 * @return 0: 成功, 其他: 失败
 */
int LandslideMonitorStop(void)
{
    printf("Stopping landslide monitoring system...\n");
    
    // 设置系统状态为关闭
    g_system_state = SYSTEM_STATE_SHUTDOWN;
    
    // 删除任务
    if (g_sensor_thread_id != 0) {
        LOS_TaskDelete(g_sensor_thread_id);
        g_sensor_thread_id = 0;
    }
    if (g_data_proc_thread_id != 0) {
        LOS_TaskDelete(g_data_proc_thread_id);
        g_data_proc_thread_id = 0;
    }
    if (g_risk_eval_thread_id != 0) {
        LOS_TaskDelete(g_risk_eval_thread_id);
        g_risk_eval_thread_id = 0;
    }
    if (g_display_thread_id != 0) {
        LOS_TaskDelete(g_display_thread_id);
        g_display_thread_id = 0;
    }
    if (g_alarm_thread_id != 0) {
        LOS_TaskDelete(g_alarm_thread_id);
        g_alarm_thread_id = 0;
    }
    
    printf("Landslide monitoring system stopped\n");
    return 0;
}

/**
 * @brief 关闭山体滑坡监测系统
 */
void LandslideMonitorShutdown(void)
{
    printf("Shutting down landslide monitoring system...\n");
    
    // 停止系统
    LandslideMonitorStop();
    
    // 反初始化硬件
    Sensors_Deinit();
    OutputDevices_Deinit();
    
    // 删除同步对象
    if (g_data_mutex != 0) {
        LOS_MuxDelete(g_data_mutex);
        g_data_mutex = 0;
    }
    if (g_sensor_sem != 0) {
        LOS_SemDelete(g_sensor_sem);
        g_sensor_sem = 0;
    }
    
    g_system_state = SYSTEM_STATE_SHUTDOWN;
    printf("Landslide monitoring system shutdown complete\n");
}

/**
 * @brief 获取最新传感器数据
 * @param data 数据结构指针
 * @return 0: 成功, 其他: 失败
 */
int GetLatestSensorData(SensorData *data)
{
    if (data == NULL) {
        return -1;
    }
    
    LOS_MuxPend(g_data_mutex, LOS_WAIT_FOREVER);
    *data = g_latest_sensor_data;
    LOS_MuxPost(g_data_mutex);
    
    return 0;
}

/**
 * @brief 获取最新处理数据
 * @param data 数据结构指针
 * @return 0: 成功, 其他: 失败
 */
int GetLatestProcessedData(ProcessedData *data)
{
    if (data == NULL) {
        return -1;
    }
    
    LOS_MuxPend(g_data_mutex, LOS_WAIT_FOREVER);
    *data = g_latest_processed_data;
    LOS_MuxPost(g_data_mutex);
    
    return 0;
}

/**
 * @brief 获取最新风险评估
 * @param assessment 评估结构指针
 * @return 0: 成功, 其他: 失败
 */
int GetLatestRiskAssessment(RiskAssessment *assessment)
{
    if (assessment == NULL) {
        return -1;
    }
    
    LOS_MuxPend(g_data_mutex, LOS_WAIT_FOREVER);
    *assessment = g_latest_risk_assessment;
    LOS_MuxPost(g_data_mutex);
    
    return 0;
}

/**
 * @brief 获取系统统计信息
 * @param stats 统计信息结构指针
 * @return 0: 成功, 其他: 失败
 */
int GetSystemStats(SystemStats *stats)
{
    if (stats == NULL) {
        return -1;
    }
    
    LOS_MuxPend(g_data_mutex, LOS_WAIT_FOREVER);
    UpdateSystemStats();
    *stats = g_system_stats;
    LOS_MuxPost(g_data_mutex);
    
    return 0;
}

/**
 * @brief 获取系统状态
 * @return 系统状态
 */
SystemState GetSystemState(void)
{
    return g_system_state;
}

/**
 * @brief 设置系统状态
 * @param state 系统状态
 */
void SetSystemState(SystemState state)
{
    g_system_state = state;
    g_system_stats.current_state = state;
}

/**
 * @brief 切换LCD显示模式
 */
void SwitchLcdMode(void)
{
    g_lcd_mode = (LcdDisplayMode)((g_lcd_mode + 1) % LCD_MODE_COUNT);
    g_system_stats.lcd_mode = g_lcd_mode;

    // 重置静态布局标志，强制重新初始化界面
    extern bool g_static_layout_initialized;
    g_static_layout_initialized = false;

    printf("LCD mode switched to: %d\n", g_lcd_mode);
}

/**
 * @brief 获取LCD显示模式
 * @return LCD显示模式
 */
LcdDisplayMode GetLcdMode(void)
{
    return g_lcd_mode;
}

/**
 * @brief 设置报警静音
 * @param mute 是否静音
 */
void SetAlarmMute(bool mute)
{
    Alarm_Mute(mute);
}

/**
 * @brief 获取最后错误信息
 * @return 错误信息字符串
 */
const char* GetLastErrorMessage(void)
{
    return g_error_message;
}

/**
 * @brief 清除错误信息
 */
void ClearErrorMessage(void)
{
    memset(g_error_message, 0, sizeof(g_error_message));
}

// ========== 内部函数实现 ==========

/**
 * @brief 初始化硬件
 * @return 0: 成功, 其他: 失败
 */
static int InitializeHardware(void)
{
    int ret;

    printf("Initializing hardware components...\n");

    // 初始化传感器
    ret = Sensors_Init();
    if (ret != 0) {
        printf("Failed to initialize sensors: %d\n", ret);
        return -1;
    }

    // 初始化输出设备 (允许部分设备失败)
    ret = OutputDevices_Init();
    if (ret > 2) {  // 只有超过2个设备失败才认为是严重错误
        printf("Too many output devices failed to initialize: %d\n", ret);
        return -2;
    } else if (ret > 0) {
        printf("Some output devices failed to initialize: %d (continuing)\n", ret);
    }

    printf("Hardware initialization completed\n");
    return 0;
}

/**
 * @brief 创建任务
 * @return 0: 成功, 其他: 失败
 */
static int CreateTasks(void)
{
    TSK_INIT_PARAM_S task_param;
    UINT32 ret;

    // 创建传感器采集任务
    memset(&task_param, 0, sizeof(task_param));
    task_param.pfnTaskEntry = (TSK_ENTRY_FUNC)SensorCollectionTask;
    task_param.uwStackSize = THREAD_STACK_SIZE;
    task_param.pcName = "SensorTask";
    task_param.usTaskPrio = THREAD_PRIO_SENSOR;
    ret = LOS_TaskCreate(&g_sensor_thread_id, &task_param);
    if (ret != LOS_OK) {
        printf("Failed to create sensor task: %d\n", ret);
        return -1;
    }

    // 创建数据处理任务
    memset(&task_param, 0, sizeof(task_param));
    task_param.pfnTaskEntry = (TSK_ENTRY_FUNC)DataProcessingTask;
    task_param.uwStackSize = THREAD_STACK_SIZE;
    task_param.pcName = "DataProcTask";
    task_param.usTaskPrio = THREAD_PRIO_DATA_PROC;
    ret = LOS_TaskCreate(&g_data_proc_thread_id, &task_param);
    if (ret != LOS_OK) {
        printf("Failed to create data processing task: %d\n", ret);
        return -2;
    }

    // 创建风险评估任务
    memset(&task_param, 0, sizeof(task_param));
    task_param.pfnTaskEntry = (TSK_ENTRY_FUNC)RiskEvaluationTask;
    task_param.uwStackSize = THREAD_STACK_SIZE;
    task_param.pcName = "RiskEvalTask";
    task_param.usTaskPrio = THREAD_PRIO_RISK_EVAL;
    ret = LOS_TaskCreate(&g_risk_eval_thread_id, &task_param);
    if (ret != LOS_OK) {
        printf("Failed to create risk evaluation task: %d\n", ret);
        return -3;
    }

    // 创建显示任务
    memset(&task_param, 0, sizeof(task_param));
    task_param.pfnTaskEntry = (TSK_ENTRY_FUNC)DisplayTask;
    task_param.uwStackSize = THREAD_STACK_SIZE;
    task_param.pcName = "DisplayTask";
    task_param.usTaskPrio = THREAD_PRIO_DISPLAY;
    ret = LOS_TaskCreate(&g_display_thread_id, &task_param);
    if (ret != LOS_OK) {
        printf("Failed to create display task: %d\n", ret);
        return -4;
    }

    // 创建报警任务
    memset(&task_param, 0, sizeof(task_param));
    task_param.pfnTaskEntry = (TSK_ENTRY_FUNC)AlarmTask;
    task_param.uwStackSize = THREAD_STACK_SIZE;
    task_param.pcName = "AlarmTask";
    task_param.usTaskPrio = THREAD_PRIO_ALARM;
    ret = LOS_TaskCreate(&g_alarm_thread_id, &task_param);
    if (ret != LOS_OK) {
        printf("Failed to create alarm task: %d\n", ret);
        return -5;
    }

    printf("All tasks created successfully\n");
    return 0;
}

/**
 * @brief 传感器采集任务
 */
static void SensorCollectionTask(void)
{
    SensorData sensor_data;
    MPU6050_Data mpu_data;
    SHT30_Data sht_data;
    BH1750_Data bh_data;
    int ret;
    uint32_t sample_interval_ms = 1000 / SENSOR_SAMPLE_RATE_HZ;

    printf("Sensor collection task started\n");

    while (g_system_state == SYSTEM_STATE_RUNNING || g_system_state == SYSTEM_STATE_WARNING) {
        // 读取所有传感器数据
        ret = Sensors_ReadAll(&mpu_data, &sht_data, &bh_data);

        if (ret == 0) {
            // 组装传感器数据
            sensor_data.accel_x = mpu_data.accel_x;
            sensor_data.accel_y = mpu_data.accel_y;
            sensor_data.accel_z = mpu_data.accel_z;
            sensor_data.gyro_x = mpu_data.gyro_x;
            sensor_data.gyro_y = mpu_data.gyro_y;
            sensor_data.gyro_z = mpu_data.gyro_z;
            sensor_data.angle_x = mpu_data.angle_x;
            sensor_data.angle_y = mpu_data.angle_y;
            sensor_data.mpu_temperature = mpu_data.temperature;

            sensor_data.sht_temperature = sht_data.temperature;
            sensor_data.humidity = sht_data.humidity;

            sensor_data.light_intensity = bh_data.light_intensity;

            sensor_data.timestamp = LOS_TickCountGet();
            sensor_data.data_valid = true;
        } else {
            printf("Failed to read sensor data, errors: %d\n", ret);
            sensor_data.data_valid = false;
            g_system_stats.sensor_errors++;
        }

        // 更新全局数据
        LOS_MuxPend(g_data_mutex, LOS_WAIT_FOREVER);
        g_latest_sensor_data = sensor_data;
        AddSensorDataToBuffer(&sensor_data);
        g_system_stats.data_samples++;
        LOS_MuxPost(g_data_mutex);

        // 通知数据处理任务
        LOS_SemPost(g_sensor_sem);

        // 等待下次采样
        LOS_Msleep(sample_interval_ms);
    }

    printf("Sensor collection task stopped\n");
}

/**
 * @brief 数据处理任务
 */
static void DataProcessingTask(void)
{
    ProcessedData processed_data;

    printf("Data processing task started\n");

    while (g_system_state == SYSTEM_STATE_RUNNING || g_system_state == SYSTEM_STATE_WARNING) {
        // 等待传感器数据
        LOS_SemPend(g_sensor_sem, LOS_WAIT_FOREVER);

        if (g_system_state != SYSTEM_STATE_RUNNING) {
            break;
        }

        // 处理传感器数据
        ProcessSensorData(&processed_data);

        // 更新全局处理数据
        LOS_MuxPend(g_data_mutex, LOS_WAIT_FOREVER);
        g_latest_processed_data = processed_data;
        LOS_MuxPost(g_data_mutex);
    }

    printf("Data processing task stopped\n");
}

/**
 * @brief 风险评估任务
 */
static void RiskEvaluationTask(void)
{
    RiskAssessment assessment;
    ProcessedData processed_data;
    uint32_t last_eval_time = 0;

    printf("Risk evaluation task started\n");

    while (g_system_state == SYSTEM_STATE_RUNNING || g_system_state == SYSTEM_STATE_WARNING) {
        uint32_t current_time = LOS_TickCountGet();

        // 检查是否到了评估时间
        if (current_time - last_eval_time >= RISK_EVAL_INTERVAL_MS) {
            // 获取处理后的数据
            LOS_MuxPend(g_data_mutex, LOS_WAIT_FOREVER);
            processed_data = g_latest_processed_data;
            LOS_MuxPost(g_data_mutex);

            // 进行风险评估
            EvaluateRisk(&processed_data, &assessment);

            // 更新全局风险评估
            LOS_MuxPend(g_data_mutex, LOS_WAIT_FOREVER);
            g_latest_risk_assessment = assessment;

            // 更新系统状态
            if (assessment.level >= RISK_LEVEL_HIGH) {
                g_system_state = SYSTEM_STATE_WARNING;
                g_system_stats.risk_alerts++;
            } else if (g_system_state == SYSTEM_STATE_WARNING &&
                      assessment.level < RISK_LEVEL_MEDIUM) {
                g_system_state = SYSTEM_STATE_RUNNING;
            }

            LOS_MuxPost(g_data_mutex);

            last_eval_time = current_time;
        }

        LOS_Msleep(100);  // 100ms检查间隔
    }

    printf("Risk evaluation task stopped\n");
}

/**
 * @brief 显示任务
 */
static void DisplayTask(void)
{
    SensorData sensor_data;
    SensorData last_sensor_data = {0};  // 保存上次的数据
    RiskAssessment assessment;
    RiskAssessment last_assessment = {0};  // 保存上次的评估
    uint32_t last_update_time = 0;
    uint32_t last_force_update = 0;
    bool first_display = true;

    printf("Display task started\n");

    // 等待LCD初始化完成
    printf("Waiting for LCD initialization...\n");
    while (!LCD_IsInitialized()) {
        LOS_Msleep(100);  // 等待100ms
    }
    printf("LCD initialization detected, starting display\n");

    // 简单清屏，准备显示
    LCD_Clear(LCD_WHITE);
    printf("LCD cleared and ready for display\n");

    // 强制重置静态布局标志，确保使用新的全屏布局
    extern bool g_static_layout_initialized;
    g_static_layout_initialized = false;

    while (g_system_state == SYSTEM_STATE_RUNNING || g_system_state == SYSTEM_STATE_WARNING) {
        uint32_t current_time = LOS_TickCountGet();

        // 检查按键状态
        Button_GetState();

        // 获取最新数据
        GetLatestSensorData(&sensor_data);
        GetLatestRiskAssessment(&assessment);

        // 检查是否需要更新LCD
        bool need_update = false;

        // 强制更新条件：首次显示或超过强制更新间隔
        if (first_display || (current_time - last_force_update >= LCD_UPDATE_INTERVAL_MS)) {
            need_update = true;
            last_force_update = current_time;
            // 注意：不要在这里设置first_display = false，要在实际显示后设置
        }

        // 数据变化更新条件：关键数据有显著变化
        if (!need_update && sensor_data.data_valid) {
            float angle_change = fabsf(sensor_data.angle_x - last_sensor_data.angle_x) +
                                fabsf(sensor_data.angle_y - last_sensor_data.angle_y);
            float temp_change = fabsf(sensor_data.sht_temperature - last_sensor_data.sht_temperature);

            if (angle_change > LCD_DATA_CHANGE_THRESHOLD ||  // 倾斜角度变化超过0.5度
                temp_change > 2.0f ||                        // 温度变化超过2度
                assessment.level != last_assessment.level) { // 风险等级变化
                need_update = true;
            }
        }

        // 执行LCD更新
        if (LCD_IsInitialized()) {
            // 首次初始化静态布局
            if (first_display) {
                LCD_InitStaticLayout();
                if (sensor_data.data_valid) {
                    LCD_UpdateStatusOnly(&sensor_data);
                    LCD_UpdateDataOnly(&sensor_data);
                }
                first_display = false;
                last_update_time = current_time;
                printf("LCD: Initial display completed\n");
            }
            // 局部更新
            else if (need_update && (current_time - last_update_time >= 500)) {  // 最小0.5秒更新间隔
                switch (g_lcd_mode) {
                    case LCD_MODE_REALTIME:
                        if (sensor_data.data_valid) {
                            // 只更新变化的数据，不重绘整个屏幕
                            LCD_UpdateDataOnly(&sensor_data);

                            // 如果风险等级可能变化，更新状态
                            float angle_change = fabsf(sensor_data.angle_x - last_sensor_data.angle_x) +
                                                fabsf(sensor_data.angle_y - last_sensor_data.angle_y);
                            if (angle_change > 1.0f) {  // 角度变化较大时更新状态
                                LCD_UpdateStatusOnly(&sensor_data);
                            }

                            printf("LCD: Data updated - Angle X=%.1f Y=%.1f, Temp=%.1f\n",
                                   sensor_data.angle_x, sensor_data.angle_y, sensor_data.sht_temperature);
                        }
                        break;

                    case LCD_MODE_RISK_STATUS:
                        // 风险状态模式：重绘整个界面
                        LCD_DisplayRiskStatus(&assessment);
                        printf("LCD: Risk status updated - Level %d\n", assessment.level);
                        break;

                    case LCD_MODE_TREND_CHART:
                        LCD_DisplayTrendChart(&assessment);
                        break;

                    case LCD_MODE_COUNT:
                    default:
                        {
                            // 显示系统信息作为默认
                            SystemStats stats;
                            GetSystemStats(&stats);
                            LCD_DisplaySystemInfo(&stats);
                        }
                        break;
                }

                // 保存当前数据作为下次比较的基准
                last_sensor_data = sensor_data;
                last_assessment = assessment;
                last_update_time = current_time;
            }
        }

        // LCD未初始化时使用串口输出 (独立的逻辑块)
        if (!LCD_IsInitialized() && sensor_data.data_valid && need_update) {
            printf("=== SENSOR DATA ===\n");
            printf("Angle: X=%.1f Y=%.1f deg\n",
                   sensor_data.angle_x, sensor_data.angle_y);
            printf("Temp: %.1f C, Humidity: %.1f%%\n",
                   sensor_data.sht_temperature, sensor_data.humidity);
            printf("Risk Level: %d\n", assessment.level);
        }

        LOS_Msleep(200);  // 200ms检查间隔
    }

    printf("Display task stopped\n");
}

/**
 * @brief 报警任务
 */
static void AlarmTask(void)
{
    RiskAssessment assessment;
    uint32_t last_alarm_time = 0;
    uint32_t last_voice_time = 0;

    printf("Alarm task started\n");

    while (g_system_state == SYSTEM_STATE_RUNNING || g_system_state == SYSTEM_STATE_WARNING) {
        uint32_t current_time = LOS_TickCountGet();

        // 获取最新风险评估
        GetLatestRiskAssessment(&assessment);

        // 设置RGB指示灯
        RGB_SetColorByRisk(assessment.level);

        // 检查是否需要声音/振动报警
        if (assessment.level >= RISK_LEVEL_MEDIUM &&
            current_time - last_alarm_time >= 5000) {  // 5秒间隔

            Buzzer_BeepByRisk(assessment.level);
            Motor_VibrateByRisk(assessment.level);

            last_alarm_time = current_time;
        }

        // 检查是否需要语音播报
        if (current_time - last_voice_time >= VOICE_REPORT_INTERVAL_S * 1000) {
            if (assessment.level >= RISK_LEVEL_LOW) {
                Voice_PlayMessage(VOICE_MSG_LOW_RISK + (assessment.level - RISK_LEVEL_LOW));
            } else {
                Voice_PlayMessage(VOICE_MSG_SAFE);
            }

            last_voice_time = current_time;
        }

        LOS_Msleep(500);  // 500ms检查间隔
    }

    printf("Alarm task stopped\n");
}

/**
 * @brief 更新系统统计信息
 */
static void UpdateSystemStats(void)
{
    static uint32_t start_time = 0;

    if (start_time == 0) {
        start_time = LOS_TickCountGet();
    }

    g_system_stats.uptime_seconds = (LOS_TickCountGet() - start_time) / 1000;
}

/**
 * @brief 添加传感器数据到缓冲区
 * @param data 传感器数据
 */
static void AddSensorDataToBuffer(const SensorData *data)
{
    if (data == NULL) {
        return;
    }

    g_sensor_buffer[g_buffer_index] = *data;
    g_buffer_index = (g_buffer_index + 1) % DATA_BUFFER_SIZE;

    if (g_buffer_index == 0) {
        g_buffer_full = true;
    }
}

/**
 * @brief 处理传感器数据
 * @param processed 处理后的数据
 */
static void ProcessSensorData(ProcessedData *processed)
{
    if (processed == NULL) {
        return;
    }

    // 获取最新传感器数据
    SensorData current_data = g_latest_sensor_data;

    if (!current_data.data_valid) {
        memset(processed, 0, sizeof(ProcessedData));
        return;
    }

    // 计算加速度幅值
    processed->accel_magnitude = sqrtf(current_data.accel_x * current_data.accel_x +
                                      current_data.accel_y * current_data.accel_y +
                                      current_data.accel_z * current_data.accel_z);

    // 计算倾角幅值
    processed->angle_magnitude = sqrtf(current_data.angle_x * current_data.angle_x +
                                      current_data.angle_y * current_data.angle_y);

    // 计算振动强度 (基于陀螺仪数据)
    processed->vibration_intensity = sqrtf(current_data.gyro_x * current_data.gyro_x +
                                          current_data.gyro_y * current_data.gyro_y +
                                          current_data.gyro_z * current_data.gyro_z);

    // 简单的变化率计算（需要历史数据进行更精确计算）
    static float last_accel_mag = 0.0f;
    static float last_angle_mag = 0.0f;
    static float last_humidity = 0.0f;
    static float last_light = 0.0f;

    processed->accel_change_rate = fabsf(processed->accel_magnitude - last_accel_mag);
    processed->angle_change_rate = fabsf(processed->angle_magnitude - last_angle_mag);
    processed->humidity_trend = current_data.humidity - last_humidity;
    processed->light_change_rate = fabsf(current_data.light_intensity - last_light);

    // 更新历史值
    last_accel_mag = processed->accel_magnitude;
    last_angle_mag = processed->angle_magnitude;
    last_humidity = current_data.humidity;
    last_light = current_data.light_intensity;

    processed->timestamp = current_data.timestamp;
}

/**
 * @brief 评估风险
 * @param processed 处理后的数据
 * @param assessment 风险评估结果
 */
static void EvaluateRisk(const ProcessedData *processed, RiskAssessment *assessment)
{
    if (processed == NULL || assessment == NULL) {
        return;
    }

    float total_risk_score = 0.0f;

    // 1. 倾斜风险评估 (权重: 40%)
    assessment->tilt_risk = 0.0f;
    if (processed->angle_magnitude > 20.0f) {
        assessment->tilt_risk = 1.0f;
    } else if (processed->angle_magnitude > 15.0f) {
        assessment->tilt_risk = 0.8f;
    } else if (processed->angle_magnitude > 10.0f) {
        assessment->tilt_risk = 0.6f;
    } else if (processed->angle_magnitude > 5.0f) {
        assessment->tilt_risk = 0.3f;
    }
    total_risk_score += assessment->tilt_risk * 0.4f;

    // 2. 振动风险评估 (权重: 30%)
    assessment->vibration_risk = 0.0f;
    if (processed->vibration_intensity > 100.0f) {
        assessment->vibration_risk = 1.0f;
    } else if (processed->vibration_intensity > 50.0f) {
        assessment->vibration_risk = 0.7f;
    } else if (processed->vibration_intensity > 20.0f) {
        assessment->vibration_risk = 0.4f;
    } else if (processed->vibration_intensity > 10.0f) {
        assessment->vibration_risk = 0.2f;
    }
    total_risk_score += assessment->vibration_risk * 0.3f;

    // 3. 湿度风险评估 (权重: 20%)
    SensorData sensor_data = g_latest_sensor_data;
    assessment->humidity_risk = 0.0f;
    if (sensor_data.humidity > 90.0f) {
        assessment->humidity_risk = 0.8f;
    } else if (sensor_data.humidity > 80.0f) {
        assessment->humidity_risk = 0.6f;
    } else if (sensor_data.humidity > 70.0f) {
        assessment->humidity_risk = 0.3f;
    }
    // 湿度快速上升也是风险
    if (processed->humidity_trend > 10.0f) {
        assessment->humidity_risk += 0.3f;
    }
    if (assessment->humidity_risk > 1.0f) assessment->humidity_risk = 1.0f;
    total_risk_score += assessment->humidity_risk * 0.2f;

    // 4. 光照风险评估 (权重: 10%)
    assessment->light_risk = 0.0f;
    if (processed->light_change_rate > 1000.0f) {
        assessment->light_risk = 0.5f;  // 光照剧烈变化可能表示遮挡
    }
    total_risk_score += assessment->light_risk * 0.1f;

    // 确定风险等级
    if (total_risk_score >= 0.8f) {
        assessment->level = RISK_LEVEL_CRITICAL;
        strcpy(assessment->description, "Critical landslide risk");
    } else if (total_risk_score >= 0.6f) {
        assessment->level = RISK_LEVEL_HIGH;
        strcpy(assessment->description, "High landslide risk");
    } else if (total_risk_score >= 0.4f) {
        assessment->level = RISK_LEVEL_MEDIUM;
        strcpy(assessment->description, "Medium landslide risk");
    } else if (total_risk_score >= 0.2f) {
        assessment->level = RISK_LEVEL_LOW;
        strcpy(assessment->description, "Low landslide risk");
    } else {
        assessment->level = RISK_LEVEL_SAFE;
        strcpy(assessment->description, "Safe conditions");
    }

    assessment->confidence = (total_risk_score > 1.0f) ? 1.0f : total_risk_score;
    assessment->timestamp = LOS_TickCountGet();

    // 更新持续时间
    static RiskLevel last_level = RISK_LEVEL_SAFE;
    static uint32_t level_start_time = 0;

    if (assessment->level != last_level) {
        level_start_time = assessment->timestamp;
        last_level = assessment->level;
    }

    assessment->duration_ms = assessment->timestamp - level_start_time;
}

/**
 * @brief 按键事件处理函数
 * @param state 按键状态
 */
static void ButtonEventHandler(ButtonState state)
{
    static bool muted = false;  // 移到函数开头

    switch (state) {
        case BUTTON_STATE_SHORT_PRESS:
            // 短按：切换LCD显示模式
            SwitchLcdMode();
            printf("Button short press: LCD mode switched\n");
            break;

        case BUTTON_STATE_LONG_PRESS:
            // 长按：切换报警静音
            muted = !muted;
            SetAlarmMute(muted);
            printf("Button long press: Alarm %s\n", muted ? "muted" : "unmuted");
            break;

        default:
            break;
    }
}

// ========== 主程序入口 ==========

/**
 * @brief 山体滑坡监测系统主函数
 */
void LandslideMonitorExample(void)
{
    int ret;

    printf("=== Landslide Monitoring System Starting ===\n");
    printf("Version: 2.0.0 (Real Sensors)\n");
    printf("Hardware: rk2206 with MPU6050, SHT30, BH1750\n");

    // 初始化系统
    ret = LandslideMonitorInit();
    if (ret != 0) {
        printf("Failed to initialize landslide monitor: %d\n", ret);
        printf("Error: %s\n", GetLastErrorMessage());
        return;
    }

    // 启动系统
    ret = LandslideMonitorStart();
    if (ret != 0) {
        printf("Failed to start landslide monitor: %d\n", ret);
        printf("Error: %s\n", GetLastErrorMessage());
        LandslideMonitorShutdown();
        return;
    }

    printf("=== Landslide Monitoring System Started Successfully ===\n");
    printf("System is now monitoring for landslide risks...\n");
    printf("Press button: Short=Switch display, Long=Mute alarm\n");

    // 主循环 - 系统将在后台线程中运行
    while (GetSystemState() != SYSTEM_STATE_SHUTDOWN) {
        SystemStats stats;
        GetSystemStats(&stats);

        // 每60秒打印一次系统状态
        static uint32_t last_status_time = 0;
        uint32_t current_time = LOS_TickCountGet();
        if (current_time - last_status_time > 60000) {
            printf("\n=== SYSTEM STATUS ===\n");
            printf("Uptime: %u seconds\n", stats.uptime_seconds);
            printf("Data samples: %u\n", stats.data_samples);
            printf("Sensor errors: %u\n", stats.sensor_errors);
            printf("Risk alerts: %u\n", stats.risk_alerts);
            printf("LCD mode: %d\n", stats.lcd_mode);
            printf("System state: %d\n", stats.current_state);
            printf("====================\n\n");
            last_status_time = current_time;
        }

        LOS_Msleep(1000);  // 1秒检查间隔
    }

    printf("=== Landslide Monitoring System Shutting Down ===\n");
    LandslideMonitorShutdown();
}

/**
 * @brief OpenHarmony应用入口函数
 */
void LandslideMonitorAppEntry(void)
{
    UINT32 thread_id;
    TSK_INIT_PARAM_S task = {0};
    UINT32 ret = LOS_OK;

    task.pfnTaskEntry = (TSK_ENTRY_FUNC)LandslideMonitorExample;
    task.uwStackSize = 8192;  // 8KB栈空间
    task.pcName = "LandslideMonitor";
    task.usTaskPrio = 10;  // 中等优先级

    ret = LOS_TaskCreate(&thread_id, &task);
    if (ret != LOS_OK) {
        printf("Failed to create landslide monitor task: 0x%x\n", ret);
        return;
    }

    printf("Landslide monitor task created successfully\n");
}

// 注册为OpenHarmony应用
APP_FEATURE_INIT(LandslideMonitorAppEntry);
