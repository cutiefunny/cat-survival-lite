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
    }

    create() {
        this.data.set('gameOver', false);
        this.physics.resume();

        // 타일 색상 초기화
        if (Config.TILE_COLORS.length === 0) {
            for (let i = 0; i < 10; i++) {
                const hue = Phaser.Math.FloatBetween(0.25, 0.40);
                const saturation = Phaser.Math.FloatBetween(0.1, 0.3);
                const lightness = Phaser.Math.FloatBetween(0.3, 0.4);
                Config.TILE_COLORS.push(Phaser.Display.Color.HSLToColor(hue, saturation, lightness).color);
            }
        }

        this.cameras.main.setBackgroundColor('#2d4c1e');
        this.physics.world.setBounds(0, 0, Config.WORLD_BOUNDS_SIZE, Config.WORLD_BOUNDS_SIZE);

        // 청크 텍스처 생성
        const chunkVariations = 4;
        const tempRT = this.make.renderTexture({ x: 0, y: 0, width: Config.CHUNK_SIZE_PX + 2, height: Config.CHUNK_SIZE_PX + 2, add: false }, false);
        for (let v = 0; v < chunkVariations; v++) {
            tempRT.clear();
            for (let x = 0; x < Config.CHUNK_DIMENSIONS; x++) {
                for (let y = 0; y < Config.CHUNK_DIMENSIONS; y++) {
                    const colorIndex = Phaser.Math.Between(0, Config.TILE_COLORS.length - 1);
                    const color = Config.TILE_COLORS[colorIndex];
                    tempRT.fill(color, 1, x * Config.TILE_SIZE, y * Config.TILE_SIZE, Config.TILE_SIZE + 1, Config.TILE_SIZE + 1);
                }
            }
            tempRT.saveTexture(`chunk_texture_${v}`);
        }
        tempRT.destroy();

        // 애니메이션 생성
        this.anims.create({ key: 'cat_walk', frames: this.anims.generateFrameNumbers('player_sprite', { start: 0, end: 2 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'mouse_walk', frames: this.anims.generateFrameNumbers('mouse_enemy_sprite', { start: 0, end: 1 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'dog_walk', frames: this.anims.generateFrameNumbers('dog_enemy_sprite', { start: 0, end: 1 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'fish_swim', frames: this.anims.generateFrameNumbers('fish_item_sprite', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'butterfly_fly', frames: this.anims.generateFrameNumbers('butterfly_sprite_3frame', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });

        // 플레이어 생성
        const player = this.physics.add.sprite(this.game.config.width / 2, this.game.config.height / 2, 'player_sprite');
        player.setDrag(500);
        player.setDepth(1);
        
        player.setData('level', 1);
        player.setData('experience', 0);
        player.setData('energy', Config.INITIAL_PLAYER_ENERGY);
        player.setData('maxEnergy', Config.INITIAL_PLAYER_ENERGY);
        player.setData('isInvincible', false); 
        
        const isMobile = this.sys.game.device.os.android || this.sys.game.device.os.iOS;
        this.data.set('isMobile', isMobile);
        const finalPlayerScale = 0.5 * (isMobile ? 0.7 : 1.0);
        player.setScale(finalPlayerScale);

        // UI Graphics
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

        const drawUI = () => {
            if (!player.active) return;
            const barX = player.x - (Config.ENERGY_BAR_WIDTH / 2);
            const energyY = player.y - (player.displayHeight / 2) - 20;
            const expY = energyY + Config.ENERGY_BAR_HEIGHT + 2;

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

        this.data.set('player', player);
        this.data.set('mice', this.physics.add.group());
        this.data.set('dogs', this.physics.add.group());
        this.data.set('fishItems', this.physics.add.group());
        this.data.set('butterflies', this.physics.add.group());
        this.data.set('generatedChunks', new Set());
        this.data.set('chunkGroup', this.add.group());
        this.data.set('cursors', this.input.keyboard.createCursorKeys());
        this.data.set('spaceKey', this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE));
        
        if (!this.data.has('skills')) {
             this.data.set('skills', []);
        }

        this.input.addPointer(2); 
        this.cameras.main.startFollow(player, true, 0.05, 0.05);
        this.generateSurroundingChunks(player.x, player.y);

        // -----------------------------------------------------
        // [충돌 및 상호작용 설정]
        // -----------------------------------------------------
        const mice = this.data.get('mice');
        const dogs = this.data.get('dogs');
        const fishItems = this.data.get('fishItems');
        const butterflies = this.data.get('butterflies');

        // 1. 플레이어 vs 적 (충돌 시 데미지)
        this.physics.add.collider(player, mice, this.hitMouse, null, this);
        this.physics.add.collider(player, dogs, this.hitDog, null, this);
        
        // 2. 적끼리 충돌 (겹침 방지)
        this.physics.add.collider(mice, mice);
        this.physics.add.collider(dogs, dogs);
        this.physics.add.collider(dogs, mice); // [추가] 강아지와 쥐도 서로 충돌

        // 3. 적 vs 아이템 (물리적 충돌 적용)
        // 아이템은 spawnEntity에서 setImmovable(true) 처리되어 밀리지 않음
        this.physics.add.collider(dogs, fishItems);
        this.physics.add.collider(mice, fishItems);
        this.physics.add.collider(dogs, butterflies);
        this.physics.add.collider(mice, butterflies);

        // 4. 플레이어 vs 아이템 (획득)
        this.physics.add.overlap(player, fishItems, this.collectFish, null, this);
        this.physics.add.overlap(player, butterflies, this.collectButterfly, null, this);
        
        // 스폰 타이머 설정
        this.time.addEvent({ delay: Config.MOUSE_SPAWN_INTERVAL_MS, callback: this.spawnMouseVillain, callbackScope: this, loop: true });
        this.time.addEvent({ delay: Config.DOG_SPAWN_INTERVAL_MS, callback: this.spawnDogVillain, callbackScope: this, loop: true });
        this.time.addEvent({ delay: Config.FISH_SPAWN_INTERVAL_MS, callback: this.spawnFishItem, callbackScope: this, loop: true });
        this.time.addEvent({ delay: Config.BUTTERFLY_SPAWN_INTERVAL_MS, callback: this.spawnButterflyVillain, callbackScope: this, loop: true });
    }

    update(time, delta) {
        if (this.data.get('gameOver')) return;
        
        const player = this.data.get('player');
        const cursors = this.data.get('cursors');
        const vInput = this.data.get('virtualInput') || { x: 0, y: 0, active: false };

        if (!player || !cursors) return;

        const drawUI = this.data.get('drawUI');
        if (drawUI) drawUI();

        const skills = this.data.get('skills') || [];
        const shockwaveCooldownText = this.data.get('shockwaveCooldownText');
        const hasShockwave = skills.includes(Config.SHOCKWAVE_SKILL_ID);
        let isShockwaveArmed = this.data.get('shockwaveArmed');
        
        let shockwaveTimer = this.data.get('shockwavePhaserEvent');
        if (hasShockwave && !shockwaveTimer) {
            this.data.set('shockwaveArmed', false);
            shockwaveTimer = this.time.addEvent({
                delay: Config.SHOCKWAVE_INTERVAL_MS,
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
                const isActionBtnPressed = this.data.get('isActionBtnPressed');

                const spaceKey = this.data.get('spaceKey');
                if (Phaser.Input.Keyboard.JustDown(spaceKey)) trigger = true;
                if (this.input.activePointer.rightButtonDown()) trigger = true;
                if (isMobile && isActionBtnPressed) trigger = true;

                if (trigger) {
                    this.triggerShockwave(player);
                    this.data.set('shockwaveArmed', false);
                    if (shockwaveTimer) shockwaveTimer.elapsed = 0;
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

        let speed = Config.BASE_PLAYER_SPEED;
        if (skills && skills.includes(21)) speed *= 1.1;

        let isMoving = false;
        const isKnockedBack = this.data.get('isKnockedBack');

        if (!isKnockedBack) {
            let moveX = 0;
            let moveY = 0;

            if (vInput.active) {
                moveX = vInput.x;
                moveY = vInput.y;
            } else {
                if (cursors.left.isDown) moveX -= 1;
                if (cursors.right.isDown) moveX += 1;
                if (cursors.up.isDown) moveY -= 1;
                if (cursors.down.isDown) moveY += 1;

                if (moveX !== 0 || moveY !== 0) {
                    const len = Math.sqrt(moveX * moveX + moveY * moveY);
                    moveX /= len;
                    moveY /= len;
                }
            }

            if (moveX === 0 && moveY === 0 && this.input.activePointer.isDown) {
                const targetX = this.input.activePointer.worldX;
                const targetY = this.input.activePointer.worldY;
                
                const isActionBtnPressed = this.data.get('isActionBtnPressed');
                if (!vInput.active && !isActionBtnPressed) {
                    this.physics.moveTo(player, targetX, targetY, speed);
                    
                    if (Phaser.Math.Distance.Squared(player.x, player.y, targetX, targetY) > 100) {
                        isMoving = true;
                        player.setFlipX(targetX > player.x);
                    } else {
                        player.setVelocity(0);
                    }
                }
            } else if (moveX !== 0 || moveY !== 0) {
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
                player.setFrame(0);
            }
        }

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

        const lastChunkUpdate = this.data.get('lastChunkUpdate');
        if (time - lastChunkUpdate > 200) { 
            this.generateSurroundingChunks(player.x, player.y);
            this.data.set('lastChunkUpdate', time);
        }
    }

    // --- Helper Methods ---

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
            // [중요] 아이템은 immovable: true가 되어야 밀리지 않음
            this.spawnEntity(items, 'fish_item_sprite', 'fish_swim', 0.4, true); 
        }
    }
    
    spawnButterflyVillain() { 
        if (this.data.get('gameOver')) return;
        const items = this.data.get('butterflies');
        if (Math.random() < Config.BUTTERFLY_SPAWN_PROBABILITY && items.countActive(true) < 1) {
            // 나비는 움직이지만, 충돌 시에는 벽처럼 작용하게 하여 밀리지 않게 함
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

            this.time.delayedCall(Config.KNOCKBACK_DURATION_MS, () => {
                this.data.set('isKnockedBack', false);
            });

            this.time.delayedCall(Config.PLAYER_INVINCIBILITY_DURATION_MS, () => {
                player.setData('isInvincible', false);
                player.setAlpha(1);
            });
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
            onComplete: () => {
                shockwaveCircle.destroy();
            }
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

    generateTileChunk(chunkX, chunkY) {
        const generatedChunks = this.data.get('generatedChunks');
        const chunkKey = `${chunkX}_${chunkY}`;
        if (generatedChunks.has(chunkKey)) return;
        generatedChunks.add(chunkKey);

        const startWorldX = chunkX * Config.CHUNK_SIZE_PX;
        const startWorldY = chunkY * Config.CHUNK_SIZE_PX;
        const randomTextureKey = `chunk_texture_${Phaser.Math.Between(0, 3)}`;

        const chunkGroup = this.data.get('chunkGroup');
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

    generateSurroundingChunks(worldX, worldY) {
        const currentChunkX = Math.floor(worldX / Config.CHUNK_SIZE_PX);
        const currentChunkY = Math.floor(worldY / Config.CHUNK_SIZE_PX);
        for (let i = currentChunkX - Config.GENERATION_BUFFER_CHUNKS; i <= currentChunkX + Config.GENERATION_BUFFER_CHUNKS; i++) {
            for (let j = currentChunkY - Config.GENERATION_BUFFER_CHUNKS; j <= currentChunkY + Config.GENERATION_BUFFER_CHUNKS; j++) {
                this.generateTileChunk(i, j);
            }
        }
        this.cleanupFarChunks(worldX, worldY);
    }

    cleanupFarChunks(playerX, playerY) {
        const chunkGroup = this.data.get('chunkGroup');
        const generatedChunks = this.data.get('generatedChunks');
        const cleanupDistance = Config.CHUNK_SIZE_PX * (Config.GENERATION_BUFFER_CHUNKS + 3);
        const cleanupDistanceSq = cleanupDistance * cleanupDistance; 

        chunkGroup.getChildren().forEach(child => {
            if (!child.active) return; 

            const distSq = Phaser.Math.Distance.Squared(playerX, playerY, child.x + Config.CHUNK_SIZE_PX / 2, child.y + Config.CHUNK_SIZE_PX / 2);
            if (distSq > cleanupDistanceSq) {
                const key = child.getData('chunkKey');
                if (key) generatedChunks.delete(key);
                chunkGroup.killAndHide(child); 
            }
        });
    }
}