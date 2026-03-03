import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0';

let categoryData = {};
let embeddingData = [];
let extractor = null;
let currentSelectedArticle = null;

async function init() {
    const container = document.getElementById("results-container");
    const searchBtn = document.getElementById("searchBtn");
    
    if (searchBtn) searchBtn.disabled = true;
    container.innerHTML = `<div class="status-msg">AI 모델을 로드 중입니다...</div>`;

    try {
        // 임베딩 모델 로드
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log("✅ AI Model Loaded");
        
        if (searchBtn) {
            searchBtn.disabled = false;
            searchBtn.innerText = "AI 시맨틱 검색";
        }

        // 초기 데이터 로드
        await loadDataByDate('latest');
    } catch (err) {
        console.error("❌ Init Error:", err);
        container.innerHTML = `<div class="error-msg">초기화 실패. 콘솔을 확인하세요.</div>`;
    }
}

window.loadDataByDate = async function(date) {
    const container = document.getElementById("results-container");
    console.log(`📡 Fetching: data/${date}/`);

    try {
        const [catRes, embRes] = await Promise.all([
            fetch(`data/${date}/category.json`),
            fetch(`data/${date}/embedding.json`)
        ]);

        if (!catRes.ok) throw new Error("Category 데이터가 없습니다.");
        
        categoryData = await catRes.json();
        // embedding.json이 비어있을 경우 빈 배열로 처리
        embeddingData = embRes.ok ? await embRes.json() : [];

        console.log("📦 Received:", { 
            cats: Object.keys(categoryData), 
            embs: embeddingData.length 
        });

        // 렌더링 우선순위: general -> 첫 번째 카테고리
        const defaultCat = categoryData['general'] && categoryData['general'].length > 0 ? 'general' : Object.keys(categoryData)[0];
        renderCards(categoryData[defaultCat] || []);

    } catch (err) {
        console.error("❌ Fetch Error:", err);
        container.innerHTML = `<div class="error-msg">📍 ${date} 데이터를 찾을 수 없습니다.</div>`;
    }
};

window.handleSearch = async function() {
    const query = document.getElementById("interestInput").value.trim();
    if (!query || !extractor || embeddingData.length === 0) {
        alert("검색할 데이터가 없거나 모델이 준비되지 않았습니다.");
        return;
    }

    const container = document.getElementById("results-container");
    container.innerHTML = `<div class="status-msg">'${query}' 검색 중...</div>`;

    const output = await extractor(query, { pooling: 'mean', normalize: true });
    const userVector = Array.from(output.data);

    const scored = embeddingData.map(art => ({
        ...art,
        score: cosineSimilarity(userVector, art.embedding)
    })).sort((a, b) => b.score - a.score);

    renderCards(scored.slice(0, 10));
};

function cosineSimilarity(a, b) {
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        nA += a[i] * a[i]; nB += b[i] * b[i];
    }
    return dot / (Math.sqrt(nA) * Math.sqrt(nB));
}

function renderCards(articles) {
    const container = document.getElementById("results-container");
    container.innerHTML = "";

    if (!articles || articles.length === 0) {
        container.innerHTML = `<p class="status-msg">뉴스가 없습니다.</p>`;
        return;
    }

    articles.forEach(art => {
        const card = document.createElement("div");
        card.className = "card";
        
        const previewText = (art.summaries && art.summaries.elementary) 
            ? art.summaries.elementary.en 
            : (art.description || "No preview available.");

        card.innerHTML = `
            ${art.image ? `<img src="${art.image}" onerror="this.style.display='none'">` : ''}
            <div class="card-info">
                <h3>${art.title}</h3>
                <p>${previewText.slice(0, 100)}...</p>
            </div>
        `;
        card.onclick = () => openModal(art);
        container.appendChild(card);
    });
}

window.openModal = function(article) {
    currentSelectedArticle = article;
    document.getElementById("modal-title").innerText = article.title;
    document.getElementById("modal-link").href = article.url;
    document.getElementById("modal").style.display = "block";
    updateSummaryLevel('elementary');
};

window.updateSummaryLevel = function(level) {
    if (!currentSelectedArticle || !currentSelectedArticle.summaries) return;
    const data = currentSelectedArticle.summaries[level];
    const summaryBox = document.getElementById("summary-text");

    summaryBox.innerHTML = `
        <div class="english-box" onclick="toggleTranslation()">
            <p class="en-text">${data.en}</p>
            <p class="ko-text" id="ko-translation" style="display:none;">🔍 ${data.ko}</p>
            <div class="hint-badge">Click to see Translation</div>
        </div>
    `;
    document.querySelectorAll(".level-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById(`btn-${level}`).classList.add("active");
};

window.toggleTranslation = () => {
    const ko = document.getElementById("ko-translation");
    if (ko) ko.style.display = (ko.style.display === "none") ? "block" : "none";
};

window.closeModal = () => document.getElementById("modal").style.display = "none";

window.loadCategory = (cat, btn) => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderCards(categoryData[cat] || []);
};

init();
