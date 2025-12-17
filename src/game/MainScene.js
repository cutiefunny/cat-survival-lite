import Phaser from 'phaser';
import * as Config from '../constants/GameConfig';
import levelSetting from '../assets/levelSetting.json';

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

        this.load.image('grass_img', '/assets/tilesets/TX_Tileset_Grass.png');
        this.load.image('tree_img', '/assets/tilesets/TX_Plant.png');
        this.load.tilemapTiledJSON('stage1_map', '/assets/maps/stage1.json');
    }

    create() {
        this.cameras.main.setBackgroundColor('#808080');

        this.data.set('gameOver', false);
        this.physics.resume();

        // 1. Tiled 맵 로드
        const map = this.make.tilemap({ key: 'stage1_map' });
        const grassTileset = map.addTilesetImage('tile_grass', 'grass_img');
        const plantTileset = map.addTilesetImage('tile_tree', 'tree_img');

        if (!grassTileset || !plantTileset) console.error("타일셋 로드 실패");

        const groundLayer = map.createLayer('grass', grassTileset, 0, 0);
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
        
        player.setData('level', 1);
        player.setData('experience', 0);
        player.setData('energy', Config.INITIAL_PLAYER_ENERGY);
        player.setData('maxEnergy', Config.INITIAL_PLAYER_ENERGY);
        player.setData('isInvincible', false); 
        
        const isMobile = this.sys.game.device.os.android || this.sys.game.device.os.iOS;
        this.data.set('isMobile', isMobile);
        const finalPlayerScale = 0.5 * (isMobile ? 0.7 : 1.0);
        player.setScale(finalPlayerScale);

        // --- 가상 조이스틱 (왼쪽 하단) ---
        if (isMobile) {
            this.joyStick = this.plugins.get('rexVirtualJoystick').add(this, {
                x: 120,
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

            const currentEnergy = player.getData('energy');
            const maxEnergy = player.getData('maxEnergy');
            const energyPercent = Phaser.Math.Clamp(currentEnergy / maxEnergy, 0, 1);

            energyBarBg.clear();
            energyBarBg.fillStyle(0x000000, 0.5);
            energyBarBg.fillRect(barX, energyY, Config.ENERGY_BAR_WIDTH, Config.ENERGY_BAR_HEIGHT);

            energyBarFill.clear();
            energyBarFill.fillStyle(0x00ff00, 1);
            energyBarFill.fillRect(barX, energyY, Config.ENERGY_BAR_WIDTH * energyPercent, Config.ENERGY_BAR_HEIGHT);

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
            expBarBg.fillRect(barX, expY, Config.EXP_BAR_WIDTH, Config.EXP_BAR_HEIGHT);

            expBarFill.clear();
            expBarFill.fillStyle(0xffff00, 1);
            expBarFill.fillRect(barX, expY, Config.EXP_BAR_WIDTH * expPercent, Config.EXP_BAR_HEIGHT);
        };

        this.data.set('drawUI', drawUI);
        drawUI(); 
        
        player.on('changedata-energy', drawUI);
        player.on('changedata-experience', drawUI);
        player.on('changedata-level', drawUI);

        // 5. 오브젝트 및 입력
        this.data.set('player', player);
        this.data.set('mice', this.physics.add.group());
        this.data.set('dogs', this.physics.add.group());
        this.data.set('fishItems', this.physics.add.group());
        this.data.set('butterflies', this.physics.add.group());
        this.data.set('cursors', this.input.keyboard.createCursorKeys());
        this.data.set('spaceKey', this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE));
        
        if (!this.data.has('skills')) {
             this.data.set('skills', []);
        }

        this.input.addPointer(2); 
        this.cameras.main.startFollow(player, true, 0.05, 0.05);

        // [DEBUG] 모바일 디버그용 텍스트 추가 (화면 좌측 상단)
        this.debugText = this.add.text(10, 80, 'Initializing Debug...', {
            fontSize: '14px',
            color: '#ffffff',
            backgroundColor: '#00000088', // 반투명 검은 배경
            stroke: '#000000',
            strokeThickness: 2,
            fontFamily: 'monospace'
        });
        this.debugText.setScrollFactor(0); // 카메라 따라 다니지 않게 고정
        this.debugText.setDepth(100);      // 가장 위에 표시

        // 6. 충돌
        const mice = this.data.get('mice');
        const dogs = this.data.get('dogs');
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
        
        this.time.addEvent({ delay: Config.MOUSE_SPAWN_INTERVAL_MS, callback: this.spawnMouseVillain, callbackScope: this, loop: true });
        this.time.addEvent({ delay: Config.DOG_SPAWN_INTERVAL_MS, callback: this.spawnDogVillain, callbackScope: this, loop: true });
        this.time.addEvent({ delay: Config.FISH_SPAWN_INTERVAL_MS, callback: this.spawnFishItem, callbackScope: this, loop: true });
        this.time.addEvent({ delay: Config.BUTTERFLY_SPAWN_INTERVAL_MS, callback: this.spawnButterflyVillain, callbackScope: this, loop: true });
    }

    // [신규] UI 업데이트 헬퍼 함수
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

        // 스킬 보유 시 초기화 로직
        if (hasShockwave && this.data.get('shockwaveReady') === undefined) {
             this.data.set('shockwaveReady', false);
             this.updateShockwaveUI(false); // [UI] 버튼 숨김
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
                     // 스킬 사용 후 쿨타임 시작 및 UI 숨김
                     this.data.set('shockwaveReady', false);
                     this.updateShockwaveUI(false); // [UI] 버튼 숨김
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

        // --- 이동 로직 ---
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

        // --- 적 AI 로직 ---
        const mice = this.data.get('mice');
        mice.getChildren().forEach(mouse => {
            if (mouse.active && mouse.body) {
                const distSq = Phaser.Math.Distance.Squared(player.x, player.y, mouse.x, mouse.y);
                const gatherSpeed = 70;
                if (distSq < Config.FLEE_RADIUS_SQ) {
                    const fleeX = mouse.x - (player.x - mouse.x);
                    const fleeY = mouse.y - (player.y - mouse.y);
                    this.physics.moveToObject(mouse, { x: fleeX, y: fleeY }, gatherSpeed);
                } else if (distSq > Config.GATHERING_RADIUS_SQ) {
                    this.physics.moveToObject(mouse, player, gatherSpeed);
                }
                mouse.setFlipX(mouse.body.velocity.x > 0);
            }
        });

        const dogs = this.data.get('dogs');
        dogs.getChildren().forEach(dog => {
            if (dog.active && dog.body && !dog.isKnockedBack && !dog.isStunned) {
                this.physics.moveToObject(dog, player, Config.DOG_CHASE_SPEED);
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

        // [DEBUG] 디버그 정보 실시간 업데이트
        if (this.debugText) {
            const player = this.data.get('player');
            const grassTex = this.textures.get('grass_img');
            const treeTex = this.textures.get('tree_img');
            const rendererType = this.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas';
            
            this.debugText.setText([
                `FPS: ${this.game.loop.actualFps.toFixed(1)}`,
                `Renderer: ${rendererType}`,
                `Mobile: ${this.data.get('isMobile')}`,
                `Screen: ${window.innerWidth} x ${window.innerHeight}`,
                `PixelRatio: ${window.devicePixelRatio}`,
                `Grass Tex: ${grassTex.key} (Valid: ${grassTex.key !== '__MISSING'})`,
                `Grass Size: ${grassTex.getSourceImage().width}x${grassTex.getSourceImage().height}`,
                `Tree Tex: ${treeTex.key} (Valid: ${treeTex.key !== '__MISSING'})`,
                `Player Pos: ${player ? Math.floor(player.x) + ',' + Math.floor(player.y) : 'N/A'}`
            ]);
        }
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
                 this.updateShockwaveUI(true); // [UI] 쿨타임 끝 -> 버튼 표시
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
        if (mice.countActive(true) >= Config.MAX_ACTIVE_MICE) return;
        this.spawnEntity(mice, 'mouse_enemy_sprite', 'mouse_walk', 0.32); 
    }

    spawnDogVillain() {
        if (this.data.get('gameOver')) return;
        const dogs = this.data.get('dogs');
        if (dogs.countActive(true) >= Config.MAX_ACTIVE_DOGS) return;
        this.spawnEntity(dogs, 'dog_enemy_sprite', 'dog_walk', 0.5); 
    }

    spawnFishItem() { 
        if (this.data.get('gameOver')) return;
        const items = this.data.get('fishItems');
        if (Math.random() < Config.FISH_SPAWN_PROBABILITY && items.countActive(true) < 2) {
            this.spawnEntity(items, 'fish_item_sprite', 'fish_swim', 0.4, true); 
        }
    }
    
    spawnButterflyVillain() { 
        if (this.data.get('gameOver')) return;
        const items = this.data.get('butterflies');
        if (Math.random() < Config.BUTTERFLY_SPAWN_PROBABILITY && items.countActive(true) < 1) {
            const butterfly = this.spawnEntity(items, 'butterfly_sprite_3frame', 'butterfly_fly', 0.5, false);
            if (butterfly && butterfly.body) {
                 butterfly.setImmovable(true);
            }
        }
    }

    spawnEntity(group, spriteKey, animKey, scaleBase, isStatic = false) {
        const cam = this.cameras.main;
        const pad = 100;
        let x, y;
        const worldBounds = this.physics.world.bounds;
        const boundMargin = 50; 
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

        const entity = group.get(x, y, spriteKey);
        if (!entity) return null;

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
            entity.setCollideWorldBounds(true);
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

        let exp = player.getData('experience') + 10;
        player.setData('experience', exp);
        
        const currentLvl = player.getData('level');
        const nextLvlExp = levelExperience[String(currentLvl + 1)];
        
        if (nextLvlExp !== undefined && exp >= nextLvlExp) {
            const newLevel = currentLvl + 1;
            player.setData('level', newLevel);
            const openShopModal = this.data.get('openShopModal');
            if (openShopModal) openShopModal(newLevel, score);
        }
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