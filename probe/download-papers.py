# probe/download-papers.py — 稳健下载(分块读+重试+进度)两篇论文 PDF
import urllib.request, time, sys

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

def download(url, out, timeout=45, retries=4, chunk=65536):
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                total = int(r.headers.get("Content-Length") or 0)
                got = 0
                with open(out, "wb") as f:
                    while True:
                        data = r.read(chunk)
                        if not data:
                            break
                        f.write(data)
                        got += len(data)
                        if total:
                            print(f"\r  {url[-50:]}  {got}/{total} ({100*got//total}%)", end="", flush=True)
                print(f"\r  OK {url[-60:]}  {got} bytes", flush=True)
                return True
        except Exception as e:
            print(f"\n  attempt {attempt} FAIL: {type(e).__name__} {str(e)[:60]}", flush=True)
            time.sleep(3 * attempt)
    return False

if __name__ == "__main__":
    curtis = [
        "https://grail.cs.washington.edu/projects/watercolor/paper_small.pdf",
        "https://grail.cs.washington.edu/projects/watercolor/paper_tiny.pdf",
    ]
    ok = False
    for u in curtis:
        if download(u, "research/curtis1997.pdf"):
            ok = True
            break
    print("curtis:", "OK" if ok else "FAILED", flush=True)
    sys.exit(0 if ok else 1)
