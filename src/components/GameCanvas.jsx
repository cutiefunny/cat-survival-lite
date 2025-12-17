import { onMount, onCleanup, createSignal, createEffect, Show } from 'solid-js';
import { useSkills } from './SkillsContext';

import ShopModal from './ShopModal';
import GameOverModal from './GameOverModal';
import * as Config from '../constants/GameConfig';
import MainScene from '../game/MainScene';

export default function GameCanvas(props) {
  const { skills, clearSkills } = useSkills();

  const [showShopModal, setShowShopModal] = createSignal(false);
  const [showGameOverModal, setShowGameOverModal] = createSignal(false);
  const [currentScore, setCurrentScore] = createSignal(0);
  const [currentLevel, setCurrentLevel] = createSignal(1);
  const [finalScore, setFinalScore] = createSignal(0);
  
  // [신규] 하악질 스킬 사용 가능 여부 (버튼 표시용)
  const [isShockwaveReady, setIsShockwaveReady] = createSignal(false);

  let isActionBtnPressed = false;
  let gameContainer;
  let game = null;

  createEffect(() => {
    const currentSkills = skills();

    if (!game) return;
    const scene = game.scene.getScene('MainScene');
    if (!scene || !scene.data) return;

    scene.data.set('skills', currentSkills);

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
    setIsShockwaveReady(false); // 재시작 시 버튼 숨김
    
    setShowGameOverModal(false);
    setShowShopModal(false);
    
    if (game) {
        const scene = game.scene.getScene('MainScene');
        if (scene) scene.scene.restart();
    }
  };

  const handleActionStart = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    isActionBtnPressed = true;
    if (game) {
        const scene = game.scene.getScene('MainScene');
        if (scene) scene.data.set('isActionBtnPressed', true);
    }
  };

  const handleActionEnd = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    isActionBtnPressed = false;
    if (game) {
        const scene = game.scene.getScene('MainScene');
        if (scene) scene.data.set('isActionBtnPressed', false);
    }
  };

  onCleanup(() => {
    window.removeEventListener('resize', handleResize);
    if (game) {
        game.destroy(true);
        game = null;
    }
  });

  onMount(async () => {
    const Phaser = await import('phaser');
    window.Phaser = Phaser.default || Phaser;

    const { default: VirtualJoystickPlugin } = await import('phaser3-rex-plugins/plugins/virtualjoystick-plugin.js');

    const config = {
      type: Phaser.AUTO,
      parent: gameContainer,
      width: window.innerWidth,
      height: window.innerHeight,
      // [수정] 픽셀 비율 1로 고정하여 호환성 확보
      resolution: 1,
      render: {
        pixelArt: true,
        roundPixels: true,
        precision: 'mediump', // 모바일에서 고정밀도 강제 설정
        antialias: false,
        powerPreference: 'high-performance'
      },
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false }
      },
      plugins: {
        global: [{
            key: 'rexVirtualJoystick',
            plugin: VirtualJoystickPlugin,
            start: true
        }]
      },
      scene: [MainScene] 
    };

    game = new Phaser.Game(config);
    window.addEventListener('resize', handleResize);

    game.events.on('ready', () => {
        const scene = game.scene.getScene('MainScene');
        
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

        // [신규] MainScene에서 React(Solid) UI 상태를 변경할 수 있도록 함수 전달
        scene.data.set('setShockwaveReady', (isReady) => {
            setIsShockwaveReady(isReady);
        });

        scene.data.set('skills', skills());
        scene.data.set('isActionBtnPressed', isActionBtnPressed);
    });
  });

  const hasShockwaveSkill = () => skills().includes(Config.SHOCKWAVE_SKILL_ID);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div ref={gameContainer} style={{ width: '100%', height: '100%' }}></div>

      {/* [수정] 스킬이 있고 && 준비 완료(쿨타임 끝) 상태일 때만 버튼 표시 */}
      <Show when={hasShockwaveSkill() && isShockwaveReady()}>
        <div 
            className="action-btn-container"
            onTouchStart={handleActionStart}
            onTouchEnd={handleActionEnd}
            onTouchCancel={handleActionEnd}
            onMouseDown={handleActionStart}
            onMouseUp={handleActionEnd}
            onMouseLeave={handleActionEnd}
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
        .action-btn-container {
            display: none;
            position: absolute;
            bottom: 40px;
            right: 40px; 
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
        @media (hover: none) and (pointer: coarse) {
            .action-btn-container { display: block; }
        }
      `}</style>
    </div>
  );
}