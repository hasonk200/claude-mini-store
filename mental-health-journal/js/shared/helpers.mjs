const uid = () => Math.random().toString(36).slice(2, 10);

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export { uid, pick };
