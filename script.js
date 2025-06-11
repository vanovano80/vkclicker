// Конфигурация приложения
const config = {
  initialClickValue: 0.001,
  clickUpgrades: [
    {
      name: "Улучшенный палец",
      description: "Базовое увеличение клика",
      levels: 10,
      baseCost: 10,
      costMultiplier: 1.5,
      baseValue: 0.002,
      valueMultiplier: 1.2,
      icon: "👆"
    },
    {
      name: "Золотой палец",
      description: "Значительное увеличение клика",
      levels: 5,
      baseCost: 100,
      costMultiplier: 2,
      baseValue: 0.01,
      valueMultiplier: 1.5,
      icon: "👉",
      requires: { upgradeIndex: 0, minLevel: 5 }
    }
  ],
  autoClickUpgrades: [
    {
      name: "Новичок-майнер",
      description: "Базовый автомайнинг",
      levels: 10,
      baseCost: 50,
      costMultiplier: 1.8,
      baseValue: 0.01,
      valueMultiplier: 1.3,
      icon: "⛏️"
    },
    {
      name: "Профессионал-майнер",
      description: "Улучшенный автомайнинг",
      levels: 5,
      baseCost: 500,
      costMultiplier: 2.2,
      baseValue: 0.1,
      valueMultiplier: 1.7,
      icon: "⚒️",
      requires: { upgradeIndex: 0, minLevel: 5 }
    }
  ],
  adMultiplier: 2,
  adDuration: 30000,    // 30 секунд
  adCooldown: 60000,    // 1 минута
  adRetryDelay: 30000,  // 30 секунд
  bannerAdRefresh: 60000 // 60 секунд между обновлениями баннера
};

// Данные игрока
let currentPlayer = {
  id: 0,
  name: "Вы",
  score: 0,
  clickUpgrades: config.clickUpgrades.map(() => ({ level: 0 })),
  autoClickUpgrades: config.autoClickUpgrades.map(() => ({ level: 0 })),
  baseClickValue: config.initialClickValue,
  totalClickValue: config.initialClickValue,
  totalAutoClickValue: 0,
  adMultiplierActive: false,
  adMultiplierEndTime: 0,
  adButtonCooldownEnd: 0,
  autoClickInterval: null,
  adReady: false,
  lastAdCheckTime: 0,
  bannerAdInterval: null
};

// Инициализация базы данных
let db;
const DB_NAME = 'ClickerGameDB';
const DB_VERSION = 1;
const PLAYERS_STORE = 'players';
const SAVE_STORE = 'gameSaves';

