// ==UserScript==
// @name         Byte Graph
// @namespace    http://tampermonkey.net/
// @version      0.0.7
// @author       Big watermelon
// @description  devloppment
// @match        *://agma.io/*
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

/* flags support and value log but for now do the 1st part */

function isPrintableAscii(code) {
    return code >= 32 && code <= 126;
}

function fromUtf8Array(arr) {
    try {
        return new TextDecoder("utf-8").decode(new Uint8Array(arr));
    } catch {
        return null;
    }
}

function fromUtf16Array(arr) {
    return String.fromCharCode(...arr);
}
const ALLOW_UTF8 = false,
      ALLOW_UTF16LE = true,
      ALLOW_UTF16BE = false;

function detectStrings(struct) {
    const out = [];
    let i = 0;

    while (i < struct.length) {
        const [method, value, location] = struct[i];

        if (ALLOW_UTF8 && method == Methods.Uint8
            || ALLOW_UTF16LE && method == Methods.Uint16LE
            || ALLOW_UTF16BE && method == Methods.Uint16BE
        ) {
            const [fromUtfArray, EofMethod, LengthMethod] = method == Methods.Uint8 ? [
                fromUtf8Array,
                Methods.StringUtf8Eof,
                Methods.StringUtf8Length
            ] : [
                fromUtf16Array, ...method == Methods.Uint16LE ? [
                    Methods.EofStringUtf16LE,
                    Methods.EofStringUtf16BE
                ] : [
                    Methods.LengthStringUtf16LE,
                    Methods.LengthStringUtf16BE
                ]
            ];
            const chars = [];
            let j = i;

            while (j < struct.length && struct[j][0] == method) {
                const v = struct[j][1];
                if (v == 0 && chars.length > 0) {
                    const str = fromUtfArray(chars);
                    if (str) {
                        out.push([EofMethod, str]);
                        i = j + 1;
                        break;
                    }
                }
                if (!isPrintableAscii(v)) break;
                chars.push(v);
                j++;
            }

            if (j - i >= 2 && chars.length == j - i) {
                const str = fromUtfArray(chars);
                if (str) {
                    out.push([LengthMethod, str]);
                    i = j;
                    continue;
                }
            }
        }
        if (i >= struct.length) break;
        out.push(struct[i]);
        i++;
    }
    return out;
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

function graphToJSON(graph) {
    const json = {};
    for (const [fromKey, edges] of graph) {
        const edgeList = [];
        for (const [valueSet, toKey] of edges)
            edgeList.push({
                accessValues: valueSet instanceof Set ? [...valueSet] : valueSet,
                next: toKey
            });
        json[fromKey] = edgeList;
    }
    return json;
}

const reverseMethods = Object.fromEntries(Object.entries(Methods).map(([k, v]) => [v, k]));

function generateDotFromGraph(graph) {
    const roots = new Set(graph.keys());
    for (const accessMap of graph.values())
        for (const to of accessMap.values())
            roots.delete(to);

    let dot = 'digraph G {\n';
    dot += '    node [shape=circle, style=filled, fillcolor=white];\n';

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
            const values = valuesSet instanceof Set ? [...valuesSet].join(', ') : valuesSet;

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

const structs = require('./fkthis.json').recv;
const graph = generateGraph(structs);
optimizeGraph(graph);
console.log(JSON.stringify(graphToJSON(graph), null, 0))
console.log(generateDotFromGraph(graph));