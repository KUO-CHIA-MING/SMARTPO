import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, Plus, Trash2, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Search } from 'lucide-react';

const BACKEND_URL = 'http://localhost:3001/api';

export function FocusInventoryAdmin({ onBackClick }) {
    const [adminList, setAdminList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // 單筆新增
    const [newItemCode, setNewItemCode] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    
    // 拖曳上傳
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Modal
    const [modalInfo, setModalInfo] = useState(null);

    const fetchAdminList = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${BACKEND_URL}/focus-inventory/admin-list`);
            if (res.data.success) {
                setAdminList(res.data.data);
            }
        } catch (error) {
            console.error('取得後台清單失敗:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAdminList();
    }, []);

    // 處理單筆新增
    const handleAdd = async () => {
        if (!newItemCode || newItemCode.trim().length !== 18) {
            alert('請輸入 18 碼料號');
            return;
        }
        setIsAdding(true);
        try {
            const res = await axios.post(`${BACKEND_URL}/focus-inventory/add`, { itemCode: newItemCode });
            if (res.data.success) {
                setNewItemCode('');
                fetchAdminList();
                showToast('加入成功', 'success');
            } else {
                if (res.data.duplicateCount) {
                    setNewItemCode(''); // 是重複的，直接清空輸入框
                    showToast(res.data.message, 'warning');
                } else {
                    showToast(res.data.message || '加入失敗', 'error');
                }
            }
        } catch (error) {
            showToast('網路或系統錯誤', 'error');
        } finally {
            setIsAdding(false);
        }
    };

    // 處理狀態切換
    const handleToggle = async (itemCode, currentStatus) => {
        const newStatus = currentStatus === 1 ? 0 : 1;
        try {
            const res = await axios.put(`${BACKEND_URL}/focus-inventory/toggle`, { itemCode, isVisible: newStatus });
            if (res.data.success) {
                setAdminList(prev => prev.map(item => 
                    item.ItemCode === itemCode ? { ...item, IsVisible: newStatus } : item
                ));
            }
        } catch (error) {
            alert('狀態更新失敗');
        }
    };

    // 處理刪除
    const handleDelete = async (itemCode) => {
        if (!window.confirm(`確定要將料號 ${itemCode} 從重點清單中永久移除嗎？`)) return;
        try {
            const res = await axios.delete(`${BACKEND_URL}/focus-inventory/delete`, { data: { itemCode } });
            if (res.data.success) {
                fetchAdminList();
            }
        } catch (error) {
            alert('刪除失敗');
        }
    };

    // 處理檔案拖曳上傳
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    };

    const handleFileUpload = async (file) => {
        if (!file.name.match(/\.(xlsx|xls)$/)) {
            alert('僅支援 Excel (.xlsx, .xls) 檔案格式');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        setIsUploading(true);

        try {
            const res = await axios.post(`${BACKEND_URL}/focus-inventory/import`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setModalInfo({
                    successCount: res.data.successCount,
                    failCount: res.data.failCount,
                    failedItems: res.data.failedItems || [],
                    duplicateCount: res.data.duplicateCount || 0,
                    duplicateItems: res.data.duplicateItems || []
                });
                fetchAdminList();
            } else {
                alert(res.data.message || '匯入失敗');
            }
        } catch (error) {
            alert('匯入發生錯誤');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const showToast = (msg, type) => {
        // 簡單使用 alert 替代，若有 toast 庫可換
        alert(`[${type.toUpperCase()}] ${msg}`);
    };

    const filteredList = adminList.filter(item => 
        item.ItemCode.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBackClick}
                        className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">重點清單管理</h2>
                        <p className="text-sm text-slate-500 mt-1">匯入、新增與管理重點關注物料</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 左側：操作區 */}
                <div className="md:col-span-1 space-y-6">
                    {/* 檔案匯入區塊 */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h3 className="text-md font-bold text-slate-800 mb-4">Excel 批次匯入</h3>
                        <div 
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
                        >
                            <input 
                                type="file" 
                                accept=".xlsx, .xls" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                            />
                            <div className="flex flex-col items-center justify-center gap-3">
                                {isUploading ? (
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center animate-pulse">
                                        <UploadCloud className="w-6 h-6 text-indigo-500" />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                                        <UploadCloud className={`w-6 h-6 ${isDragging ? 'text-indigo-500' : 'text-slate-400'}`} />
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">
                                        {isUploading ? '正在解析並與 ERP 比對中...' : '點擊或拖曳 Excel 檔案至此'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">首行標題需為 ItemCode</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 單筆新增區塊 */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h3 className="text-md font-bold text-slate-800 mb-4">單筆料號新增</h3>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                placeholder="輸入 18 碼料號"
                                value={newItemCode}
                                onChange={(e) => setNewItemCode(e.target.value)}
                                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 uppercase"
                                maxLength={18}
                            />
                            <button
                                onClick={handleAdd}
                                disabled={isAdding}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                                {isAdding ? <UploadCloud className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                加入
                            </button>
                        </div>
                    </div>
                </div>

                {/* 右側：清單管理 */}
                <div className="md:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h3 className="text-md font-bold text-slate-800 whitespace-nowrap">已納入清單 ({filteredList.length} / {adminList.length})</h3>
                        <div className="relative w-full md:w-64">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="搜尋料號..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto h-[600px] overflow-y-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap relative">
                            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm text-slate-500">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">料號</th>
                                    <th className="px-6 py-4 font-semibold text-center">前台顯示狀態</th>
                                    <th className="px-6 py-4 font-semibold text-center">加入時間</th>
                                    <th className="px-6 py-4 font-semibold text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {isLoading ? (
                                    <tr><td colSpan="4" className="text-center py-10 text-slate-400">載入中...</td></tr>
                                ) : filteredList.length === 0 ? (
                                    <tr><td colSpan="4" className="text-center py-10 text-slate-400">尚無符合搜尋結果的資料</td></tr>
                                ) : (
                                    filteredList.map(item => (
                                        <tr key={item.ItemCode} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-mono font-medium text-slate-700">{item.ItemCode}</td>
                                            <td className="px-6 py-4 text-center">
                                                <button 
                                                    onClick={() => handleToggle(item.ItemCode, item.IsVisible)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${item.IsVisible ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                >
                                                    {item.IsVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                                    {item.IsVisible ? '顯示中' : '已隱藏'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-500 text-xs">
                                                {new Date(item.CreatedAt).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button 
                                                    onClick={() => handleDelete(item.ItemCode)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* 比對回饋 Modal */}
            {modalInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-indigo-500" />
                                匯入比對結果
                            </h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-emerald-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                                    <div className="text-2xl font-black text-emerald-700">{modalInfo.successCount}</div>
                                    <div className="text-xs text-emerald-600 font-semibold mt-1">成功加入</div>
                                </div>
                                <div className="bg-amber-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                                    <div className="text-2xl font-black text-amber-700">{modalInfo.duplicateCount || 0}</div>
                                    <div className="text-xs text-amber-600 font-semibold mt-1">重複跳過</div>
                                </div>
                                <div className="bg-rose-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <XCircle className="w-8 h-8 text-rose-500 mb-2" />
                                    <div className="text-2xl font-black text-rose-700">{modalInfo.failCount}</div>
                                    <div className="text-xs text-rose-600 font-semibold mt-1">比對失敗</div>
                                </div>
                            </div>

                            {modalInfo.duplicateItems?.length > 0 && (
                                <div>
                                    <p className="text-sm font-semibold text-slate-700 mb-2">重複料號清單 (已存在於清單中，無須加入)：</p>
                                    <div className="bg-slate-50 rounded-xl p-3 max-h-24 overflow-y-auto text-xs text-slate-500 font-mono space-y-1 border border-slate-100">
                                        {modalInfo.duplicateItems.map((code, idx) => (
                                            <div key={idx}>{code}</div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {modalInfo.failedItems.length > 0 && (
                                <div>
                                    <p className="text-sm font-semibold text-slate-700 mb-2">失敗料號清單 (無此料或格式不符)：</p>
                                    <div className="bg-slate-50 rounded-xl p-3 max-h-32 overflow-y-auto text-xs text-slate-500 font-mono space-y-1 border border-slate-100">
                                        {modalInfo.failedItems.map((code, idx) => (
                                            <div key={idx}>{code}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
                            <button 
                                onClick={() => setModalInfo(null)}
                                className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all"
                            >
                                關閉
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
