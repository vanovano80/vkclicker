// ==================== VK BRIDGE (актуальная версия) ====================
const VK = {
    bridge: null,
    ready: false,
    isTestMode: false,

    async init() {
        const detectBridge = () => {
            if (window.vkBridge !== undefined) {
                return window.vkBridge;
            }
            if (window.VKBridge !== undefined) {
                return window.VKBridge;
            }
            if (window.VK !== undefined && window.VK.Bridge !== undefined) {
                return window.VK.Bridge;
            }
            return null;
        };

        return new Promise((resolve) => {
            const completeInit = () => {
                this.ready = true;
                console.log('✅ VK Bridge инициализирован');
                resolve(true);
            };

            const setTestMode = (reason) => {
                console.warn('⚠️ Режим тестирования:', reason);
                this.isTestMode = true;
                this.ready = true;
                resolve(false);
            };

            const bridge = detectBridge();
            
            if (bridge) {
                this.bridge = bridge;

                if (typeof bridge.subscribe === 'function') {
                    bridge.subscribe((e) => {
                        console.log('VK Event:', e.detail?.type || e);
                    });
                }

                if (typeof bridge.send === 'function') {
                    bridge.send('VKWebAppInit')
                        .then(() => {
                            console.log('✅ VK инициализирован в приложении');
                            completeInit();
                        })
                        .catch((e) => {
                            console.warn('VK init error:', e);
                            setTestMode('Ошибка инициализации VK');
                        });
                } else {
                    setTestMode('bridge.send не функция');
                }
            } else {
                setTestMode('VK Bridge не найден (запуск вне VK)');
            }
            
            setTimeout(() => {
                if (!this.ready) {
                    setTestMode('Таймаут инициализации');
                }
            }, 3000);
        });
    },

    async send(method, params = {}) {
        if (this.isTestMode) {
            console.log('🔧 [TEST MODE] Вызов:', method, params);
            if (method === 'VKWebAppGetUserInfo') {
                return { first_name: 'Тестер', last_name: '', id: 1 };
            }
            return { result: true };
        }
        
        if (this.bridge && typeof this.bridge.send === 'function') {
            try {
                const result = await this.bridge.send(method, params);
                console.log('✅ VK send:', method, '=>', result);
                return result;
            } catch (error) {
                console.error('❌ VK send error:', method, error);
                throw error;
            }
        }
        throw new Error('VK bridge not ready');
    },

    isRewardSuccess(result) {
        if (this.isTestMode) return true;
        
        if (result === true || result === 'true' || result === 1) return true;
        if (result && (result.result === true || result.success === true)) return true;
        if (result && result.data && (result.data.result === true || result.data.success === true)) return true;
        
        return false;
    },

    async showRewardedVideo() {
        if (!this.ready) {
            console.warn('⚠️ VK showRewardedVideo: приложение не инициализировано');
            return false;
        }

        if (this.isTestMode) {
            console.log('🎮 [TEST MODE] Реклама "показана" (тестовый режим)');
            return true;
        }

        const isVKWebView = /VKWebView/i.test(navigator.userAgent) || 
                           /VKAndroidApp/i.test(navigator.userAgent) ||
                           /VKIOSApp/i.test(navigator.userAgent);
        
        if (!isVKWebView) {
            console.warn('⚠️ Платформа не поддерживает VK рекламу (запуск вне приложения VK)');
            return false;
        }

        try {
            console.log('📺 Попытка показа рекламы...');
            
            const result = await this.send('VKWebAppShowRewardedVideo', {});
            
            console.log('📺 Результат показа рекламы:', result);
            
            if (this.isRewardSuccess(result)) {
                console.log('✅ Реклама успешно показана, награда выдана');
                return true;
            } else if (result && result.result === false) {
                console.warn('❌ Пользователь не досмотрел рекламу');
                return false;
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ Ошибка показа рекламы:', error);
            
            const errorCode = error?.error_data?.error_code;
            const errorReason = error?.error_data?.error_reason || error?.message;
            
            if (errorCode === 6 || (errorReason && errorReason.includes('Unsupported platform'))) {
                console.warn('⚠️ Платформа не поддерживает рекламу');
                
                try {
                    console.log('🔄 Пробуем альтернативный метод VKWebAppShowAds...');
                    const altResult = await this.send('VKWebAppShowAds', {});
                    console.log('📺 Результат ShowAds:', altResult);
                    return this.isRewardSuccess(altResult);
                } catch (altError) {
                    console.warn('❌ Альтернативный метод тоже не сработал');
                }
            }
            
            return false;
        }
    },

    async getUserInfo() {
        if (!this.ready) return null;
        if (this.isTestMode) return { first_name: 'Тестер', last_name: '', id: 1 };
        
        try {
            return await this.send('VKWebAppGetUserInfo');
        } catch (e) {
            console.warn('⚠️ UserInfo error:', e);
            return null;
        }
    }
};

// ==================== СОСТОЯНИЕ ИГРЫ ====================
const Game = {
    balance: 0,
    clickPower: 1,
    autoLvl: 0,
    multiplier: 1,
    powerLvl: 1,
    multiLvl: 1,
    powerCost: 100,
    autoCost: 500,
    multiCost: 1000,
    progress: 0,
    progressGoal: 100,
    isDoubleActive: false,
    isReady: false
};

// ==================== DOM ЭЛЕМЕНТЫ ====================
const DOM = {
    loading: null,
    balance: null,
    character: null,
    scoreFloat: null,
    progressFill: null,
    multiplier: null,
    leftZone: null,
    rightZone: null,
    adBtn: null,
    powerBtn: null,
    autoBtn: null,
    multiBtn: null,
    powerLvl: null,
    autoLvl: null,
    multiLvl: null,
    powerPrice: null,
    autoPrice: null,
    multiPrice: null,
    upgradePanel: null,
    menuBtn: null,
    closePanel: null,

    init() {
        this.loading = document.getElementById('loadingScreen');
        this.balance = document.getElementById('balance');
        this.character = document.getElementById('character');
        this.scoreFloat = document.getElementById('scoreFloat');
        this.progressFill = document.getElementById('progressFill');
        this.multiplier = document.getElementById('multiplier');
        this.leftZone = document.getElementById('leftZone');
        this.rightZone = document.getElementById('rightZone');
        this.adBtn = document.getElementById('adBtn');
        this.powerBtn = document.getElementById('powerBtn');
        this.autoBtn = document.getElementById('autoBtn');
        this.multiBtn = document.getElementById('multiBtn');
        this.powerLvl = document.getElementById('powerLvl');
        this.autoLvl = document.getElementById('autoLvl');
        this.multiLvl = document.getElementById('multiLvl');
        this.powerPrice = document.getElementById('powerPrice');
        this.autoPrice = document.getElementById('autoPrice');
        this.multiPrice = document.getElementById('multiPrice');
        this.upgradePanel = document.getElementById('upgradePanel');
        this.menuBtn = document.getElementById('menuBtn');
        this.closePanel = document.getElementById('closePanel');
    }
};

// ==================== ОБНОВЛЕНИЕ UI ====================
function updateUI() {
    DOM.balance.textContent = formatNumber(Game.balance);
    DOM.powerLvl.textContent = Game.powerLvl;
    DOM.autoLvl.textContent = Game.autoLvl;
    DOM.multiLvl.textContent = Game.multiLvl;
    DOM.powerPrice.textContent = formatNumber(Game.powerCost);
    DOM.autoPrice.textContent = formatNumber(Game.autoCost);
    DOM.multiPrice.textContent = formatNumber(Game.multiCost);
    DOM.multiplier.textContent = Game.multiplier;

    const progress = (Game.progress / Game.progressGoal) * 100;
    DOM.progressFill.style.width = progress + '%';

    DOM.powerBtn.disabled = Game.balance < Game.powerCost;
    DOM.autoBtn.disabled = Game.balance < Game.autoCost;
    DOM.multiBtn.disabled = Game.balance < Game.multiCost;
}

function formatNumber(n) {
    n = Math.floor(n);
    if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
}

// ==================== АНИМАЦИИ ====================
function showScorePopup(points) {
    DOM.scoreFloat.textContent = '+' + points;
    DOM.scoreFloat.classList.remove('show');
    void DOM.scoreFloat.offsetWidth;
    DOM.scoreFloat.classList.add('show');

    DOM.character.classList.add('pop');
    setTimeout(() => DOM.character.classList.remove('pop'), 100);
}

function showLevelUp() {
    DOM.character.style.transform = 'scale(1.5)';
    DOM.character.style.textShadow = '0 0 50px #ffdd00';
    DOM.scoreFloat.textContent = '🔥 УРОВЕНЬ x' + Game.multiplier + '!';
    DOM.scoreFloat.classList.remove('show');
    void DOM.scoreFloat.offsetWidth;
    DOM.scoreFloat.classList.add('show');

    setTimeout(() => {
        DOM.character.style.transform = '';
        DOM.character.style.textShadow = '';
    }, 500);
}

// ==================== ИГРОВАЯ ЛОГИКА ====================
function addScore() {
    const mult = Game.isDoubleActive ? 2 : 1;
    const points = Game.clickPower * Game.multiplier * mult;

    Game.balance += points;
    Game.progress++;

    showScorePopup(points);

    if (Game.progress >= Game.progressGoal) {
        levelUp();
    }

    updateUI();
}

function levelUp() {
    Game.progress = 0;
    Game.multiLvl++;
    Game.multiplier = Game.multiLvl;
    Game.progressGoal = Math.floor(100 * Math.pow(1.5, Game.multiLvl - 1));
    showLevelUp();
}

function autoClick() {
    if (Game.autoLvl > 0) {
        const points = Game.autoLvl * Game.clickPower * Game.multiplier;
        Game.balance += points;
        updateUI();
    }
}

// ==================== ПРОКАЧКА ====================
function buyUpgrade(type) {
    switch (type) {
        case 'power':
            if (Game.balance >= Game.powerCost) {
                Game.balance -= Game.powerCost;
                Game.powerLvl++;
                Game.clickPower = Game.powerLvl;
                Game.powerCost = Math.floor(100 * Math.pow(1.5, Game.powerLvl - 1));
            }
            break;

        case 'auto':
            if (Game.balance >= Game.autoCost) {
                Game.balance -= Game.autoCost;
                Game.autoLvl++;
                Game.autoCost = Math.floor(500 * Math.pow(1.8, Game.autoLvl));
            }
            break;

        case 'multi':
            if (Game.balance >= Game.multiCost) {
                Game.balance -= Game.multiCost;
                Game.multiLvl++;
                Game.multiplier = Game.multiLvl;
                Game.multiCost = Math.floor(1000 * Math.pow(2, Game.multiLvl - 1));
            }
            break;
    }

    saveGame();
    updateUI();
}

// ==================== РЕКЛАМА ====================
async function watchAd() {
    // НЕТ ОГРАНИЧЕНИЯ ПО ОЧКАМ - реклама доступна всегда
    DOM.adBtn.disabled = true;
    DOM.adBtn.textContent = '⏳ Загрузка...';

    try {
        const success = await VK.showRewardedVideo();
        
        if (success) {
            activateDouble();
        } else {
            // Утешительный бонус если реклама не сработала
            DOM.adBtn.textContent = '⚠️ Бонус!';
            const bonus = Math.floor(Game.clickPower * Game.multiplier * 50);
            Game.balance += bonus;
            showScorePopup(bonus);
            updateUI();
            
            setTimeout(() => {
                DOM.adBtn.textContent = '➕ x2';
                DOM.adBtn.disabled = false;
                DOM.adBtn.style.background = '';
            }, 1500);
        }
    } catch (error) {
        console.error('Ошибка при показе рекламы:', error);
        DOM.adBtn.textContent = '❌ Ошибка';
        
        const bonus = Math.floor(Game.clickPower * Game.multiplier * 20);
        Game.balance += bonus;
        showScorePopup(bonus);
        updateUI();
        
        setTimeout(() => {
            DOM.adBtn.textContent = '➕ x2';
            DOM.adBtn.disabled = false;
            DOM.adBtn.style.background = '';
        }, 1500);
    }
}

function activateDouble() {
    Game.isDoubleActive = true;
    DOM.adBtn.textContent = '✓ x2 АКТИВЕН (30 сек)';
    DOM.adBtn.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
    DOM.adBtn.disabled = false;

    setTimeout(() => {
        Game.isDoubleActive = false;
        DOM.adBtn.textContent = '➕ x2';
        DOM.adBtn.style.background = '';
        DOM.adBtn.disabled = false;
    }, 30000);
}

// ==================== СОХРАНЕНИЕ ====================
function saveGame() {
    const data = {
        b: Game.balance,
        pl: Game.powerLvl,
        al: Game.autoLvl,
        ml: Game.multiLvl
    };
    localStorage.setItem('mem67_save', JSON.stringify(data));
}

function loadGame() {
    const saved = localStorage.getItem('mem67_save');
    if (saved) {
        try {
            const d = JSON.parse(saved);
            Game.balance = d.b || 0;
            Game.powerLvl = d.pl || 1;
            Game.autoLvl = d.al || 0;
            Game.multiLvl = d.ml || 1;
            Game.clickPower = Game.powerLvl;
            Game.multiplier = Game.multiLvl;
            Game.powerCost = Math.floor(100 * Math.pow(1.5, Game.powerLvl - 1));
            Game.autoCost = Math.floor(500 * Math.pow(1.8, Game.autoLvl));
            Game.multiCost = Math.floor(1000 * Math.pow(2, Game.multiLvl - 1));
        } catch (e) {
            console.error('Ошибка загрузки:', e);
        }
    }
}

// ==================== УПРАВЛЕНИЕ КАСАНИЯМИ ====================
function setupTouchControls() {
    let checkInterval = null;

    document.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });

    DOM.leftZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        DOM.leftZone.classList.add('active');
    }, { passive: false });

    DOM.leftZone.addEventListener('touchend', () => {
        DOM.leftZone.classList.remove('active');
    });

    DOM.leftZone.addEventListener('touchcancel', () => {
        DOM.leftZone.classList.remove('active');
    });

    DOM.rightZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        DOM.rightZone.classList.add('active');
    }, { passive: false });

    DOM.rightZone.addEventListener('touchend', () => {
        DOM.rightZone.classList.remove('active');
    });

    DOM.rightZone.addEventListener('touchcancel', () => {
        DOM.rightZone.classList.remove('active');
    });

    checkInterval = setInterval(() => {
        if (DOM.leftZone.classList.contains('active') && 
            DOM.rightZone.classList.contains('active')) {
            addScore();
        }
    }, 80);

    DOM.leftZone.addEventListener('mousedown', () => {
        DOM.leftZone.classList.add('active');
    });

    DOM.leftZone.addEventListener('mouseup', () => {
        DOM.leftZone.classList.remove('active');
    });

    DOM.leftZone.addEventListener('mouseleave', () => {
        DOM.leftZone.classList.remove('active');
    });

    DOM.rightZone.addEventListener('mousedown', () => {
        DOM.rightZone.classList.add('active');
    });

    DOM.rightZone.addEventListener('mouseup', () => {
        DOM.rightZone.classList.remove('active');
    });

    DOM.rightZone.addEventListener('mouseleave', () => {
        DOM.rightZone.classList.remove('active');
    });
}

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================
function setupEventListeners() {
    DOM.adBtn.addEventListener('click', watchAd);

    DOM.powerBtn.addEventListener('click', () => buyUpgrade('power'));
    DOM.autoBtn.addEventListener('click', () => buyUpgrade('auto'));
    DOM.multiBtn.addEventListener('click', () => buyUpgrade('multi'));

    DOM.menuBtn.addEventListener('click', () => {
        DOM.upgradePanel.classList.add('open');
    });

    DOM.closePanel.addEventListener('click', () => {
        DOM.upgradePanel.classList.remove('open');
    });

    let touchStartY = 0;
    DOM.upgradePanel.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: false });

    DOM.upgradePanel.addEventListener('touchmove', (e) => {
        const deltaY = e.touches[0].clientY - touchStartY;
        if (deltaY > 50) {
            DOM.upgradePanel.classList.remove('open');
        }
    }, { passive: false });

    window.addEventListener('beforeunload', saveGame);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            saveGame();
        }
    });
}

// ==================== ЗАПУСК ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Запуск приложения...');

    DOM.init();

    loadGame();

    updateUI();

    const vkReady = await VK.init();
    Game.isReady = vkReady;
    console.log('✅ VK Ready:', vkReady);

    setTimeout(() => {
        if (DOM.loading) {
            DOM.loading.classList.add('hidden');
        }
    }, 500);

    setupTouchControls();

    setupEventListeners();

    setInterval(autoClick, 1000);

    setInterval(saveGame, 5000);

    console.log('✅ Приложение готово!');
});
