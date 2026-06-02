import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function listModels() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        console.log("Loaded API Key length:", apiKey ? apiKey.length : 0);
        if (!apiKey) return;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        
        if (data.models) {
            console.log('Available models:');
            data.models.forEach(m => console.log(m.name));
        } else {
            console.log('API Error:', data);
        }
    } catch (e) {
        console.log('Fetch Error:', e.message);
    }
}
listModels();
