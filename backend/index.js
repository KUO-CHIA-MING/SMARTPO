import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;

// 啟用 CORS 跨來源資源共享，允許前端（預設為 5173）存取
app.use(cors());
app.use(express.json());

// 模擬的成品基礎資料（料號範圍 ItmsGrpCod = 101）
// 欄位嚴格遵循 SDD 規範，並不包含主要供應商
const generateMockItems = () => {
  const items = [];
  const itemNames = [
    '高精密伺服馬達驅動器 A1', '工業級感測器模組 S2', '微處理器控制器 MCU-8',
    '高動態步進馬達 M3', '光電隔離信號轉換器', '不銹鋼精密導軌 G5',
    '智慧型伺服減速機 R8', '嵌入式系統主機板 E10', '多通道數值控制器 D4',
    '高速滾珠螺桿組 B2', '工業級乙太網路交換機', '精密壓力傳感器 P9'
  ];

  for (let i = 1; i <= 320; i++) {
    const itemCode = `FG-${10000 + i}`;
    const itemName = `${itemNames[i % itemNames.length]}-${String.fromCharCode(65 + (i % 26))}${i}`;
    
    // 產生合理的庫存水位值
    const minStock = Math.floor(Math.random() * 50) + 10; // 最小安全庫存
    const minOrder = minStock + Math.floor(Math.random() * 40) + 20; // 需求庫存量
    const maxStock = minOrder + Math.floor(Math.random() * 150) + 100; // 最大庫存量
    
    // 隨機分配庫存狀態 (充足, 不足目標, 不足安全, 超標)
    const stateRand = Math.random();
    let onHand, onOrder;

    if (stateRand < 0.15) {
      // 1. 需求庫存不足：(OnHand + OnOrder) < MinOrder 且 >= MinStock
      onHand = Math.floor(minStock + (minOrder - minStock) * 0.4);
      onOrder = Math.floor((minOrder - onHand) * 0.5);
    } else if (stateRand < 0.20) {
      // 2. 最小安全庫存不足：(OnHand + OnOrder) < MinStock
      onHand = Math.floor(minStock * 0.6);
      onOrder = Math.floor(minStock * 0.1);
    } else if (stateRand < 0.40) {
      // 3. 最大庫存超標：OnHand > MaxStock
      onHand = maxStock + Math.floor(Math.random() * 50) + 10;
      onOrder = 0;
    } else {
      // 4. 健康狀態
      onHand = Math.floor(minOrder + (maxStock - minOrder) * 0.5);
      onOrder = Math.floor(Math.random() * 30);
    }

    // 計算庫齡（天數），用於週轉分析
    // 庫齡主要針對 OnHand > 0 的物料，隨機分佈於 10 天至 1200 天之間
    const ageDays = onHand > 0 ? (Math.random() < 0.1 ? Math.floor(Math.random() * 1200) + 10 : Math.floor(Math.random() * 400) + 10) : 0;

    items.push({
      ItemCode: itemCode,
      ItemName: itemName,
      OnHand: onHand,
      OnOrder: onOrder,
      MinOrder: minOrder,
      MinStock: minStock,
      MaxStock: maxStock,
      AgeDays: ageDays
    });
  }
  return items;
};

// 全域快取 Mock 資料，模擬真實資料庫狀態
let mockDatabase = generateMockItems();

// ==========================================
// 1. 庫存水位監控 API
// ==========================================
app.get('/api/inventory/level-monitor', (req, res) => {
  try {
    // 每次請求微調一下數據以展示動態重新整理的效果
    if (req.query.refresh === 'true') {
      mockDatabase = generateMockItems();
    }

    const totalActiveItems = mockDatabase.length; // 設定有 MinOrder 的成品總數

    // 計算符合各水位的筆數
    const underTargetList = mockDatabase.filter(item => (item.OnHand + item.OnOrder) < item.MinOrder && (item.OnHand + item.OnOrder) >= item.MinStock);
    const underSafetyList = mockDatabase.filter(item => (item.OnHand + item.OnOrder) < item.MinStock);
    const overMaxList = mockDatabase.filter(item => item.OnHand > item.MaxStock);

    res.json({
      success: true,
      totalActiveItems,
      underTarget: {
        count: underTargetList.length,
        percentage: parseFloat(((underTargetList.length / totalActiveItems) * 100).toFixed(1))
      },
      underSafety: {
        count: underSafetyList.length,
        percentage: parseFloat(((underSafetyList.length / totalActiveItems) * 100).toFixed(1))
      },
      overMax: {
        count: overMaxList.length,
        percentage: parseFloat(((overMaxList.length / totalActiveItems) * 100).toFixed(1))
      }
    });
  } catch (error) {
    console.error('level-monitor 錯誤：', error);
    res.status(500).json({ success: false, message: '無法取得庫存水位數據' });
  }
});

// ==========================================
// 2. 採購到達率與逾期監控 API
// ==========================================
app.get('/api/po/delivery-rate', (req, res) => {
  try {
    // 模擬達交率數據，符合 SDD 的 🟢黃🟡紅🔴 燈號標準
    res.json({
      success: true,
      thisMonth: { rate: 92.4, status: 'green' },  // 92.4% 綠色健康 (目標 >= 90%)
      lastMonth: { rate: 84.6, status: 'yellow' }, // 84.6% 黃色告警 (80% <= rate < 90%)
      thisYear: { rate: 78.2, status: 'red' }      // 78.2% 紅色危險 (rate < 80%)
    });
  } catch (error) {
    console.error('delivery-rate 錯誤：', error);
    res.status(500).json({ success: false, message: '無法取得採購達交率數據' });
  }
});

