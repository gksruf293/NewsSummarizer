import requests
import os
from datetime import datetime

API_KEY = os.getenv("NEWS_API_KEY")
BASE_URL = "https://newsapi.org/v2"

def fetch_by_category(category="general", country="us", page_size=10):
    """실시간 주요 헤드라인 수집 (/top-headlines)"""
    url = f"{BASE_URL}/top-headlines"
    params = {
        "category": category,
        "country": country,
        "pageSize": page_size,
        "apiKey": API_KEY
    }
    response = requests.get(url, params=params)
    return response.json().get("articles", [])

def fetch_everything(query="world", sort_by="publishedAt", page_size=50):
    """특정 키워드 기반 전체 검색 (/everything)"""
    # 오늘 날짜 구하기 (ISO 8601 형식: YYYY-MM-DD)
    today = datetime.now().strftime('%Y-%m-%d')
    
    url = f"{BASE_URL}/everything"
    params = {
        "q": query,
        "from": today,       # 오늘 발행된 뉴스만!
        "to": today,         # 오늘 발행된 뉴스만!
        "sortBy": sort_by,   # 최신순 정렬
        "language": "en",    # 영어 뉴스
        "pageSize": page_size,
        "apiKey": API_KEY
    }
    response = requests.get(url, params=params)
    data = response.json()
    
    if data.get("status") != "ok":
        print(f"⚠️ API Error: {data.get('message')}")
        return []
        
    return data.get("articles", [])

def get_full_text(url):
    """뉴스 본문 추출 (실패 시 빈 문자열)"""
    try:
        from newspaper import Article
        article = Article(url)
        article.download()
        article.parse()
        return article.text
    except:
        return ""
