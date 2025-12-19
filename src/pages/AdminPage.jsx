import { createSignal, onMount, For } from 'solid-js';
import { fetchGameConfig, saveGameConfig } from '../utils/configUtils';
import * as DefaultConfig from '../constants/GameConfig';

const AdminPage = () => {
    const [config, setConfig] = createSignal({});
    const [loading, setLoading] = createSignal(true);

    onMount(async () => {
        const data = await fetchGameConfig();
        setConfig(data);
        setLoading(false);
    });

    const handleChange = (key, value, type) => {
        let finalValue = value;

        if (type === 'number') {
            if (value === '' || value === '-' || value === '.') {
                // 입력 중인 상태 허용
            } else {
                finalValue = Number(value);
            }
        }
        else if (isColorKey(key)) {
            finalValue = parseInt(value.replace('#', ''), 16);
        }

        setConfig(prev => ({
            ...prev,
            [key]: finalValue
        }));
    };

    const handleSave = () => {
        saveGameConfig(config());
    };

    const handleReset = () => {
        if (confirm("정말 기본값으로 초기화하시겠습니까?")) {
            setConfig({ ...DefaultConfig });
        }
    };

    const isColorKey = (key) => key.includes('TINT') || key.includes('COLOR');

    const formatValue = (key, value) => {
        if (isColorKey(key) && typeof value === 'number') {
            return '#' + value.toString(16).padStart(6, '0').toUpperCase();
        }
        return value;
    };

    const getStep = (key) => {
        const floatKeywords = ['RATIO', 'PROBABILITY', 'MULTIPLIER', 'PREDICT_TIME', 'SEPARATION_FORCE'];
        if (floatKeywords.some(term => key.includes(term))) {
            return "0.1";
        }
        return "1";
    };

    // [수정] 카테고리 분류 로직 강화
    const getCategories = () => {
        const currentConfig = config();
        if (!currentConfig) return {};

        const categories = {
            "Special Enemies (Elite & AI)": ['SPECIAL', 'AMBUSH'], 
            "Player Stats (HP & Stamina)": ['PLAYER', 'ENERGY', 'STAMINA'], // [추가] STAMINA 키워드 추가
            "Player Jump & Action": ['JUMP'],
            "Common Enemies": ['MOUSE', 'DOG', 'FLEE', 'GATHERING', 'VILLAIN', 'SEPARATION'],
            "Items": ['FISH', 'BUTTERFLY'],
            "Skills & UI": ['SHOCKWAVE', 'BAR', 'EXP'],
            "World & Map": ['WORLD', 'TILE', 'CHUNK'],
        };

        const grouped = {};
        Object.keys(currentConfig).forEach(key => {
            let found = false;
            for (const [cat, keywords] of Object.entries(categories)) {
                if (keywords.some(k => key.includes(k))) {
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(key);
                    found = true;
                    break;
                }
            }
            if (!found) {
                if (!grouped["Others"]) grouped["Others"] = [];
                grouped["Others"].push(key);
            }
        });
        return grouped;
    };

    return (
        <div style={{ padding: '20px', "max-width": '1000px', margin: '0 auto', "font-family": 'monospace' }}>
            <style>
                {`
                    html, body, #root {
                        overflow: auto !important; 
                        height: auto !important;
                        min-height: 100vh;
                        background-color: #f5f5f5 !important;
                        color: #333;
                    }
                `}
            </style>

            <h1 style={{ "text-align": "center", "margin-bottom": "30px" }}>🛠️ Game Admin Dashboard</h1>
            
            {loading() ? (
                <div style={{ "text-align": "center", "padding": "50px" }}>로딩 중...</div>
            ) : (
                <>
                    <div style={{ "margin-bottom": '20px', display: 'flex', gap: '10px', "justify-content": "center" }}>
                        <button onClick={handleSave} style={btnStyle(true)}>💾 변경사항 저장 (Save)</button>
                        <button onClick={handleReset} style={btnStyle(false)}>🔄 기본값 리셋 (Reset)</button>
                        <a href="/" style={{...btnStyle(false), "text-decoration": "none", display:"inline-block"}}>🏠 게임 실행 (Play)</a>
                    </div>

                    <div style={{ "column-count": 1, "column-gap": "20px" }}> 
                        <For each={Object.entries(getCategories())}>
                            {([category, keys]) => (
                                <div style={{ 
                                    "break-inside": "avoid", 
                                    "margin-bottom": '20px', 
                                    border: '1px solid #e0e0e0', 
                                    padding: '20px', 
                                    "border-radius": '12px', 
                                    "background-color": "white", 
                                    "box-shadow": "0 2px 8px rgba(0,0,0,0.05)" 
                                }}>
                                    <h3 style={{ 
                                        "border-bottom": '2px solid #f0f0f0', 
                                        "padding-bottom": '10px', 
                                        "margin-top": 0, 
                                        color: "#2c3e50",
                                        "font-size": "1.2rem"
                                    }}>
                                        {category} <span style={{ "font-size": "0.8rem", color: "#888", "font-weight": "normal" }}>({keys.length})</span>
                                    </h3>
                                    
                                    <div style={{ display: 'grid', "grid-template-columns": 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                                        <For each={keys}>
                                            {(key) => (
                                                <div style={{ 
                                                    display: 'flex', 
                                                    "flex-direction": 'column', 
                                                    "background": "#fafafa", 
                                                    padding: "12px", 
                                                    "border-radius": "8px", 
                                                    border: "1px solid #eee",
                                                    transition: "border-color 0.2s"
                                                }}>
                                                    <label style={{ 
                                                        "font-size": '11px', 
                                                        color: '#666', 
                                                        "margin-bottom": '6px', 
                                                        "font-weight": "bold",
                                                        "word-break": "break-all"
                                                    }}>
                                                        {key}
                                                    </label>
                                                    
                                                    {isColorKey(key) ? (
                                                        <div style={{ display: 'flex', gap: '8px', "align-items": "center" }}>
                                                            <input 
                                                                type="color" 
                                                                value={formatValue(key, config()[key])}
                                                                onInput={(e) => handleChange(key, e.target.value, 'text')}
                                                                style={{ width: '40px', height: '35px', padding: 0, border: 'none', cursor: 'pointer', "background": "none" }}
                                                            />
                                                            <input
                                                                type="text"
                                                                value={formatValue(key, config()[key])}
                                                                onInput={(e) => handleChange(key, e.target.value, 'text')}
                                                                style={inputStyle}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type={typeof config()[key] === 'number' ? 'number' : 'text'}
                                                            step={getStep(key)} 
                                                            value={config()[key]}
                                                            onInput={(e) => handleChange(key, e.target.value, e.target.type)}
                                                            style={inputStyle}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </>
            )}
        </div>
    );
};

const btnStyle = (primary) => ({
    padding: '12px 24px',
    "background-color": primary ? '#27ae60' : '#ecf0f1',
    color: primary ? 'white' : '#2c3e50',
    border: 'none',
    "border-radius": '8px',
    cursor: 'pointer',
    "font-weight": 'bold',
    "font-size": '15px',
    transition: 'all 0.2s ease',
    "box-shadow": "0 2px 4px rgba(0,0,0,0.1)"
});

const inputStyle = {
    padding: '8px 12px',
    border: '1px solid #ddd',
    "border-radius": '6px',
    width: '100%',
    "box-sizing": "border-box",
    "font-family": "monospace",
    "font-size": "14px",
    color: "#333",
    outline: "none"
};

export default AdminPage;