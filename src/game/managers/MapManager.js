import Phaser from 'phaser';

export default class MapManager {
    constructor(scene) {
        this.scene = scene;
        this.map = null;
        this.wallLayer = null;
        
        // Key: "x,y", Value: { currentTimer: 0, sustainTimer: 0, enemies: Set, lastFrame: 0, tile: TileObject }
        this.wallPressure = new Map();

        // [디버깅용]
        this.debugText = null;
    }

    createMap() {
        this.map = this.scene.make.tilemap({ key: 'stage1_map' });
        
        let grassTilesetName = 'tile_grass';
        let plantTilesetName = 'tile_tree';

        if (this.map.tilesets.length > 0) {
            grassTilesetName = this.map.tilesets[0].name;
            if (this.map.tilesets.length > 1) {
                plantTilesetName = this.map.tilesets[1].name;
            }
        }

        const grassTileset = this.map.addTilesetImage(grassTilesetName, 'grass_img');
        const plantTileset = this.map.addTilesetImage(plantTilesetName, 'tree_img');

        this.map.createLayer('grass', grassTileset, 0, 0) || this.map.createLayer('Ground', grassTileset, 0, 0);
        this.wallLayer = this.map.createLayer('Walls', plantTileset, 0, 0);

        if (this.wallLayer) {
            this.wallLayer.setCollisionByExclusion([-1]);
        }

        this.scene.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.scene.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

        // [디버깅용 텍스트]
        this.debugText = this.scene.add.text(10, 150, 'Wall Debug', {
            fontSize: '14px', fontFamily: 'monospace', fill: '#00ff00', backgroundColor: '#000000aa'
        }).setScrollFactor(0).setDepth(100).setVisible(false);

        return { map: this.map, wallLayer: this.wallLayer };
    }

    spawnInitialItems(map, enemyManager) {
        const spawnLayer = map.getObjectLayer('Spawns');
        if (spawnLayer && spawnLayer.objects) {
            spawnLayer.objects.forEach(obj => {
                if (obj.name === 'fish') {
                    enemyManager.spawnFishItem(obj.x, obj.y);
                }
            });
        }
    }

    handleWallCollision(enemy, tile) {
        if (!tile || !tile.canCollide) return;

        const key = `${tile.x},${tile.y}`;
        const currentFrame = this.scene.game.loop.frame;

        if (!this.wallPressure.has(key)) {
            this.wallPressure.set(key, {
                currentTimer: 0,      // 파괴 누적 시간 (3초 목표)
                sustainTimer: 0,      // [신규] 상태 유지 타이머 (1초 버퍼)
                enemies: new Set(),   // 현재 밀고 있는 적들
                lastFrame: 0,         
                tile: tile            
            });
        }

        const data = this.wallPressure.get(key);

        // 새 프레임이면 적 목록 초기화
        if (data.lastFrame !== currentFrame) {
            data.enemies.clear();
            data.lastFrame = currentFrame;
        }

        data.enemies.add(enemy); 
    }

    update(time, delta) {
        const currentFrame = this.scene.game.loop.frame;
        const keysToDelete = [];
        const config = this.scene.config || {};
        
        // 설정값 로드
        const requiredEnemies = config.WALL_BREAK_REQUIRED_ENEMIES || 2; // 기본 2마리
        const breakDuration = config.WALL_BREAK_DURATION_MS || 3000;
        const sustainDuration = config.WALL_BREAK_SUSTAIN_MS || 1000;    // 1초 유지

        let debugLog = `[Wall Siege]\nReq: ${requiredEnemies}+ / 3s\n`;
        let activeWalls = 0;

        this.wallPressure.forEach((data, key) => {
            // 1. 현재 프레임(또는 직전)에 충분한 적이 밀고 있는가?
            // (Physics 업데이트 순서 차이 보정을 위해 frame 차이 허용)
            const isPushingNow = (currentFrame - data.lastFrame <= 1) && (data.enemies.size >= requiredEnemies);

            if (isPushingNow) {
                // [CASE 1] 적이 밀고 있음
                // -> 파괴 게이지 상승
                // -> 유지 타이머(버퍼)를 1초로 꽉 채움 (리필)
                data.currentTimer += delta;
                data.sustainTimer = sustainDuration;
            } else {
                // [CASE 2] 적이 잠깐 떨어짐 (Jitter) 혹은 떠남
                if (data.sustainTimer > 0) {
                    // -> 버퍼 시간이 남았으므로 '미는 상태'로 간주하여 파괴 게이지를 유지 (감소 X)
                    // -> 유지 타이머만 감소
                    data.sustainTimer -= delta;
                } else {
                    // -> 버퍼 시간도 끝남. 이제 진짜로 파괴 게이지 초기화
                    data.currentTimer = 0;
                }
            }

            // 2. 시각적 피드백 및 파괴 처리
            if (data.currentTimer > 0) {
                activeWalls++;
                debugLog += `Tile[${key}]: 👿${data.enemies.size} | ${(data.currentTimer/1000).toFixed(2)}s ${isPushingNow ? '▲' : '-'}\n`;

                const progress = Math.min(data.currentTimer / breakDuration, 1);
                
                // [시각 효과] 빨간색으로 점점 진해짐
                const colorVal = Math.floor(255 * (1 - progress));
                data.tile.tint = Phaser.Display.Color.GetColor(255, colorVal, colorVal);

                // [파괴] 3초 달성
                if (data.currentTimer >= breakDuration) {
                    this.destroyWall(data.tile, key);
                    keysToDelete.push(key);
                }
            } else {
                // 게이지가 0이면 색상 완전 복구
                data.tile.tint = 0xFFFFFF;
                
                // 오랫동안 상호작용 없으면 메모리 해제
                if (currentFrame - data.lastFrame > 120 && data.sustainTimer <= 0) {
                    keysToDelete.push(key);
                }
            }
        });

        keysToDelete.forEach(key => this.wallPressure.delete(key));

        // 디버그 텍스트 표시
        if (this.debugText) {
            if (activeWalls > 0) {
                this.debugText.setText(debugLog).setVisible(true);
            } else {
                this.debugText.setVisible(false);
            }
        }
    }

    destroyWall(tile, key) {
        this.wallLayer.removeTileAt(tile.x, tile.y);
        
        // 파편 이펙트
        const worldX = tile.getCenterX();
        const worldY = tile.getCenterY();
        
        for (let i = 0; i < 6; i++) {
            const size = Phaser.Math.Between(5, 10);
            const debris = this.scene.add.rectangle(worldX, worldY, size, size, 0x5d4037);
            this.scene.physics.add.existing(debris);
            
            const angle = Phaser.Math.Between(0, 360);
            const speed = Phaser.Math.Between(100, 250);
            debris.body.setVelocity(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed
            );
            
            this.scene.tweens.add({
                targets: debris,
                alpha: 0,
                scale: 0,
                duration: 600,
                onComplete: () => debris.destroy()
            });
        }

        this.wallPressure.delete(key);
        console.log(`Wall destroyed at ${tile.x}, ${tile.y}`);
    }
}