// ==========================================
// 3. 庫存週轉與庫齡監控 API
// ==========================================
app.get('/api/inventory/turnover-age', (req, res) => {
  try {
    // 只統計庫存量 OnHand > 0 的項目 (符合 SDD 規範)
    const activeInventory = mockDatabase.filter(item => item.OnHand > 0);
    const totalItems = activeInventory.length;

    const ranges = [
      { name: '半年以下 (新鮮)', days: '< 180', count: 0, percentage: 0, color: '#10B981' },
      { name: '半年至 1 年 (輕度積壓)', days: '180-360', count: 0, percentage: 0, color: '#3B82F6' },
      { name: '1 年至 2 年 (中度積壓)', days: '361-720', count: 0, percentage: 0, color: '#F59E0B' },
      { name: '2 年至 3 年 (重度積壓)', days: '721-1080', count: 0, percentage: 0, color: '#EF4444' },
      { name: '3 年以上 (呆滯料)', days: '> 1080', count: 0, percentage: 0, color: '#7C3AED' }
    ];

    // 分類統計
    activeInventory.forEach(item => {
      const age = item.AgeDays;
      if (age < 180) ranges[0].count++;
      else if (age <= 360) ranges[1].count++;
      else if (age <= 720) ranges[2].count++;
      else if (age <= 1080) ranges[3].count++;
      else ranges[4].count++;
    });

    // 計算百分比
    ranges.forEach(r => {
      r.percentage = parseFloat(((r.count / totalItems) * 100).toFixed(1));
    });

    res.json({
      success: true,
      totalItems,
      ranges
    });
  } catch (error) {
    console.error('turnover-age 錯誤：', error);
    res.status(500).json({ success: false, message: '無法取得庫齡分析數據' });
  }
});

// ==========================================
// 4. 向下鑽研 (Drill-down) 明細 API
// ==========================================
app.get('/api/inventory/drilldown', (req, res) => {
  try {
    const { type, range } = req.query;
    let list = [...mockDatabase];

    // 依據前端點擊的圖表類型篩選明細資料
    if (type === 'under-target') {
      list = list.filter(item => (item.OnHand + item.OnOrder) < item.MinOrder && (item.OnHand + item.OnOrder) >= item.MinStock);
    } else if (type === 'under-safety') {
      list = list.filter(item => (item.OnHand + item.OnOrder) < item.MinStock);
    } else if (type === 'over-max') {
      list = list.filter(item => item.OnHand > item.MaxStock);
    } else if (type === 'age-range' && range) {
      // 只統計有庫存的項目
      list = list.filter(item => item.OnHand > 0);
      if (range === '< 180') list = list.filter(item => item.AgeDays < 180);
      else if (range === '180-360') list = list.filter(item => item.AgeDays >= 180 && item.AgeDays <= 360);
      else if (range === '361-720') list = list.filter(item => item.AgeDays >= 361 && item.AgeDays <= 720);
      else if (range === '721-1080') list = list.filter(item => item.AgeDays >= 721 && item.AgeDays <= 1080);
      else if (range === '> 1080') list = list.filter(item => item.AgeDays > 1080);
    } else if (type === 'po-delivery') {
      // 採購明細的 Mock 數據
      const poMockList = [];
      const buyers = ['林志明', '陳小華', '張大同', '黃美玲'];
      const vendors = ['聯發科技', '台積電', '日月光', '國巨電子', '華邦電子'];
      
      for (let i = 1; i <= 50; i++) {
        const poDate = new Date();
        poDate.setDate(poDate.getDate() - Math.floor(Math.random() * 45));
        
        poMockList.push({
          DocNum: 20260000 + i,
          CardCode: `V-${10000 + i}`,
          CardName: vendors[i % vendors.length],
          DocDate: poDate.toISOString().slice(0, 10),
          ItemCode: `FG-${10000 + i}`,
          Dscription: `成品料號組件-${i}`,
          Quantity: Math.floor(Math.random() * 500) + 100,
          OpenQty: Math.random() < 0.8 ? 0 : Math.floor(Math.random() * 100), // OpenQty = 0 代表已結案達交
          BuyerName: buyers[i % buyers.length]
        });
      }
      
      // 篩選：green 綠色代表已結案達交，red/yellow 代表含有未達交項目
      if (range === 'green') {
        list = poMockList.filter(po => po.OpenQty === 0);
      } else if (range === 'yellow' || range === 'red') {
        list = poMockList.filter(po => po.OpenQty > 0);
      } else {
        list = poMockList;
      }
      
      return res.json({
        success: true,
        total: list.length,
        data: list
      });
    }

    // 格式化回傳符合 SDD 的標準明細欄位 (無主要供應商)
    const formattedList = list.map(item => ({
      ItemCode: item.ItemCode,
      ItemName: item.ItemName,
      OnHand: item.OnHand,
      OnOrder: item.OnOrder,
      MinOrder: item.MinOrder,
      MinStock: item.MinStock,
      MaxStock: item.MaxStock,
      AgeDays: item.AgeDays
    }));

    res.json({
      success: true,
      total: formattedList.length,
      data: formattedList
    });
  } catch (error) {
    console.error('drilldown 錯誤：', error);
    res.status(500).json({ success: false, message: '無法取得向下鑽研明細數據' });
  }
});

app.listen(PORT, () => {
  console.log(`SmartPO Mock 後端 API 服務已成功啟動！監聽 Port: ${PORT}`);
});
