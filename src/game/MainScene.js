import Phaser from 'phaser';
import { fetchGameConfig } from '../utils/configUtils';
import MapManager from './managers/MapManager';
import PlayerManager from './managers/PlayerManager';
import EnemyManager from './managers/EnemyManager';
import UIManager from './managers/UIManager';

// 리소스 URL import
import stage1MapUrl from '../assets/maps/stage1.json?url';
import grassImgUrl from '../assets/tilesets/TX_Tileset_Grass.png?url';
import treeImgUrl from '../assets/tilesets/TX_Plant.png?url';

// [신규] BGM 파일 import (파일이 src/assets/sounds/stage1_bgm.mp3 위치에 있어야 합니다)
import bgmUrl from '../assets/sounds/stage1_bgm.mp3?url'; 

export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.config = {};
        this.frameCounter = 0; // 최적화용 프레임 카운터

        // 매니저 인스턴스
        this.mapManager = null;
        this.playerManager = null;
        this.enemyManager = null;
        this.uiManager = null;
        
        // [신규] BGM 인스턴스
        this.bgm = null;
    }

    preload() {
        // --- 리소스 로드 ---
        this.load.spritesheet('player_sprite', '/images/cat_walk_3frame_sprite.png', { frameWidth: 100, frameHeight: 100 });
        this.load.image('cat_punch', '/images/cat_punch.png');
        this.load.image('cat_jump', '/images/cat_jump.png');
        this.load.image('cat_hit', '/images/cat_hit.png');
        
        // [신규] 쥐 먹는 애니메이션 스프라이트 로드 (200x100, 2프레임 -> 1프레임당 100x100)
        this.load.spritesheet('cat_eat', '/images/cat-eat.png', { frameWidth: 100, frameHeight: 100 });

        this.load.spritesheet('mouse_enemy_sprite', '/images/mouse_2frame_sprite.png', { frameWidth: 100, frameHeight: 64 });
        this.load.spritesheet('dog_enemy_sprite', '/images/dog_2frame_horizontal.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('fish_item_sprite', '/images/fish_sprite_2frame.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('butterfly_sprite_3frame', '/images/butterfly_sprite_3frame.png', { frameWidth: 100, frameHeight: 83 });
        this.load.image('cat_cry', '/images/cat_cry.png');
        this.load.image('cat_haak', '/images/cat_haak.png');
        
        this.load.image('mouse_icon', '/images/mouse.png');

        this.load.image('grass_img', grassImgUrl);
        this.load.image('tree_img', treeImgUrl);
        this.load.tilemapTiledJSON('stage1_map', stage1MapUrl);

        // [신규] 오디오 로드
        this.load.audio('stage1_bgm', bgmUrl);
    }

    async create() {
        // 1. 설정 로드
        this.config = await fetchGameConfig();
        this.data.set('gameOver', false);
        this.cameras.main.setBackgroundColor('#808080');
        this.physics.resume();
        
        // 모바일 체크
        const isMobile = this.sys.game.device.os.android || this.sys.game.device.os.iOS;
        this.data.set('isMobile', isMobile);
        if (!this.data.has('skills')) this.data.set('skills', []);

        // 2. 매니저 초기화
        this.mapManager = new MapManager(this);
        this.playerManager = new PlayerManager(this, this.config);
        this.enemyManager = new EnemyManager(this, this.config);
        this.uiManager = new UIManager(this, this.config);

        // 3. 게임 월드 구성 순서
        // (1) 맵 생성
        const { map, wallLayer, blockLayer } = this.mapManager.createMap();
        
        // (2) 애니메이션 생성 (플레이어, 적 공통)
        this.createAnimations();

        // (3) 플레이어 생성
        const player = this.playerManager.createPlayer(map, wallLayer, blockLayer);

        // (4) UI 생성
        this.uiManager.createUI(player);

        // (5) 적/아이템 그룹 및 충돌 설정
        // EnemyManager가 플레이어와 벽 정보를 알아야 충돌 설정을 할 수 있음
        this.enemyManager.setupGroupsAndColliders(player, wallLayer, blockLayer);

        // (6) 게임 시작 (스테이지 1)
        this.enemyManager.startStage(1);

        // (7) 맵 초기 아이템 스폰
        this.mapManager.spawnInitialItems(map, this.enemyManager); // enemyManager를 통해 스폰

        // [신규] BGM 재생
        // 이미 재생 중이라면 중복 재생 방지
        // 테스트하려면 주석처리
        if (!this.bgm || !this.bgm.isPlaying) {
            this.bgm = this.sound.add('stage1_bgm', { 
                loop: true,      // 무한 반복
                volume: 0.5      // 볼륨 (0.0 ~ 1.0)
            });
            this.bgm.play();
        }

        // 이벤트 emit
        this.game.events.emit('main-scene-ready', this);
    }

    createAnimations() {
        this.anims.create({ key: 'cat_walk', frames: this.anims.generateFrameNumbers('player_sprite', { start: 0, end: 2 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'mouse_walk', frames: this.anims.generateFrameNumbers('mouse_enemy_sprite', { start: 0, end: 1 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'dog_walk', frames: this.anims.generateFrameNumbers('dog_enemy_sprite', { start: 0, end: 1 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'fish_swim', frames: this.anims.generateFrameNumbers('fish_item_sprite', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'butterfly_fly', frames: this.anims.generateFrameNumbers('butterfly_sprite_3frame', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
        
        // [신규] 쥐 먹기 애니메이션 (반복 없음)
        this.anims.create({ 
            key: 'cat_eat', 
            frames: this.anims.generateFrameNumbers('cat_eat', { start: 0, end: 1 }), 
            frameRate: 10, 
            repeat: 0 
        });
    }

    update(time, delta) {
        if (this.data.get('gameOver')) {
            // [신규] 게임 오버 시 BGM 정지 (선택 사항: 원치 않으면 이 부분을 주석 처리)
            if (this.bgm && this.bgm.isPlaying) {
                this.bgm.stop();
            }
            return;
        }
        if (!this.config || Object.keys(this.config).length === 0) return;

        // 최적화: 프레임 카운트
        this.frameCounter = (this.frameCounter + 1) % 60;
        const runAiLogic = (this.frameCounter % 3 === 0);
        const runSeparationLogic = (this.frameCounter % 5 === 0);

        // [신규] MapManager 업데이트 호출 (벽 파괴 로직 처리)
        if (this.mapManager) this.mapManager.update(time, delta);

        // 각 매니저 Update 호출
        if (this.playerManager) this.playerManager.update(time, delta);
        if (this.uiManager) this.uiManager.update();
        if (this.enemyManager) this.enemyManager.update(time, delta, runAiLogic, runSeparationLogic);
    }
}