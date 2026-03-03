import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0';

let categoryData = {};
let embeddingData = [];
let extractor = null;
let currentSelectedArticle = null;

async function init() {
    const container = document.getElementById("results-container");
    const searchBtn = document.getElementById("searchBtn");
    
    if (searchBtn) searchBtn.disabled = true;
    container.innerHTML = `<div class="status-msg">AI 영문 분석 모델을 로드 중입니다...</div>`;

    try {
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log("✅ AI Model Loaded");
        if (searchBtn) { searchBtn.disabled = false; searchBtn.innerText = "AI 시맨틱 검색"; }
        await loadDataByDate('latest');
    } catch (err) {
        container.innerHTML = `<div class="error-msg">초기화 중 오류가 발생했습니다. 새로고침 해주세요.</div>`;
    }
}

window.loadDataByDate = async function(date) {
    const container = document.getElementById("results-container");
    try {
        const [catRes, embRes] = await Promise.all([
            fetch(`data/${date}/category.json`),
            fetch(`data/${date}/embedding.json`)
        ]);
        
        categoryData = await catRes.json();
        embeddingData = embRes.ok ? await embRes.json() : [];
        
        console.log(`📦 Data Loaded | Categories: ${Object.keys(categoryData).length} | Embeddings: ${embeddingData.length}`);
        
        const defaultCat = categoryData['general']?.length > 0 ? 'general' : Object.keys(categoryData)[0];
        renderCards(categoryData[defaultCat] || []);
    } catch (err) {
        console.error("Fetch Error:", err);
        container.innerHTML = `<div class="error-msg">📍 데이터를 불러올 수 없습니다. (날짜: ${date})</div>`;
    }
};

window.handleSearch = async function() {
    const query = document.getElementById("interestInput").value.trim();
    if (!query || !extractor) return;
    
    if (!embeddingData || embeddingData.length === 0) {
        alert("검색 가능한 뉴스 데이터가 없습니다.");
        return;
    }

    const container = document.getElementById("results-container");
    container.innerHTML = `<div class="status-msg">'${query}' 관련 소식을 분석 중입니다...</div>`;

    const output = await extractor(query, { pooling: 'mean', normalize: true });
    const userVector = Array.from(output.data);

    const scored = embeddingData.map(art => ({
        ...art,
        score: cosineSimilarity(userVector, art.embedding)
    })).sort((a, b) => b.score - a.score);

    renderCards(scored.slice(0, 12));
};

function cosineSimilarity(a, b) {
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i];
    }
    return dot / (Math.sqrt(nA) * Math.sqrt(nB));
}

function renderCards(articles) {
    const container = document.getElementById("results-container");
    container.innerHTML = "";
    
    if (!articles || articles.length === 0) {
        container.innerHTML = `<p class="status-msg">해당 조건의 뉴스가 없습니다.</p>`;
        return;
    }

    articles.forEach(art => {
        const card = document.createElement("div");
        card.className = "card";
        const scoreTag = art.score ? `<span class="score-tag">${Math.round(art.score*100)}% Match</span>` : '';
        const preview = art.summaries ? art.summaries.elementary.en : (art.description || "");
        
        card.innerHTML = `
            ${art.image ? `<img src="${art.image}" onerror="this.style.display='none'">` : ''}
            <div class="card-info">
                ${scoreTag}
                <h3>${art.title}</h3>
                <p>${preview.slice(0, 90)}...</p>
            </div>
        `;
        card.onclick = () => openModal(art);
        container.appendChild(card);
    });
}

window.openModal = (article) => {
    currentSelectedArticle = article;
    document.getElementById("modal-title").innerText = article.title;
    document.getElementById("modal-link").href = article.url;
    document.getElementById("modal").style.display = "block";
    updateSummaryLevel('elementary');
};

window.updateSummaryLevel = (level) => {
    if (!currentSelectedArticle.summaries) return;
    const data = currentSelectedArticle.summaries[level];
    document.getElementById("summary-text").innerHTML = `
        <div class="english-box" onclick="toggleTranslation()">
            <p class="en-text">${data.en}</p>
            <p class="ko-text" id="ko-translation" style="display:none;">🔍 ${data.ko}</p>
            <small style="color: #3b82f6; display:block; margin-top:10px;">💡 문장을 클릭하면 해석이 나옵니다.</small>
        </div>
    `;
    document.querySelectorAll(".level-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById(`btn-${level}`).classList.add("active");
};

window.toggleTranslation = () => {
    const ko = document.getElementById("ko-translation");
    if (ko) ko.style.display = ko.style.display === "none" ? "block" : "none";
};

window.closeModal = () => document.getElementById("modal").style.display = "none";
window.loadCategory = (cat, btn) => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderCards(categoryData[cat] || []);
};

init();
