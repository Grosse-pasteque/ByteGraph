const script = document.createElement('script');
script.src = chrome.runtime.getURL('interceptor.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

chrome.runtime.connect();
window.addEventListener("message", async event => {
    if (event.source !== window || event.data?.from === 'ByteGraph') return;
    const response = await chrome.runtime.sendMessage(event.data);
    if (response) window.postMessage(response);
});
chrome.runtime.onMessage.addListener(msg => window.postMessage(msg));