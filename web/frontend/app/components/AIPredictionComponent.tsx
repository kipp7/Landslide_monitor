import { useState } from 'react';

interface PredictionData {
  analysis: string;
  result: string;
  probability: string;
  timestamp: string;
  recommendation: string;
}

const AIPredictionComponent = () => {
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
 
  // 获取当前时间 
  const getCurrentTime = () => {
    const now = new Date();
    const year = now.getFullYear(); 
    const month = String(now.getMonth()  + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2,  '0');
    const hours = String(now.getHours()).padStart(2,  '0');
    const minutes = String(now.getMinutes()).padStart(2,  '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };
 
  // 模拟预测分析 
  const fetchPrediction = async () => {
    setLoading(true);
    // 模拟 API 请求 
    setTimeout(() => {
      const mockPrediction = {
        analysis: `
          根据最新传感器数据分析：
          1. 降雨量在过去 24 小时内达到 120mm，远超警戒值。
          2. 土壤湿度持续上升，已达到饱和状态。
          3. 加速度传感器检测到轻微的地表位移，位移速率为 0.5mm/h。
          4. 陀螺仪数据显示地表倾斜角度增加了 2°。
          综合分析，当前区域存在较高的滑坡风险。
        `,
        result: '滑坡风险较高',
        probability: '78%',
        timestamp: getCurrentTime(), // 使用当前时间 
        recommendation: `
          建议采取以下措施：
          1. 立即疏散高风险区域居民。
          2. 加强监测频率，实时关注数据变化。
          3. 启动应急预案，准备抢险物资。
          4. 通知相关部门进行现场勘查。
        `,
      };
      setPrediction(mockPrediction);
      setLoading(false);
    }, 2000);
  };
 
  // 取消展示预测结果 
  const clearPrediction = () => {
    setPrediction(null);
  };
 
  return (
    <div className="h-full flex flex-col items-center justify-center p-4 bg-[#112c42] rounded-lg max-w-[600px] mx-auto relative overflow-hidden">
      {/* 蓝色小圈装饰 */}
      <div className="absolute top-[-50px] left-[-50px] w-32 h-32 bg-cyan-500 rounded-full opacity-20"></div>
      <div className="absolute bottom-[-50px] right-[-50px] w-32 h-32 bg-cyan-500 rounded-full opacity-20"></div>
      <div className="absolute top-[20%] left-[30%] w-16 h-16 bg-cyan-500 rounded-full opacity-20"></div>
      <div className="absolute bottom-[20%] right-[30%] w-16 h-16 bg-cyan-500 rounded-full opacity-20"></div>
 
      {loading ? (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-300"></div>
          <span className="ml-2 text-cyan-300">数据分析预测中...</span>
        </div>
      ) : prediction ? (
        <div className="text-white text-center w-full">
          {/* 卡片内容区域，隐藏滚动条 */}
          <div className="max-h-[250px] overflow-y-auto px-0 scrollbar-hide mx-2 w-[100%]">
            <p className="text-sm text-left whitespace-pre-line">{prediction.analysis}</p> 
            <p className="text-sm">
              滑坡风险: <span className="font-bold">{prediction.result}</span> 
            </p>
            <p className="text-sm mt-1">
              风险概率: <span className="font-bold">{prediction.probability}</span> 
            </p>
            <p className="text-sm text-left whitespace-pre-line">{prediction.recommendation}</p> 
          </div>
          {/* 更新时间放到右下角 */}
          <p className="text-xs text-gray-400 absolute bottom-0 right-0 mr-2.5 mb-3.5">
            更新时间: {prediction.timestamp} 
          </p>
          {/* 返回按钮放到左下角 */}
          <button 
            className="px-1 py-0.5 bg-blue-500 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm absolute bottom-0 left-0 ml-1 mb-2 shadow-lg hover:shadow-blue-500/50"
            onClick={clearPrediction}
          >
            返回 
          </button>
        </div>
      ) : (
        <button 
          className="px-4 py-2 bg-cyan-400 text-white rounded-lg hover:bg-cyan-600 transition-colors shadow-lg hover:shadow-cyan-400/50 font-medium"
          onClick={fetchPrediction}
        >
          开始数据分析预测 
        </button>
      )}
    </div>
  );
};
 
export default AIPredictionComponent;