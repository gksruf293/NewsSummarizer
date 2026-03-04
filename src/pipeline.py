import os
import json
import time
from datetime import datetime
from huggingface_hub import InferenceClient # 공식 라이브러리 추가
from openai import OpenAI
from fetch_news import fetch_top_headlines

# API 설정
client_openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
# 허깅페이스 인퍼런스 클라이언트 초기화 (가장 확실한 방법)
hf_client = InferenceClient(api_key=os.getenv("HF_TOKEN"))

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
CATEGORY_LIST = ["business", "entertainment", "general", "health", "science", "sports", "technology"]

def get_embedding(text):
    """공식 InferenceClient를 사용하여 임베딩(벡터)을 추출합니다."""
    try:
        # feature_extraction 메서드를 사용하여 텍스트를 벡터로 변환
        # 리스트 형태로 반환되므로 바로 사용 가능합니다.
        embedding = hf_client.feature_extraction(
            text[:1000],
            model=MODEL_ID
        )
        # 반환 형식이 numpy array일 수 있으므로 list로 변환
        if hasattr(embedding, "tolist"):
            return embedding.tolist()
        return embedding
    except Exception as e:
        print(f"⚠️ HF API 에러: {e}")
        return None

def generate_multi_summaries(text):
    """GPT를 이용한 2문장 요약 (English ||| Korean)"""
    if not text or len(text) < 30:
        return {k: {"en": "No content", "ko": "내용 없음"} for k in ["elementary", "middle", "high"]}
    try:
        resp = client_openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Summarize in 2 sentences. Format: English ||| Korean"},
                {"role": "user", "content": text[:1200]}
            ],
            temperature=0.3
        )
        res = resp.choices[0].message.content.strip()
        en, ko = res.split("|||") if "|||" in res else (res, "(번역 중)")
        data = {"en": en.strip(), "ko": ko.strip()}
        return {"elementary": data, "middle": data, "high": data}
    except:
        return {k: {"en": "Error", "ko": "오류"} for k in ["elementary", "middle", "high"]}

def run_pipeline():
    start_time = time.time()
    today_str = datetime.now().strftime("%Y-%m-%d")
    print(f"🚀 파이프라인 시작 (Official SDK): {today_str}")

    # 1. 시맨틱 검색 데이터 (20개)
    print("--- 임베딩 생성 시작 ---")
    base_articles = fetch_top_headlines(category="general", page_size=20)
    embedding_results = []
    
    for art in base_articles:
        txt = f"{art['title']}. {art.get('description', '')}"
        emb = get_embedding(txt)
        if emb:
            embedding_results.append({
                "title": art["title"], "url": art["url"], "image": art.get("urlToImage"),
                "embedding": emb, "summaries": generate_multi_summaries(txt)
            })
            print("✅", end="", flush=True)
            
    # 2. 카테고리별 뉴스 데이터
    category_results = {}
    for cat in CATEGORY_LIST:
        articles = fetch_top_headlines(category=cat, page_size=5)
        processed = []
        for art in articles:
            txt = art.get('description', art['title'])
            processed.append({
                "title": art["title"], "url": art["url"], "image": art.get("urlToImage"),
                "summaries": generate_multi_summaries(txt)
            })
        category_results[cat] = processed

    # 3. 저장
    for p in [f"docs/data/{today_str}", "docs/data/latest"]:
        os.makedirs(p, exist_ok=True)
        with open(f"{p}/category.json", "w", encoding="utf-8") as f:
            json.dump(category_results, f, ensure_ascii=False)
        with open(f"{p}/embedding.json", "w", encoding="utf-8") as f:
            json.dump(embedding_results, f, ensure_ascii=False)
            
    print(f"\n✨ 완료! 소요시간: {int(time.time() - start_time)}초 | 성공: {len(embedding_results)}개")

if __name__ == "__main__":
    run_pipeline()
