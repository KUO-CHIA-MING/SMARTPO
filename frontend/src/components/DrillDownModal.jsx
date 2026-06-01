import React, { useState, useMemo } from 'react';
import { X, Search, FileSpreadsheet, AlertCircle } from 'lucide-react';

/**
 * 三、 向下鑽研 (Drill-down) 明細規格組件
 * 點擊圖表彈出 Modal 視窗呈現
 * 支援前端即時搜尋、分頁、與模擬匯出 Excel
 * 欄位嚴格遵循 SDD 規範，不顯示主要供應商
 */
export const DrillDownModal = ({ isOpen, onClose, title, type, range, data, isLoading }) => {
  if (!isOpen) return null;

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // 1. 搜尋過濾邏輯
  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter(item => {
      const searchLower = searchTerm.toLowerCase();
      if (type === 'po-delivery') {
        // 採購單搜尋：料號、品名、採購員、供應商名稱
        return (
          item.ItemCode?.toLowerCase().includes(searchLower) ||
          item.Dscription?.toLowerCase().includes(searchLower) ||
          item.BuyerName?.toLowerCase().includes(searchLower) ||
          item.CardName?.toLowerCase().includes(searchLower)
        );
      } else {
        // 庫存水位搜尋：料號、品名
        return (
          item.ItemCode?.toLowerCase().includes(searchLower) ||
          item.ItemName?.toLowerCase().includes(searchLower)
        );
      }
    });
  }, [data, searchTerm, type]);

  // 2. 分頁計算
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  // 3. 模擬匯出 Excel 提示
  const [showExportToast, setShowExportToast] = useState(false);
  const handleExportExcel = () => {
    setShowExportToast(true);
    setTimeout(() => {
      setShowExportToast(false);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
      {/* Toast 提示 (模擬匯出) */}
      {showExportToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500 animate-bounce">
          <FileSpreadsheet className="w-5 h-5" />
          <div className="text-sm">
            <p className="font-bold">匯出 Excel 成功！</p>
            <p className="text-xs text-emerald-100">已將 {filteredData.length} 筆明細匯出為 XLS 格式。</p>
          </div>
        </div>
      )}

      {/* Modal 主體 */}
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-500 bg-indigo-55 bg-indigo-50 px-2.5 py-1 rounded-full">
              {type === 'po-delivery' ? '採購單明細鑽研' : '庫存水位明細鑽研'}
            </span>
            <h2 className="text-xl font-bold text-slate-800 mt-1">{title}</h2>
          </div>
          <button
            onClick={() => {
              setSearchTerm('');
              setCurrentPage(1);
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 搜尋列與操作區 */}
        <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder={type === 'po-delivery' ? "搜尋料號、品名、採購員..." : "搜尋料號、品名..."}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400 text-slate-700"
            />
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={handleExportExcel}
              disabled={filteredData.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-150 border-emerald-200 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              <FileSpreadsheet className="w-4 h-4" />
              匯出 Excel
            </button>
          </div>
        </div>

        {/* 數據表格區 */}
        <div className="flex-grow p-6 overflow-y-auto min-h-[300px]">
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-8 bg-slate-100 rounded"></div>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-slate-50 rounded"></div>
              ))}
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <AlertCircle className="w-12 h-12 text-slate-300 mb-2 animate-bounce" />
              <p className="text-sm font-medium">沒有找到符合條件的明細數據</p>
            </div>
          ) : type === 'po-delivery' ? (
            /* 採購單明細表格 */
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                    <th className="px-5 py-4">採購單號</th>
                    <th className="px-5 py-4">過帳日期</th>
                    <th className="px-5 py-4">料號</th>
                    <th className="px-5 py-4">品名描述</th>
                    <th className="px-5 py-4 text-right">採購數量</th>
                    <th className="px-5 py-4 text-right">未交數量</th>
                    <th className="px-5 py-4">供應商</th>
                    <th className="px-5 py-4">採購員</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedData.map((po, index) => (
                    <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{po.DocNum}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">{po.DocDate}</td>
                      <td className="px-5 py-3.5 font-mono text-indigo-600 font-medium">{po.ItemCode}</td>
                      <td className="px-5 py-3.5 font-medium max-w-xs truncate">{po.Dscription}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-800">{po.Quantity}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-bold ${po.OpenQty > 0 ? 'text-red-500 bg-red-50 px-2 py-0.5 rounded-md border border-red-100' : 'text-slate-400'}`}>
                          {po.OpenQty}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 max-w-xs truncate text-slate-500">{po.CardName}</td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">{po.BuyerName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* 庫存水位明細表格（嚴格遵循 SDD，無主要供應商） */
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                    <th className="px-5 py-4">料號</th>
                    <th className="px-5 py-4">品名</th>
                    <th className="px-5 py-4 text-right">現有庫存量</th>
                    <th className="px-5 py-4 text-right">已訂貨量</th>
                    <th className="px-5 py-4 text-right">需求庫存量</th>
                    <th className="px-5 py-4 text-right">最小安全庫存</th>
                    <th className="px-5 py-4 text-right">最大庫存量</th>
                    <th className="px-5 py-4 text-right">庫齡 (天)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedData.map((item, index) => {
                    const totalQty = item.OnHand + item.OnOrder;
                    const isSafetyAlert = totalQty < item.MinStock;
                    const isTargetAlert = totalQty < item.MinOrder && totalQty >= item.MinStock;
                    const isOverMaxAlert = item.OnHand > item.MaxStock;

                    let rowStyle = '';
                    if (isSafetyAlert) rowStyle = 'bg-red-50/20';
                    else if (isTargetAlert) rowStyle = 'bg-orange-50/10';

                    return (
                      <tr key={index} className={`hover:bg-slate-50/50 transition-colors ${rowStyle}`}>
                        <td className="px-5 py-3.5 font-mono text-indigo-600 font-bold whitespace-nowrap">{item.ItemCode}</td>
                        <td className="px-5 py-3.5 font-medium max-w-sm truncate">{item.ItemName}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900">{item.OnHand}</td>
                        <td className="px-5 py-3.5 text-right font-medium text-slate-500">{item.OnOrder}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-orange-600">{item.MinOrder}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-red-600">{item.MinStock}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-yellow-600">{item.MaxStock}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                          {item.OnHand > 0 ? (
                            <span className={item.AgeDays > 360 ? 'text-purple-600 font-extrabold' : 'text-slate-700'}>
                              {item.AgeDays}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer 與分頁 */}
        {filteredData.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
            <span className="text-slate-500 font-medium">
              顯示第 {(currentPage - 1) * itemsPerPage + 1} 至 {Math.min(currentPage * itemsPerPage, filteredData.length)} 筆，共 {filteredData.length} 筆資料
            </span>
            
            {totalPages > 1 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                  上一頁
                </button>
                <span className="px-3 py-1.5 font-bold text-slate-700 bg-slate-200/50 rounded-lg">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                  下一頁
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
