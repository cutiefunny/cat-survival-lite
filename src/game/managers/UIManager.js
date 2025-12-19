import Phaser from 'phaser';

export default class UIManager {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        
        this.energyBarBg = null;
        this.staminaBarBg = null;
        this.expBarBg = null;
        this.energyBarFill = null;
        this.staminaBarFill = null;
        this.expBarFill = null;
        this.shockwaveCooldownText = null;
    }

    createUI(player) {
        this.energyBarBg = this.scene.add.graphics();
        this.staminaBarBg = this.scene.add.graphics();
        this.expBarBg = this.scene.add.graphics();
        this.energyBarFill = this.scene.add.graphics();
        this.staminaBarFill = this.scene.add.graphics();
        this.expBarFill = this.scene.add.graphics();
        
        const graphics = [this.energyBarBg, this.staminaBarBg, this.expBarBg, this.energyBarFill, this.staminaBarFill, this.expBarFill];
        graphics.forEach(g => {
            g.setScrollFactor(0);
            g.setDepth(10);
        });

        this.shockwaveCooldownText = this.scene.add.text(player.x, player.y, '', {
            fontSize: '18px', color: '#FFFF00', stroke: '#000000', strokeThickness: 4, align: 'center', fontStyle: 'bold'
        });
        this.shockwaveCooldownText.setOrigin(0.5, 1.5);
        this.shockwaveCooldownText.setDepth(11);
        this.shockwaveCooldownText.setVisible(false);
        this.scene.data.set('shockwaveCooldownText', this.shockwaveCooldownText);

        const drawUI = () => { this._drawUI(player); };
        this.scene.data.set('drawUI', drawUI);
        
        // 초기 그리기
        drawUI(); 
        
        // 데이터 변경 감지 이벤트 연결
        player.on('changedata-energy', drawUI);
        player.on('changedata-stamina', drawUI);
        
        // 쇼크웨이브 UI 헬퍼
        const setShockwaveReady = (isReady) => {
            // 필요 시 UI 효과 추가
        };
        this.scene.data.set('setShockwaveReady', setShockwaveReady);
    }

    _drawUI(player) {
        if (!player.active) return;
        const screenWidth = this.scene.cameras.main.width;
        
        const barWidth = this.config.ENERGY_BAR_WIDTH;
        const barX = screenWidth / 2 - (barWidth / 2);
        
        const energyY = 20;
        const staminaY = energyY + this.config.ENERGY_BAR_HEIGHT + 4;
        const expY = staminaY + this.config.STAMINA_BAR_HEIGHT + 4;

        // 1. Energy
        const currentEnergy = player.getData('energy');
        const maxEnergy = player.getData('maxEnergy');
        const energyPercent = Phaser.Math.Clamp(currentEnergy / maxEnergy, 0, 1);
        
        this.energyBarBg.clear().fillStyle(0x000000, 0.5).fillRect(barX, energyY, this.config.ENERGY_BAR_WIDTH, this.config.ENERGY_BAR_HEIGHT);
        this.energyBarFill.clear().fillStyle(0x00ff00, 1).fillRect(barX, energyY, this.config.ENERGY_BAR_WIDTH * energyPercent, this.config.ENERGY_BAR_HEIGHT);

        // 2. Stamina
        const currentStamina = player.getData('stamina');
        const maxStamina = player.getData('maxStamina');
        const staminaPercent = Phaser.Math.Clamp(currentStamina / maxStamina, 0, 1);
        
        this.staminaBarBg.clear().fillStyle(0x000000, 0.5).fillRect(barX, staminaY, this.config.STAMINA_BAR_WIDTH, this.config.STAMINA_BAR_HEIGHT);
        this.staminaBarFill.clear().fillStyle(this.config.STAMINA_BAR_COLOR, 1).fillRect(barX, staminaY, this.config.STAMINA_BAR_WIDTH * staminaPercent, this.config.STAMINA_BAR_HEIGHT);

        // 3. EXP
        const totalMice = this.scene.enemyManager ? this.scene.enemyManager.stageMiceTotal : 1;
        const killedMice = this.scene.enemyManager ? this.scene.enemyManager.stageMiceKilled : 0;
        const progressPercent = Phaser.Math.Clamp(killedMice / totalMice, 0, 1);
        
        this.expBarBg.clear().fillStyle(0x000000, 0.5).fillRect(barX, expY, this.config.EXP_BAR_WIDTH, this.config.EXP_BAR_HEIGHT);
        this.expBarFill.clear().fillStyle(0xffff00, 1).fillRect(barX, expY, this.config.EXP_BAR_WIDTH * progressPercent, this.config.EXP_BAR_HEIGHT);
    }

    update() {
        const skills = this.scene.data.get('skills') || [];
        const hasShockwave = skills.includes(this.config.SHOCKWAVE_SKILL_ID);
        const player = this.scene.data.get('player');

        // 스킬 초기화 체크 (MainScene 로직에서 옮겨옴)
        if (hasShockwave && this.scene.data.get('shockwaveReady') === undefined) {
             this.scene.data.set('shockwaveReady', false);
             // 초기 쿨타임 시작 로직이 필요하다면 여기에 추가 (지금은 PlayerManager에서 트리거될 때 시작됨)
             // 첫 시작은 쿨타임 없이 사용 가능하게 하려면 true로 설정
             this.scene.data.set('shockwaveReady', true); 
        }

        if (hasShockwave && this.shockwaveCooldownText && player && player.active) {
             this.shockwaveCooldownText.setPosition(player.x, player.y - (player.displayHeight / 2) * player.scaleY - 40);
             this.shockwaveCooldownText.setVisible(true);
             const isReady = this.scene.data.get('shockwaveReady');
             
             if (isReady) {
                 this.shockwaveCooldownText.setText('⚡');
             } else {
                 const timer = this.scene.data.get('shockwaveTimerEvent');
                 if (timer) {
                     const remain = timer.getRemaining(); 
                     const remainSec = Math.ceil(remain / 1000);
                     this.shockwaveCooldownText.setText(remainSec);
                 }
             }
        } else if (this.shockwaveCooldownText) {
             this.shockwaveCooldownText.setVisible(false);
        }
    }
}