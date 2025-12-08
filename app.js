// ====== Константы чисел в микромонетах (1 ед. = 0.000001) ======
const PRECISION = 1_000_000;

function toDisplay(valueInt) {
  return (valueInt / PRECISION).toFixed(6);
}

function floatToInt(valueFloat) {
  return Math.round(valueFloat * PRECISION);
}

// ====== Начальные значения ======
const INITIAL_BALANCE = 0;                    // 0.000000
const INITIAL_CLICK  = floatToInt(0.000001);  // 1
const INITIAL_AUTO   = 0;                     // 0.000000

const CLICK_UPGRADE_BASE_COST = floatToInt(0.000010);
const AUTO_UPGRADE_BASE_COST  = floatToInt(0.000010);

const CLICK_UPGRADE_MULTIPLIER = 1.5;
const AUTO_UPGRADE_MULTIPLIER  = 1.5;

const CLICK_GAIN_MULTIPLIER_PER_LEVEL = 1.5;
const AUTO_GAIN_PER_LEVEL             = floatToInt(0.000001);

// x2 реклама
const AD_BONUS_DURATION = 30;   // секунд действия x2
const AD_COOLDOWN       = 30;   // секунд кулдауна после конца

// Реферальные бонусы
const REF_BALANCE_BONUS = floatToInt(0.000050);
const REF_AUTO_BONUS    = floatToInt(0.000001);

// ====== Состояние ======
const state = {
  userId: null,
  balance: INITIAL_BALANCE,
  clickValue: INITIAL_CLICK,
  autoPerSec: INITIAL_AUTO,
  clickLevel: 1,
  autoLevel: 0,

  bonusX2Active: false,
  bonusX2Remaining: 0,
  adCooldownRemaining: 0,

  referrerId: null,
  refCount: 0,
  refBalanceBonus: 0,
  refAutoBonus: 0,
};

// ====== DOM ======
const balanceText        = document.getElementById('balanceText');
const clickValueText     = document.getElementById('clickValueText');
const autoPerSecText     = document.getElementById('autoPerSecText');
const clickButton        = document.getElementById('clickButton');

const upgradeClickBtn       = document.getElementById('upgradeClickBtn');
const upgradeAutoBtn        = document.getElementById('upgradeAutoBtn');
const clickUpgradeCostText  = document.getElementById('clickUpgradeCostText');
const autoUpgradeCostText   = document.getElementById('autoUpgradeCostText');
const upgradeWarning        = document.getElementById('upgradeWarning');
const clickLevelBadge       = document.getElementById('clickLevelBadge');
const autoLevelBadge        = document.getElementById('autoLevelBadge');

const adButton              = document.getElementById('adButton');
const adStatusText          = document.getElementById('adStatusText');
const bonusRemainingText    = document.getElementById('bonusRemainingText');
const cooldownRemainingText = document.getElementById('cooldownRemainingText');
const clickBonusBadge       = document.getElementById('clickBonusBadge');

const refCountText          = document.getElementById('refCountText');
const refBalanceBonusText   = document.getElementById('refBalanceBonusText');
const refAutoBonusText      = document.getElementById('refAutoBonusText');
const refLinkText           = document.getElementById('refLinkText');
const userIdLabel           = document.getElementById('userIdLabel');

const toast                 = document.getElementById('toast');

const tabButtons            = document.querySelectorAll('.tab-btn');
const tabContents           = document.querySelectorAll('.tab-content');
const topTableBody          = document.getElementById('topTableBody');

// ====== LocalStorage для игрового состояния ======
const LS_KEY = 'vk_clicker_state_v1';

function saveState() {
  const data = {
    userId: state.userId,
    balance: state.balance,
    clickValue: state.clickValue,
    autoPerSec: state.autoPerSec,
    clickLevel: state.clickLevel,
    autoLevel: state.autoLevel,
    bonusX2Active: state.bonusX2Active,
    bonusX2Remaining: state.bonusX2Remaining,
    adCooldownRemaining: state.adCooldownRemaining,
    referrerId: state.referrerId,
    refCount: state.refCount,
    refBalanceBonus: state.refBalanceBonus,
    refAutoBonus: state.refAutoBonus,
  };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('LocalStorage save error', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    Object.assign(state, data);
  } catch (e) {
    console.error('LocalStorage load error', e);
  }
}

// ====== VK Bridge: init, user_id, launch params ======
async function initVK() {
  try {
    if (window.vkBridge) {
      await vkBridge.send('VKWebAppInit', {});
    }

    let launchParams = null;
    if (window.vkBridge) {
      // Получаем параметры запуска для user_id и vk_ref [web:31][web:63][web:64]
      launchParams = await vkBridge.send('VKWebAppGetLaunchParams', {});
    }

    if (launchParams && launchParams.vk_user_id) {
      state.userId = launchParams.vk_user_id;
    }

    handleReferral(launchParams);

    userIdLabel.textContent = 'user_id: ' + (state.userId ?? '−');
    updateRefLink();

    // После того как есть userId — обновим лидеров
    updateLeaderboard();

    saveState();
    renderAll();
  } catch (e) {
    console.error('VK init error', e);
  }
}

