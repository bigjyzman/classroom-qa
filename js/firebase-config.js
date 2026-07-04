// ===== Firebase 配置 =====
const firebaseConfig = {
  apiKey: "AIzaSyBo6oNWhrLXNooQyGJylr4QrDdf_dnRQ2c",
  authDomain: "classroom-qa-d088d.firebaseapp.com",
  projectId: "classroom-qa-d088d",
  storageBucket: "classroom-qa-d088d.firebasestorage.app",
  messagingSenderId: "222937942049",
  appId: "1:222937942049:web:2af26128e36e9fbf7ebb60",
  measurementId: "G-FE0QHK58XK"
};

// ===== 代理配置（用于中国地区无法直连 Google API）=====
// 可选地部署 Cloudflare Worker 作为 Firebase API 代理
// 如果不设置，走直连；如果设置，所有 Firestore 和 Auth API 请求走代理
const FIREBASE_PROXY_URL = ''; // 例如 'https://your-worker.workers.dev'

// 如果设置了代理 URL，拦截 fetch 和 XHR 请求
if (FIREBASE_PROXY_URL) {
  const proxyDomains = [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'www.googleapis.com',
  ];

  // 拦截 fetch
  const _origFetch = window.fetch;
  window.fetch = function(input, init) {
    const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
    try {
      const u = new URL(urlStr);
      if (proxyDomains.some(d => u.hostname.includes(d))) {
        const proxyInput = typeof input === 'string'
          ? FIREBASE_PROXY_URL + u.pathname + u.search
          : new Request(FIREBASE_PROXY_URL + u.pathname + u.search, input);
        return _origFetch.call(window, proxyInput, init);
      }
    } catch(e) {}
    return _origFetch.call(window, input, init);
  };

  // 拦截 XMLHttpRequest
  const _origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    try {
      const urlStr = typeof url === 'string' ? url : '';
      const u = new URL(urlStr, window.location.origin);
      if (proxyDomains.some(d => u.hostname.includes(d))) {
        arguments[1] = FIREBASE_PROXY_URL + u.pathname + u.search;
      }
    } catch(e) {}
    return _origOpen.apply(this, arguments);
  };
}
