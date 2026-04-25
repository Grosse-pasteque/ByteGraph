chrome.devtools.panels.create("Graph Viewer", "", "panel.html", (panel) => {
    panel.onShown.addListener((win) => {
        // Optional: access win.document or trigger init
        win.initPanel?.();
    });
});