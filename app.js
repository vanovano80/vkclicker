// ==================== VK BRIDGE (актуальная версия) ====================
const VK = {
    bridge: null,
    ready: false,

    async init() {
        const detectBridge = () => {
            if (window.vkBridge !== undefined) {
                return window.vkBridge;
            }
            if (window.VK !== undefined && window.VK.Bridge !== undefined) {
                return window.VK.Bridge;
            }
            return null;
        };

        return new Promise((resolve) => {
            const checkVK = setInterval(() => {
                const bridge = detectBridge();
                if (bridge) {
                    clearInterval(checkVK);
                    this.bridge = bridge;
                    this.ready = true;

                    if (typeof bridge.subscribe === 'function') {
                        bridge.subscribe((e) => console.log('VK Event:', e));
                    }

                    if (typeof bridge.send === 'function') {
                        bridge.send('VKWebAppInit')
                            .then(() => console.log('VK инициализирован'))
                            .catch((e) => console.warn('VK init error:', e))
                            .finally(() => resolve());
                    } else {
                        resolve();
                    }
                }
            }, 100);

            setTimeout(() => {
                clearInterval(checkVK);
                if (!this.ready) {
                    const bridge = detectBridge();
                    if (bridge) {
                        this.bridge = bridge;
                        this.ready = true;
                    }
                }
                resolve();
            }, 3000);
        });
    },

    async send(method, params = {}) {
        if (this.bridge && typeof this.bridge.send === 'function') {
            return this.bridge.send(method, params);
        }
        throw new Error('VK bridge not ready');
    },

    async showRewardedVideo() {
        try {
            const result = await this.send('VKWebAppShowRewardedVideo', {
                type: 'reward'
            });
            console.log('Rewarded result:', result);
            return result && result.success === true;
        } catch (e) {
            console.error('Реклама ошибка:', e);
            return false;
        }
    },

    async getUserInfo() {
        try {
            return await this.send('VKWebAppGetUserInfo');
        } catch (e) {
            console.warn('UserInfo error:', e);
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
    DOM.adBtn.disabled = true;
    DOM.adBtn.textContent = '⏳...';

    const success = await VK.showRewardedVideo();

    if (success) {
        activateDouble();
    } else {
        // Показываем кнопку обратно
        DOM.adBtn.textContent = '🎬 x2';
        DOM.adBtn.disabled = false;
        
        // Можно показать сообщение что реклама недоступна
        alert('Реклама недоступна. Набери ' + Game.powerCost + ' очков для прокачки!');
    }
}

function activateDouble() {
    Game.isDoubleActive = true;
    DOM.adBtn.textContent = '✓ x2 АКТИВЕН';
    DOM.adBtn.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';

    setTimeout(() => {
        Game.isDoubleActive = false;
        DOM.adBtn.textContent = '🎬 x2';
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

    // Блокируем скролл страницы
    document.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });

    // Левый сенсор
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

    // Правый сенсор
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

    // Проверка нажатий каждые 80мс
    checkInterval = setInterval(() => {
        if (DOM.leftZone.classList.contains('active') && 
            DOM.rightZone.classList.contains('active')) {
            addScore();
        }
    }, 80);

    // Поддержка мыши для десктопа
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
    // Реклама
    DOM.adBtn.addEventListener('click', watchAd);

    // Прокачки
    DOM.powerBtn.addEventListener('click', () => buyUpgrade('power'));
    DOM.autoBtn.addEventListener('click', () => buyUpgrade('auto'));
    DOM.multiBtn.addEventListener('click', () => buyUpgrade('multi'));

    // Открытие/закрытие панели
    DOM.menuBtn.addEventListener('click', () => {
        DOM.upgradePanel.classList.add('open');
    });

    DOM.closePanel.addEventListener('click', () => {
        DOM.upgradePanel.classList.remove('open');
    });

    // Закрытие по свайпу вниз на панели
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

    // Сохранение при выходе
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

    // Инициализируем DOM
    DOM.init();

    // Загружаем сохранение
    loadGame();

    // Обновляем UI
    updateUI();

    // Инициализируем VK Bridge
    await VK.init();
    Game.isReady = true;
    console.log('✅ VK Ready:', VK.ready);

    // Скрываем загрузку
    setTimeout(() => {
        if (DOM.loading) {
            DOM.loading.classList.add('hidden');
        }
    }, 500);

    // Настраиваем управление
    setupTouchControls();

    // Настраиваем обработчики
    setupEventListeners();

    // Авто-клик каждую секунду
    setInterval(autoClick, 1000);

    // Автосохранение каждые 5 секунд
    setInterval(saveGame, 5000);

    console.log('✅ Приложение готово!');
});
