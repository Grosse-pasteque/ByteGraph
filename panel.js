let hideToolTipId;

const render = async (dot, graph) => {
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
            const tooltip = graph.nextElementSibling;
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


let count = 0;
const Methods = {
    Int8:                  count++,
    Uint8:                 count++,
    Int16LE:               count++,
    Int16BE:               count++,
    Uint16LE:              count++,
    Uint16BE:              count++,
    Int32LE:               count++,
    Int32BE:               count++,
    Uint32LE:              count++,
    Uint32BE:              count++,
    Float32LE:             count++,
    Float32BE:             count++,
    Float64LE:             count++,
    Float64BE:             count++,
    BigInt64LE:            count++,
    BigInt64BE:            count++,
    BigUint64LE:           count++,
    BigUint64BE:           count++,
    StringUtf8Eof:         count++,
    StringUtf8Length:      count++,
    EofStringUtf16LE:      count++,
    EofStringUtf16BE:      count++,
    LengthStringUtf16LE:   count++,
    LengthStringUtf16BE:   count++,
};

const reverseMethods = Object.fromEntries(Object.entries(Methods).map(([k, v]) => [v, k]));

function addEdge(graph, fromKey, accessValue, toKey) {
    if (!graph.has(fromKey))
        graph.set(fromKey, new Map);
    const edges = graph.get(fromKey);
    for (const [valueSet, target] of edges)
        if (target === toKey) {
            valueSet.add(accessValue);
            return;
        }
    edges.set(new Set([accessValue]), toKey);
}

function generateGraph(structs) {
    const graph = new Map;
    for (const struct of structs)
        for (let i = 0; i < struct.length; i++) {
            const [method, value, location] = struct[i];
            const next = struct[i + 1];
            addEdge(graph, method + ":" + location, value, next ? next[0] + ":" + next[2] : null);
        }
    return graph;
}

function optimizeGraph(graph) {
    for (const [nodeKey, accessMap] of graph.entries()) {
        if (accessMap.size == 1) {
            const [[accessSet, target]] = accessMap;
            if (accessSet instanceof Set && accessSet.size > 1) {
                accessMap.delete(accessSet);
                accessMap.set('*', target);
            }
        } else if (accessMap.size == 2) {
            const [[accessSetA, targetA], [accessSetB, targetB]] = accessMap;
            if (accessSetA instanceof Set && accessSetA.size > 1 && accessSetB instanceof Set && accessSetB.size == 1) {
                accessMap.delete(accessSetA);
                accessMap.set('^' + [...accessSetB][0], targetA);
            } else if (accessSetB instanceof Set && accessSetB.size > 1 && accessSetA instanceof Set && accessSetA.size == 1) {
                accessMap.delete(accessSetB);
                accessMap.set('^' + [...accessSetA][0], targetB);
            }
        }
    }
}

function generateDotFromGraph(graph) {
    const roots = new Set(graph.keys());
    for (const accessMap of graph.values())
        for (const to of accessMap.values())
            roots.delete(to);

    let dot = 'digraph G {\n';
    dot += '    node [shape=circle, style=filled, fillcolor=white];\nedge [minlen=1]\n';

    const seenNodes = new Set();

    for (const [from, accessMap] of graph) {
        const [methodId, ...trace] = from.split(':');
        const label = reverseMethods[+methodId] || `Unknown(${methodId})`;

        // Define node
        if (!seenNodes.has(from)) {
            dot += `    "${from}" [label="${label}", tooltip="${trace.join(':')}"${roots.has(from) ? ', fillcolor=green' : ''}];\n`;
            seenNodes.add(from);
        }

        for (const [valuesSet, to] of accessMap) {
            // FIXIT: structures repeated fixed amount of times cannot be easily detected
            const values = valuesSet instanceof Set ? valuesSet.size > 10 ? '>10' : [...valuesSet].join(', ') : valuesSet;

            let toId = to;
            if (to === null) {
                toId = 'end';
                if (!seenNodes.has('end')) {
                    dot += `    "end" [label="end", fillcolor=red, fontcolor=white];\n`;
                    seenNodes.add('end');
                }
            } else {
                const [toMethodId, ...toTrace] = toId.split(':');
                const toLabel = reverseMethods[+toMethodId] || `Unknown(${toMethodId})`;
                if (!seenNodes.has(toId)) {
                    dot += `    "${toId}" [label="${toLabel}", tooltip="${toTrace.join(':')}"];\n`;
                    seenNodes.add(toId);
                }
            }

            dot += `    "${from}" -> "${toId}" [label="${values}"];\n`;
        }
    }

    dot += '}';
    return dot;
}

const [graphSent, graphRecv] = document.querySelectorAll('.graph');

let enabled = false, recvCount = 0, sentCount = 0;
const packetsSent = [], packetsRecv = [];
record.onclick = () => {
    record.innerText = (enabled = !enabled) ? 'Stop' : 'Start';
    if (enabled) sent.innerText = recv.innerText = packetsSent.length = packetsRecv.length = 0;
    port.postMessage({ type: 'TOGGLE_RECORD', tabId });
};
load.onclick = async () => {
    const a = generateGraph(packetsSent),
        b = generateGraph(packetsRecv);
    optimizeGraph(a);
    optimizeGraph(b);
    await render(generateDotFromGraph(a), graphSent);
    await render(generateDotFromGraph(b), graphRecv);
};

const tabId = chrome.devtools.inspectedWindow.tabId;
const port = chrome.runtime.connect({ name: 'panel' });
port.onMessage.addListener(message => {
    switch (message.type) {
        case 'SENT':
            sent.innerText = ++sentCount;
            packetsSent.push(message.data);
            break;
        case 'RECV':
            recv.innerText = ++recvCount;
            packetsRecv.push(message.data);
            break;
    }
});