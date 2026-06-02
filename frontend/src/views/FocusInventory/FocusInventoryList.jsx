import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { RefreshCw, Search, ArrowUpDown, Settings } from 'lucide-react';

const BACKEND_URL = 'http://localhost:3001/api';

export function FocusInventoryList({ onAdminClick }) {
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'StatusWeight', direction: 'desc' });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${BACKEND_URL}/focus-inventory/list`);
            if (res.data.success) {
                // 為每一筆資料計算狀態和排序權重
                const processedData = res.data.data.map(item => {
                    const { OnHand, OnOrder, MinOrder, MinStock, MaxStock } = item;
                    const available = OnHand + OnOrder;
                    
                    let status = 'healthy';
                    let statusText = '充足健康';
                    let weight = 0;

                    if (available < MinStock) {
                        status = 'critical';
                        statusText = '安全庫存不足';
                        weight = 4;
                    } else if (available < MinOrder) {
                        status = 'warning';
                        statusText = '需求庫存不足';
                        weight = 3;
                    } else if (OnHand > MaxStock) {
                        status = 'overstock';
                        statusText = '最大庫存超標';
                        weight = 2;
                    } else {
                        status = 'healthy';
                        statusText = '充足健康';
                        weight = 1;
                    }

                    return { ...item, status, statusText, StatusWeight: weight };
                });
                setData(processedData);
            }
        } catch (error) {
            console.error('抓取重點庫存失敗:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        let sortableItems = [...data];
        
        if (searchTerm) {
            sortableItems = sortableItems.filter(item => 
                item.ItemCode.toLowerCase().includes(searchTerm.toLowerCase()) || 
                item.ItemName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                
                // 次要排序：當主要排序權重相同時，依料號字母順序排列
                if (a.ItemCode < b.ItemCode) return -1;
                if (a.ItemCode > b.ItemCode) return 1;
                return 0;
            });
        }
        return sortableItems;
    }, [data, sortConfig, searchTerm]);

    const getStatusStyle = (status) => {
        switch (status) {
            case 'critical':
                return 'bg-[#FEF2F2] text-[#EF4444] border-[#EF4444]/20 animate-pulse ring-2 ring-[#EF4444]/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]';
            case 'warning':
                return 'bg-[#FFFBEB] text-[#F59E0B] border-[#F59E0B]/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]';
            case 'overstock':
                return 'bg-[#FEF3C7] text-[#D97706] border-[#D97706]/20 shadow-[0_0_10px_rgba(217,119,6,0.15)]';
            default:
                return 'bg-[#ECFDF5] text-[#10B981] border-[#10B981]/20';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">重點庫存監控</h2>
                    <p className="text-sm text-slate-500 mt-1">即時追蹤企業關鍵物料庫存水位</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="搜尋料號或品名..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-64 transition-all"
                        />
                    </div>
                    <button 
                        onClick={onAdminClick}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-sm font-semibold transition-all"
                    >
                        <Settings className="w-4 h-4" />
                        維護清單
                    </button>
                    <button 
                        onClick={fetchData}
                        className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-auto max-h-[calc(100vh-240px)]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="text-slate-500">
                            <tr>
                                {['ItemCode|料號', 'ItemName|品名', 'OnHand|現在庫存', 'IsCommited|已承約量', 'OnOrder|已訂貨量', 'MinOrder|需求庫存', 'MinStock|最小安全', 'MaxStock|最大庫存', 'StatusWeight|狀態'].map((col) => {
                                    const [key, label] = col.split('|');
                                    const isStatus = key === 'StatusWeight';
                                    return (
                                        <th 
                                            key={key} 
                                            onClick={() => handleSort(key)}
                                            className={`px-4 py-4 font-semibold cursor-pointer transition-colors group sticky top-0 bg-slate-50 border-b border-slate-100 ${isStatus ? 'right-0 shadow-[-12px_0_15px_-5px_rgba(0,0,0,0.05)] z-30' : 'z-20 hover:bg-slate-100'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {label}
                                                <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === key ? 'text-indigo-500' : 'text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity'}`} />
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                                            載入即時數據中...
                                        </div>
                                    </td>
                                </tr>
                            ) : sortedData.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-12 text-center text-slate-400">
                                        尚未設定任何重點庫存品項，或無符合搜尋結果。
                                    </td>
                                </tr>
                            ) : (
                                sortedData.map((item, idx) => (
                                    <tr key={item.ItemCode} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-4 py-4 font-mono font-medium text-slate-700">{item.ItemCode}</td>
                                        <td className="px-4 py-4 text-slate-600 truncate max-w-[14rem]" title={item.ItemName}>{item.ItemName}</td>
                                        <td className="px-4 py-4 font-semibold text-slate-800">{item.OnHand?.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-slate-600">{item.IsCommited?.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-indigo-600 font-medium">{item.OnOrder?.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-slate-500">{item.MinOrder?.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-slate-500">{item.MinStock?.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-slate-500">{item.MaxStock?.toLocaleString()}</td>
                                        <td className="px-4 py-4 sticky right-0 bg-white group-hover:bg-slate-50/80 transition-colors shadow-[-12px_0_15px_-5px_rgba(0,0,0,0.05)] z-10">
                                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${getStatusStyle(item.status)}`}>
                                                {item.status === 'critical' ? '🔴 ' : ''}
                                                {item.statusText}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
