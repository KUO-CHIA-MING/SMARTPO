async function test() {
    try {
        const response = await fetch('http://localhost:3001/api/ai/query', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: '測試' })
        });
        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response body:', text.substring(0, 500));
    } catch (e) {
        console.log('Error:', e.message);
    }
}
test();
