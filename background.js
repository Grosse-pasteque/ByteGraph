chrome.runtime.onInstalled.addListener(() => console.log('Extension installed'));

let panelPort = null, contentPort = null;
chrome.runtime.onConnect.addListener(port => {
    if (port.sender?.id !== chrome.runtime.id) return port.disconnect();
    if (port.name === 'panel') {
        panelPort = port;
        port.onMessage.addListener(msg => contentPort?.postMessage(msg));
        port.onDisconnect.addListener(() => {
            panelPort = null;
        });
    } else if (port.name === 'content') {
        contentPort = port;
        port.onMessage.addListener(msg => panelPort?.postMessage(msg));
        port.onDisconnect.addListener(() => {
            contentPort = null;
        });
    }
});