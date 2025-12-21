import { Show } from 'solid-js';
import './StageClearModal.css'; // CSS 파일 import

const StageClearModal = (props) => {
    const formatTime = (ms) => { /* ... 기존 로직 ... */ };

    return (
        <Show when={props.isVisible}>
            <div className="modal-overlay">
                <div className="modal-content">
                    <h2 className="modal-title">STAGE {props.stats.stage} CLEAR!</h2>
                    
                    <div className="stat-container">
                        <div className="stat-row">
                            <span>⏱️ Time</span>
                            <span className="stat-value">{formatTime(props.stats.timeMs)}</span>
                        </div>
                        <div className="stat-row">
                            <span>🩸 Damage</span>
                            <span className="stat-value" style={{color: '#e53935'}}>{props.stats.damage}</span>
                        </div>
                        <div className="stat-row">
                            <span>🐟 Fish</span>
                            <span className="stat-value" style={{color: '#1e88e5'}}>{props.stats.fish}</span>
                        </div>
                        <hr style={{width: '100%', border: 'none', borderTop: '2px dashed #ccc', margin: '10px 0'}}/>
                        <div className="stat-row" style={{fontSize: '1.4em', color: '#4CAF50'}}>
                            <span>TOTAL SCORE</span>
                            <span className="stat-value">+{props.stats.score}</span>
                        </div>
                    </div>

                    <button className="next-button" onClick={props.onNext}>
                        NEXT STAGE ▶
                    </button>
                </div>
            </div>
        </Show>
    );
};
export default StageClearModal;