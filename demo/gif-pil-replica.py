# 复刻 Pillow GifDecode.c 的调试解码器：记录读取序列 + 精确定位 BROKEN 条件
import sys

GIFBITS = 12
GIFTABLE = 1 << GIFBITS
GIFBUFFER = 1 << GIFBITS

def parse_gif(path):
    d = open(path, 'rb').read()
    pos = 6
    w = int.from_bytes(d[pos:pos+2], 'little'); pos += 2
    h = int.from_bytes(d[pos:pos+2], 'little'); pos += 2
    p = d[pos]; pos += 1
    gct = 2 ** ((p & 7) + 1)
    pos += 2 + gct * 3
    while pos < len(d):
        b = d[pos]
        if b == 0x21:
            pos += 2
            while True:
                n = d[pos]; pos += 1
                if n == 0: break
                pos += n
        elif b == 0x2c:
            pos += 1
            pos += 8
            ip = d[pos]; pos += 1
            if ip & 0x80: pos += 2 ** ((ip & 7) + 1) * 3
            min_code = d[pos]; pos += 1
            raw = bytearray()
            while True:
                n = d[pos]; pos += 1
                if n == 0: break
                raw.append(n)
                raw += d[pos:pos + n]; pos += n
            return w, h, min_code, bytes(raw)
        elif b == 0x3b:
            break
        else:
            raise ValueError(f'unknown block {b:#x} at {pos}')
    raise ValueError('no image')

def pil_decode(w, h, min_code, raw, seq_path=None):
    bits = min_code
    clear = 1 << bits
    end = clear + 1
    next_code = clear + 2
    codesize = bits + 1
    codemask = (1 << codesize) - 1
    data = [0] * GIFTABLE
    link = [0] * GIFTABLE
    buffer = [0] * GIFBUFFER
    bufferindex = GIFBUFFER
    lastdata = 0
    lastcode = 0
    bitbuffer = 0
    bitcount = 0
    ptr = 0
    out = bytearray()
    state = 2
    blocksize = 0
    seq = []

    def read_code():
        nonlocal bitbuffer, bitcount, ptr, blocksize
        while bitcount < codesize:
            if blocksize > 0:
                c = raw[ptr]; ptr += 1; blocksize -= 1
                bitbuffer |= c << bitcount
                bitcount += 8
            else:
                c = raw[ptr]
                blocksize = c
                ptr += 1
        c = bitbuffer & codemask
        bitbuffer >>= codesize
        bitcount -= codesize
        return c

    while True:
        c = read_code()
        seq.append(f'{c}@{codesize}')
        if c == clear:
            state = 1
            continue
        if c == end:
            break
        if state == 1:
            next_code = clear + 2
            codesize = bits + 1
            codemask = (1 << codesize) - 1
            bufferindex = GIFBUFFER
            state = 2
        if state == 2:
            if c > clear:
                if seq_path: open(seq_path, 'w').write('\n'.join(seq))
                return None, f'first-symbol {c} > clear (n={len(seq)})'
            lastdata = c
            lastcode = c
            state = 3
        else:
            thiscode = c
            if c > next_code:
                if seq_path: open(seq_path, 'w').write('\n'.join(seq))
                return None, f'code {c} > next {next_code} at out={len(out)} (n={len(seq)})'
            if c == next_code:
                if bufferindex <= 0:
                    return None, f'KwKwK buffer exhausted at out={len(out)}'
                bufferindex -= 1
                buffer[bufferindex] = lastdata
                c = lastcode
            while c >= clear:
                if bufferindex <= 0 or c >= GIFTABLE:
                    return None, f'string-copy break: c={c} buf={bufferindex} out={len(out)}'
                bufferindex -= 1
                buffer[bufferindex] = data[c]
                c = link[c]
            lastdata = c
            if next_code < GIFTABLE:
                data[next_code] = c
                link[next_code] = lastcode
                if next_code == codemask and codesize < GIFBITS:
                    codesize += 1
                    codemask = (1 << codesize) - 1
                next_code += 1
            lastcode = thiscode
        for k in range(bufferindex, GIFBUFFER):
            out.append(buffer[k])
        bufferindex = GIFBUFFER
        if len(out) >= w * h:
            if seq_path: open(seq_path, 'w').write('\n'.join(seq))
            return None, f'OVERRUN out={len(out)}'
    if seq_path: open(seq_path, 'w').write('\n'.join(seq))
    return out, f'OK out={len(out)}'

w, h, mc, raw = parse_gif(sys.argv[1])
out, status = pil_decode(w, h, mc, raw, sys.argv[1] + '.seq.txt')
print(sys.argv[1], '→', status)
