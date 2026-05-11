const secret = crypto.randomUUID();
const script = document.createElement('script');
script.src = chrome.runtime.getURL('interceptor.js');
script.dataset.secret = secret;
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

const port = chrome.runtime.connect({ name: 'content' });
port.onMessage.addListener(message => window.postMessage(message));
window.addEventListener('message', event => {
    if (event.source !== window || event.data?.secret === secret) return;
    port.postMessage(event.data);
});