// Обработка реферала по vk_ref или ?ref=
function handleReferral(launchParams) {
  if (!launchParams) return;

  let ref = null;
  if (launchParams.vk_ref) {
    ref = launchParams.vk_ref;
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (!ref && urlParams.has('ref')) {
      ref = urlParams.get('ref');
    }
  } catch (e) {}

  if (ref && state.userId && String(ref) === String(state.userId)) {
    return; // сам себя не считаем
  }

  if (ref && !state.referrerId) {
    state.referrerId = String(ref);
    state.balance    += REF_BALANCE_BONUS;
    state.autoPerSec += REF_AUTO_BONUS;
  }
}

// ====== Рендер ======
function renderAll() {
  balanceText.textContent    = toDisplay(state.balance);
  clickValueText.textContent = toDisplay(state.clickValue);
  autoPerSecText.textContent = toDisplay(state.autoPerSec);

  clickLevelBadge.textContent = 'ур. ' + state.clickLevel;
  autoLevelBadge.textContent  = 'ур. ' + state.autoLevel;

  const clickCost = calcClickUpgradeCost(state.clickLevel);
  const autoCost  = calcAutoUpgradeCost(state.autoLevel);
  clickUpgradeCostText.textContent = toDisplay(clickCost);
  autoUpgradeCostText.textContent  = toDisplay(autoCost);

  updateAdUI();

  refCountText.textContent        = String(state.refCount);
  refBalanceBonusText.textContent = toDisplay(state.refBalanceBonus);
  refAutoBonusText.textContent    = toDisplay(state.refAutoBonus);

  clickBonusBadge.style.display = state.bonusX2Active ? 'inline-flex' : 'none';
}

function updateAdUI() {
  if (state.bonusX2Active) {
    adStatusText.textContent       = 'x2 активен';
    bonusRemainingText.textContent = Math.ceil(state.bonusX2Remaining) + ' с';
  } else {
    bonusRemainingText.textContent = 'нет активного бонуса';
  }

  if (state.adCooldownRemaining > 0) {
    cooldownRemainingText.textContent = Math.ceil(state.adCooldownRemaining) + ' с';
    adButton.disabled = true;
    adButton.style.opacity = 0.7;
    adStatusText.textContent = 'кулдаун рекламы';
  } else {
    cooldownRemainingText.textContent = 'готово';
    adButton.disabled = false;
    adButton.style.opacity = 1;
    if (!state.bonusX2Active) {
      adStatusText.textContent = 'готово к показу';
    }
  }
}

function updateRefLink() {
  if (!state.userId) {
    refLinkText.textContent = 'Реферальная ссылка появится после получения user_id.';
    return;
  }
  const base = window.location.origin + window.location.pathname;
  const link = base + '?ref=' + encodeURIComponent(state.userId);
  refLinkText.textContent = 'Твоя реферальная ссылка: ' + link;
}

// ====== Апгрейды: стоимость ======
function calcClickUpgradeCost(level) {
  const multiplier = Math.pow(CLICK_UPGRADE_MULTIPLIER, level - 1);
  return Math.round(CLICK_UPGRADE_BASE_COST * multiplier);
}

function calcAutoUpgradeCost(level) {
  const multiplier = Math.pow(AUTO_UPGRADE_MULTIPLIER, level);
  return Math.round(AUTO_UPGRADE_BASE_COST * multiplier);
}

// ====== Игровая логика ======
function doClick() {
  let gain = state.clickValue;
  if (state.bonusX2Active) {
    gain *= 2;
  }
  state.balance += gain;
  saveState();
  renderAll();
  updateLeaderboard();
}

function tryUpgradeClick() {
  const cost = calcClickUpgradeCost(state.clickLevel);
  if (state.balance < cost) {
    showWarning('Недостаточно средств для прокачки клика');
    return;
  }
  state.balance    -= cost;
  state.clickLevel += 1;
  state.clickValue  = Math.round(
    INITIAL_CLICK * Math.pow(CLICK_GAIN_MULTIPLIER_PER_LEVEL, state.clickLevel - 1)
  );
  saveState();
  renderAll();
  updateLeaderboard();
  showToast('Клик прокачан до уровня ' + state.clickLevel);
}

function tryUpgradeAuto() {
  const cost = calcAutoUpgradeCost(state.autoLevel);
  if (state.balance < cost) {
    showWarning('Недостаточно средств для прокачки автомайнинга');
    return;
  }
  state.balance   -= cost;
  state.autoLevel += 1;
  state.autoPerSec += AUTO_GAIN_PER_LEVEL;
  saveState();
  renderAll();
  updateLeaderboard();
  showToast('Автомайнинг прокачан до уровня ' + state.autoLevel);
}

