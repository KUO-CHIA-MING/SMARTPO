import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { History } from 'lucide-react';

/**
 * 2.3 庫存週轉與庫齡監控組件
 * 呈現橫向長條圖 (Horizontal BarChart)
 * 監控範圍：OnHand > 0 的成品與半成品 (ItmsGrpCod = 101, 103)
 */
export const TurnoverAgeChart = ({ data, onDrillDown }) => {
  const { totalItems, ranges } = data;

  // 自訂 Tooltip 視覺效果，呈現高級 premium 質感
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const info = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-xl text-xs space-y-1">
          <p className="font-bold">{info.name}</p>
          <p className="text-slate-300">庫存筆數：<span className="font-semibold text-white">{info.count} 筆</span></p>
          <p className="text-slate-300">佔比：<span className="font-semibold text-emerald-400">{info.percentage}%</span></p>
        </div>
      );
    }
    return null;
  };

  // 點擊柱狀圖觸發 Drill-down
  const handleBarClick = (barData) => {
    if (barData && barData.days) {
      onDrillDown('age-range', `庫齡明細 - ${barData.name}`, barData.days);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
      {/* 標題區 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" />
            庫存週轉與庫齡分析
          </h3>
          <p className="text-xs text-slate-400 mt-1">只統計現有庫存大於零的成品與半成品</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
          成品 & 半成品
        </span>
      </div>

      {/* 橫向柱狀圖區域 */}
      <div className="h-64 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={ranges}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
          >
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              unit="%"
            />
            <YAxis
              dataKey="name"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
              width={130}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
            <Bar
              dataKey="percentage"
              radius={[0, 8, 8, 0]}
              barSize={18}
              onClick={handleBarClick}
              className="cursor-pointer"
            >
              {/* 各區間使用專屬莫蘭迪色系 */}
              {ranges.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 底部說明 */}
      <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center text-xs text-slate-400">
        <span>監控庫存物料總數: {totalItems} 筆</span>
        <span>💡 點擊長條圖可向下鑽研看該區間呆滯明細</span>
      </div>
    </div>
  );
};
