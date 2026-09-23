"""어느 위치에서 실행해도 되게 하는 시작 파일:  python run.py"""
import os
import sys

import uvicorn

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)          # app.py를 찾을 수 있게
os.chdir(HERE)                     # static/, demo.db 경로 기준을 맞춤

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8100"))
    print(f"[llm-compare] http://localhost:{port}  (Ctrl+C 로 종료)")
    uvicorn.run("app:app", host="127.0.0.1", port=port, reload=False)
