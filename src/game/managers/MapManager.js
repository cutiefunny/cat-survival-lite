import Phaser from 'phaser';

export default class MapManager {
    constructor(scene) {
        this.scene = scene;
    }

    createMap() {
        const map = this.scene.make.tilemap({ key: 'stage1_map' });
        
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

        // 레이어 생성
        map.createLayer('grass', grassTileset, 0, 0) || map.createLayer('Ground', grassTileset, 0, 0);
        const wallLayer = map.createLayer('Walls', plantTileset, 0, 0);

        if (wallLayer) {
            wallLayer.setCollisionByExclusion([-1]);
        }

        // 월드 경계 설정
        this.scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.scene.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

        return { map, wallLayer };
    }

    spawnInitialItems(map, enemyManager) {
        const spawnLayer = map.getObjectLayer('Spawns');
        if (spawnLayer && spawnLayer.objects) {
            spawnLayer.objects.forEach(obj => {
                if (obj.name === 'fish') {
                    // EnemyManager에 있는 spawn 메서드 활용 (그룹 관리를 위해)
                    enemyManager.spawnFishItem(obj.x, obj.y);
                }
            });
        }
    }
}