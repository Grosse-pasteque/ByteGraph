chrome.runtime.onInstalled.addListener(() => console.log('Extension installed'));

chrome.runtime.onMessage.addListener(async ({ type, data }, sender, sendResponse) => {
    // sendResponse({ from: 'ByteGraph', type, data });
    console.log(type, data);
    switch (type) {}
    return false;
});

const ports = new Set()
chrome.runtime.onConnect.addListener(port => {
    if (port.name !== "devtools-panel") return
    ports.add(port);
    port.onDisconnect.addListener(() => ports.delete(port));
    port.onMessage.addListener(msg => {
        console.log("from background:", msg);
    });

    window.sendToDev = data => port.postMessage({ type: "hello", data });
});