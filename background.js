chrome.runtime.onInstalled.addListener(() => console.log('Extension installed'));

chrome.runtime.onMessage.addListener(async ({ type, data }, sender, sendResponse) => {
    // sendResponse({ from: 'ByteGraph', type, data });
    switch (type) {}
    return false;
});