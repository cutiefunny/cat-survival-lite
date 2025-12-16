import { createSignal, createEffect, Show } from 'solid-js';
import Item from './item';
import skillBook from '../assets/skillBook.json';

const ShopModal = (props) => {
    const [availableItems, setAvailableItems] = createSignal([]);

    // Props(level, skills)가 변경될 때마다 실행됨
    createEffect(() => {
        // SolidJS에서 props.skills는 배열 그 자체이거나 Proxy입니다.
        // skills()는 Context에서 온 Signal getter일 수 있으므로 상황에 따라 다릅니다.
        // 부모(GameCanvas)에서 일반 배열로 넘겨준다면 props.skills로 접근합니다.
        
        const currentLevel = props.level;
        const currentSkills = props.skills || [];

        const items = skillBook.filter(item => item.level <= currentLevel);
        const alreadyHave = skillBook.filter(item => currentSkills.includes(item.id) || item.level > currentLevel);
        const newItems = items.filter(item => !alreadyHave.find(already => already.id === item.id));

        const filterItems = (items) => {
            const filteredItems = [];
            const retainedIds = new Set();

            items.forEach(item => {
                const group = Math.floor(item.id / 10);
                if ([1, 2, 3].includes(group) && item.id % 10 !== 0) {
                    if (!retainedIds.has(group)) {
                        filteredItems.push(item);
                        retainedIds.add(group);
                    }
                } else {
                    filteredItems.push(item);
                }
            });
            return filteredItems;
        };

        setAvailableItems(filterItems(newItems));
    });

    return (
        <Show when={props.isVisible}>
            <div style={modalOverlayStyle}>
                <div style={modalContentStyle}>
                    <p style={{
                        'font-size': '2em',
                        'font-weight': 'bold',
                        color: '#e44d26',
                        'text-shadow': '2px 2px 4px rgba(0,0,0,0.5)',
                        'letter-spacing': '1px',
                        'font-family': 'Arial, sans-serif'
                    }}>LEVEL UP!</p>
                    
                    <div style={{ display: 'flex', 'overflow-x': 'auto', gap: '10px', padding: '10px' }}>
                        <Item items={availableItems()} onClose={props.onClose} />
                    </div>
                    
                    <button style={buttonStyle} onClick={props.onClose}>
                        상남자에게 스킬은 필요 없다
                    </button>
                </div>
            </div>
        </Show>
    );
};

// 스타일 (JS Object)
const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    'background-color': 'rgba(0, 0, 0, 0.7)', display: 'flex',
    'justify-content': 'center', 'align-items': 'center', 'z-index': 1000,
};

const modalContentStyle = {
    'background-color': '#fff', padding: '20px', 'border-radius': '8px',
    'text-align': 'center', 'max-width': '80%', 'max-height': '80%',
    'overflow-y': 'auto', 'box-shadow': '0 4px 10px rgba(0, 0, 0, 0.2)', color: '#333',
};

const buttonStyle = {
    'margin-top': '20px', padding: '10px 20px', 'background-color': '#808080',
    color: '#fff', border: 'none', 'border-radius': '5px', cursor: 'pointer', 'font-size': '16px',
};

export default ShopModal;