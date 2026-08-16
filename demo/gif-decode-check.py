# 按 GIF89a 规范的最小 LZW 解码器：解析我们的 GIF，报告第一帧的断点
import sys

def read_gif(path):
    data = open(path, 'rb').read()
    assert data[:6] == b'GIF89a', 'bad sig'
    pos = 6
    w = int.from_bytes(data[pos:pos+2], 'little'); pos += 2
    h = int.from_bytes(data[pos:pos+2], 'little'); pos += 2
    packed = data[pos]; pos += 1
    gct_size = 2 ** ((packed & 7) + 1)
    pos += 2
    pos += gct_size * 3
    # extensions / image
    frames = []
    while pos < len(data):
        b = data[pos]
        if b == 0x21:  # extension
            pos += 2  # label
            while True:
                n = data[pos]; pos += 1
                if n == 0: break
                pos += n
        elif b == 0x2c:  # image
            pos += 1
            l = int.from_bytes(data[pos:pos+2], 'little'); pos += 2
            t = int.from_bytes(data[pos:pos+2], 'little'); pos += 2
            iw = int.from_bytes(data[pos:pos+2], 'little'); pos += 2
            ih = int.from_bytes(data[pos:pos+2], 'little'); pos += 2
            ip = data[pos]; pos += 1
            if ip & 0x80: pos += 2 ** ((ip & 7) + 1) * 3
            min_code = data[pos]; pos += 1
            raw = bytearray()
            while True:
                n = data[pos]; pos += 1
                if n == 0: break
                raw += data[pos:pos+n]; pos += n
            frames.append((iw, ih, min_code, bytes(raw)))
        elif b == 0x3b:
            break
        else:
            print('unknown block', hex(b), 'at', pos); break
    return frames

def lzw_decode(min_code, raw):
    clear = 1 << min_code
    eoi = clear + 1
    code_size = min_code + 1
    table = {i: bytes([i]) for i in range(256)}
    out = bytearray()
    bitpos = 0
    def read_code():
        nonlocal bitpos
        v = 0
        for i in range(code_size):
            byte_i = bitpos >> 3
            bit_i = bitpos & 7
            if byte_i >= len(raw):
                return None
            v |= ((raw[byte_i] >> bit_i) & 1) << i
            bitpos += 1
        return v
    code = read_code()
    if code != clear:
        print('  first code not clear:', code); return out, 'first-not-clear'
    next_code = eoi + 1
    prev = None
    count = 0
    while True:
        code = read_code()
        if code is None:
            return out, 'EOF-in-stream (bitpos %d)' % bitpos
        if code == clear:
            table = {i: bytes([i]) for i in range(256)}
            next_code = eoi + 1
            code_size = min_code + 1
            prev = None
            continue
        if code == eoi:
            return out, 'OK'
        if code in table:
            entry = table[code]
        elif prev is not None and prev in table:
            entry = table[prev] + table[prev][:1]
        else:
            return out, 'bad code %d (prev %s, table %d)' % (code, prev, len(table))
        out += entry
        if prev is not None and prev in table:
            table[next_code] = table[prev] + entry[:1]
            next_code += 1
            # 码宽增长（GIF89a 规范 LZW 早期变更约定）
            if next_code == (1 << code_size) - 1 and code_size < 12:
                code_size += 1
        prev = code
        count += 1

f = sys.argv[1]
frames = read_gif(f)
print(f, 'frames:', len(frames))
for i, (iw, ih, mc, raw) in enumerate(frames):
    out, status = lzw_decode(mc, raw)
    print(f' frame{i}: {iw}x{ih} min={mc} rawlen={len(raw)} → {status} decoded={len(out)} expect={iw*ih}')
    if status != 'OK':
        break
