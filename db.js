// Простая "база данных" лидеров на основе localStorage.
// Легко заменить на вызовы реального API/БД.
// [web:60][web:63]

const DB_LS_KEY = 'vk_clicker_leaderboard_v1';

// Структура записи: { userId: number|string, balance: number }

const db = {
  loadLeaderboard() {
    try {
      const raw = localStorage.getItem(DB_LS_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data;
    } catch (e) {
      console.error('DB load error', e);
      return [];
    }
  },

  saveLeaderboard(list) {
    try {
      localStorage.setItem(DB_LS_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('DB save error', e);
    }
  },

  // Обновить запись пользователя и вернуть актуальный список
  upsertUser(userId, balanceInt) {
    const list = this.loadLeaderboard();
    const idStr = String(userId);
    let found = false;

    for (let i = 0; i < list.length; i++) {
      if (String(list[i].userId) === idStr) {
        if (balanceInt > list[i].balance) {
          list[i].balance = balanceInt;
        }
        found = true;
        break;
      }
    }

    if (!found) {
      list.push({ userId: idStr, balance: balanceInt });
    }

    // сортировка по балансу по убыванию
    list.sort((a, b) => b.balance - a.balance);

    this.saveLeaderboard(list);
    return list;
  }
};
