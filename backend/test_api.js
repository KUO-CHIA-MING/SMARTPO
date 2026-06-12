async function test() {
    try {
        console.log('正在測試 /api/ai/query...');
        const res = await fetch('http://127.0.0.1:3001/api/ai/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: '幫我查2月份的採購單' })
        });
        const data = await res.json();
        console.log('Query Result:', JSON.stringify(data, null, 2));
        
        if (data.success) {
            console.log('\n同步查詢與解讀測試成功。');
            process.exit(0);
        } else {
            console.error('查詢失敗:', data.message);
            process.exit(1);
        }
    } catch (err) {
        console.error('測試過程中發生錯誤:', err);
        process.exit(1);
    }
}
test();
