(function() {
    let sendEnabled = true, recvEnabled = true;
    const LIMIT = 100;

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

    const overwrites = { // method: byteSize
        "Int8": 1,
        "Uint8": 1,
        "Int16": 2,
        "Uint16": 2,
        "Int32": 4,
        "Uint32": 4,
        "Float32": 4,
        "Float64": 8,
        "BigInt64": 8,
        "BigUint64": 8
    };

    const trees = new Map;
    window.trees = trees;

    const originalSend = WebSocket.prototype.send;

    window.WebSocket = class extends WebSocket {
        constructor(...args) {
            super(...args);
            this.tree = {
                send: [],
                recv: [],
                toJSON: function() {
                    return JSON.stringify({
                        recv: this.recv,
                        send: this.send
                    });
                }
            };
            trees.set(this, this.tree);
            const handler = message => {
                if (!recvEnabled) return;
                if (this.tree.recv.length >= LIMIT) recvEnabled = false;
                const udata = new Uint8Array(message.data);
                if (
                    !recvEnabled ||
                    this.binaryType !== "arraybuffer" ||
                    udata[0] === 0x78 && udata[1] === 0x9C
                ) this.removeEventListener('message', handler);
                try {
                    JSON.parse([...udata].map(x => String.fromCharCode(x)).join(''));
                    return this.removeEventListener('message', handler);
                } catch {}
                if (!message.data._struct) {
                    message.data._struct = [];
                    message.data._pos = 0;
                }
                this.tree.recv.push(message.data._struct);
            };
            this.addEventListener("message", handler);
        }

        send(data) {
            const buf = data instanceof DataView ? data.buffer : data;
            if (this.tree.send.length >= LIMIT) sendEnabled = false;
            else if (buf._struct && buf._pos === buf.byteLength)
                this.tree.send.push(buf._struct);
            return originalSend.call(this, data);
        }
    }


    const fileRegistry = ['<anonymous>'];
    window.fileRegistry = fileRegistry;

    function getFileIndex(file) {
        const idx = fileRegistry.indexOf(file);
        return idx != -1 ? idx : fileRegistry.push(file) - 1;
    }

    Error.prepareStackTrace = (_, stack) => stack;

    function getCaller() {
        const e = {};
        Error.captureStackTrace(e, getCaller);
        let location = '';
        for (const frame of e.stack) {
            if (location.length) location += ':';
            location += getFileIndex(frame.getFileName()) + ':' + frame.getPosition();
        }
        return location;
    }

    for (const [overwrite, byteSize] of Object.entries(overwrites)) {
        const isSingle = byteSize === 1;
        const getterName = 'get' + overwrite;
        const setterName = 'set' + overwrite;
        const originalGetter = DataView.prototype[getterName];
        const originalSetter = DataView.prototype[setterName];

        function methodKey(endian) {
            return isSingle ? overwrite : overwrite + (endian ? 'LE' : 'BE');
        }

        DataView.prototype[getterName] = function(pos, endian = false) {
            const value = originalGetter.call(this, pos, endian);
            if (recvEnabled && (this.buffer._pos ||= 0) === pos) {
                (this.buffer._struct ||= []).push([Methods[methodKey(endian)], value, getCaller()]);
                this.buffer._pos += byteSize;
            }
            return value;
        };

        DataView.prototype[setterName] = function(pos, value, endian = false) {
            if (sendEnabled && (this.buffer._pos ||= 0) === pos) {
                (this.buffer._struct ||= []).push([Methods[methodKey(endian)], value, getCaller()]);
                this.buffer._pos += byteSize;
            }
            return originalSetter.call(this, pos, value, endian);
        };
    }

    window.addEventListener('message', event => {
        const { type, data } = event.data;
        switch (type) {}
    });

    // window.postMessage({ from: 'ByteGraph', type, data }, '*');
})();