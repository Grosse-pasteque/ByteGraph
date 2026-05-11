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