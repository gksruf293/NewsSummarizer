import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0';

// 상태 관리 변수
let categoryData = {};
let embeddingData = [];
let extractor = null;
let currentSelectedArticle = null;
const TOP_K = 10;

/**
 * 초기화: 모델 로드 및 최신 데이터 불러오기
 */
async function init() {
    const container = document.getElementById("results-container");
    container.innerHTML = `<div class="status-msg">AI 모델 및 데이터를 로드 중입니다...</div>`;

    try {
        // 1. 실시간 임베딩을 위한 Transformers.js 모델 로드
        // 파이프라인에서 생성한 'all-MiniLM-L6-v2'와 동일한 모델 사용
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log("✅ AI Model Loaded");

        // 2. 초기 데이터(최신 뉴스) 로드
        await loadDataByDate('latest');

    } catch (err) {
        console.error("초기화 실패:", err);
        container.innerHTML = `<div class="error-msg">시스템 초기화 중 오류가 발생했습니다.</div>`;
    }
}

/**
 * 특정 날짜의 JSON 데이터를 서버에서 가져옴
 * @param {string} date - 'YYYY-MM-DD' 형식 또는 'latest'
 */
window.loadDataByDate = async function(date) {
    const container = document.getElementById("results-container");
    const dateInput = document.getElementById("datePicker");
    
    // UI 업데이트 (latest일 경우 오늘 날짜로 표시)
    if (date !== 'latest') {
        dateInput.value = date;
    }

    try {
        const [catRes, embRes] = await Promise.all([
            fetch(`data/${date}/category.json`),
            fetch(`data/${date}/embedding.json`)
        ]);

        if (!catRes.ok) throw new Error("해당 날짜에 데이터가 없습니다.");

        categoryData = await catRes.json();
        embeddingData = await embRes.json();

        // 현재 선택된 탭의 뉴스 렌더링 (기본값 general)
        const activeTabBtn = document.querySelector(".tab-btn.active");
        const currentTab = activeTabBtn ? activeTabBtn.getAttribute("onclick").match(/'([^']+)'/)[1] : 'general';
        
        renderCards(categoryData[currentTab] || []);
        console.log(`📅 Data loaded for: ${date}`);

    } catch (err) {
        console.warn(err);
        container.innerHTML = `
            <div class="error-msg">
                <p>📍 ${date === 'latest' ? '최신' : date} 뉴스 데이터가 아직 생성되지 않았습니다.</p>
                <button onclick="loadDataByDate('latest')" class="retry-btn">최신 뉴스 보기</button>
            </div>`;
    }
};

/**
 * AI 시맨틱 검색 실행
 */
window.handleSearch = async function() {
    const query = document.getElementById("interestInput").value.trim();
    if (!query || !extractor) return;

    const container = document.getElementById("results-container");
    container.innerHTML = `<div class="status-msg">'${query}'와(과) 관련된 뉴스를 분석 중입니다...</div>`;

    // 1. 사용자 입력 쿼리를 벡터로 변환
    const output = await extractor(query, { pooling: 'mean', normalize: true });
    const userVector = Array.from(output.data);

    // 2. 코사인 유사도 계산 및 정렬
    const scored = embeddingData.map(article => ({
        ...article,
        score: cosineSimilarity(userVector, article.embedding)
    })).sort((a, b) => b.score - a.score);

    // 3. 상위 K개 결과 출력
    renderCards(scored.slice(0, TOP_K));
};

/**
 * 코사인 유사도 계산 함수
 */
function cosineSimilarity(a, b) {
    let dot = 0.0, normA = 0.0, normB = 0.0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 뉴스 카드 리스트 렌더링
 */
function renderCards(articles) {
    const container = document.getElementById("results-container");
    container.innerHTML = "";

    if (articles.length === 0) {
        container.innerHTML = `<p class="status-msg">해당 조건에 맞는 뉴스가 없습니다.</p>`;
        return;
    }

    articles.forEach(art => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
            ${art.image ? `<img src="${art.image}" alt="news">` : '<div class="no-img">No Image</div>'}
            <div class="card-info">
                <span class="source-tag">${art.source || 'News'}</span>
                <h3>${art.title}</h3>
                <p>${art.description || (art.summaries ? art.summaries.elementary : '')}</p>
            </div>
        `;
        card.onclick = () => openModal(art);
        container.appendChild(card);
    });
}

/**
 * 모달: 요약 수준(초/중/고) 변경
 */
window.updateSummaryLevel = function(level) {
    if (!currentSelectedArticle || !currentSelectedArticle.summaries) {
        document.getElementById("summary-text").innerText = "이 기사는 요약본을 제공하지 않습니다.";
        return;
    }

    // 텍스트 교체
    const summaryText = currentSelectedArticle.summaries[level];
    document.getElementById("summary-text").innerText = summaryText;

    // 버튼 활성화 상태 표시
    document.querySelectorAll(".level-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(`btn-${level}`);
    if (activeBtn) activeBtn.classList.add("active");
};

/**
 * 모달 열기
 */
window.openModal = function(article) {
    currentSelectedArticle = article;
    
    document.getElementById("modal-title").innerText = article.title;
    document.getElementById("modal-link").href = article.url;
    document.getElementById("modal").style.display = "block";

    // 기본적으로 초등 수준 요약 표시
    updateSummaryLevel('elementary');
};

/**
 * 모달 닫기
 */
window.closeModal = function() {
    document.getElementById("modal").style.display = "none";
};

/**
 * 카테고리 탭 전환
 */
window.loadCategory = function(cat, btn) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    if (categoryData[cat]) {
        renderCards(categoryData[cat]);
    } else {
        renderCards([]);
    }
};

// 창 밖 클릭 시 모달 닫기
window.onclick = function(event) {
    const modal = document.getElementById("modal");
    if (event.target === modal) closeModal();
};

// 날짜 선택기 이벤트 바인딩
document.addEventListener('DOMContentLoaded', () => {
    const datePicker = document.getElementById('datePicker');
    if (datePicker) {
        datePicker.addEventListener('change', (e) => loadDataByDate(e.target.value));
    }
    init();
});
