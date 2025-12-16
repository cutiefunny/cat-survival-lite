import { useSkills } from './SkillsContext';
import { For } from 'solid-js';

const Item = (props) => {
    const { addSkill } = useSkills();

    const handleUpgradeClick = (skillId) => {
        console.log('handleUpgradeClick called with skill:', skillId);
        addSkill(skillId);
        props.onClose(); // 부모(ShopModal)에서 전달받은 닫기 함수
    };

    return (
        <div className="items-container">
            <div className="items-grid" style={{ display: 'flex', 'overflow-x': 'auto', gap: '10px', padding: '10px' }}>
                <For each={props.items}>
                    {(item) => (
                        <div className="item-card" style={cardStyle}>
                            <img 
                                src={item.imageUrl} 
                                alt={item.name} 
                                className="item-image" 
                                onClick={() => handleUpgradeClick(item.id)}
                                style={{
                                    cursor: 'pointer',
                                    width: '150px',
                                    height: '150px',
                                    'object-fit': 'cover',
                                    'border-radius': '8px'
                                }}
                            />
                            <h3 style={{ 'font-family': 'Arial, sans-serif', 'font-size': '18px', color: '#555', margin: '10px 0 5px 0' }}>
                                {item.name}
                            </h3>
                            <p style={{ 'font-family': 'Arial, sans-serif', 'font-size': '14px', color: '#777', margin: 0 }}>
                                {item.description}
                            </p>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};

const cardStyle = {
    display: 'inline-block',
    width: '160px',
    'flex-shrink': 0, // flex 컨테이너 안에서 줄어들지 않도록
    background: '#f9f9f9',
    padding: '10px',
    'border-radius': '8px',
    'box-shadow': '0 2px 5px rgba(0,0,0,0.1)',
    'text-align': 'center',
    transition: 'transform 0.2s',
};

export default Item;