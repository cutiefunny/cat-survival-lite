import { onMount, onCleanup, createSignal, createEffect, Show } from 'solid-js';
import { useSkills } from './SkillsContext';

import ShopModal from './ShopModal';
import GameOverModal from './GameOverModal';
import * as Config from '../constants/GameConfig';
import MainScene from '../game/MainScene'; // [중요] 분리된 씬 가져오기

export default function GameCanvas(props) {
  const { skills, clearSkills } = useSkills();

  const [showShopModal, setShowShopModal] = createSignal(false);
  const [showGameOverModal, setShowGameOverModal] = createSignal(false);
  const [currentScore, setCurrentScore] = createSignal(0);
  const [currentLevel, setCurrentLevel] = createSignal(1);
  const [finalScore, setFinalScore] = createSignal(0);

  // 입력 상태
  let virtualInput = { x: 0, y: 0, active: false };
  let isActionBtnPressed = false;

  let gameContainer;
  let dPadContainer;
  let game = null;

  // --- 스킬 동기화 및 능력치 적용 Effect ---
  createEffect(() => {
    const currentSkills = skills();

    if (!game) return;
    const scene = game.scene.getScene('MainScene');
    if (!scene || !scene.data) return;

    // Phaser 데이터 동기화
    scene.data.set('skills', currentSkills);

    // 플레이어 체력 업데이트 로직 (근성장 스킬)
    const player = scene.data.get('player');
    if (!player) return;

    let bonusHealth = 0;
    if (currentSkills.includes(31)) bonusHealth += 1;
    if (currentSkills.includes(32)) bonusHealth += 1;
    if (currentSkills.includes(33)) bonusHealth += 1;

    const newMaxEnergy = Config.INITIAL_PLAYER_ENERGY + bonusHealth;
    const currentMaxEnergy = player.getData('maxEnergy');

    if (newMaxEnergy !== currentMaxEnergy) {
        player.setData('maxEnergy', newMaxEnergy);
        if (newMaxEnergy > currentMaxEnergy) {
            const diff = newMaxEnergy - currentMaxEnergy;
            const currentEnergy = player.getData('energy');
            player.setData('energy', currentEnergy + diff);
        }
    }
  });

  // --- 리사이즈 핸들러 ---
  const handleResize = () => {
    if (game) {
        game.scale.resize(window.innerWidth, window.innerHeight);
    }
  };

  const handleResumeGame = () => {
    setShowShopModal(false);
    if (game) {
        const scene = game.scene.getScene('MainScene');
        if (scene) scene.scene.resume();
    }
  };

  const handleRestartGame = () => {
    clearSkills();
    setCurrentScore(0);
    setCurrentLevel(1);
    setFinalScore(0);
    
    setShowGameOverModal(false);
    setShowShopModal(false);
    
    if (game) {
        const scene = game.scene.getScene('MainScene');
        if (scene) scene.scene.restart();
    }
  };

  // --- D-Pad 핸들러 ---
  const handleDpadTouch = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    if (e.type === 'touchend' || e.type === 'touchcancel') {
        if (virtualInput.active) {
            virtualInput = { x: 0, y: 0, active: false };
            syncInputToPhaser();
        }
        return;
    }

    const touch = e.touches[0];
    if (!touch || !dPadContainer) return;

    const rect = dPadContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;

    if (dx * dx + dy * dy < 100) { 
        if (virtualInput.active) {
            virtualInput = { x: 0, y: 0, active: false };
            syncInputToPhaser();
        }
        return;
    }

    const angle = Math.atan2(dy, dx);
    const sector = (Math.PI * 2) / 32; 
    const snappedAngle = Math.round(angle / sector) * sector;

    const vx = Math.cos(snappedAngle);
    const vy = Math.sin(snappedAngle);

    virtualInput = { x: vx, y: vy, active: true };
    syncInputToPhaser();
  };

  // --- 액션 버튼 핸들러 ---
  const handleActionTouch = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    if (e.type === 'touchstart') {
        isActionBtnPressed = true;
        // [추가] 씬에도 버튼 눌림 상태 전달
        if (game) {
             const scene = game.scene.getScene('MainScene');
             if (scene) scene.data.set('isActionBtnPressed', true);
        }
    } else if (e.type === 'touchend' || e.type === 'touchcancel') {
        isActionBtnPressed = false;
        // [추가] 씬에도 버튼 해제 상태 전달
        if (game) {
             const scene = game.scene.getScene('MainScene');
             if (scene) scene.data.set('isActionBtnPressed', false);
        }
    }
  };

  const syncInputToPhaser = () => {
    if (game) {
        const scene = game.scene.getScene('MainScene');
        if (scene) scene.data.set('virtualInput', virtualInput);
    }
  };

  // --- Lifecycle ---
  onCleanup(() => {
    window.removeEventListener('resize', handleResize);
    if (game) {
        game.destroy(true);
        game = null;
    }
  });

  onMount(async () => {
    const Phaser = await import('phaser');

    const config = {
      type: Phaser.AUTO,
      parent: gameContainer,
      width: window.innerWidth,
      height: window.innerHeight,
      roundPixels: true,
      pixelArt: true,
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false }
      },
      // [리팩토링] 이제 MainScene 클래스를 직접 사용합니다.
      scene: [MainScene] 
    };

    game = new Phaser.Game(config);
    window.addEventListener('resize', handleResize);

    // 게임 인스턴스 준비 후 콜백 연결
    game.events.on('ready', () => {
        const scene = game.scene.getScene('MainScene');
        
        // 1. SolidJS UI 업데이트 콜백 전달
        scene.data.set('openShopModal', (level, score) => {
            setCurrentLevel(level);
            setCurrentScore(score);
            setShowShopModal(true);
            scene.scene.pause();
        });

        scene.data.set('triggerGameOverModal', (score) => {
            setFinalScore(score);
            setShowGameOverModal(true);
        });

        scene.data.set('updateScoreUI', (score) => {
            setCurrentScore(score);
        });

        // 2. 초기 데이터 주입
        scene.data.set('skills', skills());
        scene.data.set('virtualInput', virtualInput);
        scene.data.set('isActionBtnPressed', isActionBtnPressed);
    });
  });

  const hasShockwaveSkill = () => skills().includes(Config.SHOCKWAVE_SKILL_ID);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div ref={gameContainer} style={{ width: '100%', height: '100%' }}></div>

      {/* 가상 D-Pad */}
      <div 
        className="d-pad-container" 
        ref={dPadContainer}
      >
        <div 
            className="d-pad-grid"
            onTouchStart={handleDpadTouch}
            onTouchMove={handleDpadTouch}
            onTouchEnd={handleDpadTouch}
            onTouchCancel={handleDpadTouch}
        >
            <div className={`d-pad-btn d-pad-up ${virtualInput.y < -0.5 ? 'active' : ''}`}>▲</div>
            <div className={`d-pad-btn d-pad-left ${virtualInput.x < -0.5 ? 'active' : ''}`}>◀</div>
            <div className={`d-pad-btn d-pad-right ${virtualInput.x > 0.5 ? 'active' : ''}`}>▶</div>
            <div className={`d-pad-btn d-pad-down ${virtualInput.y > 0.5 ? 'active' : ''}`}>▼</div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <Show when={hasShockwaveSkill()}>
        <div 
            className="action-btn-container"
            onTouchStart={handleActionTouch}
            onTouchEnd={handleActionTouch}
            onTouchCancel={handleActionTouch}
        >
            <div className={`action-btn ${isActionBtnPressed ? 'active' : ''}`}>⚡</div>
        </div>
      </Show>

      <ShopModal 
        isVisible={showShopModal()} 
        onClose={handleResumeGame} 
        level={currentLevel()} 
        skills={skills()} 
      />

      <GameOverModal
        isVisible={showGameOverModal()}
        score={finalScore()}
        onClose={handleRestartGame}
        onSave={(name) => console.log(`Saving score for: ${name}`)}
      />

      <style>{`
        .d-pad-container {
            display: none;
            position: absolute;
            bottom: 30px;
            right: 30px;
            z-index: 50;
            opacity: 0.7;
            touch-action: none;
        }
        .d-pad-grid {
            display: grid;
            grid-template-columns: 60px 60px 60px;
            grid-template-rows: 60px 60px 60px;
            gap: 0px;
            pointer-events: auto; 
        }
        .d-pad-btn {
            width: 60px; height: 60px;
            background-color: rgba(255, 255, 255, 0.3);
            border: 2px solid rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            color: white; font-size: 24px;
            display: flex; justify-content: center; align-items: center;
            user-select: none; 
            pointer-events: none;
        }
        .d-pad-btn.active {
            background-color: rgba(255, 255, 255, 0.6);
        }
        
        .d-pad-up    { grid-column: 2; grid-row: 1; }
        .d-pad-left  { grid-column: 1; grid-row: 2; }
        .d-pad-right { grid-column: 3; grid-row: 2; }
        .d-pad-down  { grid-column: 2; grid-row: 3; }

        /* Action Button */
        .action-btn-container {
            display: none;
            position: absolute;
            bottom: 40px;
            left: 40px;
            z-index: 50;
            opacity: 0.8;
            touch-action: none;
        }
        .action-btn {
            width: 80px; height: 80px;
            background-color: rgba(255, 100, 100, 0.5);
            border: 3px solid rgba(255, 200, 200, 0.8);
            border-radius: 50%;
            color: white; font-size: 40px;
            display: flex; justify-content: center; align-items: center;
            user-select: none; cursor: pointer;
            box-shadow: 0 0 10px rgba(255, 50, 50, 0.5);
        }
        .action-btn:active, .action-btn.active {
            background-color: rgba(255, 100, 100, 0.8);
            transform: scale(0.95);
        }

        @media only screen and (max-width: 900px) and (orientation: landscape) {
            .d-pad-container { display: block; }
            .action-btn-container { display: block; }
        }
      `}</style>
    </div>
  );
}