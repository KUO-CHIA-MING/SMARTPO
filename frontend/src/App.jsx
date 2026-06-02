import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, LayoutDashboard, Layers, ShieldCheck, Database, Calendar } from 'lucide-react';
import { InventoryLevelCards } from './components/InventoryLevelCards';
import { DeliveryRateGauges } from './components/DeliveryRateGauges';
import { TurnoverAgeChart } from './components/TurnoverAgeChart';
import { DrillDownModal } from './components/DrillDownModal';
import { SkeletonLoader } from './components/SkeletonLoader';
import { FocusInventoryList } from './views/FocusInventory/FocusInventoryList';
import { FocusInventoryAdmin } from './views/FocusInventory/FocusInventoryAdmin';
import { Target } from 'lucide-react';

// 依據 .env 檔案中的 PORT=3001 設定，對齊後端服務埠號
const BACKEND_URL = 'http://localhost:3001/api';

function App() {
  // 0. 視圖狀態
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'focus-list', 'focus-admin'

  // 1. 各數據模組的 State
  const [levelData, setLevelData] = useState(null);
  const [poData, setPoData] = useState(null);
  const [turnoverData, setTurnoverData] = useState(null);
  
  // 2. 加載狀態 State (控制高質感 Skeleton 骨架屏展現)
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 3. Drill-down Modal 控制 State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalType, setModalType] = useState('');
  const [modalRange, setModalRange] = useState('');
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  // 4. API 資料抓取函數
  const fetchData = async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      const refreshParam = refresh ? '?refresh=true' : '';
      
      // 同步併行發送三個 API 請求，提升效能
      const [levelRes, poRes, turnoverRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/inventory/level-monitor${refreshParam}`),
        axios.get(`${BACKEND_URL}/po/delivery-rate`),
        axios.get(`${BACKEND_URL}/inventory/turnover-age`)
      ]);

      if (levelRes.data.success) setLevelData(levelRes.data);
      if (poRes.data.success) setPoData(poRes.data);
      if (turnoverRes.data.success) setTurnoverData(turnoverRes.data);

    } catch (error) {
      console.error('抓取儀表板 API 數據失敗：', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // 5. 初始化加載
  useEffect(() => {
    fetchData();
  }, []);

  // 6. 觸發向下鑽研明細彈窗
  const handleDrillDown = async (type, title, range = '') => {
    setModalOpen(true);
    setModalTitle(title);
    setModalType(type);
    setModalRange(range);
    setModalLoading(true);

    try {
      const typeParam = `type=${type}`;
      const rangeParam = range ? `&range=${range}` : '';
      
      const res = await axios.get(`${BACKEND_URL}/inventory/drilldown?${typeParam}${rangeParam}`);
      if (res.data.success) {
        setModalData(res.data.data);
      }
    } catch (error) {
      console.error('抓取鑽研明細失敗：', error);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      
      {/* 頂部高級莫蘭迪 Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20">
              <LayoutDashboard className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2.5 py-0.5 rounded-full">
                SmartPO 採購防禦系統
              </span>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">採購與庫存水位監控儀表板</h1>
            </div>
          </div>

          {/* 導覽按鈕區 */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView(currentView === 'dashboard' ? 'focus-list' : 'dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-sm ${
                currentView !== 'dashboard' 
                  ? 'bg-indigo-600 text-white shadow-indigo-600/20' 
                  : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              <Target className="w-4 h-4" />
              {currentView === 'dashboard' ? '重點庫存狀態' : '返回總覽儀表板'}
            </button>

            {/* 重新整理與刷新按鈕 */}
            {currentView === 'dashboard' && (
              <button
                onClick={() => fetchData(true)}
                disabled={isLoading || isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-950 text-white hover:bg-slate-800 rounded-2xl text-xs font-bold transition-all shadow-md shadow-slate-950/10 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? '重新整理中...' : '重新整理'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 儀表板主要內容區 */}
      <main className="max-w-7xl mx-auto px-6 mt-8 space-y-10 animate-in fade-in duration-300">
        
        {currentView === 'dashboard' && (
          <>
            {/* 全域系統數據狀態橫幅 */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              👋 歡迎回來，採購管理主管！
            </h2>
            <p className="text-xs text-slate-400">
              儀表板資料已成功連接至 SAP B1 Mock API 伺服器，呈現即時監控數據。
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3.5 py-2 rounded-xl border border-emerald-100">
              <ShieldCheck className="w-4 h-4" />
              <span>後端安全架構：已啟用唯讀防禦</span>
            </div>
            <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3.5 py-2 rounded-xl border border-indigo-100">
              <Database className="w-4 h-4" />
              <span>資料連線：即時 Mock 同步</span>
            </div>
          </div>
        </div>

        {/* 1. 庫存量監控區 (2.1) */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              庫存水位監控
            </h2>
            <span className="text-xs text-slate-400">只抓取成品料號 ItmsGrpCod=101</span>
          </div>

          {isLoading ? (
            <SkeletonLoader type="card" count={3} />
          ) : (
            levelData && <InventoryLevelCards data={levelData} onDrillDown={handleDrillDown} />
          )}
        </section>

        {/* 2. 採購單達交與逾期監控區 (2.2) */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              採購到達率與逾期監控
            </h2>
            <span className="text-xs text-slate-400">基於當期已結案採購單佔比計算</span>
          </div>

          {isLoading ? (
            <SkeletonLoader type="gauge" count={3} />
          ) : (
            poData && <DeliveryRateGauges data={poData} onDrillDown={handleDrillDown} />
          )}
        </section>

        {/* 3. 庫存週轉與庫齡監控 (2.3) */}
        <section className="space-y-4">
          {isLoading ? (
            <SkeletonLoader type="bar" count={1} />
          ) : (
            turnoverData && <TurnoverAgeChart data={turnoverData} onDrillDown={handleDrillDown} />
            )}
          </section>
        </>
        )}

        {currentView === 'focus-list' && (
          <FocusInventoryList onAdminClick={() => setCurrentView('focus-admin')} />
        )}
        
        {currentView === 'focus-admin' && (
          <FocusInventoryAdmin onBackClick={() => setCurrentView('focus-list')} />
        )}

      </main>

      {/* 4. 通用向下鑽研 (Drill-down) Modal */}
      <DrillDownModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        type={modalType}
        range={modalRange}
        data={modalData}
        isLoading={modalLoading}
      />
    </div>
  );
}

export default App;
