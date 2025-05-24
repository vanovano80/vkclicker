// Конфигурация приложения
const config = {
  initialClickValue: 0.000001,
  clickUpgrades: [
    {
      name: "Улучшенный палец",
      description: "Базовое увеличение клика",
      levels: 10,
      baseCost: 10,
      costMultiplier: 1.5,
      baseValue: 0.000002,
      valueMultiplier: 1.2,
      icon: "👆"
    },
    {
      name: "Золотой палец",
      description: "Значительное увеличение клика",
      levels: 5,
      baseCost: 100,
      costMultiplier: 2,
      baseValue: 0.00001,
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
      baseValue: 0.00001,
      valueMultiplier: 1.3,
      icon: "⛏️"
    },
    {
      name: "Профессионал-майнер",
      description: "Улучшенный автомайнинг",
      levels: 5,
      baseCost: 500,
      costMultiplier: 2.2,
      baseValue: 0.0001,
      valueMultiplier: 1.7,
      icon: "⚒️",
      requires: { upgradeIndex: 0, minLevel: 5 }
    }
  ],
  adMultiplier: 2,
  adDuration: 30000,    // 30 секунд
  adCooldown: 60000,    // 1 минута
  adRetryDelay: 10000   // 10 секунд
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
  lastAdAttemptTime: 0,
  autoClickInterval: null,
  adCheckAttempts: 0
};

// Инициализация VK Bridge
function initVKBridge() {
  if (typeof vkBridge !== 'undefined') {
    vkBridge.send('VKWebAppInit')
      .then(() => {
        console.log('VK Bridge инициализирован');
        return vkBridge.send('VKWebAppGetUserInfo');
      })
      .then(user => {
        currentPlayer.id = user.id;
        currentPlayer.name = `${user.first_name} ${user.last_name}`;
        loadPlayerData();
        startAdMultiplierCheck();
      })
      .catch(error => {
        console.error('Ошибка VK Bridge:', error);
        initTestMode();
      });
  } else {
    console.log('VK Bridge не обнаружен, активирован тестовый режим');
    initTestMode();
  }
}

// Тестовый режим
function initTestMode() {
  currentPlayer.id = 999;
  currentPlayer.name = "Тестовый режим";
  loadPlayerData();
  startAdMultiplierCheck();
}

// Загрузка данных игрока
function loadPlayerData() {
  const savedData = localStorage.getItem('clickerData');
  if (savedData) {
    try {
      const data = JSON.parse(savedData);
      Object.assign(currentPlayer, data);
      
      calculateTotalClickValue();
      calculateTotalAutoClickValue();
      
      if (currentPlayer.adMultiplierEndTime > Date.now()) {
        currentPlayer.adMultiplierActive = true;
        setTimeout(endAdMultiplier, currentPlayer.adMultiplierEndTime - Date.now());
      }
      
      startAutoClicker();
    } catch (e) {
      console.error('Ошибка загрузки данных:', e);
    }
  }
  updateUI();
}

// Сохранение данных игрока
function savePlayerData() {
  localStorage.setItem('clickerData', JSON.stringify(currentPlayer));
}

// Основные функции игры
function handleClick() {
  currentPlayer.score += currentPlayer.totalClickValue;
  updateCounter();
  savePlayerData();
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
  
  if (upgrade.requires) {
    const reqUpgrade = currentPlayer.clickUpgrades[upgrade.requires.upgradeIndex];
    if (reqUpgrade.level < upgrade.requires.minLevel) {
      showMessage(`Требуется ${config.clickUpgrades[upgrade.requires.upgradeIndex].name} уровня ${upgrade.requires.minLevel}`);
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

// Улучшенная система рекламы
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
  
  if (currentPlayer.adCheckAttempts > 2) {
    showMessage("Слишком много попыток. Подождите");
    currentPlayer.adButtonCooldownEnd = now + config.adRetryDelay * 2;
    updateAdButton();
    return;
  }

  currentPlayer.lastAdAttemptTime = now;
  currentPlayer.adCheckAttempts++;
  updateAdButton();
  
  try {
    showMessage("Загружаем рекламу...");
    
    if (typeof vkBridge === 'undefined') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (confirm("Хотите активировать множитель? (В приложении будет реклама)")) {
        activateAdMultiplier();
        return;
      }
      throw new Error("Отменено пользователем");
    }
    
    const available = await vkBridge.send('VKWebAppCheckNativeAds', { 
      ad_format: 'reward' 
    });
    
    if (!available.result || !available.result.is_available) {
      throw new Error("Реклама не доступна. Попробуйте позже");
    }
    
    const result = await vkBridge.send('VKWebAppShowNativeAds', {
      ad_format: 'reward'
    });
    
    if (!result.result) {
      throw new Error("Не удалось показать рекламу");
    }
    
    activateAdMultiplier();
    currentPlayer.adCheckAttempts = 0;
    
  } catch (error) {
    console.error("Ошибка рекламы:", error);
    showMessage(error.message || "Ошибка загрузки");
    
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
  if (clickValue) clickValue.textContent = currentPlayer.totalClickValue.toFixed(6);
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
    adButton.classList.add('active');
  } 
  else if (now < currentPlayer.adButtonCooldownEnd) {
    const timeLeft = Math.max(0, Math.ceil((currentPlayer.adButtonCooldownEnd - now)/1000));
    adButton.textContent = `Доступно через ${formatTime(timeLeft)}`;
    adButton.disabled = true;
    adButton.classList.remove('active');
  } 
  else {
    adButton.textContent = `Умножить x${config.adMultiplier} (Реклама)`;
    adButton.disabled = false;
    adButton.classList.remove('active');
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

  const totalClickValueStat = document.getElementById('totalClickValueStat');
  const totalAutoClickValueStat = document.getElementById('totalAutoClickValueStat');
  if (totalClickValueStat) totalClickValueStat.textContent = currentPlayer.totalClickValue.toFixed(6);
  if (totalAutoClickValueStat) totalAutoClickValueStat.textContent = currentPlayer.totalAutoClickValue.toFixed(6);
}

function showTopPlayers() {
  const topPlayersList = document.getElementById('topPlayersList');
  if (!topPlayersList) return;
  
  topPlayersList.innerHTML = '';
  
  const allPlayers = [...playersDB, {
    id: currentPlayer.id,
    name: currentPlayer.name,
    score: currentPlayer.score
  }];
  
  allPlayers.sort((a, b) => b.score - a.score);
  
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
  document.getElementById('clickButton')?.addEventListener('click', handleClick);
  document.getElementById('watchAdButton')?.addEventListener('click', showAdAndActivateMultiplier);
  
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      switchTab(button.getAttribute('data-tab'));
    });
  });
  
  window.buyClickUpgrade = buyClickUpgrade;
  window.buyAutoClickUpgrade = buyAutoClickUpgrade;
  
  initVKBridge();
});

// Тестовая база данных игроков
const playersDB = [
  { id: 1, name: "Игрок 1", score: 100.123456 },
  { id: 2, name: "Игрок 2", score: 90.654321 },
  { id: 3, name: "Игрок 3", score: 80.987654 }
];
