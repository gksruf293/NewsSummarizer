from newspaper import Article
import requests
from typing import List, Dict
import os

NEWS_API_URL = "https://newsapi.org/v2"

def fetch_everything(query: str, language: str = "en", page_size: int = 20, page: int = 1) -> List[Dict]:
    """
    Fetch article metadata from NewsAPI, then use newspaper3k to get full text.
    """

    # 1️⃣ NewsAPI로 메타데이터 가져오기
    url = f"{NEWS_API_URL}/everything"
    params = {
        "q": query,
        "language": language,
        "pageSize": page_size,
        "page": page,
        "apiKey": os.getenv("NEWS_API_KEY")
    }

    response = requests.get(url, params=params)
    response.raise_for_status()

    articles_meta = response.json().get("articles", [])

    # 2️⃣ newspaper3k로 URL에서 full text 가져오기
    articles = []
    for meta in articles_meta:
        title = meta.get("title")
        url = meta.get("url")
        description = meta.get("description", "")

        if not url or not title:
            continue

        try:
            article = Article(url)
            article.download()
            article.parse()
            full_text = article.text[:5000]  # 길이 제한(필요시 조정)
        except Exception as e:
            print(f"Failed to fetch article full text for {url}: {e}")
            full_text = ""  # 실패하면 비워둠

        articles.append({
            "title": title,
            "url": url,
            "description": description,
            "text": full_text
        })

    return articles
