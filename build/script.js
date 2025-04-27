// Конфигурация приложения
const config = {
    initialClickValue: 0.000001,
    // Ветки улучшений клика
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
      },
      {
        name: "Платиновый палец",
        description: "Огромное увеличение клика",
        levels: 3,
        baseCost: 1000,
        costMultiplier: 3,
        baseValue: 0.0001,
        valueMultiplier: 2,
        icon: "👌",
        requires: { upgradeIndex: 1, minLevel: 3 }
      }
    ],
    // Ветки автомайнинга
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
      },
      {
        name: "Робот-майнер",
        description: "Мощный автомайнинг",
        levels: 3,
        baseCost: 5000,
        costMultiplier: 3,
        baseValue: 0.001,
        valueMultiplier: 2,
        icon: "🤖",
        requires: { upgradeIndex: 1, minLevel: 3 }
      }
    ],
    // Настройки рекламы
    adMultiplier: 2,
    adDuration: 60000,
    adCooldown: 180000
  };
  
  // База данных игроков (в реальном приложении нужно использовать VK API)
  let playersDB = [
    { id: 1, name: "Игрок 1", score: 100.123456 },
    { id: 2, name: "Игрок 2", score: 90.654321 },
    { id: 3, name: "Игрок 3", score: 80.987654 }
  ];
  
  // Данные текущего игрока
  let currentPlayer = {
    id: 0,
    name: "Вы",
    score: 0,
    // Улучшения клика
    clickUpgrades: config.clickUpgrades.map(upgrade => ({
      level: 0,
      currentValue: 0
    })),
    // Автомайнинг
    autoClickUpgrades: config.autoClickUpgrades.map(upgrade => ({
      level: 0,
      currentValue: 0
    })),
    // Общие значения
    baseClickValue: config.initialClickValue,
    totalClickValue: config.initialClickValue,
    totalAutoClickValue: 0,
    // Реклама
    adMultiplierActive: false,
    adMultiplierEndTime: 0,
    adButtonCooldownEnd: 0,
    // Интервалы
    autoClickInterval: null
  };
  
  // Инициализация приложения
  vkBridge.send('VKWebAppInit');
  
  // Получение информации о текущем пользователе
  vkBridge.send('VKWebAppGetUserInfo')
    .then(user => {
      currentPlayer.id = user.id;
      currentPlayer.name = user.first_name + " " + user.last_name;
      loadPlayerData();
      startAdMultiplierCheck();
    })
    .catch(error => {
      console.error('Ошибка получения данных пользователя:', error);
    });
  
  // Загрузка данных игрока
  function loadPlayerData() {
    const savedData = localStorage.getItem('clickerData');
    if (savedData) {
      const data = JSON.parse(savedData);
      Object.assign(currentPlayer, data);
      
      // Восстановление значений
      calculateTotalClickValue();
      calculateTotalAutoClickValue();
      
      // Проверка активного множителя
      if (currentPlayer.adMultiplierEndTime > Date.now()) {
        currentPlayer.adMultiplierActive = true;
        setTimeout(endAdMultiplier, currentPlayer.adMultiplierEndTime - Date.now());
      }
      
      updateUI();
      startAutoClicker();
    }
  }
  
  // Сохранение данных игрока
  function savePlayerData() {
    localStorage.setItem('clickerData', JSON.stringify(currentPlayer));
  }
  
  // ========== ОСНОВНЫЕ ФУНКЦИИ ИГРЫ ==========
  
  // Обработка клика
  function handleClick() {
    currentPlayer.score += currentPlayer.totalClickValue;
    updateCounter();
    savePlayerData();
  }
  
  // Запуск автомайнинга
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
  
  // Расчет общего значения клика
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
  
  // Расчет общего значения автомайнинга
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
  
  // ========== СИСТЕМА ПРОКАЧКИ ==========
  
  // Покупка улучшения клика
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
    
    // Проверка баланса
    if (currentPlayer.score >= cost) {
      currentPlayer.score -= cost;
      playerUpgrade.level++;
      
      // Пересчет значений
      calculateTotalClickValue();
      updateUI();
      savePlayerData();
      showMessage(`${upgrade.name} улучшен до уровня ${playerUpgrade.level}!`);
    } else {
      showMessage("Недостаточно средств");
    }
  }
  
  // Покупка улучшения автомайнинга
  function buyAutoClickUpgrade(upgradeIndex) {
    const upgrade = config.autoClickUpgrades[upgradeIndex];
    const playerUpgrade = currentPlayer.autoClickUpgrades[upgradeIndex];
    
    // Проверка требований
    if (upgrade.requires) {
      const reqUpgrade = currentPlayer.autoClickUpgrades[upgrade.requires.upgradeIndex];
      if (reqUpgrade.level < upgrade.requires.minLevel) {
        showMessage(`Требуется ${config.autoClickUpgrades[upgrade.requires.upgradeIndex].name} уровня ${upgrade.requires.minLevel}`);
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
    
    // Проверка баланса
    if (currentPlayer.score >= cost) {
      currentPlayer.score -= cost;
      playerUpgrade.level++;
      
      // Пересчет значений
      calculateTotalAutoClickValue();
      
      // Перезапуск автомайнинга
      startAutoClicker();
      
      updateUI();
      savePlayerData();
      showMessage(`${upgrade.name} улучшен до уровня ${playerUpgrade.level}!`);
    } else {
      showMessage("Недостаточно средств");
    }
  }
  
  // ========== СИСТЕМА РЕКЛАМЫ ==========
  
  // Показ рекламы и активация множителя
  function showAdAndActivateMultiplier() {
    const now = Date.now();
    if (currentPlayer.adMultiplierActive || now < currentPlayer.adButtonCooldownEnd) {
      return;
    }
    
    // Показ рекламы ВКонтакте
    vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' })
      .then(data => {
        if (data.result) {
          activateAdMultiplier();
        }
      })
      .catch(error => {
        console.error('Ошибка показа рекламы:', error);
        // Для демо-режима активируем без рекламы
        activateAdMultiplier();
      });
  }
  
  // Активация множителя за рекламу
  function activateAdMultiplier() {
    currentPlayer.adMultiplierActive = true;
    currentPlayer.adMultiplierEndTime = Date.now() + config.adDuration;
    currentPlayer.adButtonCooldownEnd = Date.now() + config.adDuration + config.adCooldown;
    
    // Применяем множитель
    calculateTotalClickValue();
    
    // Устанавливаем таймер окончания множителя
    setTimeout(endAdMultiplier, config.adDuration);
    
    updateUI();
    savePlayerData();
    showMessage("Множитель кликов x2 активирован на 1 минуту!");
  }
  
  // Окончание действия множителя
  function endAdMultiplier() {
    currentPlayer.adMultiplierActive = false;
    calculateTotalClickValue();
    updateUI();
    savePlayerData();
    showMessage("Действие множителя закончилось");
  }
  
  // Проверка активного множителя
  function startAdMultiplierCheck() {
    setInterval(() => {
      if (currentPlayer.adMultiplierActive && Date.now() >= currentPlayer.adMultiplierEndTime) {
        endAdMultiplier();
      }
      updateAdButton();
    }, 1000);
  }
  
  // ========== ИНТЕРФЕЙС ==========
  
  // Обновление интерфейса
  function updateUI() {
    updateCounter();
    updateAdButton();
    renderUpgrades();
  }
  
  // Обновление счетчика
  function updateCounter() {
    document.getElementById('counter').textContent = currentPlayer.score.toFixed(6);
    document.getElementById('clickValue').textContent = currentPlayer.totalClickValue.toFixed(6);
  }
  
  // Обновление кнопки рекламы
  function updateAdButton() {
    const adButton = document.getElementById('watchAdButton');
    const now = Date.now();
    
    if (currentPlayer.adMultiplierActive) {
      const timeLeft = Math.ceil((currentPlayer.adMultiplierEndTime - now) / 1000);
      adButton.textContent = `Умножение активное (${timeLeft}с)`;
      adButton.disabled = true;
      adButton.classList.add('active');
    } else if (now < currentPlayer.adButtonCooldownEnd) {
      const cooldownLeft = Math.ceil((currentPlayer.adButtonCooldownEnd - now) / 1000);
      adButton.textContent = `Доступно через ${cooldownLeft}с`;
      adButton.disabled = true;
      adButton.classList.remove('active');
    } else {
      adButton.textContent = "Умножить клики х2 (Реклама)";
      adButton.disabled = false;
      adButton.classList.remove('active');
    }
  }
  
  // Рендер улучшений
  function renderUpgrades() {
    const clickUpgradesContainer = document.getElementById('clickUpgrades');
    const autoClickUpgradesContainer = document.getElementById('autoClickUpgrades');
    
    clickUpgradesContainer.innerHTML = '';
    autoClickUpgradesContainer.innerHTML = '';
    
    // Рендер улучшений клика
    config.clickUpgrades.forEach((upgrade, index) => {
      const playerUpgrade = currentPlayer.clickUpgrades[index];
      const upgradeElement = createUpgradeElement(upgrade, playerUpgrade, index, 'click');
      clickUpgradesContainer.appendChild(upgradeElement);
    });
    
    // Рендер улучшений автомайнинга
    config.autoClickUpgrades.forEach((upgrade, index) => {
      const playerUpgrade = currentPlayer.autoClickUpgrades[index];
      const upgradeElement = createUpgradeElement(upgrade, playerUpgrade, index, 'auto');
      autoClickUpgradesContainer.appendChild(upgradeElement);
    });
    
    // Обновление статистики
    document.getElementById('totalClickValueStat').textContent = currentPlayer.totalClickValue.toFixed(6);
    document.getElementById('totalAutoClickValueStat').textContent = currentPlayer.totalAutoClickValue.toFixed(6);
    
    // Генерация вкладки прокачки
    document.getElementById('upgrades').innerHTML = createUpgradesTab();
  }
  
  // Создание элемента улучшения
  function createUpgradeElement(upgrade, playerUpgrade, index, type) {
    const element = document.createElement('div');
    const progress = (playerUpgrade.level / upgrade.levels) * 100;
    const nextCost = playerUpgrade.level < upgrade.levels ? 
      Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, playerUpgrade.level)) : 0;
    const currentValue = playerUpgrade.level > 0 ? 
      (upgrade.baseValue * Math.pow(upgrade.valueMultiplier, playerUpgrade.level - 1)).toFixed(6) : 0;
    
    const isLocked = !canBuyUpgrade(type, index);
    const isMaxLevel = playerUpgrade.level >= upgrade.levels;
    
    element.className = `upgrade ${isMaxLevel ? 'max-level' : ''} ${isLocked ? 'locked' : ''}`;
    element.innerHTML = `
      <div class="upgrade-icon">${upgrade.icon}</div>
      <div class="upgrade-info">
        <h4>${upgrade.name} (${playerUpgrade.level}/${upgrade.levels})</h4>
        <p>${upgrade.description}</p>
        <div class="progress-bar">
          <div class="progress" style="width: ${progress}%"></div>
        </div>
        <div class="upgrade-stats">
          <span>+${currentValue} ${type === 'click' ? 'за клик' : '/сек'}</span>
          ${!isMaxLevel ? `<span>Следующий уровень: ${nextCost.toFixed(2)}</span>` : '<span class="max-level-text">МАКС. УРОВЕНЬ</span>'}
        </div>
      </div>
      <button class="buy-button" onclick="buy${type === 'click' ? 'Click' : 'AutoClick'}Upgrade(${index})" 
        ${isMaxLevel || isLocked ? 'disabled' : ''}>
        ${isMaxLevel ? 'MAX' : 'Улучшить'}
      </button>
    `;
    
    return element;
  }
  
  // Создание вкладки прокачки
  function createUpgradesTab() {
    return `
      <div class="upgrades-tab">
        <div class="upgrades-section">
          <h3><i class="icon">👆</i> Улучшения клика</h3>
          <div id="clickUpgrades" class="upgrades-container"></div>
        </div>
        
        <div class="upgrades-section">
          <h3><i class="icon">⛏️</i> Автомайнинг</h3>
          <div id="autoClickUpgrades" class="upgrades-container"></div>
        </div>
        
        <div class="stats-section">
          <h3>Ваши характеристики</h3>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value" id="totalClickValueStat">${currentPlayer.totalClickValue.toFixed(6)}</div>
              <div class="stat-name">За клик</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" id="totalAutoClickValueStat">${currentPlayer.totalAutoClickValue.toFixed(6)}</div>
              <div class="stat-name">В секунду</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Проверка, можно ли купить улучшение
  function canBuyUpgrade(type, index) {
    const upgrade = type === 'click' ? config.clickUpgrades[index] : config.autoClickUpgrades[index];
    const playerUpgrade = type === 'click' ? currentPlayer.clickUpgrades[index] : currentPlayer.autoClickUpgrades[index];
    
    // Проверка требований
    if (upgrade.requires) {
      const reqUpgrade = type === 'click' ? 
        currentPlayer.clickUpgrades[upgrade.requires.upgradeIndex] : 
        currentPlayer.autoClickUpgrades[upgrade.requires.upgradeIndex];
      
      if (reqUpgrade.level < upgrade.requires.minLevel) {
        return false;
      }
    }
    
    // Проверка максимального уровня
    if (playerUpgrade.level >= upgrade.levels) {
      return false;
    }
    
    // Проверка стоимости
    const cost = upgrade.baseCost * Math.pow(upgrade.costMultiplier, playerUpgrade.level);
    return currentPlayer.score >= cost;
  }
  
  // Показ сообщения
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
  
  // Переключение вкладок
  function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(button => {
      button.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`.tab-button[data-tab="${tabName}"]`).classList.add('active');
    
    if (tabName === 'top') {
      showTopPlayers();
    } else if (tabName === 'upgrades') {
      renderUpgrades();
    }
  }
  
  // Показ топа игроков
  function showTopPlayers() {
    const topPlayersList = document.getElementById('topPlayersList');
    topPlayersList.innerHTML = '';
    
    // В реальном приложении здесь нужно загружать данные из VK API
    const allPlayers = [...playersDB, {
      id: currentPlayer.id,
      name: currentPlayer.name,
      score: currentPlayer.score
    }];
    
    // Сортируем по убыванию счета
    allPlayers.sort((a, b) => b.score - a.score);
    
    // Отображаем топ-100
    const top100 = allPlayers.slice(0, 100);
    top100.forEach((player, index) => {
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
  
  // Инициализация интерфейса
  document.addEventListener('DOMContentLoaded', () => {
    // Назначение обработчиков событий
    document.getElementById('clickButton').addEventListener('click', handleClick);
    document.getElementById('watchAdButton').addEventListener('click', showAdAndActivateMultiplier);
    
    // Назначение обработчиков для кнопок вкладок
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => {
        switchTab(button.getAttribute('data-tab'));
      });
    });
    
    // Первоначальная загрузка UI
    updateUI();
  });