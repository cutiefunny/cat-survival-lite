import { onMount, onCleanup, createSignal, createEffect, Show } from 'solid-js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useSkills } from './SkillsContext';
import levelSetting from '../assets/levelSetting.json';

import ShopModal from './ShopModal';
import GameOverModal from './GameOverModal';

// --- [상수 정의] ---
const FLEE_RADIUS = 200;
const FLEE_RADIUS_SQ = FLEE_RADIUS * FLEE_RADIUS;
const GATHERING_RADIUS = 700;
const GATHERING_RADIUS_SQ = GATHERING_RADIUS * GATHERING_RADIUS;

const WORLD_BOUNDS_SIZE = 100000;
const TILE_SIZE = 32;
const CHUNK_DIMENSIONS = 20;
const CHUNK_SIZE_PX = CHUNK_DIMENSIONS * TILE_SIZE;
const GENERATION_BUFFER_CHUNKS = 2;

const INITIAL_PLAYER_ENERGY = 3;
const BASE_PLAYER_SPEED = 200;
const DOG_CHASE_SPEED = BASE_PLAYER_SPEED * 0.3;
const PLAYER_PUSH_BACK_FORCE = 300;
const KNOCKBACK_DURATION_MS = 250;
const PLAYER_INVINCIBILITY_DURATION_MS = 500;

const ENERGY_BAR_WIDTH = 60;
const ENERGY_BAR_HEIGHT = 8;
const EXP_BAR_WIDTH = 60;
const EXP_BAR_HEIGHT = 6;

const MOUSE_SPAWN_INTERVAL_MS = 1000;
const MAX_ACTIVE_MICE = 30;
const DOG_SPAWN_INTERVAL_MS = 2000;
const MAX_ACTIVE_DOGS = 20;
const FISH_SPAWN_INTERVAL_MS = 5000;
const FISH_SPAWN_PROBABILITY = 0.3;
const BUTTERFLY_SPAWN_INTERVAL_MS = 1000;
const BUTTERFLY_SPAWN_PROBABILITY = 0.1;

const SHOCKWAVE_SKILL_ID = 51;
const SHOCKWAVE_INTERVAL_MS = 10000;
const SHOCKWAVE_RADIUS_START = 20;
const SHOCKWAVE_RADIUS_END = 300;
const SHOCKWAVE_DURATION_MS = 500;
const SHOCKWAVE_PUSH_FORCE = 500;
const SHOCKWAVE_COLOR = 0xADD8E6;
const SHOCKWAVE_LINE_WIDTH = 10;

const levelExperience = levelSetting.levelExperience;
const TILE_COLORS = []; 

