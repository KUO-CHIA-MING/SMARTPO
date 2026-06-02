import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Search, UploadCloud, ChevronDown, ChevronRight, Layers, X } from 'lucide-react';

const BACKEND_URL = 'http://localhost:3001/api/shared-inventory';

// 子元件：單一廠區層級的主列表與展開內容
const SharedInventoryRow = ({ plant, queriedItem, queriedItemName }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            <tr className={`border-b border-slate-100 transition-colors group ${isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                <td className="px-4 py-4 w-12 text-center">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-indigo-200 text-indigo-700' : 'hover:bg-indigo-100 hover:text-indigo-600 text-slate-400'}`}
                    >
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                </td>
                <td className="px-4 py-4 font-medium text-slate-800">{queriedItem}</td>
                <td className="px-4 py-4 text-slate-600 truncate max-w-[200px]" title={queriedItemName}>{queriedItemName}</td>
                <td className="px-4 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        {plant.plantPrefix} 廠區
                    </span>
                </td>
                <td className="px-4 py-4 font-medium text-slate-600">{plant.targetOnHand.toLocaleString()}</td>
                <td className="px-4 py-4">
                    <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-800 shadow-sm border border-emerald-200">
                        {plant.smartQty.toLocaleString()}
                    </span>
                </td>
            </tr>
            {isExpanded && (
                <tr>
                    <td colSpan="6" className="p-0 border-b-2 border-slate-800">
                        <div className="bg-slate-800 px-12 py-6 shadow-inner relative border-l-4 border-indigo-500">
                            {/* 左側連接裝飾線 */}
                            <div className="absolute left-6 top-0 bottom-6 w-px bg-slate-700"></div>
                            <div className="absolute left-6 top-8 w-4 h-px bg-slate-700"></div>

                            <h4 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                                <Layers size={16} className="text-indigo-400" />
                                廠區 ({plant.plantPrefix}) 共享庫存池明細
                            </h4>
                            <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-800 text-slate-400">
                                        <tr>
                                            <th className="px-5 py-3 font-semibold border-b border-slate-700">共用料號</th>
                                            <th className="px-5 py-3 font-semibold border-b border-slate-700">品名</th>
                                            <th className="px-5 py-3 font-semibold border-b border-slate-700">倉庫</th>
                                            <th className="px-5 py-3 font-semibold border-b border-slate-700 text-right">實體庫存 (OnHand)</th>
                                            <th className="px-5 py-3 font-semibold border-b border-slate-700 text-right">已承約量 (Committed)</th>
                                            <th className="px-5 py-3 font-semibold border-b border-slate-700 text-right">已訂購量 (OnOrder)</th>
                                            <th className="px-5 py-3 font-semibold border-b border-slate-700 text-right">可用量 (Available)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {plant.sharedDetails.map((detail, idx) => {
                                            const isTarget = detail.itemCode === queriedItem;
                                            return (
                                                <tr key={idx} className={isTarget ? 'bg-indigo-900/40' : 'hover:bg-slate-800/50'}>
                                                    <td className="px-5 py-3 font-medium text-slate-200 flex items-center gap-2">
                                                        {isTarget && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block shadow-[0_0_4px_rgba(129,140,248,0.6)]"></span>}
                                                        {detail.itemCode}
                                                    </td>
                                                    <td className="px-5 py-3 text-slate-400 truncate max-w-[200px]" title={detail.itemName}>{detail.itemName}</td>
                                                    <td className="px-5 py-3 font-medium text-slate-400">
                                                        <span className="bg-slate-800 px-2 py-0.5 rounded text-xs border border-slate-700 text-slate-300">{detail.whsCode}</span>
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-medium text-slate-300">{detail.onHand.toLocaleString()}</td>
                                                    <td className="px-5 py-3 text-right font-medium text-rose-400">{detail.isCommited.toLocaleString()}</td>
                                                    <td className="px-5 py-3 text-right font-medium text-blue-400">{detail.onOrder.toLocaleString()}</td>
                                                    <td className="px-5 py-3 text-right font-bold text-emerald-400">{detail.available.toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

export const SharedInventorySearch = () => {
    const [searchMode, setSearchMode] = useState('item'); // 'item', 'order', 'excel'
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [importSummary, setImportSummary] = useState(null);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const handleSearch = async () => {
        if (!inputValue.trim()) return;
        setIsLoading(true);
        setErrorMsg('');
        setResults([]);
        setImportSummary(null);

        try {
            const params = searchMode === 'item' ? { itemCode: inputValue.trim() } : { orderNum: inputValue.trim() };
            const res = await axios.get(`${BACKEND_URL}/search`, { params });
            if (res.data.success) {
                setResults(res.data.data);
            } else {
                setErrorMsg(res.data.message);
            }
        } catch (err) {
            setErrorMsg('查詢失敗，請檢查伺服器狀態與連線。');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            processFile(file);
        }
    };

    const processFile = async (file) => {
        setIsLoading(true);
        setErrorMsg('');
        setResults([]);
        setImportSummary(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post(`${BACKEND_URL}/import`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setResults(res.data.data);
                if (res.data.summary) {
                    setImportSummary(res.data.summary);
                    setShowSummaryModal(true);
                }
            } else {
                setErrorMsg(res.data.message);
            }
        } catch (err) {
            setErrorMsg('Excel 上傳與解析失敗。');
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            processFile(file);
        }
    };

    return (
        <div className="space-y-4 animate-fade-in flex flex-col">
            {/* 搜尋控制面板與標題合併，高度壓縮 */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-slate-50 pb-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Search size={18} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800">共用料智慧查詢</h1>
                        </div>
                        {importSummary && searchMode === 'excel' && (
                            <button onClick={() => setShowSummaryModal(true)} className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-semibold hover:bg-indigo-200 transition-colors">
                                檢視匯入報告
                            </button>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input type="radio" name="mode" className="text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" checked={searchMode === 'item'} onChange={() => setSearchMode('item')} />
                            <span className={`text-sm font-semibold transition-colors ${searchMode === 'item' ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'}`}>單一料號</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input type="radio" name="mode" className="text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" checked={searchMode === 'order'} onChange={() => setSearchMode('order')} />
                            <span className={`text-sm font-semibold transition-colors ${searchMode === 'order' ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'}`}>訂單號碼</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input type="radio" name="mode" className="text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" checked={searchMode === 'excel'} onChange={() => setSearchMode('excel')} />
                            <span className={`text-sm font-semibold transition-colors ${searchMode === 'excel' ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'}`}>Excel 匯入</span>
                        </label>
                    </div>
                </div>

                <div className="w-full">
                    {searchMode !== 'excel' ? (
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search size={16} className="text-slate-400" />
                                </div>
                                <input 
                                    type="text" 
                                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow outline-none shadow-inner bg-slate-50 focus:bg-white"
                                    placeholder={searchMode === 'item' ? "輸入成品料號..." : "輸入銷售訂單內部號碼..."}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                            </div>
                            <button 
                                onClick={handleSearch}
                                disabled={isLoading || !inputValue.trim()}
                                className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                {isLoading ? '解析中...' : '查詢'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <input 
                                type="file" 
                                accept=".xlsx, .xls"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                            <div 
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current.click()}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border-2 border-dashed transition-all cursor-pointer ${
                                    isDragging 
                                        ? 'bg-indigo-100 border-indigo-500 text-indigo-800' 
                                        : 'bg-slate-50 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400'
                                } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <UploadCloud size={20} />
                                {isLoading ? '上傳解析中...' : (isDragging ? '放開以匯入檔案' : '點擊選擇或拖曳 Excel 檔案至此')}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 rounded-xl flex items-center gap-3 font-medium animate-fade-in">
                    <span className="flex-shrink-0 bg-rose-200 p-1 rounded-full"><Search size={14} className="text-rose-700"/></span>
                    {errorMsg}
                </div>
            )}

            {/* 匯入結果統計 Modal */}
            {importSummary && showSummaryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                                <UploadCloud size={22} className="text-indigo-600" />
                                Excel 批次匯入統計報告
                            </h3>
                            <button onClick={() => setShowSummaryModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                                    <span className="text-4xl font-black text-emerald-600">{importSummary.successCount}</span>
                                    <span className="text-sm font-semibold text-emerald-700 mt-2">成功查詢料號 (筆)</span>
                                </div>
                                
                                <div className="flex-1 bg-rose-50 border border-rose-100 rounded-2xl p-6 flex flex-col items-center text-center">
                                    <span className="text-4xl font-black text-rose-600">{importSummary.failCount}</span>
                                    <span className="text-sm font-semibold text-rose-700 mt-2 mb-2">不存在或無效料號 (筆)</span>
                                    {importSummary.failedItems.length > 0 && (
                                        <div className="text-xs text-rose-600/80 bg-white px-3 py-2 rounded-lg border border-rose-100 max-h-40 overflow-y-auto w-full scrollbar-thin text-left flex flex-col gap-1">
                                            {importSummary.failedItems.map((item, i) => (
                                                <div key={i} className="whitespace-nowrap font-mono bg-rose-50 px-2 py-1 rounded border border-rose-100">
                                                    {item}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 bg-amber-50 border border-amber-100 rounded-2xl p-6 flex flex-col items-center text-center">
                                    <span className="text-4xl font-black text-amber-600">{importSummary.duplicateCount}</span>
                                    <span className="text-sm font-semibold text-amber-700 mt-2 mb-2">Excel 重複料號 (筆)</span>
                                    {importSummary.duplicateItems.length > 0 && (
                                        <div className="text-xs text-amber-700/80 bg-white px-3 py-2 rounded-lg border border-amber-100 max-h-40 overflow-y-auto w-full scrollbar-thin text-left flex flex-col gap-1">
                                            {importSummary.duplicateItems.map((item, i) => (
                                                <div key={i} className="whitespace-nowrap font-mono bg-amber-50/50 px-2 py-1 rounded border border-amber-100">
                                                    {item}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end">
                            <button onClick={() => setShowSummaryModal(false)} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                                確認並檢視資料
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 動態雙層 DataGrid */}
            {results.length > 0 && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
                    <div className="overflow-auto max-h-[calc(100vh-230px)]">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="text-slate-500">
                                <tr>
                                    <th className="px-4 py-4 w-12 sticky top-0 bg-slate-50 border-b border-slate-200 z-20"></th>
                                    <th className="px-4 py-4 font-bold text-slate-600 sticky top-0 bg-slate-50 border-b border-slate-200 z-20">查詢料號</th>
                                    <th className="px-4 py-4 font-bold text-slate-600 sticky top-0 bg-slate-50 border-b border-slate-200 z-20">品名</th>
                                    <th className="px-4 py-4 font-bold text-slate-600 sticky top-0 bg-slate-50 border-b border-slate-200 z-20">所屬廠區</th>
                                    <th className="px-4 py-4 font-bold text-slate-600 sticky top-0 bg-slate-50 border-b border-slate-200 z-20">本尊實體庫存 (廠區總計)</th>
                                    <th className="px-4 py-4 font-bold text-indigo-700 sticky top-0 bg-slate-50 border-b border-slate-200 z-20">智慧庫存判讀量 (廠區整體可用)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {results.map((itemResult, idx) => {
                                    if (itemResult.error || itemResult.isInvalid || !itemResult.plants || itemResult.plants.length === 0) {
                                        let message = '此料號與其共用料在所有倉庫皆無庫存紀錄。';
                                        if (itemResult.error) message = `查詢錯誤: ${itemResult.error}`;
                                        else if (itemResult.isInvalid) message = '此料號在系統中不存在或已停用。';

                                        return (
                                            <tr key={idx} className="bg-rose-50/30">
                                                <td className="px-4 py-4"></td>
                                                <td className="px-4 py-4 font-medium text-slate-800">{itemResult.queriedItem}</td>
                                                <td className="px-4 py-4 text-slate-500" colSpan="4">
                                                    {message}
                                                </td>
                                            </tr>
                                        );
                                    }
                                    return itemResult.plants.map((plant, pIdx) => (
                                        <SharedInventoryRow 
                                            key={`${idx}-${pIdx}`} 
                                            plant={plant} 
                                            queriedItem={itemResult.queriedItem}
                                            queriedItemName={itemResult.queriedItemName} 
                                        />
                                    ));
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