function showWarning(msg) {
  upgradeWarning.textContent = msg;
  setTimeout(() => {
    if (upgradeWarning.textContent === msg) {
      upgradeWarning.textContent = '';
    }
  }, 2000);
}

// ====== Автомайнинг и таймеры рекламы (реальное время) ======
let lastTickTime = Date.now();

function gameLoop() {
  const now = Date.now();
  const deltaMs = now - lastTickTime;
  lastTickTime = now;

  const deltaSec = deltaMs / 1000;

  // Автомайнинг: добавляем каждую отрисовку, баланс обновляется в реальном времени
  if (state.autoPerSec > 0) {
    const gainFloat = state.autoPerSec * deltaSec;
    const gainInt   = Math.floor(gainFloat);
    if (gainInt > 0) {
      state.balance += gainInt;
    }
  }

  // Таймер x2 и кулдаун
  if (state.bonusX2Active || state.adCooldownRemaining > 0) {
    let changed = false;

    if (state.bonusX2Active) {
      state.bonusX2Remaining -= deltaSec;
      if (state.bonusX2Remaining <= 0) {
        state.bonusX2Active    = false;
        state.bonusX2Remaining = 0;
        state.adCooldownRemaining = AD_COOLDOWN;
        changed = true;
      }
    }

    if (state.adCooldownRemaining > 0) {
      state.adCooldownRemaining -= deltaSec;
      if (state.adCooldownRemaining < 0) {
        state.adCooldownRemaining = 0;
      }
      changed = true;
    }

    if (changed) {
      saveState();
    }
  }

  renderAll();
  updateLeaderboard(); // обновляем топ с новым балансом
  requestAnimationFrame(gameLoop);
}

// ====== Rewarded‑реклама: VKWebAppShowNativeAds ======
async function showAdAndActivateBonus() {
  if (state.adCooldownRemaining > 0 || state.bonusX2Active) {
    return;
  }
  if (!window.vkBridge) {
    showToast('VK Bridge недоступен, реклама недоступна');
    return;
  }

  adStatusText.textContent = 'загрузка rewarded‑рекламы...';

  try {
    // Rewarded реклама: формат "reward" [web:31][web:47][web:59]
    const data = await vkBridge.send('VKWebAppShowNativeAds', {
      ad_format: 'reward'
    });

    if (data && data.result) {
      activateX2Bonus();
      showToast('Бонус x2 за клик активирован на 30 секунд!');
    } else {
      showToast('Реклама не была просмотрена до конца');
    }
  } catch (e) {
    console.error('ShowNativeAds error', e);
    showToast('Ошибка показа рекламы');
  } finally {
    renderAll();
    saveState();
  }
}

function activateX2Bonus() {
  state.bonusX2Active    = true;
  state.bonusX2Remaining = AD_BONUS_DURATION;
  state.adCooldownRemaining = 0;
  saveState();
  renderAll();
}

// ====== Toast ======
let toastTimeout = null;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// ====== Табы ======
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');

    if (tab === 'top') {
      renderTopTable();
    }
  });
});

// ====== Лидерборд через db.js ======
function updateLeaderboard() {
  if (!state.userId || typeof db === 'undefined') return;
  const list = db.upsertUser(state.userId, state.balance);
  // Перерисуем таблицу, если вкладка "Топ" открыта
  const topTab = document.getElementById('tab-top');
  if (topTab.classList.contains('active')) {
    renderTopTable(list);
  }
}

function renderTopTable(listOpt) {
  if (typeof db === 'undefined') return;
  const list = listOpt || db.loadLeaderboard();

  topTableBody.innerHTML = '';
  list.slice(0, 100).forEach((item, idx) => {
    const tr = document.createElement('tr');
    const tdPos = document.createElement('td');
    const tdId  = document.createElement('td');
    const tdBal = document.createElement('td');

    tdPos.textContent = String(idx + 1);
    tdId.textContent  = item.userId;
    tdBal.textContent = toDisplay(item.balance);

    tr.appendChild(tdPos);
    tr.appendChild(tdId);
    tr.appendChild(tdBal);

    topTableBody.appendChild(tr);
  });
}

// ====== Слушатели ======
clickButton.addEventListener('click', () => {
  doClick();
});

upgradeClickBtn.addEventListener('click', () => {
  tryUpgradeClick();
});

upgradeAutoBtn.addEventListener('click', () => {
  tryUpgradeAuto();
});

adButton.addEventListener('click', () => {
  showAdAndActivateBonus();
});

// ====== Инициализация ======
loadState();
renderAll();
renderTopTable();
requestAnimationFrame(gameLoop);
initVK();
