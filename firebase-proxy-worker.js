// Cloudflare Worker: 代理 Firebase API 请求
// 部署到 Cloudflare Workers 后在 app.js 中引用

const FIREBASE_PROJECT = 'classroom-qa-d088d';
const API_KEY = 'AIzaSyBo6oNWhrLXNooQyGJylr4QrDdf_dnRQ2c';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const search = url.search;

    let targetHost;
    let targetPath = path;

    if (path.startsWith('/firestore/')) {
      targetHost = 'firestore.googleapis.com';
      targetPath = '/v1' + path.replace('/firestore', '');
    } else if (path.startsWith('/identitytoolkit/')) {
      targetHost = 'identitytoolkit.googleapis.com';
    } else if (path.startsWith('/securetoken/')) {
      targetHost = 'securetoken.googleapis.com';
    } else if (path.startsWith('/googleapis/')) {
      targetHost = 'www.googleapis.com';
      targetPath = path.replace('/googleapis', '');
    } else {
      return new Response(JSON.stringify({ error: 'unknown route' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const targetUrl = `https://${targetHost}${targetPath}${search}`;

    const headers = new Headers(request.headers);
    headers.set('Host', targetHost);

    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    const response = await fetch(modifiedRequest);

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }
};
