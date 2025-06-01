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
        initAdSystem();
        startAdMultiplierCheck();
        initBannerAd(); // Инициализация баннерной рекламы
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
  currentPlayer.adReady = true;
  loadPlayerData();
  startAdMultiplierCheck();
  initBannerAd(); // Баннер в тестовом режиме
}

// Инициализация баннерной рекламы
function initBannerAd() {
  if (typeof vkBridge === 'undefined') {
    // В тестовом режиме создаем заглушку
    const testBanner = document.createElement('div');
    testBanner.id = 'banner-ad';
    testBanner.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 50px;
      background-color: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-top: 1px solid #ccc;
      z-index: 1000;
    `;
    testBanner.innerHTML = '<p>Здесь был бы рекламный баннер</p>';
    document.body.appendChild(testBanner);
    return;
  }

  // Функция показа баннера
  const showBanner = () => {
    vkBridge.send('VKWebAppShowBannerAd', {
      banner_location: 'bottom'
    }).then(data => {
      if (!data.result) {
        console.log('Не удалось показать баннер');
      }
    }).catch(error => {
      console.error('Ошибка баннера:', error);
    });
  };

  // Показываем сразу и устанавливаем интервал
  showBanner();
  currentPlayer.bannerAdInterval = setInterval(showBanner, config.bannerAdRefresh);
}

// Остановка баннерной рекламы
function stopBannerAd() {
  if (currentPlayer.bannerAdInterval) {
    clearInterval(currentPlayer.bannerAdInterval);
  }
  
  if (typeof vkBridge !== 'undefined') {
    vkBridge.send('VKWebAppHideBannerAd').catch(console.error);
  } else {
    const banner = document.getElementById('banner-ad');
    if (banner) banner.remove();
  }
}

// Инициализация рекламной системы (без изменений)
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

// ... (все остальные функции остаются без изменений, как в предыдущем коде)

// Обновленная функция инициализации
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

// Обновленный CSS для учета баннера
const style = document.createElement('style');
style.textContent = `
  #banner-ad {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 50px;
    background-color: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-top: 1px solid #ccc;
    z-index: 1000;
  }
  
  /* Сдвигаем контент вверх, чтобы не перекрывался баннером */
  .tab-content {
    padding-bottom: 60px;
  }
`;
document.head.appendChild(style);

// Тестовая база данных игроков
const playersDB = [
 
];
