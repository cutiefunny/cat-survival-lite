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
    }

    preload() {
        // --- 리소스 로드 ---
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
        const { map, wallLayer } = this.mapManager.createMap();
        
        // (2) 애니메이션 생성 (플레이어, 적 공통)
        this.createAnimations();

        // (3) 플레이어 생성
        const player = this.playerManager.createPlayer(map, wallLayer);

        // (4) UI 생성
        this.uiManager.createUI(player);

        // (5) 적/아이템 그룹 및 충돌 설정
        // EnemyManager가 플레이어와 벽 정보를 알아야 충돌 설정을 할 수 있음
        this.enemyManager.setupGroupsAndColliders(player, wallLayer);

        // (6) 게임 시작 (스테이지 1)
        this.enemyManager.startStage(1);

        // (7) 맵 초기 아이템 스폰
        this.mapManager.spawnInitialItems(map, this.enemyManager); // enemyManager를 통해 스폰

        // 이벤트 emit
        this.game.events.emit('main-scene-ready', this);
    }

    createAnimations() {
        this.anims.create({ key: 'cat_walk', frames: this.anims.generateFrameNumbers('player_sprite', { start: 0, end: 2 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'mouse_walk', frames: this.anims.generateFrameNumbers('mouse_enemy_sprite', { start: 0, end: 1 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'dog_walk', frames: this.anims.generateFrameNumbers('dog_enemy_sprite', { start: 0, end: 1 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'fish_swim', frames: this.anims.generateFrameNumbers('fish_item_sprite', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'butterfly_fly', frames: this.anims.generateFrameNumbers('butterfly_sprite_3frame', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
    }

    update(time, delta) {
        if (this.data.get('gameOver')) return;
        if (!this.config || Object.keys(this.config).length === 0) return;

        // 최적화: 프레임 카운트
        this.frameCounter = (this.frameCounter + 1) % 60;
        const runAiLogic = (this.frameCounter % 3 === 0);
        const runSeparationLogic = (this.frameCounter % 5 === 0);

        // 각 매니저 Update 호출
        if (this.playerManager) this.playerManager.update(time, delta);
        if (this.uiManager) this.uiManager.update();
        if (this.enemyManager) this.enemyManager.update(time, delta, runAiLogic, runSeparationLogic);
    }
}