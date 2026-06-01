import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, ShieldAlert, TrendingUp } from 'lucide-react';

/**
 * 2.1 庫存量監控組件
 * 呈現三個圓環圖，圖中間呈現異常筆數及佔比
 * 支援向下鑽研 (Drill-down)
 */
export const InventoryLevelCards = ({ data, onDrillDown }) => {
  const { totalActiveItems, underTarget, underSafety, overMax } = data;

  const cardConfigs = [
    {
      id: 'under-target',
      title: '需求庫存不足',
      subtitle: '低於目標水位 (OnHand + OnOrder < MinOrder)',
      count: underTarget.count,
      percentage: underTarget.percentage,
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      color: '#f97316', // 橘黃色 🟠
      bgColor: '#fff7ed',
      borderColor: 'border-orange-100',
    },
    {
      id: 'under-safety',
      title: '安全庫存不足',
      subtitle: '低於安全水位 (OnHand + OnOrder < MinStock)',
      count: underSafety.count,
      percentage: underSafety.percentage,
      icon: <ShieldAlert className="w-5 h-5 text-red-500" />,
      color: '#ef4444', // 紅色 🔴
      bgColor: '#fef2f2',
      borderColor: 'border-red-100',
    },
    {
      id: 'over-max',
      title: '最大庫存超標',
      subtitle: '庫存積壓警示 (OnHand > MaxStock)',
      count: overMax.count,
      percentage: overMax.percentage,
      icon: <TrendingUp className="w-5 h-5 text-yellow-600" />,
      color: '#eab308', // 黃色 🟡
      bgColor: '#fefcbf',
      borderColor: 'border-yellow-100',
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cardConfigs.map((card) => {
        // Pie 圖表資料：異常佔比 vs 健康佔比
        const chartData = [
          { name: '異常', value: card.count },
          { name: '健康', value: totalActiveItems - card.count }
        ];

        return (
          <div
            key={card.id}
            onClick={() => onDrillDown(card.id, card.title)}
            className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            {/* 卡片標題 */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  {card.icon}
                  {card.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1">{card.subtitle}</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
                成品
              </span>
            </div>

            {/* 圓環圖區域 */}
            <div className="relative h-36 flex items-center justify-center mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={62}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                  >
                    {/* 異常扇區顏色與健康灰色背景 */}
                    <Cell fill={card.color} />
                    <Cell fill="#e2e8f0" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* 圖形中心呈現：筆數與佔比 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-800">
                  {card.count} <span className="text-xs text-slate-400 font-normal">筆</span>
                </span>
                <span className="text-xs font-semibold mt-0.5" style={{ color: card.color }}>
                  {card.percentage}%
                </span>
              </div>
            </div>

            {/* 底部總數提示 */}
            <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center text-xs text-slate-400">
              <span>監控成品總數: {totalActiveItems} 筆</span>
              <span className="text-indigo-500 font-medium hover:underline">查看明細 →</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
