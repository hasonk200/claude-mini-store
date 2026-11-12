// The five places on the island map. `x`/`y` are percentages on the 2D map; the 3D map
// places its buildings from the same numbers (see js/scene3d/layout.mjs).
const DESTINATIONS = {
  home: {
    name: '暖暖屋',
    icon: '⌂',
    text: '探吓你嘅伙伴、佈置屋企，或者一齊去散步。',
    button: '入屋坐吓',
    page: 'pet',
    x: 28,
    y: 40,
  },
  library: {
    name: '觀星書屋',
    icon: '✦',
    text: '留低今晚嘅故事，遇見一張屬於今日嘅牌。',
    button: '推門入去',
    page: 'draw',
    x: 72,
    y: 42,
  },
  garden: {
    name: '成長花園',
    icon: '❀',
    text: '每一日嘅記錄都會留低，花園跟住你慢慢長大。',
    button: '去花園',
    page: null,
    x: 28,
    y: 70,
  },
  lake: {
    name: '靜靜湖畔',
    icon: '≈',
    text: '望吓湖水，陪自己停一停。乜都唔做都可以。',
    button: '去坐一陣',
    page: 'haven',
    x: 75,
    y: 74,
  },
  plaza: {
    name: '小遊戲廣場',
    icon: '◇',
    text: '帶伙伴去星光尋路、推箱解謎，或者慢慢玩配對。',
    button: '去玩遊戲',
    page: 'arcade',
    x: 50,
    y: 59,
  },
};

export { DESTINATIONS };
