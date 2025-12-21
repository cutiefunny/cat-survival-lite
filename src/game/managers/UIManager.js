import Phaser from 'phaser';

export default class UIManager {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        
        // HUD 요소
        // [수정] Score 텍스트 제거
        
        // [신규] 쥐 카운터 UI
        this.mouseIcon = null;
        this.mouseText = null;
        
        // [신규] 캐릭터 머리 위 플로팅 바 컨테이너
        this.floatingBarContainer = null;
        this.floatingEnergy = null;
        this.floatingStamina = null;
    }

    createUI(player) {
        // --- [수정] 남은 쥐 표시 UI를 왼쪽 상단(Score 있던 자리)으로 이동 ---
        
        // 쥐 아이콘 (위치: x=35, y=35) - 이미지 origin이 (0.5, 0.5)이므로 좌표 조정
        this.mouseIcon = this.scene.add.image(35, 35, 'mouse_icon')
            .setScrollFactor(0)
            .setDepth(100)
            .setScale(0.5); 

        // 남은 숫자 텍스트 (아이콘 옆, y=20은 기존 Score와 동일 높이)
        this.mouseText = this.scene.add.text(60, 20, ': 0', { 
            fontSize: '32px', 
            fill: '#fff',
            fontFamily: 'Arial',
            stroke: '#000',
            strokeThickness: 4
        }).setScrollFactor(0).setDepth(100);

        // --- 2. [신규] 캐릭터 따라다니는 플로팅 바 ---
        this.floatingBarContainer = this.scene.add.container(0, 0).setDepth(99);
        
        this.floatingEnergy = this.scene.add.graphics();
        this.floatingStamina = this.scene.add.graphics();
        
        this.floatingBarContainer.add([this.floatingEnergy, this.floatingStamina]);

        // 초기 그리기
        this.updateFloatingBars(player);
    }

    update() {
        const player = this.scene.data.get('player');
        if (!player || !player.active) {
            if (this.floatingBarContainer) this.floatingBarContainer.setVisible(false);
            return;
        }

        // --- 위치 동기화 ---
        this.floatingBarContainer.setPosition(player.x, player.y - 60);
        this.floatingBarContainer.setVisible(true);

        // --- 값 변경 감지 및 다시 그리기 ---
        this.updateFloatingBars(player);
        
        // [수정] Score 텍스트 업데이트 로직 제거

        // [신규] 남은 쥐 숫자 업데이트
        const remainingMice = this.scene.data.get('remainingMice') || 0;
        if (this.mouseText) {
            this.mouseText.setText(`: ${remainingMice}`);
        }
    }

    updateFloatingBars(player) {
        // 데이터 가져오기
        const energy = player.getData('energy') || 0;
        const maxEnergy = player.getData('maxEnergy') || 10;
        const stamina = player.getData('stamina') || 0;
        const maxStamina = player.getData('maxStamina') || 100;

        // 크기 설정
        const width = 80;
        const height = 8;
        const x = -width / 2; // 중앙 정렬

        // 1. 에너지 바 (체력 - 녹색)
        this.floatingEnergy.clear();
        
        // 배경 (검정)
        this.floatingEnergy.fillStyle(0x000000, 0.6);
        this.floatingEnergy.fillRect(x, 0, width, height);
        
        // 전경 (녹색)
        const energyRatio = Math.max(0, energy / maxEnergy);
        this.floatingEnergy.fillStyle(0x00ff00, 1);
        this.floatingEnergy.fillRect(x, 0, width * energyRatio, height);

        // 2. 기력 바 (스태미나 - 노랑)
        this.floatingStamina.clear();
        
        // 배경 (검정)
        this.floatingStamina.fillStyle(0x000000, 0.6);
        this.floatingStamina.fillRect(x, height + 2, width, height / 2);
        
        // 전경 (노랑)
        const staminaRatio = Math.max(0, stamina / maxStamina);
        this.floatingStamina.fillStyle(0xffff00, 1);
        this.floatingStamina.fillRect(x, height + 2, width * staminaRatio, height / 2);
    }
}