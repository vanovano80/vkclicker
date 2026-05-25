const VK = {
    init: () => {
        if (window.vkBridge) {
            vkBridge.send('VKWebAppInit', {});
        }
    },
    
    getRewardedVideo: () => {
        return new Promise((resolve, reject) => {
            if (window.vkBridge) {
                vkBridge.send('VKWebAppGetRewardedVideo', { type: 'reward' })
                    .then(result => {
                        if (result.success) {
                            resolve(result);
                        } else {
                            reject(new Error('Реклама не загружена'));
                        }
                    })
                    .catch(err => {
                        reject(err);
                    });
            } else {
                // Тестовый режим для браузера
                console.log('VK SDK не найден - тестовый режим');
                resolve({ success: true, test: true });
            }
        });
    },
    
    showPayVault: (amount) => {
        return new Promise((resolve, reject) => {
            if (window.vkBridge) {
                vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' })
                    .then(resolve)
                    .catch(reject);
            } else {
                resolve({ success: true });
            }
        });
    }
};

// ==================== ИГРОВОЕ СОСТОЯНИЕ ====================
const GameState = {
    balance: 0,
    clickPower: 1,
    autoClicks: 0,
    multiplier: 1,
    
    // Уровни прокачки
    powerLevel: 1,
    autoLevel: 0,
    multiLevel: 1,
    
    // Стоимость прокачек
    powerCost: 100,
    autoCost: 500,
    multiCost: 1000,
    
    // Прогресс множителя
    multiplierProgress: 0,
    multiplierGoal: 100,
    
    // Сохранение
    save() {
        localStorage.setItem('mem67_save', JSON.stringify({
            balance: this.balance,
            powerLevel: this.powerLevel,
            autoLevel: this.autoLevel,
            multiLevel: this.multiLevel
        }));
    },
    
    load() {
        const saved = localStorage.getItem('mem67_save');
        if (saved) {
            const data = JSON.parse(saved);
            this.balance = data.balance || 0;
            this.powerLevel = data.powerLevel || 1;
            this.autoLevel = data.autoLevel || 0;
            this.multiLevel = data.multiLevel || 1;
            this.updateClickPower();
            this.updateMultiplier();
            this.updateCosts();
        }
    },
    
    updateClickPower() {
        this.clickPower = this.powerLevel;
    },
    
    updateMultiplier() {
        this.multiplier = this.multiLevel;
    },
    
    updateCosts() {
        this.powerCost = Math.floor(100 * Math.pow(1.5, this.powerLevel - 1));
        this.autoCost = Math.floor(500 * Math.pow(1.8, this.autoLevel));
        this.multiCost = Math.floor(1000 * Math.pow(2, this.multiLevel - 1));
    }
};

