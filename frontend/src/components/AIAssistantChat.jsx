import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';


const AIAssistantChat = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: '您好！我是智慧 AI 採購助理。您可以直接用自然語言詢問我採購、庫存、銷售相關的數據（例如：「幫我查2月份向某供應商採購的總金額」）。\n\n*為確保資安，所有機敏資訊(如供應商名稱)將被自動隱蔽，且本系統絕對不虛構任何無中生有的數據。*'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';
            
            // 單次 API 請求：一次同步處理 Text-to-SQL + DB 查詢 + 數據解讀
            const response = await axios.post(`${BACKEND_URL}/ai/query`, { prompt: userMessage });
            
            if (response.data.success) {
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: response.data.message 
                }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ **系統提示**：\n${response.data.message}`, isError: true }]);
            }
        } catch (error) {
            let errorMsg = '無法連線至 AI 伺服器，請稍後再試。';
            if (error.response && error.response.status === 429) {
                errorMsg = '今日 AI 查詢額度已達上限，為防範超額費用，已中斷請求。請明日再試。';
            } else if (error.response && error.response.data && error.response.data.message) {
                errorMsg = error.response.data.message;
            } else if (error.message) {
                errorMsg = error.message;
            }
            setMessages(prev => [...prev, { role: 'assistant', content: `🚨 **錯誤**：\n${errorMsg}`, isError: true }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden border border-slate-200" style={{ height: '80vh' }}>
                
                {/* Header */}
                <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <Sparkles size={24} className="text-indigo-100" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                智慧 AI 採購助理
                                <span className="bg-indigo-500 text-xs px-2 py-0.5 rounded-full border border-indigo-400">零幻覺 Beta</span>
                            </h2>
                            <p className="text-indigo-200 text-xs mt-0.5">基於實體資料庫 RAG 架構與五層資安防護</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-indigo-500 rounded-full transition-colors text-indigo-100 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col gap-6">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : (msg.isError ? 'bg-rose-100 text-rose-600' : 'bg-white border border-slate-200 text-indigo-600')}`}>
                                {msg.role === 'user' ? <User size={20} /> : (msg.isError ? <AlertCircle size={20} /> : <Bot size={20} />)}
                            </div>
                            
                            <div className={`px-5 py-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
                                msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                                    : (msg.isError ? 'bg-rose-50 text-rose-900 border border-rose-200 rounded-tl-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm')
                            }`}>
                                {msg.role === 'user' ? (
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                ) : (
                                    <div className="prose prose-sm prose-slate max-w-none prose-p:my-1 prose-ul:my-1 prose-table:my-2 prose-td:p-2 prose-th:p-2 prose-th:bg-slate-100 prose-table:border-collapse prose-td:border prose-td:border-slate-200 prose-th:border prose-th:border-slate-200">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {isLoading && (
                        <div className="flex gap-4 max-w-[85%]">
                            <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm bg-white border border-slate-200 text-indigo-600">
                                <Bot size={20} />
                            </div>
                            <div className="px-6 py-4 rounded-2xl bg-white border border-slate-200 text-slate-500 rounded-tl-sm shadow-sm flex items-center gap-3">
                                <Loader2 size={18} className="animate-spin text-indigo-500" />
                                <span className="text-sm font-medium animate-pulse">正在查詢資料庫並進行數據分析...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                    <div className="relative flex items-end gap-2 max-w-4xl mx-auto">
                        <textarea 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="請輸入採購查詢需求 (例如：查詢本月採購總金額，或是特定料號目前的在線庫存量)... Shift+Enter 換行"
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none min-h-[52px] max-h-32 scrollbar-thin"
                            rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 4) : 1}
                            disabled={isLoading}
                        />
                        <button 
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className={`p-3.5 rounded-xl shrink-0 flex items-center justify-center transition-colors ${
                                !input.trim() || isLoading 
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                            }`}
                        >
                            <Send size={20} className={input.trim() && !isLoading ? 'translate-x-0.5 -translate-y-0.5' : ''} />
                        </button>
                    </div>
                    <div className="text-center mt-2">
                        <span className="text-[10px] text-slate-400">
                            AI 可能會產生不準確的資訊，本系統已啟用五層資安防護與無狀態查詢機制，請安心使用。
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AIAssistantChat;
