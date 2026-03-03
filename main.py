from src.scheduler import should_run_today
from src.pipeline import run_pipeline

# NewsAPI 공식 category만 허용
USER_CATEGORY = "technology"  # 여기만 바꾸면 됨
TOP_K = 3

if __name__ == "__main__":
    if not should_run_today():
        print("Pipeline skipped today.")
    else:
        run_pipeline()
