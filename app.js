// ==================== VK BRIDGE ====================
let vkBridge = {
    ready: false,
    
    init() {
        return new Promise((resolve) => {
            if (window.vkBridge) {
                window.vkBridge.subscribe((e) => {
                    if (e.detail && e.detail.type === 'VKWebAppViewHide') {
                        // Приложение свернуто
                    }
                });
                
                window.vkBridge.send('VKWebAppInit')
                    .then(() => {
                        this.ready = true;
                        resolve();
                    })
                    .catch(() => resolve());
            } else {
                // Браузерный режим - не VK
                resolve();
            }
        });
    },
    
    async showRewardedAd() {
        if (window.vkBridge) {
            try {
                const result = await window.vkBridge.send('VKWebAppShowRewardedVideo', {
                    type: 'reward'
                });
                return result.success === true;
            } catch (e) {
                console.error('Реклама недоступна:', e);
                return false;
            }
        }
        return false;
    },
    
    getUserId() {
        if (window.vkBridge) {
            return window.vkBridge.send('VKWebAppGetUserInfo')
                .then(data => data.id)
                .catch(() => null);
        }
        return Promise.resolve(null);
    }
};

// ==================== СОСТОЯНИЕ ИГРЫ ====================
const state = {
    balance: 0,
    clickPower: 1,
    autoLevel: 0,
    multiplier: 1,
    powerLvl: 1,
    autoLvl: 0,
    multiLvl: 1,
    powerCost: 100,
    autoCost: 500,
    multiCost: 1000,
    progress: 0,
    progressGoal: 100,
    isAdActive: false,
    isReady: false
};

// ==================== UI ====================
function updateUI() {
    document.getElementById('balance').textContent = formatNum(state.balance);
    document.getElementById('powerLvl').textContent = state.powerLvl;
    document.getElementById('autoLvl').textContent = state.autoLvl;
    document.getElementById('multiLvl').textContent = state.multiLvl;
    document.getElementById('powerPrice').textContent = formatNum(state.powerCost);
    document.getElementById('autoPrice').textContent = formatNum(state.autoCost);
    document.getElementById('multiPrice').textContent = formatNum(state.multiCost);
    document.getElementById('multiplier').textContent = state.multiplier;
    
    const progress = (state.progress / state.progressGoal) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    
    document.getElementById('powerBtn').disabled = state.balance < state.powerCost;
    document.getElementById('autoBtn').disabled = state.balance < state.autoCost;
    document.getElementById('multiBtn').disabled = state.balance < state.multiCost;
}

function formatNum(n) {
    n = Math.floor(n);
    if (n >= 1000000000) return (n/1000000000).toFixed(1) + 'B';
    if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n/1000).toFixed(1) + 'K';
    return n.toString();
}

function showPopup(text) {
    const popup = document.getElementById('scoreFloat');
    popup.textContent = text;
    popup.classList.remove('show');
    void popup.offsetWidth;
    popup.classList.add('show');
    
    const char = document.getElementById('character');
    char.classList.add('pop');
    setTimeout(() => char.classList.remove('pop'), 100);
}

function activateDouble() {
    state.isAdActive = true;
    const btn = document.getElementById('adBtn');
    btn.textContent = '✓ x2 АКТИВЕН';
    btn.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
    
    setTimeout(() => {
        state.isAdActive = false;
        btn.textContent = '🎬 x2';
        btn.style.background ='';
    }, 30000);
}

// ==================== ИГРОВАЯ ЛОГИКА ====================
function addScore() {
    const mult = state.isAdActive ? 2 : 1;
    const points = state.clickPower * state.multiplier * mult;
    
    state.balance += points;
    state.progress++;
    
    showPopup('+' + points);
    
    if (state.progress >= state.progressGoal) {
        levelUp();
    }
    
    updateUI();
}

function levelUp() {
    state.progress = 0;
    state.multiLvl++;
    state.multiplier = state.multiLvl;
    state.progressGoal = Math.floor(100 * Math.pow(1.5, state.multiLvl - 1));
    
    const char = document.getElementById('character');
    char.style.transform = 'scale(1.5)';
    char.style.color = '#ffdd00';
    setTimeout(() => {
        char.style.transform = '';
        char.style.color = '';
    }, 500);
    
    showPopup('🔥 УРОВЕНЬ x' + state.multiplier + '!');
}

function autoClick() {
    if (state.autoLvl > 0) {
        state.balance += state.autoLvl * state.clickPower * state.multiplier;
        updateUI();
    }
}