// ==================== УПРАВЛЕНИЕ КАСАНИЯМИ ====================
const TouchController = {
    leftTouch: null,
    rightTouch: null,
    leftStartY: 0,
    rightStartY: 0,
    lastLeftY: 0,
    lastRightY: 0,
    
    sensitivity: 30, // Порог для срабатывания
    
    init() {
        const leftZone = document.getElementById('leftZone');
        const rightZone = document.getElementById('rightZone');
        
        // Prevent default touch behavior
        document.body.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
        
        // Левый сенсор
        leftZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.leftTouch = e.touches[0];
            this.leftStartY = this.leftTouch.clientY;
            this.lastLeftY = this.leftStartY;
            leftZone.classList.add('active');
        }, { passive: false });
        
        leftZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.leftTouch) {
                const touch = e.touches[0];
                const deltaY = touch.clientY - this.lastLeftY;
                this.lastLeftY = touch.clientY;
                
                if (this.rightTouch) {
                    // Оба пальца активны - начисляем очки
                    this.processBothFingers(deltaY);
                }
            }
        }, { passive: false });
        
        leftZone.addEventListener('touchend', () => {
            this.leftTouch = null;
            leftZone.classList.remove('active');
        });
        
        leftZone.addEventListener('touchcancel', () => {
            this.leftTouch = null;
            leftZone.classList.remove('active');
        });
        
        // Правый сенсор
        rightZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.rightTouch = e.touches[0];
            this.rightStartY = this.rightTouch.clientY;
            this.lastRightY = this.rightStartY;
            rightZone.classList.add('active');
        }, { passive: false });
        
        rightZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.rightTouch) {
                const touch = e.touches[0];
                const deltaY = touch.clientY - this.lastRightY;
                this.lastRightY = touch.clientY;
                
                if (this.leftTouch) {
                    this.processBothFingers(deltaY);
                }
            }
        }, { passive: false });
        
        rightZone.addEventListener('touchend', () => {
            this.rightTouch = null;
            rightZone.classList.remove('active');
        });
        
        rightZone.addEventListener('touchcancel', () => {
            this.rightTouch = null;
            rightZone.classList.remove('active');
        });
        
        // Мышь для десктопного тестирования
        let mouseDownLeft = false, mouseDownRight = false;
        
        leftZone.addEventListener('mousedown', () => {
            mouseDownLeft = true;
            leftZone.classList.add('active');
        });
        
        leftZone.addEventListener('mousemove', (e) => {
            if (mouseDownLeft && mouseDownRight) {
                this.processBothFingers(e.movementY);
            }
        });
        
        leftZone.addEventListener('mouseup', () => {
            mouseDownLeft = false;
            leftZone.classList.remove('active');
        });
        
        leftZone.addEventListener('mouseleave', () => {
            mouseDownLeft = false;
            leftZone.classList.remove('active');
        });
        
        rightZone.addEventListener('mousedown', () => {
            mouseDownRight = true;
            rightZone.classList.add('active');
        });
        
        rightZone.addEventListener('mousemove', (e) => {
            if (mouseDownLeft && mouseDownRight) {
                this.processBothFingers(e.movementY);
            }
        });
        
        rightZone.addEventListener('mouseup', () => {
            mouseDownRight = false;
            rightZone.classList.remove('active');
        });
        
        rightZone.addEventListener('mouseleave', () => {
            mouseDownRight = false;
            rightZone.classList.remove('active');
        });
    },
    
    processBothFingers(deltaY) {
        if (Math.abs(deltaY) > 0) {
            const direction = deltaY < 0 ? 'up' : 'down';
            GameController.addScore(direction);
            GameController.animateCharacter();
        }
    }
};

