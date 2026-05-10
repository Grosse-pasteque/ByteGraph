(function() {
    const secret = document.currentScript.dataset.secret;

    let enabled = false;

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

    const fileRegistry = ['<anonymous>'];
    window.fileRegistry = fileRegistry;

    function getFileIndex(file) {
        const idx = file ? fileRegistry.indexOf(file) : 0;
        return idx !== -1 ? idx : fileRegistry.push(file) - 1;
    }

    Error.prepareStackTrace = (_, stack) => stack;
    Error.stackTraceLimit = 2;

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

        // could directly create graph here
        DataView.prototype[getterName] = function(pos, endian = false) {
            const value = originalGetter.call(this, pos, endian);
            if (enabled && (this.buffer._pos ||= 0) === pos) {
                (this.buffer._struct ||= []).push([Methods[methodKey(endian)], value, getCaller()]);
                if ((this.buffer._pos += byteSize) === this.byteLength)
                    window.postMessage({
                        secret,
                        type: 'recv',
                        data: this.buffer._struct
                    }, '*');
            }
            return value;
        };

        DataView.prototype[setterName] = function(pos, value, endian = false) {
            if (enabled && (this.buffer._pos ||= 0) === pos) {
                (this.buffer._struct ||= []).push([Methods[methodKey(endian)], value, getCaller()]);
                if ((this.buffer._pos += byteSize) === this.byteLength)
                    window.postMessage({
                        secret,
                        type: 'send',
                        data: this.buffer._struct
                    }, '*');
            }
            return originalSetter.call(this, pos, value, endian);
        };
    }

    window.addEventListener('message', event => {
        const { type, data = null } = event.data;
        switch (type) {
            case 'TOGGLE_RECORD':
                enabled = true;
                break;
        }
    });
})();