// ==================== ПРОКАЧКА ====================
function buyUpgrade(type) {
    switch(type) {
        case 'power':
            if (state.balance >= state.powerCost) {
                state.balance -= state.powerCost;
                state.powerLvl++;
                state.clickPower = state.powerLvl;
                state.powerCost = Math.floor(100 * Math.pow(1.5, state.powerLvl - 1));
            }
            break;
        case 'auto':
            if (state.balance >= state.autoCost) {
                state.balance -= state.autoCost;
                state.autoLvl++;
                state.autoCost = Math.floor(500 * Math.pow(1.8, state.autoLvl));
            }
            break;
        case 'multi':
            if (state.balance >= state.multiCost) {
                state.balance -= state.multiCost;
                state.multiLvl++;
                state.multiplier = state.multiLvl;
                state.multiCost = Math.floor(1000 * Math.pow(2, state.multiLvl - 1));
            }
            break;
    }
    
    saveGame();
    updateUI();
}

// ==================== СОХРАНЕНИЕ ====================
function saveGame() {
    localStorage.setItem('mem67_save', JSON.stringify({
        b: state.balance,
        pl: state.powerLvl,
        al: state.autoLvl,
        ml: state.multiLvl
    }));
}

function loadGame() {
    const saved = localStorage.getItem('mem67_save');
    if (saved) {
        const d = JSON.parse(saved);
        state.balance = d.b || 0;
        state.powerLvl = d.pl || 1;
        state.autoLvl = d.al || 0;
        state.multiLvl = d.ml || 1;
        state.clickPower = state.powerLvl;
        state.multiplier = state.multiLvl;
        state.powerCost = Math.floor(100 * Math.pow(1.5, state.powerLvl - 1));
        state.autoCost = Math.floor(500 * Math.pow(1.8, state.autoLvl));
        state.multiCost = Math.floor(1000 * Math.pow(2, state.multiLvl - 1));
    }
}

// ==================== СЕНСОРЫ ====================
function setupTouch() {
    const left = document.getElementById('leftZone');
    const right = document.getElementById('rightZone');
    let touchInterval = null;
    
    function checkBoth() {
        if (left.classList.contains('active') && right.classList.contains('active')) {
            addScore();
        }
    }
    
    // Блокируем скролл
    document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    
    // Левый
    left.addEventListener('touchstart', e => {
        e.preventDefault();
        left.classList.add('active');
    }, { passive: false });
    
    left.addEventListener('touchend', () => left.classList.remove('active'));
    left.addEventListener('touchcancel', () => left.classList.remove('active'));
    
    // Правый
    right.addEventListener('touchstart', e => {
        e.preventDefault();
        right.classList.add('active');
    }, { passive: false });
    
    right.addEventListener('touchend', () => right.classList.remove('active'));
    right.addEventListener('touchcancel', () => right.classList.remove('active'));
    
    // Проверка каждые 100ms
    setInterval(checkBoth, 100);
    
    // Мышь для десктопа
    left.addEventListener('mousedown', () => left.classList.add('active'));
    left.addEventListener('mouseup', () => left.classList.remove('active'));
    left.addEventListener('mouseleave', () => left.classList.remove('active'));
    
    right.addEventListener('mousedown', () => right.classList.add('active'));
    right.addEventListener('mouseup', () => right.classList.remove('active'));
    right.addEventListener('mouseleave', () => right.classList.remove('active'));
}

// ==================== ГЛАВНАЯ ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Загружаем сохранение
    loadGame();
    updateUI();
    
    // Инициализируем VK Bridge
    await vkBridge.init();
    state.isReady = true;
    
    // Скрываем загрузку
    const loading = document.getElementById('loadingScreen');
    loading.classList.add('hidden');
    
    // Настраиваем управление
    setupTouch();
    
    // Авто-клик
    setInterval(autoClick, 1000);
    
    // Автосохранение
    setInterval(saveGame, 5000);
    
    // ============ ОБРАБОТЧИКИ ============
    
    // Реклама
    document.getElementById('adBtn').addEventListener('click', async () => {
        const btn = document.getElementById('adBtn');
        btn.disabled = true;
        btn.textContent = '⏳...';
        
        const success = await vkBridge.showRewardedAd();
        
        if (success) {
            activateDouble();
        } else {
            // Тестовый режим
            console.log('Тест: активируем x2');
            activateDouble();
        }
        
        btn.disabled = false;
    });
    
    // Прокачки
    document.getElementById('powerBtn').addEventListener('click', () => buyUpgrade('power'));
    document.getElementById('autoBtn').addEventListener('click', () => buyUpgrade('auto'));
    document.getElementById('multiBtn').addEventListener('click', () => buyUpgrade('multi'));
    
    // Панель
    document.getElementById('menuBtn').addEventListener('click', () => {
        document.getElementById('upgradePanel').classList.add('open');
    });
    
    document.getElementById('closePanel').addEventListener('click', () => {
        document.getElementById('upgradePanel').classList.remove('open');
    });
    
    // Выход
    window.addEventListener('beforeunload', saveGame);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) saveGame();
    });
});
