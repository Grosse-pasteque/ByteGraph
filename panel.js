const dot = `digraph G {
    node [shape=circle, style=filled, fillcolor=white];
    Start [fillcolor=green];
    End [fillcolor=red, fontcolor=white];
    Start -> End;
}`;

let hideToolTipId;

const render = async graph => {
    const viz = new Viz();
    const svg = await viz.renderSVGElement(dot);

    let viewBox = svg.viewBox.baseVal;
    let isPanning = false;
    let startX, startY;
    let startViewBox = {};

    svg.querySelectorAll('title').forEach(el => el.remove());
    svg.addEventListener("mousedown", e => {
        e.preventDefault();
        e.stopImmediatePropagation();
        hideToolTip();
        if (e.buttons != 1) return;
        isPanning = true;
        startX = e.clientX;
        startY = e.clientY;
        startViewBox = { x: viewBox.x, y: viewBox.y };
        svg.style.cursor = "grabbing";
    });

    svg.addEventListener("mousemove", e => {
        if (!isPanning) return;
        hideToolTip();
        const dx = (e.clientX - startX) * (viewBox.width / svg.clientWidth);
        const dy = (e.clientY - startY) * (viewBox.height / svg.clientHeight);
        viewBox.x = startViewBox.x - dx;
        viewBox.y = startViewBox.y - dy;
    });

    svg.addEventListener("mouseup", () => {
        hideToolTip();
        isPanning = false;
        svg.style.cursor = "grab";
    });

    svg.addEventListener("mouseleave", () => {
        hideToolTip();
        isPanning = false;
        svg.style.cursor = "grab";
    });

    svg.addEventListener("wheel", e => {
        hideToolTip();
        e.preventDefault();
        const zoomFactor = 1.1;
        const direction = e.deltaY < 0 ? 1 / zoomFactor : zoomFactor;

        const mx = e.offsetX / svg.clientWidth;
        const my = e.offsetY / svg.clientHeight;

        const newWidth = viewBox.width * direction;
        const newHeight = viewBox.height * direction;

        viewBox.x += (viewBox.width - newWidth) * mx;
        viewBox.y += (viewBox.height - newHeight) * my;
        viewBox.width = newWidth;
        viewBox.height = newHeight;
    }, { passive: false });
    svg.querySelectorAll("g.node").forEach(node => {
        node.style.cursor = "pointer";
        node.addEventListener("click", e => {
            const tooltip = graph.querySelector(".tooltip");
            tooltip.textContent = "Trace:\n" + node.previousSibling.previousSibling.data.trim();
            tooltip.style.left = e.pageX + 10 + "px";
            tooltip.style.top = e.pageY + 10 + "px";
            tooltip.style.display = "block";

            hideToolTipId = setTimeout(hideToolTip, 4000);
        });
    });
    graph.innerHTML = "";
    graph.appendChild(svg);
};

function hideToolTip() {
    if (!hideToolTipId) return;
    hideToolTipId = clearInterval(hideToolTipId);
    tooltip.style.display = "none";
}

const [graphSend, graphRecv] = document.querySelectorAll('.graph');
render(graphSend).catch(console.error);
render(graphRecv).catch(console.error);

let enabled = false;
record.onclick = () => {
    record.innerText = (enabled = !enabled) ? 'Stop' : 'Start';
    port.postMessage({ type: 'TOGGLE_RECORD', tabId });
};

const tabId = chrome.devtools.inspectedWindow.tabId;
const port = chrome.runtime.connect({ name: 'panel' });
port.onMessage.addListener(msg => {
    console.log('from content', msg);
});