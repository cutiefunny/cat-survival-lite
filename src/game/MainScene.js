import Phaser from 'phaser';
import * as Config from '../constants/GameConfig';
import levelSetting from '../assets/levelSetting.json';

// [신규] 스테이지 정보 파일 Import
import stageInfo from '../assets/stageInfo.json';

// [Vite Asset Import]
import stage1MapUrl from '../assets/maps/stage1.json?url';
import grassImgUrl from '../assets/tilesets/TX_Tileset_Grass.png?url';
import treeImgUrl from '../assets/tilesets/TX_Plant.png?url';

const levelExperience = levelSetting.levelExperience;

export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
    }

    preload() {
        this.load.spritesheet('player_sprite', '/images/cat_walk_3frame_sprite.png', { frameWidth: 100, frameHeight: 100 });
        this.load.image('cat_punch', '/images/cat_punch.png');
        this.load.image('cat_hit', '/images/cat_hit.png');
        this.load.spritesheet('mouse_enemy_sprite', '/images/mouse_2frame_sprite.png', { frameWidth: 100, frameHeight: 64 });
        this.load.spritesheet('dog_enemy_sprite', '/images/dog_2frame_horizontal.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('fish_item_sprite', '/images/fish_sprite_2frame.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('butterfly_sprite_3frame', '/images/butterfly_sprite_3frame.png', { frameWidth: 100, frameHeight: 83 });
        this.load.image('cat_cry', '/images/cat_cry.png');
        this.load.image('cat_haak', '/images/cat_haak.png');

        this.load.image('grass_img', grassImgUrl);
        this.load.image('tree_img', treeImgUrl);
        this.load.tilemapTiledJSON('stage1_map', stage1MapUrl);
    }

    create() {
        this.cameras.main.setBackgroundColor('#808080');
        this.data.set('gameOver', false);
        this.physics.resume();

        // [스테이지 변수 초기화]
        this.currentStage = 1;
        this.stageMiceKilled = 0;
        this.stageMiceTotal = 0;
        this.stageButterflySpawned = false; // [신규] 나비 중복 스폰 방지 플래그

        // 1. 맵 로드
        const map = this.make.tilemap({ key: 'stage1_map' });
        
        let grassTilesetName = 'tile_grass';
        let plantTilesetName = 'tile_tree';

        if (map.tilesets.length > 0) {
            grassTilesetName = map.tilesets[0].name;
            if (map.tilesets.length > 1) {
                plantTilesetName = map.tilesets[1].name;
            }
        }

        const grassTileset = map.addTilesetImage(grassTilesetName, 'grass_img');
        const plantTileset = map.addTilesetImage(plantTilesetName, 'tree_img');

        const groundLayer = map.createLayer('grass', grassTileset, 0, 0) || map.createLayer('Ground', grassTileset, 0, 0);
        const wallLayer = map.createLayer('Walls', plantTileset, 0, 0);

        if (wallLayer) {
            wallLayer.setCollisionByExclusion([-1]);
        }

        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

        // 2. 애니메이션
        this.anims.create({ key: 'cat_walk', frames: this.anims.generateFrameNumbers('player_sprite', { start: 0, end: 2 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'mouse_walk', frames: this.anims.generateFrameNumbers('mouse_enemy_sprite', { start: 0, end: 1 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'dog_walk', frames: this.anims.generateFrameNumbers('dog_enemy_sprite', { start: 0, end: 1 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'fish_swim', frames: this.anims.generateFrameNumbers('fish_item_sprite', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'butterfly_fly', frames: this.anims.generateFrameNumbers('butterfly_sprite_3frame', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });

        // 3. 플레이어
        const player = this.physics.add.sprite(map.widthInPixels / 2, map.heightInPixels / 2, 'player_sprite');
        if (wallLayer) this.physics.add.collider(player, wallLayer);
        player.setDrag(500);
        player.setDepth(1);
        player.setCollideWorldBounds(true);
        player.body.setSize(60, 50); 
        player.body.setOffset(20, 50);
        
        player.setData('level', 1);
        player.setData('experience', 0);
        player.setData('energy', Config.INITIAL_PLAYER_ENERGY);
        player.setData('maxEnergy', Config.INITIAL_PLAYER_ENERGY);
        player.setData('isInvincible', false); 
        
        const isMobile = this.sys.game.device.os.android || this.sys.game.device.os.iOS;
        this.data.set('isMobile', isMobile);
        const finalPlayerScale = 0.5 * (isMobile ? 0.7 : 1.0);
        player.setScale(finalPlayerScale);

        // --- 가상 조이스틱 ---
        if (isMobile) {
            this.joyStick = this.plugins.get('rexVirtualJoystick').add(this, {
                x: this.cameras.main.width - 120, 
                y: this.cameras.main.height - 120,
                radius: 60,
                base: this.add.circle(0, 0, 60, 0x888888, 0.5),
                thumb: this.add.circle(0, 0, 30, 0xcccccc, 0.8),
                dir: '8dir',
                forceMin: 16,
                fixed: true
            });
        }

        // 4. UI 설정
        const energyBarBg = this.add.graphics();
        const expBarBg = this.add.graphics();
        const energyBarFill = this.add.graphics();
        const expBarFill = this.add.graphics();
        
        energyBarBg.setScrollFactor(0);
        expBarBg.setScrollFactor(0);
        energyBarFill.setScrollFactor(0);
        expBarFill.setScrollFactor(0);
        
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

        const drawUI = () => {
            if (!player.active) return;
            const screenWidth = this.cameras.main.width;
            const barX = screenWidth / 2 - (Config.ENERGY_BAR_WIDTH / 2);
            const energyY = 20; 
            const expY = energyY + Config.ENERGY_BAR_HEIGHT + 5;

            // [체력 바]
            const currentEnergy = player.getData('energy');
            const maxEnergy = player.getData('maxEnergy');
            const energyPercent = Phaser.Math.Clamp(currentEnergy / maxEnergy, 0, 1);

            energyBarBg.clear();
            energyBarBg.fillStyle(0x000000, 0.5);
            energyBarBg.fillRect(barX, energyY, Config.ENERGY_BAR_WIDTH, Config.ENERGY_BAR_HEIGHT);

            energyBarFill.clear();
            energyBarFill.fillStyle(0x00ff00, 1);
            energyBarFill.fillRect(barX, energyY, Config.ENERGY_BAR_WIDTH * energyPercent, Config.ENERGY_BAR_HEIGHT);

            // [스테이지 진행도 바]
            const totalMice = this.stageMiceTotal || 1; 
            const killedMice = this.stageMiceKilled || 0;
            const progressPercent = Phaser.Math.Clamp(killedMice / totalMice, 0, 1);

            expBarBg.clear();
            expBarBg.fillStyle(0x000000, 0.5);
            expBarBg.fillRect(barX, expY, Config.EXP_BAR_WIDTH, Config.EXP_BAR_HEIGHT);

            expBarFill.clear();
            expBarFill.fillStyle(0xffff00, 1); 
            expBarFill.fillRect(barX, expY, Config.EXP_BAR_WIDTH * progressPercent, Config.EXP_BAR_HEIGHT);
        };

        this.data.set('drawUI', drawUI);
        drawUI(); 
        
        player.on('changedata-energy', drawUI);

        // 5. 오브젝트 및 입력
        this.data.set('player', player);
        const mice = this.physics.add.group();
        const dogs = this.physics.add.group();
        this.data.set('mice', mice);
        this.data.set('dogs', dogs);
        this.data.set('fishItems', this.physics.add.group());
        this.data.set('butterflies', this.physics.add.group());
        this.data.set('cursors', this.input.keyboard.createCursorKeys());
        this.data.set('spaceKey', this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE));
        
        if (!this.data.has('skills')) {
             this.data.set('skills', []);
        }

        this.input.addPointer(2); 
        this.cameras.main.startFollow(player, true, 0.05, 0.05);

        // 6. 충돌 및 스폰 이벤트
        const fishItems = this.data.get('fishItems');
        const butterflies = this.data.get('butterflies');

        if (wallLayer) {
            this.physics.add.collider(mice, wallLayer);
            this.physics.add.collider(dogs, wallLayer);
        }

        this.physics.add.collider(player, mice, this.hitMouse, null, this);
        this.physics.add.collider(player, dogs, this.hitDog, null, this);
        this.physics.add.collider(mice, mice);
        this.physics.add.collider(dogs, dogs);
        this.physics.add.collider(dogs, mice);
        this.physics.add.collider(dogs, fishItems);
        this.physics.add.collider(mice, fishItems);
        this.physics.add.collider(dogs, butterflies);
        this.physics.add.collider(mice, butterflies);
        this.physics.add.overlap(player, fishItems, this.collectFish, null, this);
        this.physics.add.overlap(player, butterflies, this.collectButterfly, null, this);
        
        // [수정] 랜덤 스폰 타이머 관리
        // 1. 고등어(Fish): 랜덤 생성 제거 (맵 지정 위치에서만 생성)
        // this.time.addEvent({ delay: Config.FISH_SPAWN_INTERVAL_MS, callback: this.spawnFishItem, ... }); // 제거됨

        // 2. 나비(Butterfly): 10초마다 10% 확률, 스테이지당 1마리 제한
        this.time.addEvent({ 
            delay: 10000, // 10초
            callback: () => {
                if (this.data.get('gameOver')) return;
                // 스테이지당 1마리 생성 여부 체크 && 10% 확률
                if (!this.stageButterflySpawned && Math.random() < 0.1) {
                    this.spawnButterflyVillain();
                    this.stageButterflySpawned = true; // 생성됨 표시
                }
            }, 
            callbackScope: this, 
            loop: true 
        });

        // 1스테이지 시작 (적 일괄 생성)
        this.startStage(this.currentStage);

        // [고등어 맵 스폰] 맵에 정의된 'fish' 위치에만 생성
        const spawnLayer = map.getObjectLayer('Spawns');
        if (spawnLayer && spawnLayer.objects) {
            spawnLayer.objects.forEach(obj => {
                if (obj.name === 'fish') {
                    // x, y 좌표를 전달하여 강제 생성
                    this.spawnFishItem(obj.x, obj.y);
                }
            });
        }

        this.game.events.emit('main-scene-ready', this);
    }

    startStage(stageNum) {
        console.log(`Starting Stage ${stageNum}`);
        
        // 정보 로드
        const stageData = stageInfo[stageNum] || { mouse: 20, dog: 10 };
        this.stageMiceTotal = stageData.mouse;
        const stageDogsTotal = stageData.dog;
        this.stageMiceKilled = 0; 
        
        // [신규] 나비 스폰 플래그 초기화 (새 스테이지마다 기회 제공)
        this.stageButterflySpawned = false;

        // 적 초기화 및 생성
        const mice = this.data.get('mice');
        const dogs = this.data.get('dogs');
        mice.clear(true, true);
        dogs.clear(true, true);

        for (let i = 0; i < this.stageMiceTotal; i++) {
            this.spawnEntity(mice, 'mouse_enemy_sprite', 'mouse_walk', 0.32);
        }
        for (let i = 0; i < stageDogsTotal; i++) {
            this.spawnEntity(dogs, 'dog_enemy_sprite', 'dog_walk', 0.5);
        }

        const drawUI = this.data.get('drawUI');
        if (drawUI) drawUI();
    }

    updateShockwaveUI(isReady) {
        const setShockwaveReady = this.data.get('setShockwaveReady');
        if (setShockwaveReady) {
            setShockwaveReady(isReady);
        }
    }

    update(time, delta) {
        if (this.data.get('gameOver')) return;
        
        const player = this.data.get('player');
        const cursors = this.data.get('cursors');

        if (!player || !cursors) return;

        // --- 스킬 쿨타임 로직 ---
        const skills = this.data.get('skills') || [];
        const hasShockwave = skills.includes(Config.SHOCKWAVE_SKILL_ID);
        const shockwaveCooldownText = this.data.get('shockwaveCooldownText');

        if (hasShockwave && this.data.get('shockwaveReady') === undefined) {
             this.data.set('shockwaveReady', false);
             this.updateShockwaveUI(false); 
             this.startShockwaveCooldown(Config.SHOCKWAVE_INTERVAL_MS || 10000);
        }

        if (hasShockwave && shockwaveCooldownText) {
             shockwaveCooldownText.setPosition(player.x, player.y - (player.displayHeight / 2) * player.scaleY - 40);
             shockwaveCooldownText.setVisible(true);
             
             const isReady = this.data.get('shockwaveReady');

             if (isReady) {
                 shockwaveCooldownText.setText('⚡');
                 let trigger = false;
                 
                 const spaceKey = this.data.get('spaceKey');
                 if (Phaser.Input.Keyboard.JustDown(spaceKey)) trigger = true;
                 if (this.input.activePointer.rightButtonDown()) trigger = true;
                 
                 const isActionBtnPressed = this.data.get('isActionBtnPressed');
                 if (isActionBtnPressed) trigger = true;

                 if (trigger) {
                     this.triggerShockwave(player);
                     this.data.set('shockwaveReady', false);
                     this.updateShockwaveUI(false); 
                     this.startShockwaveCooldown(Config.SHOCKWAVE_INTERVAL_MS || 10000);
                 }
             } else {
                 const timer = this.data.get('shockwaveTimerEvent');
                 if (timer) {
                     const remain = timer.getRemaining(); 
                     const remainSec = Math.ceil(remain / 1000);
                     shockwaveCooldownText.setText(remainSec);
                 }
             }
        } else if (shockwaveCooldownText) {
             shockwaveCooldownText.setVisible(false);
        }

        // --- 플레이어 이동 ---
        let speed = Config.BASE_PLAYER_SPEED;
        if (skills && skills.includes(21)) speed *= 1.1;

        let isMoving = false;
        const isKnockedBack = this.data.get('isKnockedBack');

        if (!isKnockedBack) {
            let moveX = 0;
            let moveY = 0;

            if (cursors.left.isDown) moveX -= 1;
            if (cursors.right.isDown) moveX += 1;
            if (cursors.up.isDown) moveY -= 1;
            if (cursors.down.isDown) moveY += 1;

            if (this.joyStick && this.joyStick.force > 0) {
                if (moveX === 0 && moveY === 0) {
                    const force = Math.min(this.joyStick.force, this.joyStick.radius) / this.joyStick.radius;
                    const rotation = this.joyStick.rotation;
                    moveX = Math.cos(rotation) * force;
                    moveY = Math.sin(rotation) * force;
                }
            }

            if (moveX !== 0 || moveY !== 0) {
                const len = Math.sqrt(moveX * moveX + moveY * moveY);
                if (len > 1) {
                    moveX /= len;
                    moveY /= len;
                }
                player.setVelocity(moveX * speed, moveY * speed);
                isMoving = true;
                player.setFlipX(moveX > 0);
            } else {
                player.setVelocity(0);
            }
        }

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
                player.setTexture('player_sprite'); 
                player.setFrame(0);
            }
        }

        // --- 적 AI 로직 (속도 다양화 적용) ---
        const mice = this.data.get('mice');
        mice.getChildren().forEach(mouse => {
            if (mouse.active && mouse.body) {
                const distSq = Phaser.Math.Distance.Squared(player.x, player.y, mouse.x, mouse.y);
                
                // [수정] 쥐마다 부여된 랜덤 속도 계수(speedFactor) 적용
                const baseSpeed = 70;
                const speedFactor = mouse.getData('speedFactor') || 1; 
                const finalSpeed = baseSpeed * speedFactor;

                if (distSq < Config.FLEE_RADIUS_SQ) {
                    const fleeX = mouse.x - (player.x - mouse.x);
                    const fleeY = mouse.y - (player.y - mouse.y);
                    this.physics.moveToObject(mouse, { x: fleeX, y: fleeY }, finalSpeed);
                } else if (distSq > Config.GATHERING_RADIUS_SQ) {
                    this.physics.moveToObject(mouse, player, finalSpeed);
                }
                mouse.setFlipX(mouse.body.velocity.x > 0);
            }
        });

        const dogs = this.data.get('dogs');
        dogs.getChildren().forEach(dog => {
            if (dog.active && dog.body && !dog.isKnockedBack && !dog.isStunned) {
                // [수정] 개마다 부여된 랜덤 속도 계수 적용
                const baseSpeed = Config.DOG_CHASE_SPEED;
                const speedFactor = dog.getData('speedFactor') || 1;
                const finalSpeed = baseSpeed * speedFactor;

                this.physics.moveToObject(dog, player, finalSpeed);
                dog.setFlipX(dog.body.velocity.x > 0);
            }
        });

        const butterflies = this.data.get('butterflies');
        butterflies.getChildren().forEach(bf => {
            if (bf.active && bf.body) {
                const distSq = Phaser.Math.Distance.Squared(player.x, player.y, bf.x, bf.y);
                if (distSq < 22500) { 
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
    }

    startShockwaveCooldown(duration) {
        const existingTimer = this.data.get('shockwaveTimerEvent');
        if (existingTimer) {
            existingTimer.remove();
        }

        const timer = this.time.addEvent({
            delay: duration,
            callback: () => {
                 this.data.set('shockwaveReady', true);
                 this.updateShockwaveUI(true); 
                 this.data.set('shockwaveTimerEvent', null);
            },
            callbackScope: this,
            loop: false 
        });
        
        this.data.set('shockwaveTimerEvent', timer);
    }

    spawnMouseVillain() {
        if (this.data.get('gameOver')) return;
        const mice = this.data.get('mice');
        this.spawnEntity(mice, 'mouse_enemy_sprite', 'mouse_walk', 0.32); 
    }

    spawnDogVillain() {
        if (this.data.get('gameOver')) return;
        const dogs = this.data.get('dogs');
        this.spawnEntity(dogs, 'dog_enemy_sprite', 'dog_walk', 0.5); 
    }

    spawnFishItem(x = null, y = null) { 
        if (this.data.get('gameOver')) return;
        const items = this.data.get('fishItems');
        // [수정] 랜덤 생성 로직 제거하고, 좌표가 있을 때만 생성
        if (x !== null && y !== null) {
            this.spawnEntity(items, 'fish_item_sprite', 'fish_swim', 0.4, true, x, y);
        }
    }
    
    spawnButterflyVillain() { 
        if (this.data.get('gameOver')) return;
        const items = this.data.get('butterflies');
        // 스테이지당 1마리 제한은 타이머에서 체크하므로 여기서는 생성만 담당
        const butterfly = this.spawnEntity(items, 'butterfly_sprite_3frame', 'butterfly_fly', 0.5, false);
        if (butterfly && butterfly.body) {
             butterfly.setImmovable(true);
        }
    }

    spawnEntity(group, spriteKey, animKey, scaleBase, isStatic = false, x = null, y = null) {
        const cam = this.cameras.main;
        const pad = 100;
        const worldBounds = this.physics.world.bounds;
        const boundMargin = 50; 
        
        if (x === null || y === null) {
            let attempts = 0;
            let validPosition = false;

            while (!validPosition && attempts < 10) {
                attempts++;
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
                x = Phaser.Math.Clamp(x, worldBounds.x + boundMargin, worldBounds.width - boundMargin);
                y = Phaser.Math.Clamp(y, worldBounds.y + boundMargin, worldBounds.height - boundMargin);
                validPosition = true; 
            }
        }

        const entity = group.get(x, y, spriteKey);
        if (!entity) return null;

        entity.setActive(true).setVisible(true);
        entity.enableBody(true, x, y, true, true);
        const isMobile = this.data.get('isMobile');
        const scaleFactor = isMobile ? 0.7 : 1.0;
        entity.setScale(scaleBase * scaleFactor);
        entity.play(animKey);

        // [신규] 빌런(동적 엔티티)에게 랜덤 속도 계수 부여 (0.8 ~ 1.2배)
        if (!isStatic) {
            entity.setData('speedFactor', Phaser.Math.FloatBetween(0.8, 1.2));
        }

        if (isStatic) {
            entity.setImmovable(true);
            entity.setCollideWorldBounds(false);
            if (entity.width) {
                 entity.body.setSize(entity.width * 0.6, entity.height * 0.6);
                 entity.body.setOffset(entity.width * 0.2, entity.height * 0.2);
            }
        } else {
            entity.setBounce(0.2);
            entity.setCollideWorldBounds(true);
            
            if (spriteKey === 'dog_enemy_sprite') {
                entity.body.setSize(70, 50);
                entity.body.setOffset(15, 50);
            } else if (spriteKey === 'mouse_enemy_sprite') {
                entity.body.setSize(60, 30);
                entity.body.setOffset(20, 34);
            }
        }
        return entity;
    }

    hitMouse(player, mouse) {
        if (this.data.get('gameOver')) return;
        const mice = this.data.get('mice');
        mice.killAndHide(mouse);
        mouse.disableBody(true, true);

        let score = this.data.get('score') || 0;
        score += 10;
        this.data.set('score', score);
        
        const updateScoreUI = this.data.get('updateScoreUI');
        if (updateScoreUI) updateScoreUI(score);

        this.stageMiceKilled += 1;

        const drawUI = this.data.get('drawUI');
        if (drawUI) drawUI();

        if (this.stageMiceKilled >= this.stageMiceTotal) {
            this.clearStage();
        }
    }

    clearStage() {
        console.log('Stage Cleared!');
        const openShopModal = this.data.get('openShopModal');
        if (openShopModal) {
            openShopModal(this.currentStage, this.data.get('score')); 
        }
        this.currentStage += 1;
        this.startStage(this.currentStage);
    }

    hitDog(player, dog) {
        if (this.data.get('gameOver')) return;
        if (player.getData('isInvincible')) return;

        const skills = this.data.get('skills') || [];
        const hasKnockbackSkill = skills.some(s => s >= 11 && s <= 19);
        const dotProduct = (dog.x - player.x) * (player.flipX ? -1 : 1);

        if (hasKnockbackSkill && dotProduct < 0) { 
            const dir = new Phaser.Math.Vector2(dog.x - player.x, dog.y - player.y).normalize().scale(Config.PLAYER_PUSH_BACK_FORCE);
            dog.setVelocity(dir.x, dir.y);
            dog.isKnockedBack = true;
            this.time.delayedCall(Config.KNOCKBACK_DURATION_MS, () => { dog.isKnockedBack = false; });
            player.setTexture('cat_punch');
            this.time.delayedCall(300, () => { player.setTexture('player_sprite'); player.play('cat_walk', true); });
        } else { 
            const dir = new Phaser.Math.Vector2(player.x - dog.x, player.y - dog.y).normalize().scale(Config.PLAYER_PUSH_BACK_FORCE);
            player.setVelocity(dir.x, dir.y);
            
            let energy = player.getData('energy') - 1;
            player.setData('energy', energy);
            
            if (energy <= 0) {
                this.endGame();
                return;
            }

            this.data.set('isKnockedBack', true);
            player.setData('isInvincible', true);
            player.setAlpha(0.5); 
            this.time.delayedCall(Config.KNOCKBACK_DURATION_MS, () => { this.data.set('isKnockedBack', false); });
            this.time.delayedCall(Config.PLAYER_INVINCIBILITY_DURATION_MS, () => { player.setData('isInvincible', false); player.setAlpha(1); });
        }
    }

    triggerShockwave(player) {
        if (!player || !player.active) return;

        player.setTexture('cat_haak');
        this.data.set('isHaak', true);
        
        this.time.delayedCall(500, () => { 
            this.data.set('isHaak', false); 
        }, [], this);

        const shockwaveCircle = this.add.circle(player.x, player.y, Config.SHOCKWAVE_RADIUS_START, Config.SHOCKWAVE_COLOR, 0.7);
        shockwaveCircle.setStrokeStyle(Config.SHOCKWAVE_LINE_WIDTH, Config.SHOCKWAVE_COLOR, 0.9);
        shockwaveCircle.setDepth(player.depth - 1);

        this.tweens.add({
            targets: shockwaveCircle,
            radius: Config.SHOCKWAVE_RADIUS_END,
            alpha: { from: 0.7, to: 0 },
            lineWidth: { from: Config.SHOCKWAVE_LINE_WIDTH, to: 0 },
            duration: Config.SHOCKWAVE_DURATION_MS,
            ease: 'Quad.easeOut',
            onComplete: () => { shockwaveCircle.destroy(); }
        });

        const targets = [...this.data.get('mice').getChildren(), ...this.data.get('dogs').getChildren()];
        targets.forEach(enemy => {
            if (enemy.active && enemy.body) {
                const distSq = Phaser.Math.Distance.Squared(player.x, player.y, enemy.x, enemy.y);
                const radiusSq = Config.SHOCKWAVE_RADIUS_END * Config.SHOCKWAVE_RADIUS_END;
                
                if (distSq <= radiusSq) {
                    const dir = new Phaser.Math.Vector2(enemy.x - player.x, enemy.y - player.y).normalize().scale(Config.SHOCKWAVE_PUSH_FORCE);
                    enemy.body.velocity.copy(dir);
                    if (enemy.texture.key.includes('dog')) { 
                        enemy.isKnockedBack = true;
                        this.time.delayedCall(Config.KNOCKBACK_DURATION_MS, () => { enemy.isKnockedBack = false; });
                    }
                }
            }
        });
    }

    collectFish(player, fish) {
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

    collectButterfly(player, butterfly) {
        if (this.data.get('gameOver')) return;
        const items = this.data.get('butterflies');
        items.killAndHide(butterfly);
        butterfly.disableBody(true, true);
        const maxEnergy = player.getData('maxEnergy');
        player.setData('energy', maxEnergy); 
    }

    endGame() {
        this.data.set('gameOver', true);
        const triggerEnd = this.data.get('triggerGameOverModal');
        const score = this.data.get('score') || 0;
        if (triggerEnd) triggerEnd(score);
        
        const player = this.data.get('player');
        if(player) {
            player.setTint(0xff0000); 
            player.anims.stop();
        }
        this.physics.pause();
        this.time.removeAllEvents();
    }
}