// ==================== КОНТРОЛЛЕР ИГРЫ ====================
const GameController = {
    scoreAccumulator: 0,
    isDoubled: false,
    
    init() {
        GameState.load();
        TouchController.init();
        this.updateUI();
        
        // Авто-клики
        setInterval(() => this.autoClick(), 1000);
        
        // Автосохранение
        setInterval(() => GameState.save(), 5000);
        
        // Обработчики кнопок
        document.getElementById('toggleUpgrades').addEventListener('click', () => {
            document.getElementById('upgradePanel').classList.toggle('open');
        });
        
        document.getElementById('doubleBtn').addEventListener('click', () => this.watchAd());
        document.getElementById('powerBtn').addEventListener('click', () => this.buyUpgrade('power'));
        document.getElementById('autoBtn').addEventListener('click', () => this.buyUpgrade('auto'));
        document.getElementById('multiBtn').addEventListener('click', () => this.buyUpgrade('multi'));
        
        // Инициализация VK
        VK.init();
        
        // Обработка закрытия приложения
        window.addEventListener('beforeunload', () => GameState.save());
    },
    
    addScore(direction) {
        const multiplier = this.isDoubled ? 2 : 1;
        const points = GameState.clickPower * GameState.multiplier * multiplier;
        
        GameState.balance += points;
        GameState.multiplierProgress += 1;
        
        // Анимация очков
        this.showScorePopup(points);
        this.updateUI();
        
        // Проверка прогресса множителя
        if (GameState.multiplierProgress >= GameState.multiplierGoal) {
            this.levelUpMultiplier();
        }
    },
    
    showScorePopup(points) {
        const popup = document.getElementById('scorePopup');
        popup.textContent = `+${points}`;
        popup.style.animation = 'none';
        popup.offsetHeight; // Trigger reflow
        popup.style.animation = 'scoreFloat 1s forwards';
    },
    
    animateCharacter() {
        const char = document.getElementById('character');
        char.classList.add('active');
        setTimeout(() => char.classList.remove('active'), 100);
    },
    
    levelUpMultiplier() {
        GameState.multiplierProgress = 0;
        GameState.multiLevel++;
        GameState.multiplierGoal = Math.floor(100 * Math.pow(1.5, GameState.multiLevel - 1));
        GameState.updateMultiplier();
        this.updateUI();
    },
    
    autoClick() {
        if (GameState.autoLevel > 0) {
            const autoPoints = GameState.autoLevel * GameState.clickPower * GameState.multiplier;
            GameState.balance += autoPoints;
            this.updateUI();
        }
    },
    
    watchAd() {
        document.getElementById('doubleBtn').textContent = '⏳ Загрузка...';
        document.getElementById('doubleBtn').disabled = true;
        
        VK.getRewardedVideo()
            .then(result => {
                this.isDoubled = true;
                document.getElementById('doubleBtn').textContent = '✓ x2 АКТИВНО!'; 
                  // Снимаем x2 через 30 секунд
                setTimeout(() => {
                    this.isDoubled = false;
                    document.getElementById('doubleBtn').innerHTML = '<span>🎬</span> x2 за рекламу';
                    document.getElementById('doubleBtn').disabled = false;
                }, 30000);
            })
            .catch(err => {
                console.error('Реклама:', err);
                document.getElementById('doubleBtn').innerHTML = '<span>🎬</span> x2 за рекламу';
                document.getElementById('doubleBtn').disabled = false;
                
                // Fallback - тестовый режим
                if (window.location.hostname === 'localhost' || window.location.search === '?test') {
                    this.isDoubled = true;
                    document.getElementById('doubleBtn').textContent = '✓ x2 ТЕСТ!';
                    setTimeout(() => {
                        this.isDoubled = false;
                        document.getElementById('doubleBtn').innerHTML = '<span>🎬</span> x2 за рекламу';
                    }, 30000);
                }
            });
    },
    
    buyUpgrade(type) {
        let cost, levelKey, costKey;
        
        switch(type) {
            case 'power':
                cost = GameState.powerCost;
                if (GameState.balance >= cost) {
                    GameState.balance -= cost;
                    GameState.powerLevel++;
                    GameState.updateClickPower();
                    GameState.updateCosts();
                }
                break;
            case 'auto':
                cost = GameState.autoCost;
                if (GameState.balance >= cost) {
                    GameState.balance -= cost;
                    GameState.autoLevel++;
                    GameState.updateCosts();
                }
                break;
            case 'multi':
                cost = GameState.multiCost;
                if (GameState.balance >= cost) {
                    GameState.balance -= cost;
                    GameState.multiLevel++;
                    GameState.updateMultiplier();
                    GameState.updateCosts();
                }
                break;
        }
        
        GameState.save();
        this.updateUI();
    },
    
    updateUI() {
        // Баланс
        document.getElementById('balance').textContent = this.formatNumber(GameState.balance);
        
        // Уровни
        document.getElementById('powerLevel').textContent = GameState.powerLevel;
        document.getElementById('autoLevel').textContent = GameState.autoLevel;
        document.getElementById('multiLevel').textContent = GameState.multiLevel;
        
        // Стоимость
        document.getElementById('powerCost').textContent = this.formatNumber(GameState.powerCost);
        document.getElementById('autoCost').textContent = this.formatNumber(GameState.autoCost);
        document.getElementById('multiCost').textContent = this.formatNumber(GameState.multiCost);
        
        // Множитель
        document.getElementById('multiplierValue').textContent = GameState.multiplier;
        
        // Прогресс-бар
        const progress = (GameState.multiplierProgress / GameState.multiplierGoal) * 100;
        document.getElementById('multiplierFill').style.width = `${progress}%`;
        
        // Доступность кнопок
        document.getElementById('powerBtn').disabled = GameState.balance < GameState.powerCost;
        document.getElementById('autoBtn').disabled = GameState.balance < GameState.autoCost;
        document.getElementById('multiBtn').disabled = GameState.balance < GameState.multiCost;
    },
    
    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
};

// ==================== ЗАПУСК ====================
document.addEventListener('DOMContentLoaded', ()
  => {
    GameController.init();
});
