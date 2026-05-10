chrome.runtime.onInstalled.addListener(() => console.log('Extension installed'));

chrome.runtime.onMessage.addListener(async ({ type, data }, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return;
    // sendResponse({ from: 'ByteGraph', type, data });
    console.log(type, data);
    switch (type) {}
    return false;
});

const ports = new Set()
chrome.runtime.onConnect.addListener(port => {
    if (port.sender?.id !== chrome.runtime.id) return port.disconnect();
    ports.add(port);
    port.onDisconnect.addListener(() => ports.delete(port));
    port.onMessage.addListener(msg => {
        console.log("from background:", msg);
    });

    globalThis.sendToDev = data => port.postMessage({ type: "hello", data });
});