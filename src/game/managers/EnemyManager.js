import Phaser from 'phaser';
import stageInfo from '../../assets/stageInfo.json';

export default class EnemyManager {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        
        this.currentStage = 1;
        this.stageMiceKilled = 0;
        this.stageMiceTotal = 0;
        this.stageButterflySpawned = false;
        
        // [수정] 통계용 변수
        this.startTime = 0;
        this.isStageTimerStarted = false; // 타이머 시작 대기 플래그
    }

    setupGroupsAndColliders(player, wallLayer, blockLayer) {
        const mice = this.scene.physics.add.group();
        const dogs = this.scene.physics.add.group();
        const fishItems = this.scene.physics.add.group();
        const butterflies = this.scene.physics.add.group();

        this.scene.data.set('mice', mice);
        this.scene.data.set('dogs', dogs);
        this.scene.data.set('fishItems', fishItems);
        this.scene.data.set('butterflies', butterflies);

        if (wallLayer) {
            this.scene.physics.add.collider(mice, wallLayer);
            this.scene.physics.add.collider(dogs, wallLayer, (enemy, tile) => {
                this.scene.mapManager.handleWallCollision(enemy, tile);
            });
        }

        if (blockLayer) {
            this.scene.physics.add.collider(mice, blockLayer);
            this.scene.physics.add.collider(dogs, blockLayer);
        }

        // 충돌 핸들러 바인딩
        this.scene.physics.add.collider(player, mice, this.hitMouse, this.canPlayerCollide, this);
        this.scene.physics.add.collider(player, dogs, this.hitDog, this.canPlayerCollide, this);
        
        this.scene.physics.add.collider(mice, mice);
        this.scene.physics.add.collider(dogs, dogs);
        this.scene.physics.add.collider(dogs, mice);
        this.scene.physics.add.collider(dogs, fishItems);
        this.scene.physics.add.collider(mice, fishItems);
        this.scene.physics.add.collider(dogs, butterflies);
        this.scene.physics.add.collider(mice, butterflies);
        
        this.scene.physics.add.overlap(player, fishItems, this.collectFish, null, this);
        this.scene.physics.add.overlap(player, butterflies, this.collectButterfly, null, this);

        // 주기적 스폰 이벤트
        this.scene.time.addEvent({ 
            delay: 10000,
            callback: () => {
                if (this.scene.data.get('gameOver')) return;
                if (!this.stageButterflySpawned && Math.random() < 0.1) {
                    this.spawnButterflyVillain();
                    this.stageButterflySpawned = true; 
                }
            }, 
            callbackScope: this, 
            loop: true 
        });
    }

    startStage(stageNum) {
        console.log(`Starting Stage ${stageNum}`);
        this.currentStage = stageNum;
        
        const stageData = stageInfo[stageNum] || { mouse: 20, dog: 10 };
        this.stageMiceTotal = stageData.mouse;
        const stageDogsTotal = stageData.dog;
        this.stageMiceKilled = 0; 
        this.stageButterflySpawned = false;

        // [수정] 타이머 초기화 로직 변경
        // 여기서 바로 startTime을 찍지 않고, 플래그만 세웁니다.
        // 실제 시간은 update()가 처음 호출될 때(게임이 실제로 재개될 때) 찍습니다.
        this.isStageTimerStarted = false; 
        
        this.scene.data.set('damageTaken', 0);
        this.scene.data.set('remainingMice', this.stageMiceTotal);

        const mice = this.scene.data.get('mice');
        const dogs = this.scene.data.get('dogs');
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
        
        const drawUI = this.scene.data.get('drawUI');
        if (drawUI) drawUI();
    }

    spawnEntity(group, spriteKey, animKey, scaleBase, isStatic = false, x = null, y = null) {
        const cam = this.scene.cameras.main;
        const pad = 100;
        const worldBounds = this.scene.physics.world.bounds;
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
        const isMobile = this.scene.data.get('isMobile');
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

    spawnFishItem(x = null, y = null) {
        const items = this.scene.data.get('fishItems');
        if (x !== null && y !== null) {
            this.spawnEntity(items, 'fish_item_sprite', 'fish_swim', 0.4, true, x, y);
        }
    }

    spawnButterflyVillain() {
        const items = this.scene.data.get('butterflies');
        const butterfly = this.spawnEntity(items, 'butterfly_sprite_3frame', 'butterfly_fly', 0.5, false);
        if (butterfly && butterfly.body) {
             butterfly.setImmovable(true);
        }
    }

    update(time, delta, runAiLogic, runSeparationLogic) {
        // [수정] 게임이 실제로 재개된 첫 프레임에 시간을 기록합니다.
        // 모달이나 상점이 떠있는 동안(Paused 상태)에는 update가 호출되지 않으므로,
        // 이 로직은 "플레이어가 움직일 수 있게 된 순간"에 실행됩니다.
        if (!this.isStageTimerStarted) {
            this.startTime = time; // 현재 게임 시간을 시작 시간으로 설정
            this.isStageTimerStarted = true;
        }

        if (!runAiLogic) {
            this._updateButterflies(delta);
            return;
        }

        const player = this.scene.data.get('player');
        if (!player) return;

        this._updateMiceAI(player);
        this._updateDogsAI(player, runSeparationLogic);
        this._updateButterflies(delta);
    }

    _updateMiceAI(player) {
        const mice = this.scene.data.get('mice');
        mice.getChildren().forEach(mouse => {
            if (mouse.active && mouse.body) {
                const distSq = Phaser.Math.Distance.Squared(player.x, player.y, mouse.x, mouse.y);
                if (distSq > 1000000) return; 

                const baseSpeed = 70;
                const speedFactor = mouse.getData('speedFactor') || 1; 
                const finalSpeed = baseSpeed * speedFactor;

                if (distSq < this.config.FLEE_RADIUS_SQ) {
                    const fleeX = mouse.x - (player.x - mouse.x);
                    const fleeY = mouse.y - (player.y - mouse.y);
                    this.scene.physics.moveToObject(mouse, { x: fleeX, y: fleeY }, finalSpeed);
                } else if (distSq > this.config.GATHERING_RADIUS_SQ) {
                    this.scene.physics.moveToObject(mouse, player, finalSpeed);
                }

                if (mouse.body.blocked.left || mouse.body.blocked.right) {
                    mouse.setVelocityY((player.y > mouse.y ? 1 : -1) * finalSpeed * 1.5);
                } else if (mouse.body.blocked.up || mouse.body.blocked.down) {
                    mouse.setVelocityX((player.x > mouse.x ? 1 : -1) * finalSpeed * 1.5);
                }
                mouse.setFlipX(mouse.body.velocity.x > 0);
            }
        });
    }

    _updateDogsAI(player, runSeparationLogic) {
        const dogs = this.scene.data.get('dogs');
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
                    if (ambushState === 'patrol' && distToPlayer < this.config.AMBUSH_DETECT_RADIUS) {
                        dog.setData('ambushState', 'chase');
                    } else if (ambushState === 'chase' && distToPlayer > this.config.AMBUSH_RELEASE_RADIUS) {
                        dog.setData('ambushState', 'patrol');
                        dog.setData('patrolTarget', null); 
                    }

                    if (dog.getData('ambushState') === 'chase') {
                        finalSpeed = this.config.DOG_CHASE_SPEED * speedFactor;
                        targetVec = new Phaser.Math.Vector2(player.x - dog.x, player.y - dog.y).normalize().scale(finalSpeed);
                    } else {
                        let patrolTarget = dog.getData('patrolTarget');
                        if (!patrolTarget || Phaser.Math.Distance.Between(dog.x, dog.y, patrolTarget.x, patrolTarget.y) < 50) {
                            let tx, ty, attempts = 0;
                            const minDist = this.config.AMBUSH_PATROL_MIN_DIST;
                            do {
                                tx = Phaser.Math.Between(0, this.scene.physics.world.bounds.width);
                                ty = Phaser.Math.Between(0, this.scene.physics.world.bounds.height);
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

                // Separation Logic
                const separationVec = new Phaser.Math.Vector2(0, 0);
                if (runSeparationLogic) {
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
                }

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
    }

    _updateButterflies(delta) {
        const player = this.scene.data.get('player');
        if(!player) return;

        const butterflies = this.scene.data.get('butterflies');
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
                        this.scene.physics.velocityFromAngle(Phaser.Math.Between(0, 360), Phaser.Math.Between(50, 150), bf.body.velocity);
                        bf.setData('moveTimer', 0);
                        bf.setData('nextMoveTime', Phaser.Math.Between(200, 800));
                    }
                    bf.setData('moveTimer', timer);
                }
                bf.setFlipX(bf.body.velocity.x < 0);
            }
        });
    }

    // --- 콜백 메서드 ---

    canPlayerCollide(player, enemy) {
        return !this.scene.data.get('isJumping');
    }

    hitMouse(player, mouse) {
        if (this.scene.data.get('gameOver')) return;
        const mice = this.scene.data.get('mice');
        mice.killAndHide(mouse);
        mouse.disableBody(true, true);

        let score = this.scene.data.get('score') || 0;
        score += 10;
        this.scene.data.set('score', score);
        
        const updateScoreUI = this.scene.data.get('updateScoreUI');
        if (updateScoreUI) updateScoreUI(score);

        this.stageMiceKilled += 1;

        // 남은 쥐 숫자 업데이트
        const remaining = this.stageMiceTotal - this.stageMiceKilled;
        this.scene.data.set('remainingMice', remaining);

        const drawUI = this.scene.data.get('drawUI');
        if (drawUI) drawUI();

        // 냠냠 애니메이션 재생
        player.setData('isEating', true);
        player.play('cat_eat', true);
        player.once('animationcomplete-cat_eat', () => {
            player.setData('isEating', false);
        });

        if (this.stageMiceKilled >= this.stageMiceTotal) {
            this.clearStage();
        }
    }

    hitDog(player, dog) {
        if (this.scene.data.get('gameOver')) return;
        if (player.getData('isInvincible')) return;

        const skills = this.scene.data.get('skills') || [];
        const hasKnockbackSkill = skills.some(s => s >= 11 && s <= 19);
        const dotProduct = (dog.x - player.x) * (player.flipX ? -1 : 1);

        if (hasKnockbackSkill && dotProduct < 0) { 
            const dir = new Phaser.Math.Vector2(dog.x - player.x, dog.y - player.y).normalize().scale(this.config.PLAYER_PUSH_BACK_FORCE);
            dog.setVelocity(dir.x, dir.y);
            dog.isKnockedBack = true;
            this.scene.time.delayedCall(this.config.KNOCKBACK_DURATION_MS, () => { dog.isKnockedBack = false; });
            player.setTexture('cat_punch');
            this.scene.time.delayedCall(300, () => { player.setTexture('player_sprite'); player.play('cat_walk', true); });
        } else { 
            const dir = new Phaser.Math.Vector2(player.x - dog.x, player.y - dog.y).normalize().scale(this.config.PLAYER_PUSH_BACK_FORCE);
            player.setVelocity(dir.x, dir.y);
            
            let energy = player.getData('energy') - 1;
            player.setData('energy', energy);
            
            // 데미지 통계 증가
            const currentDamage = this.scene.data.get('damageTaken') || 0;
            this.scene.data.set('damageTaken', currentDamage + 1);

            if (energy <= 0) {
                this.endGame();
                return;
            }

            this.scene.data.set('isKnockedBack', true);
            player.setData('isInvincible', true);
            player.setAlpha(0.5); 
            this.scene.time.delayedCall(this.config.KNOCKBACK_DURATION_MS, () => { this.scene.data.set('isKnockedBack', false); });
            this.scene.time.delayedCall(this.config.PLAYER_INVINCIBILITY_DURATION_MS, () => { player.setData('isInvincible', false); player.setAlpha(1); });
        }
    }

    collectFish(player, fish) {
        if (this.scene.data.get('gameOver')) return;
        
        // 아이템 제거 처리
        const items = this.scene.data.get('fishItems');
        items.killAndHide(fish);
        fish.disableBody(true, true);

        // 1. 에너지(체력) 1칸 회복
        let energy = player.getData('energy');
        const maxEnergy = player.getData('maxEnergy');
        if (energy < maxEnergy) {
            player.setData('energy', energy + 1);
        }

        // 2. 기력(Stamina) 완전 회복
        const maxStamina = player.getData('maxStamina');
        player.setData('stamina', maxStamina);
    }

    collectButterfly(player, butterfly) {
        if (this.scene.data.get('gameOver')) return;
        const items = this.scene.data.get('butterflies');
        items.killAndHide(butterfly);
        butterfly.disableBody(true, true);
        const maxEnergy = player.getData('maxEnergy');
        player.setData('energy', maxEnergy); 
    }

    clearStage() {
        console.log('Stage Cleared!');

        // 통계 및 점수 계산
        const endTime = this.scene.time.now;
        const duration = endTime - this.startTime; // 밀리초
        const damage = this.scene.data.get('damageTaken') || 0;
        
        // 남은 생선 수 계산
        const fishItems = this.scene.data.get('fishItems');
        const remainingFish = fishItems ? fishItems.countActive() : 0;

        // 점수 공식: 
        // - 시간 보너스: (60초 - 소요시간) * 10점 (최소 0점)
        // - 생선 보너스: 마리당 200점
        // - 데미지 페널티: 피격당 -50점
        const durationSec = Math.floor(duration / 1000);
        const timeBonus = Math.max(0, 60 - durationSec) * 10;
        const fishBonus = remainingFish * 200;
        const damagePenalty = damage * 50;
        
        const stageScore = Math.max(0, timeBonus + fishBonus - damagePenalty);
        
        // 스테이지 클리어 모달 호출
        const openStageClearModal = this.scene.data.get('openStageClearModal');
        if (openStageClearModal) {
            openStageClearModal({
                stage: this.currentStage,
                timeMs: duration,
                damage: damage,
                fish: remainingFish,
                score: stageScore
            });
        }
        
        this.currentStage += 1;
        this.startStage(this.currentStage);
    }

    endGame() {
        this.scene.data.set('gameOver', true);
        const triggerEnd = this.scene.data.get('triggerGameOverModal');
        const score = this.scene.data.get('score') || 0;
        if (triggerEnd) triggerEnd(score);
        
        const player = this.scene.data.get('player');
        if(player) {
            player.setTint(0xff0000); 
            player.anims.stop();
        }
        this.scene.physics.pause();
        this.scene.time.removeAllEvents();
    }
}