export default function GameCanvas(props) {
  const { skills, clearSkills } = useSkills();

  const [showShopModal, setShowShopModal] = createSignal(false);
  const [showGameOverModal, setShowGameOverModal] = createSignal(false);
  const [currentScore, setCurrentScore] = createSignal(0);
  const [currentLevel, setCurrentLevel] = createSignal(1);
  const [finalScore, setFinalScore] = createSignal(0);

  // [수정] 가상 컨트롤러 상태를 벡터(Vector) 형태로 변경
  // x, y: 이동 방향 (-1.0 ~ 1.0), active: 터치 중 여부
  let virtualInput = { x: 0, y: 0, active: false };

  let gameContainer;
  let dPadContainer;
  let game = null;

  // --- 핸들러 ---
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

  // [수정] 32방향 벡터 기반 터치 핸들러
  const handleDpadTouch = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    // 터치 종료 시
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

    // 데드존 (중심에서 10px 이내 무시)
    if (dx * dx + dy * dy < 100) {
        if (virtualInput.active) {
            virtualInput = { x: 0, y: 0, active: false };
            syncInputToPhaser();
        }
        return;
    }

    // 1. 각도 계산 (라디안)
    const angle = Math.atan2(dy, dx);

    // 2. 32방향 스냅 (Snap)
    // 360도(2*PI)를 32로 나눈 간격
    const sector = (Math.PI * 2) / 32; 
    // 현재 각도를 가장 가까운 32분할 각도로 반올림
    const snappedAngle = Math.round(angle / sector) * sector;

    // 3. 이동 벡터 계산
    const vx = Math.cos(snappedAngle);
    const vy = Math.sin(snappedAngle);

    // 상태 업데이트
    virtualInput = { x: vx, y: vy, active: true };
    syncInputToPhaser();
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
      scene: { key: 'MainScene', preload, create, update }
    };

    game = new Phaser.Game(config);
    window.addEventListener('resize', handleResize);
  });

  createEffect(() => {
    const currentSkills = skills(); 
    if (game && game.scene.getScene('MainScene')) {
        const scene = game.scene.getScene('MainScene');
        scene.data.set('skills', currentSkills);
    }
  });

  // =================================================================
  // [Phaser Scene Logic]
  // =================================================================

  function preload() {
    this.load.spritesheet('player_sprite', '/images/cat_walk_3frame_sprite.png', { frameWidth: 100, frameHeight: 100 });
    this.load.image('cat_punch', '/images/cat_punch.png');
    this.load.image('cat_hit', '/images/cat_hit.png');
    this.load.spritesheet('mouse_enemy_sprite', '/images/mouse_2frame_sprite.png', { frameWidth: 100, frameHeight: 64 });
    this.load.spritesheet('dog_enemy_sprite', '/images/dog_2frame_horizontal.png', { frameWidth: 100, frameHeight: 100 });
    this.load.spritesheet('fish_item_sprite', '/images/fish_sprite_2frame.png', { frameWidth: 100, frameHeight: 100 });
    this.load.spritesheet('butterfly_sprite_3frame', '/images/butterfly_sprite_3frame.png', { frameWidth: 100, frameHeight: 83 });
    this.load.image('cat_cry', '/images/cat_cry.png');
    this.load.image('cat_haak', '/images/cat_haak.png');
  }

  function create() {
    this.data.set('gameOver', false);
    this.physics.resume();

    if (TILE_COLORS.length === 0) {
      for (let i = 0; i < 10; i++) {
        const hue = Phaser.Math.FloatBetween(0.25, 0.40);
        const saturation = Phaser.Math.FloatBetween(0.1, 0.3);
        const lightness = Phaser.Math.FloatBetween(0.3, 0.4);
        TILE_COLORS.push(Phaser.Display.Color.HSLToColor(hue, saturation, lightness).color);
      }
    }

    this.cameras.main.setBackgroundColor('#2d4c1e');
    this.physics.world.setBounds(0, 0, WORLD_BOUNDS_SIZE, WORLD_BOUNDS_SIZE);

    // 텍스처 캐싱
    const chunkVariations = 4;
    const tempRT = this.make.renderTexture({ x: 0, y: 0, width: CHUNK_SIZE_PX + 2, height: CHUNK_SIZE_PX + 2, add: false }, false);
    for (let v = 0; v < chunkVariations; v++) {
      tempRT.clear();
      for (let x = 0; x < CHUNK_DIMENSIONS; x++) {
        for (let y = 0; y < CHUNK_DIMENSIONS; y++) {
          const colorIndex = Phaser.Math.Between(0, TILE_COLORS.length - 1);
          const color = TILE_COLORS[colorIndex];
          tempRT.fill(color, 1, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE + 1, TILE_SIZE + 1);
        }
      }
      tempRT.saveTexture(`chunk_texture_${v}`);
    }
    tempRT.destroy();

    this.anims.create({ key: 'cat_walk', frames: this.anims.generateFrameNumbers('player_sprite', { start: 0, end: 2 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'mouse_walk', frames: this.anims.generateFrameNumbers('mouse_enemy_sprite', { start: 0, end: 1 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'dog_walk', frames: this.anims.generateFrameNumbers('dog_enemy_sprite', { start: 0, end: 1 }), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'fish_swim', frames: this.anims.generateFrameNumbers('fish_item_sprite', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
    this.anims.create({ key: 'butterfly_fly', frames: this.anims.generateFrameNumbers('butterfly_sprite_3frame', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });

    const player = this.physics.add.sprite(this.game.config.width / 2, this.game.config.height / 2, 'player_sprite');
    player.setDrag(500);
    player.setDepth(1);
    
    player.setData('level', 1);
    player.setData('experience', 0);
    player.setData('energy', INITIAL_PLAYER_ENERGY);
    player.setData('maxEnergy', INITIAL_PLAYER_ENERGY);
    player.setData('isInvincible', false); 
    
    const isMobile = this.sys.game.device.os.android || this.sys.game.device.os.iOS;
    this.data.set('isMobile', isMobile);
    const finalPlayerScale = 0.5 * (isMobile ? 0.7 : 1.0);
    player.setScale(finalPlayerScale);

    // UI 그래픽스
    const energyBarBg = this.add.graphics();
    const expBarBg = this.add.graphics();
    const energyBarFill = this.add.graphics();
    const expBarFill = this.add.graphics();
    
    energyBarBg.setDepth(10);
    energyBarFill.setDepth(10);
    expBarBg.setDepth(10);
    expBarFill.setDepth(10);

    const shockwaveCooldownText = this.add.text(player.x, player.y, '', {
        fontSize: '18px', color: '#FFFF00', stroke: '#000000', strokeThickness: 4, align: 'center', fontStyle: 'bold'
    });
    shockwaveCooldownText.setOrigin(0.5, 1.5);
    shockwaveCooldownText.setDepth(11);
    shockwaveCooldownText.setVisible(false);
    this.data.set('shockwaveCooldownText', shockwaveCooldownText);

    // UI 그리기 함수
    const drawUI = () => {
        const barX = player.x - (ENERGY_BAR_WIDTH / 2);
        const energyY = player.y - (player.displayHeight / 2) - 20;
        const expY = energyY + ENERGY_BAR_HEIGHT + 2;

        const currentEnergy = player.getData('energy');
        const maxEnergy = player.getData('maxEnergy');
        const energyPercent = Phaser.Math.Clamp(currentEnergy / maxEnergy, 0, 1);

        energyBarBg.clear();
        energyBarBg.fillStyle(0x000000, 0.5);
        energyBarBg.fillRect(barX, energyY, ENERGY_BAR_WIDTH, ENERGY_BAR_HEIGHT);

        energyBarFill.clear();
        energyBarFill.fillStyle(0x00ff00, 1);
        energyBarFill.fillRect(barX, energyY, ENERGY_BAR_WIDTH * energyPercent, ENERGY_BAR_HEIGHT);

        const currentExp = player.getData('experience');
        const currentLvl = player.getData('level');
        const nextLvlExp = levelExperience[String(currentLvl + 1)] || 999999;
        const prevLvlExp = levelExperience[String(currentLvl)] || 0;
        
        let expPercent = 0;
        if (nextLvlExp > prevLvlExp) {
            expPercent = (currentExp - prevLvlExp) / (nextLvlExp - prevLvlExp);
        }
        expPercent = Phaser.Math.Clamp(expPercent, 0, 1);

        expBarBg.clear();
        expBarBg.fillStyle(0x000000, 0.5);
        expBarBg.fillRect(barX, expY, EXP_BAR_WIDTH, EXP_BAR_HEIGHT);

        expBarFill.clear();
        expBarFill.fillStyle(0xffff00, 1);
        expBarFill.fillRect(barX, expY, EXP_BAR_WIDTH * expPercent, EXP_BAR_HEIGHT);
    };

    this.data.set('drawUI', drawUI);
    drawUI(); 
    
    player.on('changedata-energy', drawUI);
    player.on('changedata-experience', drawUI);
    player.on('changedata-level', drawUI);

    this.data.set('player', player);
    this.data.set('mice', this.physics.add.group());
    this.data.set('dogs', this.physics.add.group());
    this.data.set('fishItems', this.physics.add.group());
    this.data.set('butterflies', this.physics.add.group());
    this.data.set('generatedChunks', new Set());
    this.data.set('chunkGroup', this.add.group());
    this.data.set('cursors', this.input.keyboard.createCursorKeys());
    this.data.set('spaceKey', this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE));
    
    // 데이터 초기화
    this.data.set('virtualInput', { x: 0, y: 0, active: false });
    this.data.set('lastChunkUpdate', 0);
    this.data.set('skills', skills()); 
    
    this.input.addPointer(2); 
    this.cameras.main.startFollow(player, true, 0.05, 0.05);
    generateSurroundingChunks.call(this, player.x, player.y);

    this.physics.add.collider(player, this.data.get('mice'), hitMouse, null, this);
    this.physics.add.collider(player, this.data.get('dogs'), hitDog, null, this);
    this.physics.add.collider(this.data.get('mice'), this.data.get('mice'));
    this.physics.add.collider(this.data.get('dogs'), this.data.get('dogs'));
    this.physics.add.overlap(player, this.data.get('fishItems'), collectFish, null, this);
    this.physics.add.overlap(player, this.data.get('butterflies'), collectButterfly, null, this);
    
    this.time.addEvent({ delay: MOUSE_SPAWN_INTERVAL_MS, callback: spawnMouseVillain, callbackScope: this, loop: true });
    this.time.addEvent({ delay: DOG_SPAWN_INTERVAL_MS, callback: spawnDogVillain, callbackScope: this, loop: true });
    this.time.addEvent({ delay: FISH_SPAWN_INTERVAL_MS, callback: spawnFishItem, callbackScope: this, loop: true });
    this.time.addEvent({ delay: BUTTERFLY_SPAWN_INTERVAL_MS, callback: spawnButterflyVillain, callbackScope: this, loop: true });

    this.data.set('openShopModal', (level, score) => {
      setShowShopModal(true);
      setCurrentScore(score);
      setCurrentLevel(level);
      this.scene.pause();
    });

    this.data.set('triggerGameOverModal', (score) => {
      setShowGameOverModal(true);
      setFinalScore(score);
    });
  }

  function update(time, delta) {
    if (this.data.get('gameOver')) return;
    
    const player = this.data.get('player');
    const cursors = this.data.get('cursors');
    // 가상 입력 확인 (벡터)
    const vInput = this.data.get('virtualInput') || { x: 0, y: 0, active: false };

    if (!player || !cursors) return;

    // UI 위치 업데이트
    const drawUI = this.data.get('drawUI');
    if (drawUI) drawUI();

    // --- 스킬 쿨타임 UI ---
    const skills = this.data.get('skills');
    const shockwaveCooldownText = this.data.get('shockwaveCooldownText');
    const hasShockwave = skills.includes(SHOCKWAVE_SKILL_ID);
    let isShockwaveArmed = this.data.get('shockwaveArmed');
    
    let shockwaveTimer = this.data.get('shockwavePhaserEvent');
    if (hasShockwave && !shockwaveTimer) {
        this.data.set('shockwaveArmed', false);
        shockwaveTimer = this.time.addEvent({
            delay: SHOCKWAVE_INTERVAL_MS,
            callback: () => {
                if (player.active && !this.data.get('gameOver')) {
                    this.data.set('shockwaveArmed', true);
                }
            },
            loop: true
        });
        this.data.set('shockwavePhaserEvent', shockwaveTimer);
    }

    if (hasShockwave && shockwaveCooldownText) {
        shockwaveCooldownText.setPosition(player.x, player.y - (player.displayHeight / 2) * player.scaleY - 40);
        
        if (isShockwaveArmed) {
            shockwaveCooldownText.setText('⚡');
            shockwaveCooldownText.setVisible(true);
            
            let trigger = false;
            const isMobile = this.data.get('isMobile');
            
            if (isMobile) {
                // D-Pad 외의 영역 멀티터치
                const p1 = this.input.pointer1.isDown;
                const p2 = this.input.pointer2.isDown;
                const wasTwoFinger = this.data.get('wasTwoFingerDown');
                if (p1 && p2 && !wasTwoFinger) trigger = true;
                this.data.set('wasTwoFingerDown', p1 && p2);
            } else {
                const spaceKey = this.data.get('spaceKey');
                if (Phaser.Input.Keyboard.JustDown(spaceKey)) trigger = true;
                if (this.input.activePointer.rightButtonDown()) trigger = true;
            }

            if (trigger) {
                triggerShockwave.call(this, player);
                this.data.set('shockwaveArmed', false);
                if (shockwaveTimer) shockwaveTimer.elapsed = 0;
                if (isMobile) this.data.set('wasTwoFingerDown', false);
            }
        } else if (shockwaveTimer) {
            const remain = shockwaveTimer.getRemaining();
            if (remain > 0) {
                shockwaveCooldownText.setText(Math.ceil(remain / 1000));
                shockwaveCooldownText.setVisible(true);
            } else {
                shockwaveCooldownText.setText('⚡');
            }
        }
    } else {
        if (shockwaveCooldownText) shockwaveCooldownText.setVisible(false);
    }

    // --- [이동 로직 개선] 키보드 + 32방향 가상 조이스틱 통합 ---
    let speed = BASE_PLAYER_SPEED;
    if (skills && skills.includes(21)) speed *= 1.1;

    let isMoving = false;
    const isKnockedBack = this.data.get('isKnockedBack');

    if (!isKnockedBack) {
        let moveX = 0;
        let moveY = 0;

        // 1. 가상 조이스틱 (우선순위)
        if (vInput.active) {
            moveX = vInput.x;
            moveY = vInput.y;
        } else {
            // 2. 키보드 입력 -> 벡터 변환
            if (cursors.left.isDown) moveX -= 1;
            if (cursors.right.isDown) moveX += 1;
            if (cursors.up.isDown) moveY -= 1;
            if (cursors.down.isDown) moveY += 1;

            // 정규화 (대각선 속도 보정)
            if (moveX !== 0 || moveY !== 0) {
                const len = Math.sqrt(moveX * moveX + moveY * moveY);
                moveX /= len;
                moveY /= len;
            }
        }

        // 3. 마우스/터치 (화면 직접 터치)
        if (moveX === 0 && moveY === 0 && this.input.activePointer.isDown) {
             // D-Pad를 쓰고 있지 않을 때만
             const targetX = this.input.activePointer.worldX;
             const targetY = this.input.activePointer.worldY;
             
             // 거리가 가까우면 멈춤
             if (Phaser.Math.Distance.Between(player.x, player.y, targetX, targetY) > 10) {
                 this.physics.moveTo(player, targetX, targetY, speed);
                 isMoving = true;
                 player.setFlipX(targetX > player.x);
             } else {
                 player.setVelocity(0);
             }
        } else if (moveX !== 0 || moveY !== 0) {
            // 키보드/조이스틱 이동 적용
            player.setVelocity(moveX * speed, moveY * speed);
            isMoving = true;
            player.setFlipX(moveX > 0); // 우측 이동 시 반전
        } else {
            player.setVelocity(0);
        }
    }

    // [UX] 애니메이션 우선순위
    const isInvincible = player.getData('isInvincible');
    const isHaak = this.data.get('isHaak');

    if (isInvincible) {
        player.setTexture('cat_hit');
    } else if (isHaak) {
        player.setTexture('cat_haak');
    } else {
        if (isMoving) {
            player.anims.play('cat_walk', true);
        } else {
            player.anims.stop();
            player.setFrame(0);
        }
    }

    // --- AI 로직 ---
    const mice = this.data.get('mice');
    mice.getChildren().forEach(mouse => {
        if (mouse.active && mouse.body) {
            const distSq = Phaser.Math.Distance.Squared(player.x, player.y, mouse.x, mouse.y);
            const gatherSpeed = 70;

            if (distSq < FLEE_RADIUS_SQ) {
                const fleeX = mouse.x - (player.x - mouse.x);
                const fleeY = mouse.y - (player.y - mouse.y);
                this.physics.moveToObject(mouse, { x: fleeX, y: fleeY }, gatherSpeed);
            } else if (distSq > GATHERING_RADIUS_SQ) {
                this.physics.moveToObject(mouse, player, gatherSpeed);
            }
            mouse.setFlipX(mouse.body.velocity.x > 0);
        }
    });

    const dogs = this.data.get('dogs');
    dogs.getChildren().forEach(dog => {
        if (dog.active && dog.body && !dog.isKnockedBack && !dog.isStunned) {
            this.physics.moveToObject(dog, player, DOG_CHASE_SPEED);
            dog.setFlipX(dog.body.velocity.x > 0);
            
            dogs.getChildren().forEach(otherDog => {
                if (dog !== otherDog && otherDog.active) {
                    const dist = Phaser.Math.Distance.Between(dog.x, dog.y, otherDog.x, otherDog.y);
                    if (dist < 60) {
                        const push = new Phaser.Math.Vector2(dog.x - otherDog.x, dog.y - otherDog.y).normalize().scale(50);
                        dog.body.velocity.add(push);
                    }
                }
            });
        }
    });

    const butterflies = this.data.get('butterflies');
    butterflies.getChildren().forEach(bf => {
        if (bf.active && bf.body) {
            const dist = Phaser.Math.Distance.Between(player.x, player.y, bf.x, bf.y);
            if (dist < 150) { 
                const dir = new Phaser.Math.Vector2(bf.x - player.x, bf.y - player.y).normalize();
                bf.body.velocity.x = dir.x * 100;
                bf.body.velocity.y = dir.y * 100;
                bf.setData('moveTimer', 0);
            } else { 
                let timer = bf.getData('moveTimer') || 0;
                timer += delta;
                if (timer > (bf.getData('nextMoveTime') || 500)) {
                    this.physics.velocityFromAngle(Phaser.Math.Between(0, 360), Phaser.Math.Between(50, 150), bf.body.velocity);
                    bf.setData('moveTimer', 0);
                    bf.setData('nextMoveTime', Phaser.Math.Between(200, 800));
                }
                bf.setData('moveTimer', timer);
            }
            bf.setFlipX(bf.body.velocity.x < 0);
        }
    });

    // [최적화 2] 청크 업데이트 쓰로틀링
    const lastChunkUpdate = this.data.get('lastChunkUpdate');
    if (time - lastChunkUpdate > 200) { 
        generateSurroundingChunks.call(this, player.x, player.y);
        this.data.set('lastChunkUpdate', time);
    }
  }

  // --- Helper Functions (생략 없이 포함) ---
  function spawnMouseVillain() {
    if (this.data.get('gameOver')) return;
    const mice = this.data.get('mice');
    if (mice.countActive(true) >= MAX_ACTIVE_MICE) return;
    spawnEntity.call(this, mice, 'mouse_enemy_sprite', 'mouse_walk', 0.32); 
  }

  function spawnDogVillain() {
    if (this.data.get('gameOver')) return;
    const dogs = this.data.get('dogs');
    if (dogs.countActive(true) >= MAX_ACTIVE_DOGS) return;
    spawnEntity.call(this, dogs, 'dog_enemy_sprite', 'dog_walk', 0.5); 
  }

  function spawnFishItem() { 
    if (this.data.get('gameOver')) return;
    const items = this.data.get('fishItems');
    if (Math.random() < FISH_SPAWN_PROBABILITY && items.countActive(true) < 2) {
        spawnEntity.call(this, items, 'fish_item_sprite', 'fish_swim', 0.4, true); 
    }
  }
  
  function spawnButterflyVillain() { 
    if (this.data.get('gameOver')) return;
    const items = this.data.get('butterflies');
    if (Math.random() < BUTTERFLY_SPAWN_PROBABILITY && items.countActive(true) < 1) {
        spawnEntity.call(this, items, 'butterfly_sprite_3frame', 'butterfly_fly', 0.5); 
    }
  }

  function spawnEntity(group, spriteKey, animKey, scaleBase, isStatic = false) {
    const cam = this.cameras.main;
    const pad = 100;
    let x, y;
    
    if (isStatic) { 
        x = Phaser.Math.Between(cam.worldView.left, cam.worldView.right);
        y = Phaser.Math.Between(cam.worldView.top, cam.worldView.bottom);
    } else { 
        const side = Phaser.Math.Between(0, 3);
        if (side === 0) { x = Phaser.Math.Between(cam.scrollX, cam.scrollX + cam.width); y = cam.scrollY - pad; }
        else if (side === 1) { x = Phaser.Math.Between(cam.scrollX, cam.scrollX + cam.width); y = cam.scrollY + cam.height + pad; }
        else if (side === 2) { x = cam.scrollX - pad; y = Phaser.Math.Between(cam.scrollY, cam.scrollY + cam.height); }
        else { x = cam.scrollX + cam.width + pad; y = Phaser.Math.Between(cam.scrollY, cam.scrollY + cam.height); }
    }

    const entity = group.get(x, y, spriteKey);
    if (!entity) return;

    entity.setActive(true).setVisible(true);
    entity.enableBody(true, x, y, true, true);
    
    const isMobile = this.data.get('isMobile');
    const scaleFactor = isMobile ? 0.7 : 1.0;
    entity.setScale(scaleBase * scaleFactor);
    
    entity.play(animKey);
    if (isStatic) {
        entity.setImmovable(true);
        entity.setCollideWorldBounds(false);
    } else {
        entity.setBounce(0.2);
    }
  }

  function hitMouse(player, mouse) {
    if (this.data.get('gameOver')) return;
    
    const mice = this.data.get('mice');
    mice.killAndHide(mouse);
    mouse.disableBody(true, true);

    let score = this.data.get('score') || 0;
    score += 10;
    this.data.set('score', score);
    setCurrentScore(score); 

    let exp = player.getData('experience') + 10;
    player.setData('experience', exp);
    
    const currentLvl = player.getData('level');
    const nextLvlExp = levelExperience[String(currentLvl + 1)];
    
    if (nextLvlExp !== undefined && exp >= nextLvlExp) {
        const newLevel = currentLvl + 1;
        player.setData('level', newLevel);
        setCurrentLevel(newLevel);
        
        const openShop = this.data.get('openShopModal');
        openShop(newLevel, score);
    }
  }

  function hitDog(player, dog) {
    if (this.data.get('gameOver')) return;
    if (player.getData('isInvincible')) return;

    const skills = this.data.get('skills');
    const hasKnockbackSkill = skills.some(s => s >= 11 && s <= 19);
    
    const dotProduct = (dog.x - player.x) * (player.flipX ? -1 : 1);

    if (hasKnockbackSkill && dotProduct < 0) { 
        const dir = new Phaser.Math.Vector2(dog.x - player.x, dog.y - player.y).normalize().scale(PLAYER_PUSH_BACK_FORCE);
        dog.setVelocity(dir.x, dir.y);
        dog.isKnockedBack = true;
        this.time.delayedCall(KNOCKBACK_DURATION_MS, () => { dog.isKnockedBack = false; });
        
        player.setTexture('cat_punch');
        this.time.delayedCall(300, () => { player.setTexture('player_sprite'); player.play('cat_walk', true); });
        
    } else { 
        const dir = new Phaser.Math.Vector2(player.x - dog.x, player.y - dog.y).normalize().scale(PLAYER_PUSH_BACK_FORCE);
        player.setVelocity(dir.x, dir.y);
        
        let energy = player.getData('energy') - 1;
        player.setData('energy', energy);
        
        if (energy <= 0) {
            endGame.call(this);
            return;
        }

        this.data.set('isKnockedBack', true);
        player.setData('isInvincible', true);
        player.setAlpha(0.5); 

        this.time.delayedCall(KNOCKBACK_DURATION_MS, () => {
            this.data.set('isKnockedBack', false);
        });

        this.time.delayedCall(PLAYER_INVINCIBILITY_DURATION_MS, () => {
            player.setData('isInvincible', false);
            player.setAlpha(1);
        });
    }
  }

  function triggerShockwave(player) {
    if (!player || !player.active) return;

    player.setTexture('cat_haak');
    this.data.set('isHaak', true);
    this.time.delayedCall(500, () => {
        this.data.set('isHaak', false);
    }, [], this);

    const shockwaveCircle = this.add.circle(player.x, player.y, SHOCKWAVE_RADIUS_START, SHOCKWAVE_COLOR, 0.7);
    shockwaveCircle.setStrokeStyle(SHOCKWAVE_LINE_WIDTH, SHOCKWAVE_COLOR, 0.9);
    shockwaveCircle.setDepth(player.depth - 1);

    this.tweens.add({
        targets: shockwaveCircle,
        radius: SHOCKWAVE_RADIUS_END,
        alpha: { from: 0.7, to: 0 },
        lineWidth: { from: SHOCKWAVE_LINE_WIDTH, to: 0 },
        duration: SHOCKWAVE_DURATION_MS,
        ease: 'Quad.easeOut',
        onComplete: () => {
            shockwaveCircle.destroy();
        }
    });

    const targets = [...this.data.get('mice').getChildren(), ...this.data.get('dogs').getChildren()];
    targets.forEach(enemy => {
        if (enemy.active && enemy.body) {
            const dist = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
            if (dist <= SHOCKWAVE_RADIUS_END) {
                const dir = new Phaser.Math.Vector2(enemy.x - player.x, enemy.y - player.y).normalize().scale(SHOCKWAVE_PUSH_FORCE);
                enemy.body.velocity.copy(dir);
                if (enemy.texture.key.includes('dog')) { 
                    enemy.isKnockedBack = true;
                    this.time.delayedCall(KNOCKBACK_DURATION_MS, () => { enemy.isKnockedBack = false; });
                }
            }
        }
    });
  }

  function collectFish(player, fish) {
    if (this.data.get('gameOver')) return;
    const items = this.data.get('fishItems');
    items.killAndHide(fish);
    fish.disableBody(true, true);

    let energy = player.getData('energy');
    const maxEnergy = player.getData('maxEnergy');
    if (energy < maxEnergy) {
        player.setData('energy', energy + 1);
    }
  }

  function collectButterfly(player, butterfly) {
    if (this.data.get('gameOver')) return;
    const items = this.data.get('butterflies');
    items.killAndHide(butterfly);
    butterfly.disableBody(true, true);

    const maxEnergy = player.getData('maxEnergy');
    player.setData('energy', maxEnergy); 
  }

  function endGame() {
    this.data.set('gameOver', true);
    const triggerEnd = this.data.get('triggerGameOverModal');
    triggerEnd(this.data.get('score'));
    
    // 게임 오버 처리
    const player = this.data.get('player');
    if(player) {
        player.setTint(0xff0000); 
        player.anims.stop();
    }
    
    this.physics.pause();
    this.time.removeAllEvents();
  }

  // [최적화 3] 청크 오브젝트 풀링
  function generateTileChunk(chunkX, chunkY) {
    const generatedChunks = this.data.get('generatedChunks');
    const chunkKey = `${chunkX}_${chunkY}`;
    if (generatedChunks.has(chunkKey)) return;
    generatedChunks.add(chunkKey);

    const startWorldX = chunkX * CHUNK_SIZE_PX;
    const startWorldY = chunkY * CHUNK_SIZE_PX;
    const randomTextureKey = `chunk_texture_${Phaser.Math.Between(0, 3)}`;

    const chunkGroup = this.data.get('chunkGroup');
    // 사용하지 않는 객체 재활용
    let chunkImage = chunkGroup.getFirstDead(false);

    if (!chunkImage) {
        chunkImage = this.add.image(startWorldX, startWorldY, randomTextureKey);
        chunkImage.setOrigin(0, 0);
        chunkImage.setDepth(0);
        chunkGroup.add(chunkImage);
    } else {
        chunkImage.setTexture(randomTextureKey);
        chunkImage.setPosition(startWorldX, startWorldY);
        chunkImage.setActive(true);
        chunkImage.setVisible(true);
    }
    
    chunkImage.setData('chunkKey', chunkKey);
  }

  function generateSurroundingChunks(worldX, worldY) {
    const currentChunkX = Math.floor(worldX / CHUNK_SIZE_PX);
    const currentChunkY = Math.floor(worldY / CHUNK_SIZE_PX);
    for (let i = currentChunkX - GENERATION_BUFFER_CHUNKS; i <= currentChunkX + GENERATION_BUFFER_CHUNKS; i++) {
      for (let j = currentChunkY - GENERATION_BUFFER_CHUNKS; j <= currentChunkY + GENERATION_BUFFER_CHUNKS; j++) {
        generateTileChunk.call(this, i, j);
      }
    }
    cleanupFarChunks.call(this, worldX, worldY);
  }

  function cleanupFarChunks(playerX, playerY) {
    const chunkGroup = this.data.get('chunkGroup');
    const generatedChunks = this.data.get('generatedChunks');
    const cleanupDistance = CHUNK_SIZE_PX * (GENERATION_BUFFER_CHUNKS + 3);

    chunkGroup.getChildren().forEach(child => {
      if (!child.active) return; 

      const dist = Phaser.Math.Distance.Between(playerX, playerY, child.x + CHUNK_SIZE_PX / 2, child.y + CHUNK_SIZE_PX / 2);
      if (dist > cleanupDistance) {
        const key = child.getData('chunkKey');
        if (key) generatedChunks.delete(key);
        // 비활성화 (풀링 반납)
        chunkGroup.killAndHide(child); 
      }
    });
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div ref={gameContainer} style={{ width: '100%', height: '100%' }}></div>

      {/* --- 가상 D-Pad (모바일 가로 모드) --- */}
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
            <div className={`d-pad-btn d-pad-up`}>▲</div>
            <div className={`d-pad-btn d-pad-left`}>◀</div>
            <div className={`d-pad-btn d-pad-right`}>▶</div>
            <div className={`d-pad-btn d-pad-down`}>▼</div>
        </div>
      </div>

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
            pointer-events: none; /* 컨테이너로 터치 전달 */
        }
        
        .d-pad-up    { grid-column: 2; grid-row: 1; }
        .d-pad-left  { grid-column: 1; grid-row: 2; }
        .d-pad-right { grid-column: 3; grid-row: 2; }
        .d-pad-down  { grid-column: 2; grid-row: 3; }

        @media only screen and (max-width: 900px) and (orientation: landscape) {
            .d-pad-container { display: block; }
        }
      `}</style>
    </div>
  );
}