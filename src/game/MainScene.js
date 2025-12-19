import Phaser from 'phaser';
import { fetchGameConfig } from '../utils/configUtils'; // DB 설정 로드 유틸
import levelSetting from '../assets/levelSetting.json';
import stageInfo from '../assets/stageInfo.json';

import stage1MapUrl from '../assets/maps/stage1.json?url';
import grassImgUrl from '../assets/tilesets/TX_Tileset_Grass.png?url';
import treeImgUrl from '../assets/tilesets/TX_Plant.png?url';

const levelExperience = levelSetting.levelExperience;

export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.config = {}; // 동적 설정을 담을 객체
        this.lastStaminaUseTime = 0; // 기력 사용 시점 기록용
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

    async create() {
        this.config = await fetchGameConfig();
        console.log("Loaded Game Config:", this.config);

        this.cameras.main.setBackgroundColor('#808080');
        this.data.set('gameOver', false);
        this.physics.resume();

        this.currentStage = 1;
        this.stageMiceKilled = 0;
        this.stageMiceTotal = 0;
        this.stageButterflySpawned = false; 
        this.data.set('isJumping', false);

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

        this.anims.create({ key: 'cat_walk', frames: this.anims.generateFrameNumbers('player_sprite', { start: 0, end: 2 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'mouse_walk', frames: this.anims.generateFrameNumbers('mouse_enemy_sprite', { start: 0, end: 1 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'dog_walk', frames: this.anims.generateFrameNumbers('dog_enemy_sprite', { start: 0, end: 1 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'fish_swim', frames: this.anims.generateFrameNumbers('fish_item_sprite', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'butterfly_fly', frames: this.anims.generateFrameNumbers('butterfly_sprite_3frame', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });

        const player = this.physics.add.sprite(map.widthInPixels / 2, map.heightInPixels / 2, 'player_sprite');
        
        this.wallCollider = null;
        if (wallLayer) {
            this.wallCollider = this.physics.add.collider(player, wallLayer);
        }

        player.setDrag(500); 
        player.setDepth(1);
        player.setCollideWorldBounds(true);
        player.body.setSize(60, 50); 
        player.body.setOffset(20, 50);
        
        player.setData('level', 1);
        player.setData('experience', 0);
        player.setData('energy', this.config.INITIAL_PLAYER_ENERGY);
        player.setData('maxEnergy', this.config.INITIAL_PLAYER_ENERGY);
        
        // [신규] 기력 초기화
        player.setData('stamina', this.config.PLAYER_MAX_STAMINA);
        player.setData('maxStamina', this.config.PLAYER_MAX_STAMINA);
        
        player.setData('isInvincible', false); 
        
        const isMobile = this.sys.game.device.os.android || this.sys.game.device.os.iOS;
        this.data.set('isMobile', isMobile);
        const finalPlayerScale = 0.5 * (isMobile ? 0.7 : 1.0);
        player.setScale(finalPlayerScale);
        player.setData('baseScale', finalPlayerScale); 

        if (isMobile) {
            const joyX = this.cameras.main.width - 120;
            const joyY = this.cameras.main.height - 120;
            const joyRadius = 60;

            this.joyStick = this.plugins.get('rexVirtualJoystick').add(this, {
                x: joyX, 
                y: joyY,
                radius: joyRadius,
                base: this.add.circle(0, 0, joyRadius, 0x888888, 0.5),
                thumb: this.add.circle(0, 0, 30, 0xcccccc, 0.8),
                dir: '8dir',
                forceMin: 16,
                fixed: true
            });

            this.input.on('pointerdown', (pointer) => {
                if (this.joyStick.pointer && this.joyStick.pointer.id === pointer.id) return;
                
                const screenX = pointer.x - this.cameras.main.scrollX;
                const screenY = pointer.y - this.cameras.main.scrollY;
                const dist = Phaser.Math.Distance.Between(screenX, screenY, joyX, joyY);
                if (dist <= joyRadius * 1.5) return; 

                this.data.set('wantToJump', true);
            });
        }

        const energyBarBg = this.add.graphics();
        const staminaBarBg = this.add.graphics(); // [신규] 기력바 배경
        const expBarBg = this.add.graphics();
        
        const energyBarFill = this.add.graphics();
        const staminaBarFill = this.add.graphics(); // [신규] 기력바 채움
        const expBarFill = this.add.graphics();
        
        // UI 그래픽스 설정
        [energyBarBg, staminaBarBg, expBarBg, energyBarFill, staminaBarFill, expBarFill].forEach(g => {
            g.setScrollFactor(0);
            g.setDepth(10);
        });

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
            
            // [UI 배치] 체력 -> 기력 -> 경험치 순서
            const barWidth = this.config.ENERGY_BAR_WIDTH;
            const barX = screenWidth / 2 - (barWidth / 2);
            
            const energyY = 20;
            const staminaY = energyY + this.config.ENERGY_BAR_HEIGHT + 4; // 체력바 바로 아래
            const expY = staminaY + this.config.STAMINA_BAR_HEIGHT + 4;   // 기력바 바로 아래

            // 1. Energy (Health)
            const currentEnergy = player.getData('energy');
            const maxEnergy = player.getData('maxEnergy');
            const energyPercent = Phaser.Math.Clamp(currentEnergy / maxEnergy, 0, 1);

            energyBarBg.clear();
            energyBarBg.fillStyle(0x000000, 0.5);
            energyBarBg.fillRect(barX, energyY, this.config.ENERGY_BAR_WIDTH, this.config.ENERGY_BAR_HEIGHT);

            energyBarFill.clear();
            energyBarFill.fillStyle(0x00ff00, 1);
            energyBarFill.fillRect(barX, energyY, this.config.ENERGY_BAR_WIDTH * energyPercent, this.config.ENERGY_BAR_HEIGHT);

            // 2. [신규] Stamina
            const currentStamina = player.getData('stamina');
            const maxStamina = player.getData('maxStamina');
            const staminaPercent = Phaser.Math.Clamp(currentStamina / maxStamina, 0, 1);

            staminaBarBg.clear();
            staminaBarBg.fillStyle(0x000000, 0.5);
            staminaBarBg.fillRect(barX, staminaY, this.config.STAMINA_BAR_WIDTH, this.config.STAMINA_BAR_HEIGHT);

            staminaBarFill.clear();
            staminaBarFill.fillStyle(this.config.STAMINA_BAR_COLOR, 1);
            staminaBarFill.fillRect(barX, staminaY, this.config.STAMINA_BAR_WIDTH * staminaPercent, this.config.STAMINA_BAR_HEIGHT);

            // 3. EXP
            const totalMice = this.stageMiceTotal || 1; 
            const killedMice = this.stageMiceKilled || 0;
            const progressPercent = Phaser.Math.Clamp(killedMice / totalMice, 0, 1);

            expBarBg.clear();
            expBarBg.fillStyle(0x000000, 0.5);
            expBarBg.fillRect(barX, expY, this.config.EXP_BAR_WIDTH, this.config.EXP_BAR_HEIGHT);

            expBarFill.clear();
            expBarFill.fillStyle(0xffff00, 1); 
            expBarFill.fillRect(barX, expY, this.config.EXP_BAR_WIDTH * progressPercent, this.config.EXP_BAR_HEIGHT);
        };

        this.data.set('drawUI', drawUI);
        drawUI(); 
        
        player.on('changedata-energy', drawUI);
        // [신규] 기력 변경 시에도 UI 다시 그리기
        player.on('changedata-stamina', drawUI);

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

        const fishItems = this.data.get('fishItems');
        const butterflies = this.data.get('butterflies');

        if (wallLayer) {
            this.physics.add.collider(mice, wallLayer);
            this.physics.add.collider(dogs, wallLayer);
        }

        this.physics.add.collider(player, mice, this.hitMouse, this.canPlayerCollide, this);
        this.physics.add.collider(player, dogs, this.hitDog, this.canPlayerCollide, this);
        this.physics.add.collider(mice, mice);
        this.physics.add.collider(dogs, dogs);
        this.physics.add.collider(dogs, mice);
        this.physics.add.collider(dogs, fishItems);
        this.physics.add.collider(mice, fishItems);
        this.physics.add.collider(dogs, butterflies);
        this.physics.add.collider(mice, butterflies);
        this.physics.add.overlap(player, fishItems, this.collectFish, null, this);
        this.physics.add.overlap(player, butterflies, this.collectButterfly, null, this);
        
        this.time.addEvent({ 
            delay: 10000,
            callback: () => {
                if (this.data.get('gameOver')) return;
                if (!this.stageButterflySpawned && Math.random() < 0.1) {
                    this.spawnButterflyVillain();
                    this.stageButterflySpawned = true; 
                }
            }, 
            callbackScope: this, 
            loop: true 
        });

        this.startStage(this.currentStage);

        const spawnLayer = map.getObjectLayer('Spawns');
        if (spawnLayer && spawnLayer.objects) {
            spawnLayer.objects.forEach(obj => {
                if (obj.name === 'fish') {
                    this.spawnFishItem(obj.x, obj.y);
                }
            });
        }

        this.game.events.emit('main-scene-ready', this);
    }

    startStage(stageNum) {
        console.log(`Starting Stage ${stageNum}`);
        
        const stageData = stageInfo[stageNum] || { mouse: 20, dog: 10 };
        this.stageMiceTotal = stageData.mouse;
        const stageDogsTotal = stageData.dog;
        this.stageMiceKilled = 0; 
        
        this.stageButterflySpawned = false;

        const mice = this.data.get('mice');
        const dogs = this.data.get('dogs');
        mice.clear(true, true);
        dogs.clear(true, true);

        for (let i = 0; i < this.stageMiceTotal; i++) {
            this.spawnEntity(mice, 'mouse_enemy_sprite', 'mouse_walk', 0.32);
        }

        const specialCount = Math.floor(stageDogsTotal * this.config.SPECIAL_DOG_RATIO);
        const ambushCount = Math.floor(stageDogsTotal * this.config.AMBUSH_DOG_RATIO);

        for (let i = 0; i < stageDogsTotal; i++) {
            const dog = this.spawnEntity(dogs, 'dog_enemy_sprite', 'dog_walk', 0.5);
            if (dog) {
                if (i < specialCount) {
                    dog.setData('isSpecial', true);
                    dog.setData('isAmbush', false);
                    dog.setTint(this.config.SPECIAL_DOG_TINT); 
                } else if (i < specialCount + ambushCount) {
                    dog.setData('isSpecial', false);
                    dog.setData('isAmbush', true);
                    dog.setData('ambushState', 'patrol'); 
                    dog.setData('patrolTarget', null);   
                    dog.setTint(this.config.AMBUSH_DOG_TINT); 
                } else {
                    dog.setData('isSpecial', false);
                    dog.setData('isAmbush', false);
                }
            }
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

    canPlayerCollide(player, enemy) {
        return !this.data.get('isJumping');
    }

    update(time, delta) {
        if (this.data.get('gameOver')) return;
        if (!this.config || Object.keys(this.config).length === 0) return;

        const player = this.data.get('player');
        const cursors = this.data.get('cursors');

        if (!player || !cursors) return;

        // [신규] 기력 회복 로직 (delta 이용)
        const now = this.time.now;
        if (now - this.lastStaminaUseTime > this.config.STAMINA_REGEN_DELAY_MS) {
            const currentStamina = player.getData('stamina');
            const maxStamina = this.config.PLAYER_MAX_STAMINA;
            if (currentStamina < maxStamina) {
                // 초당 회복량 * 경과 시간(초)
                const regenAmount = this.config.STAMINA_REGEN_RATE * (delta / 1000);
                const nextStamina = Math.min(maxStamina, currentStamina + regenAmount);
                player.setData('stamina', nextStamina);
            }
        }

        const skills = this.data.get('skills') || [];
        const hasShockwave = skills.includes(this.config.SHOCKWAVE_SKILL_ID);
        const shockwaveCooldownText = this.data.get('shockwaveCooldownText');

        if (hasShockwave && this.data.get('shockwaveReady') === undefined) {
             this.data.set('shockwaveReady', false);
             this.updateShockwaveUI(false); 
             this.startShockwaveCooldown(this.config.SHOCKWAVE_INTERVAL_MS || 10000);
        }

        let speed = this.config.BASE_PLAYER_SPEED;
        if (skills && skills.includes(21)) speed *= 1.1;

        const isKnockedBack = this.data.get('isKnockedBack');
        const isJumping = this.data.get('isJumping');
        let isMoving = false;

        if (!isKnockedBack && !isJumping) {
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
        } else if (isJumping) {
            if (player.body.velocity.length() > 10) {
                isMoving = true;
            }
        }

        let triggerAction = false;
        
        const spaceKey = this.data.get('spaceKey');
        if (Phaser.Input.Keyboard.JustDown(spaceKey)) triggerAction = true;
        
        if (this.data.get('wantToJump')) {
            triggerAction = true;
            this.data.set('wantToJump', false); 
        }
        
        const isActionBtnPressed = this.data.get('isActionBtnPressed');
        if (isActionBtnPressed) {
            triggerAction = true;
        }

        if (triggerAction) {
            if (hasShockwave) {
                if (shockwaveCooldownText) {
                    shockwaveCooldownText.setPosition(player.x, player.y - (player.displayHeight / 2) * player.scaleY - 40);
                    shockwaveCooldownText.setVisible(true);
                }

                const isReady = this.data.get('shockwaveReady');
                if (isReady) {
                    this.triggerShockwave(player);
                    this.data.set('shockwaveReady', false);
                    this.updateShockwaveUI(false); 
                    this.startShockwaveCooldown(this.config.SHOCKWAVE_INTERVAL_MS || 10000);
                }
            } else {
                if (!this.data.get('isJumping')) {
                    this.triggerJump(player);
                }
            }
        }

        if (hasShockwave && shockwaveCooldownText) {
             shockwaveCooldownText.setPosition(player.x, player.y - (player.displayHeight / 2) * player.scaleY - 40);
             shockwaveCooldownText.setVisible(true);
             const isReady = this.data.get('shockwaveReady');
             
             if (isReady) {
                 shockwaveCooldownText.setText('⚡');
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

        const isInvincible = player.getData('isInvincible');
        const isHaak = this.data.get('isHaak');
        
        if (isInvincible) {
            player.setTexture('cat_hit');
        } else if (isHaak) {
            player.setTexture('cat_haak');
        } else {
            if (isMoving && !isJumping) {
                player.anims.play('cat_walk', true);
            } else {
                player.anims.stop();
                if (!isJumping) player.setTexture('player_sprite'); 
                player.setFrame(0);
            }
        }

        const mice = this.data.get('mice');
        mice.getChildren().forEach(mouse => {
            if (mouse.active && mouse.body) {
                const distSq = Phaser.Math.Distance.Squared(player.x, player.y, mouse.x, mouse.y);
                const baseSpeed = 70;
                const speedFactor = mouse.getData('speedFactor') || 1; 
                const finalSpeed = baseSpeed * speedFactor;

                if (distSq < this.config.FLEE_RADIUS_SQ) {
                    const fleeX = mouse.x - (player.x - mouse.x);
                    const fleeY = mouse.y - (player.y - mouse.y);
                    this.physics.moveToObject(mouse, { x: fleeX, y: fleeY }, finalSpeed);
                } else if (distSq > this.config.GATHERING_RADIUS_SQ) {
                    this.physics.moveToObject(mouse, player, finalSpeed);
                }

                if (mouse.body.blocked.left || mouse.body.blocked.right) {
                    mouse.setVelocityY((player.y > mouse.y ? 1 : -1) * finalSpeed * 1.5);
                } else if (mouse.body.blocked.up || mouse.body.blocked.down) {
                    mouse.setVelocityX((player.x > mouse.x ? 1 : -1) * finalSpeed * 1.5);
                }

                mouse.setFlipX(mouse.body.velocity.x > 0);
            }
        });

        const dogs = this.data.get('dogs');
        const dogsArray = dogs.getChildren(); 

        dogsArray.forEach(dog => {
            if (dog.active && dog.body && !dog.isKnockedBack && !dog.isStunned) {
                const isSpecial = dog.getData('isSpecial'); 
                const isAmbush = dog.getData('isAmbush');
                const speedFactor = dog.getData('speedFactor') || 1;
                
                let finalSpeed = this.config.DOG_CHASE_SPEED * speedFactor; 
                let targetVec = null;
                let targetX = player.x; 
                let targetY = player.y;

                if (isSpecial) {
                    finalSpeed = this.config.BASE_PLAYER_SPEED * this.config.SPECIAL_DOG_SPEED_RATIO * speedFactor;
                    const predictTime = this.config.SPECIAL_DOG_PREDICT_TIME;
                    const futureX = player.x + (player.body.velocity.x * predictTime);
                    const futureY = player.y + (player.body.velocity.y * predictTime);
                    targetX = futureX;
                    targetY = futureY;
                    targetVec = new Phaser.Math.Vector2(futureX - dog.x, futureY - dog.y).normalize().scale(finalSpeed);
                }
                else if (isAmbush) {
                    const distToPlayer = Phaser.Math.Distance.Between(dog.x, dog.y, player.x, player.y);
                    let ambushState = dog.getData('ambushState');

                    if (ambushState === 'patrol') {
                        if (distToPlayer < this.config.AMBUSH_DETECT_RADIUS) {
                            ambushState = 'chase';
                            dog.setData('ambushState', 'chase');
                        }
                    } else if (ambushState === 'chase') {
                        if (distToPlayer > this.config.AMBUSH_RELEASE_RADIUS) {
                            ambushState = 'patrol';
                            dog.setData('ambushState', 'patrol');
                            dog.setData('patrolTarget', null); 
                        }
                    }

                    if (ambushState === 'chase') {
                        finalSpeed = this.config.DOG_CHASE_SPEED * speedFactor;
                        targetVec = new Phaser.Math.Vector2(player.x - dog.x, player.y - dog.y).normalize().scale(finalSpeed);
                    } else {
                        let patrolTarget = dog.getData('patrolTarget');
                        if (!patrolTarget || Phaser.Math.Distance.Between(dog.x, dog.y, patrolTarget.x, patrolTarget.y) < 50) {
                            let tx, ty, attempts = 0;
                            const minDist = this.config.AMBUSH_PATROL_MIN_DIST;
                            do {
                                tx = Phaser.Math.Between(0, this.physics.world.bounds.width);
                                ty = Phaser.Math.Between(0, this.physics.world.bounds.height);
                                attempts++;
                            } while (Phaser.Math.Distance.Between(tx, ty, player.x, player.y) < minDist && attempts < 10);
                            
                            patrolTarget = { x: tx, y: ty };
                            dog.setData('patrolTarget', patrolTarget);
                        }
                        
                        targetX = patrolTarget.x;
                        targetY = patrolTarget.y;
                        finalSpeed = this.config.DOG_CHASE_SPEED * speedFactor * this.config.AMBUSH_PATROL_SPEED_RATIO;
                        targetVec = new Phaser.Math.Vector2(patrolTarget.x - dog.x, patrolTarget.y - dog.y).normalize().scale(finalSpeed);
                    }
                }
                else {
                    finalSpeed = this.config.DOG_CHASE_SPEED * speedFactor;
                    targetVec = new Phaser.Math.Vector2(player.x - dog.x, player.y - dog.y).normalize().scale(finalSpeed);
                }

                const separationVec = new Phaser.Math.Vector2(0, 0);
                const separationRadius = this.config.DOG_SEPARATION_RADIUS; 
                
                dogsArray.forEach(otherDog => {
                    if (dog === otherDog || !otherDog.active) return;
                    
                    const distSq = Phaser.Math.Distance.Squared(dog.x, dog.y, otherDog.x, otherDog.y);
                    if (distSq < separationRadius * separationRadius) {
                        const dist = Math.sqrt(distSq);
                        const pushDir = new Phaser.Math.Vector2(dog.x - otherDog.x, dog.y - otherDog.y).normalize();
                        
                        const weight = (separationRadius - dist) / separationRadius;
                        pushDir.scale(weight * finalSpeed * this.config.DOG_SEPARATION_FORCE); 
                        separationVec.add(pushDir);
                    }
                });

                const finalVelocity = targetVec.add(separationVec);

                if (dog.body.blocked.left || dog.body.blocked.right) {
                    dog.setVelocityY((targetY > dog.y ? 1 : -1) * finalSpeed * 1.5);
                    finalVelocity.y = (targetY > dog.y ? 1 : -1) * finalSpeed * 1.5;
                } else if (dog.body.blocked.up || dog.body.blocked.down) {
                    dog.setVelocityX((targetX > dog.x ? 1 : -1) * finalSpeed * 1.5);
                    finalVelocity.x = (targetX > dog.x ? 1 : -1) * finalSpeed * 1.5;
                }

                if (finalVelocity.length() > finalSpeed * 1.5) { 
                    finalVelocity.normalize().scale(finalSpeed * 1.5);
                } else if (!dog.body.blocked.none && finalVelocity.length() > finalSpeed) {
                     finalVelocity.normalize().scale(finalSpeed);
                }

                dog.setVelocity(finalVelocity.x, finalVelocity.y);
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

    triggerJump(player) {
        if (this.data.get('isJumping')) return;
        
        const lastJumpTime = this.data.get('lastJumpTime') || 0;
        const now = this.time.now;
        if (now - lastJumpTime < this.config.JUMP_COOLDOWN_MS) return;

        // [신규] 기력 체크 및 소모
        const stamina = player.getData('stamina');
        if (stamina < this.config.STAMINA_JUMP_COST) {
            return; // 기력 부족 시 점프 불가
        }
        player.setData('stamina', stamina - this.config.STAMINA_JUMP_COST);
        this.lastStaminaUseTime = now; // 사용 시점 기록 -> 회복 대기시간 리셋

        this.data.set('isJumping', true);
        this.data.set('lastJumpTime', now);

        if (this.wallCollider) {
            this.wallCollider.active = false;
        }

        const body = player.body;
        if (body.velocity.length() > 10) {
             const currentVel = body.velocity.clone();
             const boost = this.config.JUMP_SPEED_MULTIPLIER;
             player.setVelocity(currentVel.x * boost, currentVel.y * boost);
        }
        
        player.setDrag(0);

        const originalScale = player.getData('baseScale');
        const jumpDuration = this.config.JUMP_DURATION_MS;
        const defaultOriginY = player.displayOriginY; 

        this.tweens.add({
            targets: player,
            displayOriginY: defaultOriginY + this.config.JUMP_HEIGHT_PIXEL, 
            scaleX: originalScale * 1.2, 
            scaleY: originalScale * 1.2,
            duration: jumpDuration / 2,
            yoyo: true, 
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.data.set('isJumping', false);
                player.setScale(originalScale);
                player.setOrigin(0.5, 0.5); 
                player.setDrag(500); 

                if (this.wallCollider) {
                    this.wallCollider.active = true;
                }
                
                this.physics.overlap(player, this.data.get('mice'), this.hitMouse, null, this);
                this.physics.overlap(player, this.data.get('dogs'), this.hitDog, null, this);
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
        if (x !== null && y !== null) {
            this.spawnEntity(items, 'fish_item_sprite', 'fish_swim', 0.4, true, x, y);
        }
    }
    
    spawnButterflyVillain() { 
        if (this.data.get('gameOver')) return;
        const items = this.data.get('butterflies');
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
            const dir = new Phaser.Math.Vector2(dog.x - player.x, dog.y - player.y).normalize().scale(this.config.PLAYER_PUSH_BACK_FORCE);
            dog.setVelocity(dir.x, dir.y);
            dog.isKnockedBack = true;
            this.time.delayedCall(this.config.KNOCKBACK_DURATION_MS, () => { dog.isKnockedBack = false; });
            player.setTexture('cat_punch');
            this.time.delayedCall(300, () => { player.setTexture('player_sprite'); player.play('cat_walk', true); });
        } else { 
            const dir = new Phaser.Math.Vector2(player.x - dog.x, player.y - dog.y).normalize().scale(this.config.PLAYER_PUSH_BACK_FORCE);
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
            this.time.delayedCall(this.config.KNOCKBACK_DURATION_MS, () => { this.data.set('isKnockedBack', false); });
            this.time.delayedCall(this.config.PLAYER_INVINCIBILITY_DURATION_MS, () => { player.setData('isInvincible', false); player.setAlpha(1); });
        }
    }

    triggerShockwave(player) {
        if (!player || !player.active) return;

        player.setTexture('cat_haak');
        this.data.set('isHaak', true);
        
        this.time.delayedCall(500, () => { 
            this.data.set('isHaak', false); 
        }, [], this);

        const shockwaveCircle = this.add.circle(player.x, player.y, this.config.SHOCKWAVE_RADIUS_START, this.config.SHOCKWAVE_COLOR, 0.7);
        shockwaveCircle.setStrokeStyle(this.config.SHOCKWAVE_LINE_WIDTH, this.config.SHOCKWAVE_COLOR, 0.9);
        shockwaveCircle.setDepth(player.depth - 1);

        this.tweens.add({
            targets: shockwaveCircle,
            radius: this.config.SHOCKWAVE_RADIUS_END,
            alpha: { from: 0.7, to: 0 },
            lineWidth: { from: this.config.SHOCKWAVE_LINE_WIDTH, to: 0 },
            duration: this.config.SHOCKWAVE_DURATION_MS,
            ease: 'Quad.easeOut',
            onComplete: () => { shockwaveCircle.destroy(); }
        });

        const targets = [...this.data.get('mice').getChildren(), ...this.data.get('dogs').getChildren()];
        targets.forEach(enemy => {
            if (enemy.active && enemy.body) {
                const distSq = Phaser.Math.Distance.Squared(player.x, player.y, enemy.x, enemy.y);
                const radiusSq = this.config.SHOCKWAVE_RADIUS_END * this.config.SHOCKWAVE_RADIUS_END;
                
                if (distSq <= radiusSq) {
                    const dir = new Phaser.Math.Vector2(enemy.x - player.x, enemy.y - player.y).normalize().scale(this.config.SHOCKWAVE_PUSH_FORCE);
                    enemy.body.velocity.copy(dir);
                    if (enemy.texture.key.includes('dog')) { 
                        enemy.isKnockedBack = true;
                        this.time.delayedCall(this.config.KNOCKBACK_DURATION_MS, () => { enemy.isKnockedBack = false; });
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