function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(PLAYERS_STORE)) {
        const store = db.createObjectStore(PLAYERS_STORE, { keyPath: 'id' });
        store.createIndex('score', 'score', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(SAVE_STORE)) {
        db.createObjectStore(SAVE_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('Ошибка открытия базы данных:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Сохранение данных игрока
async function savePlayerData() {
  if (!db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SAVE_STORE], 'readwrite');
    const store = transaction.objectStore(SAVE_STORE);
    
    const saveData = {
      id: currentPlayer.id,
      data: JSON.stringify(currentPlayer),
      timestamp: Date.now()
    };
    
    const request = store.put(saveData);
    
    request.onsuccess = () => resolve();
    request.onerror = (event) => {
      console.error('Ошибка сохранения:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Загрузка данных игрока
async function loadPlayerData() {
  if (!db) return;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SAVE_STORE], 'readonly');
    const store = transaction.objectStore(SAVE_STORE);
    
    const request = store.get(currentPlayer.id);
    
    request.onsuccess = () => {
      if (request.result) {
        try {
          const data = JSON.parse(request.result.data);
          Object.assign(currentPlayer, data);
          
          // Восстановление таймеров
          if (currentPlayer.adMultiplierEndTime > Date.now()) {
            currentPlayer.adMultiplierActive = true;
            setTimeout(endAdMultiplier, currentPlayer.adMultiplierEndTime - Date.now());
          }
          
          calculateTotalClickValue();
          calculateTotalAutoClickValue();
          startAutoClicker();
          updateUI();
        } catch (e) {
          console.error('Ошибка загрузки данных:', e);
        }
      }
      resolve();
    };
    
    request.onerror = (event) => {
      console.error('Ошибка загрузки:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Сохранение топ-игроков
async function saveTopPlayer() {
  if (!db || currentPlayer.id === 0) return;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PLAYERS_STORE], 'readwrite');
    const store = transaction.objectStore(PLAYERS_STORE);
    
    const playerData = {
      id: currentPlayer.id,
      name: currentPlayer.name,
      score: currentPlayer.score,
      timestamp: Date.now()
    };
    
    const request = store.put(playerData);
    
    request.onsuccess = () => resolve();
    request.onerror = (event) => {
      console.error('Ошибка сохранения топ-игрока:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Получение топ-игроков
async function getTopPlayers(limit = 100) {
  if (!db) return [];
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PLAYERS_STORE], 'readonly');
    const store = transaction.objectStore(PLAYERS_STORE);
    const index = store.index('score');
    
    const request = index.openCursor(null, 'prev');
    const topPlayers = [];
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && topPlayers.length < limit) {
        topPlayers.push(cursor.value);
        cursor.continue();
      } else {
        resolve(topPlayers);
      }
    };
    
    request.onerror = (event) => {
      console.error('Ошибка получения топ-игроков:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Инициализация VK Bridge
async function initVKBridge() {
  try {
    await initDatabase();
    
    if (typeof vkBridge !== 'undefined') {
      await vkBridge.send('VKWebAppInit');
      console.log('VK Bridge инициализирован');
      
      const user = await vkBridge.send('VKWebAppGetUserInfo');
      currentPlayer.id = user.id;
      currentPlayer.name = `${user.first_name} ${user.last_name}`;
      
      await loadPlayerData();
      initAdSystem();
      startAdMultiplierCheck();
      initBannerAd();
    } else {
      console.log('VK Bridge не обнаружен, активирован тестовый режим');
      initTestMode();
    }
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    initTestMode();
  }
}

// Тестовый режим
async function initTestMode() {
  try {
    await initDatabase();
    
    currentPlayer.id = 999;
    currentPlayer.name = "Тестовый режим";
    currentPlayer.adReady = true;
    
    await loadPlayerData();
    startAdMultiplierCheck();
    initBannerAd();
  } catch (error) {
    console.error('Ошибка тестового режима:', error);
  }
}

// Инициализация баннерной рекламы
function initBannerAd() {
  const banner = document.getElementById('banner-ad');
  
  if (!banner) {
    console.error('Элемент баннера не найден');
    return;
  }

  if (typeof vkBridge === 'undefined') {
    // Тестовый режим
    banner.innerHTML = '<p>Здесь был бы рекламный баннер</p>';
    return;
  }

  // Функция показа баннера
  const showBanner = () => {
    vkBridge.send('VKWebAppShowBannerAd', {
      banner_location: 'bottom'
    }).then(data => {
      if (!data.result) {
        console.log('Не удалось показать баннер');
        banner.innerHTML = '<p>Рекламный баннер недоступен</p>';
      }
    }).catch(error => {
      console.error('Ошибка баннера:', error);
      banner.innerHTML = '<p>Ошибка загрузки баннера</p>';
    });
  };

  // Показываем баннер сразу и устанавливаем интервал обновления
  showBanner();
  currentPlayer.bannerAdInterval = setInterval(showBanner, config.bannerAdRefresh);
}

// Остановка баннерной рекламы
function stopBannerAd() {
  if (currentPlayer.bannerAdInterval) {
    clearInterval(currentPlayer.bannerAdInterval);
    currentPlayer.bannerAdInterval = null;
  }
  
  if (typeof vkBridge !== 'undefined') {
    vkBridge.send('VKWebAppHideBannerAd').catch(console.error);
  }
}

// Основные функции игры
function handleClick() {
  currentPlayer.score += currentPlayer.totalClickValue;
  updateCounter();
  savePlayerData();
  saveTopPlayer();
}

function startAutoClicker() {
  if (currentPlayer.autoClickInterval) {
    clearInterval(currentPlayer.autoClickInterval);
  }
  
  if (currentPlayer.totalAutoClickValue > 0) {
    currentPlayer.autoClickInterval = setInterval(() => {
      currentPlayer.score += currentPlayer.totalAutoClickValue;
      updateCounter();
      savePlayerData();
      saveTopPlayer();
    }, 1000);
  }
}

function calculateTotalClickValue() {
  let total = config.initialClickValue;
  
  config.clickUpgrades.forEach((upgrade, index) => {
    const playerUpgrade = currentPlayer.clickUpgrades[index];
    if (playerUpgrade.level > 0) {
      total += upgrade.baseValue * Math.pow(upgrade.valueMultiplier, playerUpgrade.level - 1);
    }
  });
  
  currentPlayer.baseClickValue = total;
  currentPlayer.totalClickValue = currentPlayer.adMultiplierActive ? 
    total * config.adMultiplier : 
    total;
}

function calculateTotalAutoClickValue() {
  let total = 0;
  
  config.autoClickUpgrades.forEach((upgrade, index) => {
    const playerUpgrade = currentPlayer.autoClickUpgrades[index];
    if (playerUpgrade.level > 0) {
      total += upgrade.baseValue * Math.pow(upgrade.valueMultiplier, playerUpgrade.level - 1);
    }
  });
  
  currentPlayer.totalAutoClickValue = total;
}

// Система прокачки
function buyClickUpgrade(upgradeIndex) {
  const upgrade = config.clickUpgrades[upgradeIndex];
  const playerUpgrade = currentPlayer.clickUpgrades[upgradeIndex];
  
  // Проверка требований
  if (upgrade.requires) {
    const reqUpgrade = currentPlayer.clickUpgrades[upgrade.requires.upgradeIndex];
    if (reqUpgrade.level < upgrade.requires.minLevel) {
      showMessage(`Требуется ${config.clickUpgrades[upgrade.requires.upgradeIndex].name} уровня ${upgrade.requires.minLevel}`);
      return;
    }
  }
  
  // Проверка максимального уровня
  if (playerUpgrade.level >= upgrade.levels) {
    showMessage("Максимальный уровень достигнут");
    return;
  }
  
  // Расчет стоимости
  const cost = upgrade.baseCost * Math.pow(upgrade.costMultiplier, playerUpgrade.level);
  
  if (currentPlayer.score >= cost) {
    currentPlayer.score -= cost;
    playerUpgrade.level++;
    
    calculateTotalClickValue();
    updateUI();
    savePlayerData();
    showMessage(`${upgrade.name} улучшен до уровня ${playerUpgrade.level}!`);
  } else {
    showMessage("Недостаточно средств");
  }
}

function buyAutoClickUpgrade(upgradeIndex) {
  const upgrade = config.autoClickUpgrades[upgradeIndex];
  const playerUpgrade = currentPlayer.autoClickUpgrades[upgradeIndex];
  
  if (upgrade.requires) {
    const reqUpgrade = currentPlayer.autoClickUpgrades[upgrade.requires.upgradeIndex];
    if (reqUpgrade.level < upgrade.requires.minLevel) {
      showMessage(`Требуется ${config.autoClickUpgrades[upgrade.requires.upgradeIndex].name} уровня ${upgrade.requires.minLevel}`);
      return;
    }
  }
  
  if (playerUpgrade.level >= upgrade.levels) {
    showMessage("Максимальный уровень достигнут");
    return;
  }
  
  const cost = upgrade.baseCost * Math.pow(upgrade.costMultiplier, playerUpgrade.level);
  
  if (currentPlayer.score >= cost) {
    currentPlayer.score -= cost;
    playerUpgrade.level++;
    
    calculateTotalAutoClickValue();
    startAutoClicker();
    updateUI();
    savePlayerData();
    showMessage(`${upgrade.name} улучшен до уровня ${playerUpgrade.level}!`);
  } else {
    showMessage("Недостаточно средств");
  }
}

// Система рекламы
async function initAdSystem() {
  const now = Date.now();
  if (now - currentPlayer.lastAdCheckTime < 10000) return;
  
  currentPlayer.lastAdCheckTime = now;
  
  try {
    if (typeof vkBridge === 'undefined') {
      currentPlayer.adReady = true;
      return;
    }

    const checkResult = await vkBridge.send('VKWebAppCheckNativeAds', { 
      ad_format: 'reward' 
    });
    
    currentPlayer.adReady = checkResult.result;
    updateAdButton();
  } catch (error) {
    console.error('Ошибка проверки рекламы:', error);
    currentPlayer.adReady = false;
    updateAdButton();
  }
}

async function showAdAndActivateMultiplier() {
  const now = Date.now();
  
  if (currentPlayer.adMultiplierActive) {
    showMessage("Множитель уже активен");
    return;
  }
  
  if (now < currentPlayer.adButtonCooldownEnd) {
    const timeLeft = Math.ceil((currentPlayer.adButtonCooldownEnd - now)/1000);
    showMessage(`Попробуйте через ${timeLeft} сек`);
    return;
  }

  // Тестовый режим
  if (typeof vkBridge === 'undefined') {
    if (confirm("Хотите активировать множитель? (В приложении будет реклама)")) {
      activateAdMultiplier();
    }
    return;
  }

  // Проверка готовности рекламы
  if (!currentPlayer.adReady) {
    showMessage("Идет загрузка рекламы...");
    await initAdSystem();
    
    if (!currentPlayer.adReady) {
      showMessage("Реклама не загружена. Попробуйте позже");
      return;
    }
  }

  try {
    showMessage("Загружаем рекламу...");
    
    const result = await vkBridge.send('VKWebAppShowNativeAds', {
      ad_format: 'reward'
    });
    
    if (!result.result) {
      throw new Error("Не удалось показать рекламу");
    }
    
    activateAdMultiplier();
    setTimeout(initAdSystem, 1000); // Перезагружаем рекламу
    
  } catch (error) {
    console.error("Ошибка показа рекламы:", error);
    showMessage("Ошибка загрузки рекламы");
    currentPlayer.adReady = false;
    currentPlayer.adButtonCooldownEnd = now + config.adRetryDelay;
    updateAdButton();
  }
}

function activateAdMultiplier() {
  const now = Date.now();
  currentPlayer.adMultiplierActive = true;
  currentPlayer.adMultiplierEndTime = now + config.adDuration;
  currentPlayer.adButtonCooldownEnd = now + config.adDuration + config.adCooldown;
  
  calculateTotalClickValue();
  updateUI();
  savePlayerData();
  
  setTimeout(() => {
    endAdMultiplier();
  }, config.adDuration);
  
  showMessage(`Множитель x${config.adMultiplier} активирован!`);
}

function endAdMultiplier() {
  currentPlayer.adMultiplierActive = false;
  calculateTotalClickValue();
  updateUI();
  savePlayerData();
  showMessage("Действие множителя закончилось");
}

function startAdMultiplierCheck() {
  setInterval(() => {
    if (currentPlayer.adMultiplierActive && Date.now() >= currentPlayer.adMultiplierEndTime) {
      endAdMultiplier();
    }
    updateAdButton();
  }, 1000);
}

// Интерфейс
function updateUI() {
  updateCounter();
  updateAdButton();
  renderUpgrades();
}

function updateCounter() {
  const counter = document.getElementById('counter');
  const clickValue = document.getElementById('clickValue');
  if (counter) counter.textContent = currentPlayer.score.toFixed(6);
  if (clickValue) clickValue.textContent = `За клик: ${currentPlayer.totalClickValue.toFixed(6)}`;
}

function updateAdButton() {
  const adButton = document.getElementById('watchAdButton');
  if (!adButton) return;
  
  const now = Date.now();
  
  function formatTime(seconds) {
    if (seconds < 60) return `${seconds}с`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}м ${secs.toString().padStart(2, '0')}с`;
  }
  
  if (currentPlayer.adMultiplierActive) {
    const timeLeft = Math.max(0, Math.ceil((currentPlayer.adMultiplierEndTime - now)/1000));
    adButton.textContent = `Активно (${formatTime(timeLeft)})`;
    adButton.disabled = true;
  } 
  else if (now < currentPlayer.adButtonCooldownEnd) {
    const timeLeft = Math.max(0, Math.ceil((currentPlayer.adButtonCooldownEnd - now)/1000));
    adButton.textContent = `Доступно через ${formatTime(timeLeft)}`;
    adButton.disabled = true;
  } 
  else {
    adButton.textContent = `Умножить x${config.adMultiplier} (Реклама)`;
    adButton.disabled = !currentPlayer.adReady;
  }
}

function renderUpgrades() {
  const clickUpgradesContainer = document.getElementById('clickUpgrades');
  const autoClickUpgradesContainer = document.getElementById('autoClickUpgrades');
  
  if (clickUpgradesContainer) {
    clickUpgradesContainer.innerHTML = config.clickUpgrades.map((upgrade, index) => {
      const playerUpgrade = currentPlayer.clickUpgrades[index];
      const progress = (playerUpgrade.level / upgrade.levels) * 100;
      const nextCost = playerUpgrade.level < upgrade.levels ? 
        Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, playerUpgrade.level)) : 0;
      const currentValue = playerUpgrade.level > 0 ? 
        (upgrade.baseValue * Math.pow(upgrade.valueMultiplier, playerUpgrade.level - 1)).toFixed(6) : 0;
      
      const isLocked = upgrade.requires && 
        currentPlayer.clickUpgrades[upgrade.requires.upgradeIndex].level < upgrade.requires.minLevel;
      const isMaxLevel = playerUpgrade.level >= upgrade.levels;
      
      return `
      <div class="upgrade ${isMaxLevel ? 'max-level' : ''} ${isLocked ? 'locked' : ''}">
        <div class="upgrade-icon">${upgrade.icon}</div>
        <div class="upgrade-info">
          <h4>${upgrade.name} (${playerUpgrade.level}/${upgrade.levels})</h4>
          <p>${upgrade.description}</p>
          <div class="progress-bar">
            <div class="progress" style="width: ${progress}%"></div>
          </div>
          <div class="upgrade-stats">
            <span>+${currentValue} за клик</span>
            ${!isMaxLevel ? `<span>Следующий уровень: ${nextCost.toFixed(2)}</span>` : '<span class="max-level-text">МАКС. УРОВЕНЬ</span>'}
          </div>
        </div>
        <button class="buy-button" onclick="buyClickUpgrade(${index})" 
          ${isMaxLevel || isLocked ? 'disabled' : ''}>
          ${isMaxLevel ? 'MAX' : 'Улучшить'}
        </button>
      </div>
      `;
    }).join('');
  }
  
  if (autoClickUpgradesContainer) {
    autoClickUpgradesContainer.innerHTML = config.autoClickUpgrades.map((upgrade, index) => {
      const playerUpgrade = currentPlayer.autoClickUpgrades[index];
      const progress = (playerUpgrade.level / upgrade.levels) * 100;
      const nextCost = playerUpgrade.level < upgrade.levels ? 
        Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, playerUpgrade.level)) : 0;
      const currentValue = playerUpgrade.level > 0 ? 
        (upgrade.baseValue * Math.pow(upgrade.valueMultiplier, playerUpgrade.level - 1)).toFixed(6) : 0;
      
      const isLocked = upgrade.requires && 
        currentPlayer.autoClickUpgrades[upgrade.requires.upgradeIndex].level < upgrade.requires.minLevel;
      const isMaxLevel = playerUpgrade.level >= upgrade.levels;
      
      return `
      <div class="upgrade ${isMaxLevel ? 'max-level' : ''} ${isLocked ? 'locked' : ''}">
        <div class="upgrade-icon">${upgrade.icon}</div>
        <div class="upgrade-info">
          <h4>${upgrade.name} (${playerUpgrade.level}/${upgrade.levels})</h4>
          <p>${upgrade.description}</p>
          <div class="progress-bar">
            <div class="progress" style="width: ${progress}%"></div>
          </div>
          <div class="upgrade-stats">
            <span>+${currentValue}/сек</span>
            ${!isMaxLevel ? `<span>Следующий уровень: ${nextCost.toFixed(2)}</span>` : '<span class="max-level-text">МАКС. УРОВЕНЬ</span>'}
          </div>
        </div>
        <button class="buy-button" onclick="buyAutoClickUpgrade(${index})" 
          ${isMaxLevel || isLocked ? 'disabled' : ''}>
          ${isMaxLevel ? 'MAX' : 'Улучшить'}
        </button>
      </div>
      `;
    }).join('');
  }
}

async function showTopPlayers() {
  const topPlayersList = document.getElementById('topPlayersList');
  if (!topPlayersList) return;
  
  topPlayersList.innerHTML = '';
  
  try {
    const topPlayers = await getTopPlayers(100);
    const allPlayers = [...topPlayers];
    
    // Добавляем текущего игрока, если его нет в топе
    if (!allPlayers.some(p => p.id === currentPlayer.id)) {
      allPlayers.push({
        id: currentPlayer.id,
        name: currentPlayer.name,
        score: currentPlayer.score
      });
    }
    
    // Сортируем по убыванию счета
    allPlayers.sort((a, b) => b.score - a.score);
    
    // Отображаем топ-100
    allPlayers.slice(0, 100).forEach((player, index) => {
      const playerElement = document.createElement('div');
      playerElement.className = `player ${player.id === currentPlayer.id ? 'current-player' : ''}`;
      playerElement.innerHTML = `
        <span class="rank">${index + 1}.</span>
        <span class="name">${player.name}</span>
        <span class="score">${player.score.toFixed(6)}</span>
      `;
      topPlayersList.appendChild(playerElement);
    });
  } catch (error) {
    console.error('Ошибка загрузки топ-игроков:', error);
    topPlayersList.innerHTML = '<p>Не удалось загрузить таблицу лидеров</p>';
  }
}

function showMessage(text) {
  const messageElement = document.getElementById('message');
  if (messageElement) {
    messageElement.textContent = text;
    messageElement.style.display = 'block';
    setTimeout(() => {
      messageElement.style.display = 'none';
    }, 3000);
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.remove('active');
  });
  
  const activeTab = document.getElementById(tabName);
  if (activeTab) {
    activeTab.classList.add('active');
  }
  
  const activeButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  }
  
  if (tabName === 'upgrades') {
    renderUpgrades();
  } else if (tabName === 'top') {
    showTopPlayers();
  }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  // Проверка AdBlock
  const adCheck = document.createElement('div');
  adCheck.innerHTML = '&nbsp;';
  adCheck.className = 'ad';
  document.body.appendChild(adCheck);
  setTimeout(() => {
    if (adCheck.offsetHeight === 0) {
      showMessage("Для корректной работы отключите AdBlock");
    }
    document.body.removeChild(adCheck);
  }, 100);

  // Назначение обработчиков
  document.getElementById('clickButton')?.addEventListener('click', handleClick);
  document.getElementById('watchAdButton')?.addEventListener('click', showAdAndActivateMultiplier);
  
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      switchTab(button.getAttribute('data-tab'));
    });
  });
  
  // Глобальные функции
  window.buyClickUpgrade = buyClickUpgrade;
  window.buyAutoClickUpgrade = buyAutoClickUpgrade;
  
  // Инициализация
  initVKBridge();
});
