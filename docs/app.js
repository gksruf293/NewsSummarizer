import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0';

let categoryData = {};
let embeddingData = [];
let extractor = null;
let currentSelectedArticle = null;

/**
 * [1] 초기화: 모델 로드, 날짜 자동 설정, 이벤트 바인딩
 */
async function init() {
    const container = document.getElementById("results-container");
    const searchBtn = document.getElementById("searchBtn");
    const datePicker = document.getElementById("datePicker");
    
    // 달력 날짜 자동 설정
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (datePicker) {
        datePicker.value = todayStr;
        datePicker.addEventListener('change', (e) => {
            if (e.target.value) loadDataByDate(e.target.value);
        });
    }

    if (searchBtn) searchBtn.disabled = true;
    container.innerHTML = `<div class="status-msg">AI 학습 환경을 준비 중입니다...</div>`;

    try {
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log("✅ AI Model Loaded");
        await loadDataByDate('latest');
        if (searchBtn) { 
            searchBtn.disabled = false; 
            searchBtn.innerText = "AI 시맨틱 검색"; 
        }
    } catch (err) {
        console.error("Init Error:", err);
        container.innerHTML = `<div class="error-msg">초기화 실패.</div>`;
    }
}

/**
 * [2] 데이터 로드 (날짜별)
 */
window.loadDataByDate = async function(date) {
    const container = document.getElementById("results-container");
    try {
        const cacheBust = `?t=${new Date().getTime()}`;
        const [catRes, embRes] = await Promise.all([
            fetch(`./data/${date}/category.json${cacheBust}`),
            fetch(`./data/${date}/embedding.json${cacheBust}`)
        ]);
        if (!catRes.ok) throw new Error(`${date}의 데이터가 없습니다.`);
        
        categoryData = await catRes.json();
        const embJson = await embRes.json();
        embeddingData = Array.isArray(embJson) ? embJson : [];
        
        const firstCat = categoryData['general'] ? 'general' : Object.keys(categoryData)[0];
        renderCards(categoryData[firstCat] || []);
    } catch (err) {
        console.error("Data Load Error:", err);
        container.innerHTML = `<div class="error-msg">⚠️ ${err.message}</div>`;
    }
};

/**
 * [3] 레벨별 요약 업데이트 (HTML <br> 태그 허용)
 */
window.updateSummaryLevel = function(level) {
    if (!currentSelectedArticle || !currentSelectedArticle.summaries) return;
    const data = currentSelectedArticle.summaries[level];
    if (!data) return;

    const summaryBox = document.getElementById("summary-text");
    summaryBox.innerHTML = `
        <div class="english-box" onclick="toggleTranslation()">
            <p class="en-text" style="font-size: 1.1rem; line-height: 1.8;">${data.en}</p>
            <p class="ko-text" id="ko-translation" style="display:none; color: #666; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px;">🔍 ${data.ko}</p>
            <small style="color: #3b82f6; display:block; margin-top:15px; cursor:pointer; font-weight:bold;">
                💡 클릭하면 한국어 해석이 나타납니다.
            </small>
        </div>
    `;
    document.querySelectorAll(".level-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(`btn-${level}`);
    if (activeBtn) activeBtn.classList.add("active");
};

/**
 * [4] 카드 렌더링 (유사도 점수 표시 기능 추가)
 */
function renderCards(articles, isSearch = false) {
    const container = document.getElementById("results-container");
    container.innerHTML = "";
    
    articles.forEach(art => {
        const card = document.createElement("div");
        card.className = "card";
        
        // 검색 결과일 때만 유사도 뱃지 HTML 생성
        const scoreBadge = isSearch 
            ? `<div class="similarity-badge">🎯 유사도 ${art.score}%</div>` 
            : "";
        
        const imageHtml = art.image 
            ? `<img src="${art.image}" onerror="this.outerHTML='<div class=\'no-image\'>🖼️ No Image</div>'">`
            : `<div class="no-image">🖼️ No Image</div>`;
            
        card.innerHTML = `
            ${scoreBadge}
            ${imageHtml}
            <div class="card-info">
                <h3>${art.title}</h3>
                <p>${(art.summaries?.elementary?.en || art.title).slice(0, 90)}...</p>
            </div>
        `;
        card.onclick = () => openModal(art);
        container.appendChild(card);
    });
}

/**
 * [5] AI 시맨틱 검색 (백분율 계산 및 정렬)
 */
window.handleSearch = async function() {
    const input = document.getElementById("interestInput");
    const query = input.value.trim();
    if (!query || !extractor) return;
    
    const container = document.getElementById("results-container");
    container.innerHTML = `<div class="status-msg">'${query}' 관련 뉴스 분석 중...</div>`;
    
    // 1. 사용자 쿼리 임베딩 추출
    const output = await extractor(query, { pooling: 'mean', normalize: true });
    const userVector = Array.from(output.data);
    
    // 2. 유사도 계산 및 % 변환
    const scored = embeddingData.map(art => {
        const similarity = cosineSimilarity(userVector, art.embedding);
        // 코사인 유사도(0~1)를 백분율(0~100)로 가공
        const scorePercent = Math.max(0, Math.min(100, Math.floor(similarity * 100)));
        return { ...art, score: scorePercent };
    }).sort((a, b) => b.score - a.score); // 높은 점수 순 정렬

    // 3. 상위 15개 결과 출력 (isSearch = true)
    renderCards(scored.slice(0, 15), true);
};

window.openModal = (article) => {
    currentSelectedArticle = article;
    document.getElementById("modal-title").innerText = article.title;
    document.getElementById("modal-link").href = article.url;
    document.getElementById("modal").style.display = "block";
    window.updateSummaryLevel('elementary');
};

window.closeModal = () => document.getElementById("modal").style.display = "none";
window.toggleTranslation = () => {
    const ko = document.getElementById("ko-translation");
    if (ko) ko.style.display = ko.style.display === "none" ? "block" : "none";
};

window.loadCategory = (cat, btn) => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderCards(categoryData[cat] || []);
};

/**
 * 코사인 유사도 연산 함수
 */
function cosineSimilarity(a, b) {
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]; 
        nA += a[i] * a[i]; 
        nB += b[i] * b[i];
    }
    const denom = Math.sqrt(nA) * Math.sqrt(nB);
    return denom === 0 ? 0 : dot / denom;
}

init();
