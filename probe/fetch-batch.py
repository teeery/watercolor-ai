# probe/fetch-batch.py — 批量下载候选论文(分块+重试)
import urllib.request, time

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

TARGETS = {
    "research/montesdeoca2017-cg.pdf":    "https://dr.ntu.edu.sg/server/api/core/bitstreams/81a53675-526a-4be8-bb80-34bea86e872b/content",
    "research/montesdeoca2017-npar.pdf":  "https://hal.science/hal-01539599v1/document",
    "research/bousseau2006.pdf":          "https://maverick.inria.fr/Publications/2006/BKTS06/watercolor.pdf",
    "research/moxi2005.pdf":              "http://visgraph.cse.ust.hk/MoXi/moxi.pdf",
}

def fetch(url, out, timeout=40, retries=3, chunk=65536):
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                total = int(r.headers.get("Content-Length") or 0)
                got = 0
                with open(out, "wb") as f:
                    while True:
                        d = r.read(chunk)
                        if not d:
                            break
                        f.write(d)
                        got += len(d)
                print(f"OK  {out}  {got} bytes", flush=True)
                return True
        except Exception as e:
            print(f"  attempt {attempt} FAIL {out}: {type(e).__name__} {str(e)[:60]}", flush=True)
            time.sleep(2 * attempt)
    return False

if __name__ == "__main__":
    fails = 0
    for out, url in TARGETS.items():
        if not fetch(url, out):
            fails += 1
    print("fails:", fails, flush=True)
