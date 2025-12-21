import Phaser from 'phaser';

export default class PlayerManager {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.player = null;
        this.lastStaminaUseTime = 0;
        this.wallCollider = null;
    }

    createPlayer(map, wallLayer, blockLayer) {
        this.player = this.scene.physics.add.sprite(map.widthInPixels / 2, map.heightInPixels / 2, 'player_sprite');
        
        // 1. Wall 충돌 (점프 시 통과)
        if (wallLayer) {
            this.wallCollider = this.scene.physics.add.collider(
                this.player, 
                wallLayer, 
                null, // collideCallback (충돌 후 처리)
                (player, tile) => { // processCallback (충돌 여부 결정)
                    // 점프 중이면 충돌 무시 (false 반환)
                    if (this.player.getData('isJumping')) return false;
                    return true;
                }, 
                this
            );
        }

        // 2. [신규] Block 충돌 (절대 못 지나감)
        if (blockLayer) {
            this.blockCollider = this.scene.physics.add.collider(this.player, blockLayer);
        }

        this.player.setDrag(500); 
        this.player.setDepth(1);
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(60, 50); 
        this.player.body.setOffset(20, 50);
        
        // 데이터 초기화
        this.player.setData('level', 1);
        this.player.setData('experience', 0);
        this.player.setData('energy', this.config.INITIAL_PLAYER_ENERGY);
        this.player.setData('maxEnergy', this.config.INITIAL_PLAYER_ENERGY);
        this.player.setData('stamina', this.config.PLAYER_MAX_STAMINA);
        this.player.setData('maxStamina', this.config.PLAYER_MAX_STAMINA);
        this.player.setData('isInvincible', false); 
        
        const isMobile = this.scene.data.get('isMobile');
        const finalPlayerScale = 0.5 * (isMobile ? 0.7 : 1.0);
        this.player.setScale(finalPlayerScale);
        this.player.setData('baseScale', finalPlayerScale); 

        this.scene.cameras.main.startFollow(this.player, true, 0.05, 0.05);
        this.scene.data.set('player', this.player);

        this._setupInputs();

        return this.player;
    }

    _setupInputs() {
        this.scene.data.set('cursors', this.scene.input.keyboard.createCursorKeys());
        this.scene.data.set('spaceKey', this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE));
        this.scene.input.addPointer(2);

        if (this.scene.data.get('isMobile')) {
            const joyX = this.scene.cameras.main.width - 120;
            const joyY = this.scene.cameras.main.height - 120;
            const joyRadius = 60;

            this.joyStick = this.scene.plugins.get('rexVirtualJoystick').add(this.scene, {
                x: joyX, y: joyY, radius: joyRadius,
                base: this.scene.add.circle(0, 0, joyRadius, 0x888888, 0.5),
                thumb: this.scene.add.circle(0, 0, 30, 0xcccccc, 0.8),
                dir: '8dir', forceMin: 16, fixed: true
            });

            this.scene.input.on('pointerdown', (pointer) => {
                if (this.joyStick.pointer && this.joyStick.pointer.id === pointer.id) return;
                const screenX = pointer.x - this.scene.cameras.main.scrollX;
                const screenY = pointer.y - this.scene.cameras.main.scrollY;
                if (Phaser.Math.Distance.Between(screenX, screenY, joyX, joyY) <= joyRadius * 1.5) return; 
                this.scene.data.set('wantToJump', true);
            });
        }
    }

    update(time, delta) {
        if (!this.player || !this.player.active) return;

        this._updateStamina(delta);
        this._updateMovement();
        this._handleAction();
        this._updateAnimation();
    }

    _updateStamina(delta) {
        const now = this.scene.time.now;
        if (now - this.lastStaminaUseTime > this.config.STAMINA_REGEN_DELAY_MS) {
            const currentStamina = this.player.getData('stamina');
            const maxStamina = this.config.PLAYER_MAX_STAMINA;
            
            if (currentStamina < maxStamina) {
                let regenMultiplier = 1;

                // 1. 현재 속도 및 최대 속도 계산
                const currentSpeed = this.player.body ? this.player.body.velocity.length() : 0;
                const skills = this.scene.data.get('skills') || [];
                let maxSpeed = this.config.BASE_PLAYER_SPEED;
                if (skills.includes(21)) maxSpeed *= 1.1; 

                // 2. 속도에 따른 회복 배율 설정
                if (currentSpeed < 10) {
                    regenMultiplier = 3;
                } else if (currentSpeed <= maxSpeed * 0.5) {
                    regenMultiplier = 2;
                } else {
                    regenMultiplier = 1;
                }

                // 3. 회복 적용
                const regenAmount = (this.config.STAMINA_REGEN_RATE * regenMultiplier) * (delta / 1000);
                const nextStamina = Math.min(maxStamina, currentStamina + regenAmount);
                this.player.setData('stamina', nextStamina);
            }
        }
    }

    _updateMovement() {
        const isKnockedBack = this.scene.data.get('isKnockedBack');
        const isJumping = this.scene.data.get('isJumping');
        const cursors = this.scene.data.get('cursors');
        const skills = this.scene.data.get('skills') || [];

        let speed = this.config.BASE_PLAYER_SPEED;
        if (skills.includes(21)) speed *= 1.1;

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
                this.player.setVelocity(moveX * speed, moveY * speed);
                this.player.setFlipX(moveX > 0);
                this.scene.data.set('isMoving', true);
            } else {
                this.player.setVelocity(0);
                this.scene.data.set('isMoving', false);
            }
        } else if (isJumping) {
            this.scene.data.set('isMoving', this.player.body.velocity.length() > 10);
        }
    }

    _handleAction() {
        let triggerAction = false;
        const spaceKey = this.scene.data.get('spaceKey');
        
        if (Phaser.Input.Keyboard.JustDown(spaceKey) || 
            this.scene.data.get('wantToJump') || 
            this.scene.data.get('isActionBtnPressed')) {
            triggerAction = true;
            this.scene.data.set('wantToJump', false);
        }

        if (triggerAction) {
            const skills = this.scene.data.get('skills') || [];
            const hasShockwave = skills.includes(this.config.SHOCKWAVE_SKILL_ID);

            if (hasShockwave) {
                const isReady = this.scene.data.get('shockwaveReady');
                if (isReady) {
                    this.triggerShockwave();
                }
            } else {
                if (!this.scene.data.get('isJumping')) {
                    this.triggerJump();
                }
            }
        }
    }

    _updateAnimation() {
        const isInvincible = this.player.getData('isInvincible');
        const isHaak = this.scene.data.get('isHaak');
        const isJumping = this.scene.data.get('isJumping');
        const isMoving = this.scene.data.get('isMoving');
        // [신규] 먹는 상태 확인
        const isEating = this.player.getData('isEating'); 
        
        if (isInvincible) {
            this.player.setTexture('cat_hit');
        } else if (isEating) { 
            // [신규] 먹는 애니메이션이 아니라면 재생 (이미 재생 중이면 유지)
            if (this.player.anims.currentAnim?.key !== 'cat_eat') {
                this.player.play('cat_eat', true);
            }
        } else if (isHaak) {
            this.player.setTexture('cat_haak');
        } else if (isJumping) {
            this.player.anims.stop(); 
            this.player.setTexture('cat_jump');
        } else {
            if (isMoving) {
                this.player.anims.play('cat_walk', true);
            } else {
                this.player.anims.stop();
                this.player.setTexture('player_sprite'); 
                this.player.setFrame(0);
            }
        }
    }

    triggerJump() {
        if (this.scene.data.get('isJumping')) return;
        
        const now = this.scene.time.now;
        const lastJumpTime = this.scene.data.get('lastJumpTime') || 0;
        if (now - lastJumpTime < this.config.JUMP_COOLDOWN_MS) return;

        const stamina = this.player.getData('stamina');
        if (stamina < this.config.STAMINA_JUMP_COST) {
            this.scene.events.emit('stamina-warning');
            return; 
        }

        this.player.setData('stamina', stamina - this.config.STAMINA_JUMP_COST);
        this.lastStaminaUseTime = now;

        this.scene.data.set('isJumping', true);
        this.scene.data.set('lastJumpTime', now);

        if (this.wallCollider) this.wallCollider.active = false;

        if (this.player.body.velocity.length() > 10) {
             const currentVel = this.player.body.velocity.clone();
             const boost = this.config.JUMP_SPEED_MULTIPLIER;
             this.player.setVelocity(currentVel.x * boost, currentVel.y * boost);
        }
        
        this.player.setDrag(0);
        const originalScale = this.player.getData('baseScale');
        const defaultOriginY = this.player.displayOriginY; 

        this.scene.tweens.add({
            targets: this.player,
            displayOriginY: defaultOriginY + this.config.JUMP_HEIGHT_PIXEL, 
            scaleX: originalScale * 1.2, 
            scaleY: originalScale * 1.2,
            duration: this.config.JUMP_DURATION_MS / 2,
            yoyo: true, 
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.scene.data.set('isJumping', false);
                this.player.setScale(originalScale);
                this.player.setOrigin(0.5, 0.5); 
                this.player.setDrag(500); 

                if (this.wallCollider) this.wallCollider.active = true;
                
                this._checkLandingCollision();
            }
        });
    }

    _checkLandingCollision() {
        const enemyManager = this.scene.enemyManager;
        if (!enemyManager || this.scene.data.get('gameOver')) return;

        const mice = this.scene.data.get('mice');
        const dogs = this.scene.data.get('dogs');

        if (mice) {
            this.scene.physics.overlap(this.player, mice, (player, mouse) => {
                enemyManager.hitMouse(player, mouse);
            }, null, enemyManager);
        }

        if (dogs) {
            this.scene.physics.overlap(this.player, dogs, (player, dog) => {
                enemyManager.hitDog(player, dog);
            }, null, enemyManager);
        }
    }

    triggerShockwave() {
        this.player.setTexture('cat_haak');
        this.scene.data.set('isHaak', true);
        
        this.scene.time.delayedCall(500, () => { 
            this.scene.data.set('isHaak', false); 
        });

        this.scene.data.set('shockwaveReady', false);
        
        const shockwaveCircle = this.scene.add.circle(this.player.x, this.player.y, this.config.SHOCKWAVE_RADIUS_START, this.config.SHOCKWAVE_COLOR, 0.7);
        shockwaveCircle.setStrokeStyle(this.config.SHOCKWAVE_LINE_WIDTH, this.config.SHOCKWAVE_COLOR, 0.9);
        shockwaveCircle.setDepth(this.player.depth - 1);

        this.scene.tweens.add({
            targets: shockwaveCircle,
            radius: this.config.SHOCKWAVE_RADIUS_END,
            alpha: { from: 0.7, to: 0 },
            lineWidth: { from: this.config.SHOCKWAVE_LINE_WIDTH, to: 0 },
            duration: this.config.SHOCKWAVE_DURATION_MS,
            ease: 'Quad.easeOut',
            onComplete: () => { shockwaveCircle.destroy(); }
        });

        const mice = this.scene.data.get('mice');
        const dogs = this.scene.data.get('dogs');
        const targets = [...mice.getChildren(), ...dogs.getChildren()];
        
        targets.forEach(enemy => {
            if (enemy.active && enemy.body) {
                const distSq = Phaser.Math.Distance.Squared(this.player.x, this.player.y, enemy.x, enemy.y);
                const radiusSq = this.config.SHOCKWAVE_RADIUS_END * this.config.SHOCKWAVE_RADIUS_END;
                
                if (distSq <= radiusSq) {
                    const dir = new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y).normalize().scale(this.config.SHOCKWAVE_PUSH_FORCE);
                    enemy.body.velocity.copy(dir);
                    if (enemy.texture.key.includes('dog')) { 
                        enemy.isKnockedBack = true;
                        this.scene.time.delayedCall(this.config.KNOCKBACK_DURATION_MS, () => { enemy.isKnockedBack = false; });
                    }
                }
            }
        });

        if (this.scene.shockwaveTimer) this.scene.shockwaveTimer.remove();
        this.scene.shockwaveTimer = this.scene.time.addEvent({
            delay: this.config.SHOCKWAVE_INTERVAL_MS || 10000,
            callback: () => {
                 this.scene.data.set('shockwaveReady', true);
                 this.scene.data.set('shockwaveTimerEvent', null);
            }
        });
        this.scene.data.set('shockwaveTimerEvent', this.scene.shockwaveTimer);
    }
}