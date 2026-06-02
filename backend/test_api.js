async function test() {
    try {
        const response = await fetch('http://localhost:3001/api/inventory/level-monitor');
        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response body:', text.substring(0, 100));
    } catch (e) {
        console.log('Error:', e.message);
    }
}
test();
