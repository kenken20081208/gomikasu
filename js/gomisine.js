// ==========================================
// 仮データ: 回収地点
// ==========================================
const STOPS = [
    { id: "a", name: "集積所A", addr: "福岡市 ○○ 1-2-3", lat: 33.5904, lng: 130.4017 },
    { id: "b", name: "集積所B", addr: "福岡市 ○○ 4-5-6", lat: 33.5920, lng: 130.3990 },
    { id: "c", name: "集積所C", addr: "福岡市 ○○ 7-8-9", lat: 33.5885, lng: 130.4040 },
    { id: "d", name: "集積所D", addr: "福岡市 ○○ 10-11-12", lat: 33.5900, lng: 130.4070 },
];

// ==========================================
// 状態管理
// ==========================================
// state.done: 回収済みの地点IDの配列
// state.historyList: 過去の回収履歴の配列 [{ date: YYYY-MM-DD, count: 総数 }, ...]
// state.history: 本日の完了状態（後方互換性のため保持）
let state = {
    done: [],
    history: null,
    historyList: []
};

// LocalStorageのキー
const STORAGE_KEY = 'gomi-collection-state';

// 地図オブジェクト
let map = null;
let markers = [];
let routeLine = null; // ルート表示用のポリライン

// ==========================================
// 初期化
// ==========================================
function init() {
    loadState();
    initMap();
    render();
    attachEventListeners();
    checkPendingStopsAlert(); // 未回収アラート
}

// ==========================================
// LocalStorageから状態を読み込み
// ==========================================
function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            state = JSON.parse(saved);

            // データマイグレーション: historyListがない場合は追加
            if (!state.historyList) {
                state.historyList = [];
                // 既存のhistoryがあればリストに追加
                if (state.history) {
                    state.historyList.push(state.history);
                }
                saveState(); // マイグレーション後に保存
                console.log('✅ データをマイグレーションしました');
            }
        } catch (e) {
            console.error('Failed to parse saved state:', e);
            state = { done: [], history: null, historyList: [] };
        }
    }
}

// ==========================================
// LocalStorageに状態を保存
// ==========================================
function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ==========================================
// イベントリスナーを設定
// ==========================================
function attachEventListeners() {
    const resetBtn = document.getElementById('resetBtn');
    resetBtn.addEventListener('click', handleReset);
}

// ==========================================
// 回収ボタンがクリックされたときの処理
// ==========================================
// 仕様: 回収したらリストから消える（state.doneに追加してrender()で非表示にする）
function handleCollect(stopId) {
    if (!state.done.includes(stopId)) {
        state.done.push(stopId);
        saveState();
        render();
    }
}

// ==========================================
// リセットボタンがクリックされたときの処理
// ==========================================
function handleReset() {
    if (confirm('リセットしますか？全ての進捗と履歴がクリアされます。')) {
        state = { done: [], history: null, historyList: [] };
        saveState();
        render();
    }
}

// ==========================================
// 画面を更新
// ==========================================
function render() {
    renderProgress();
    renderStopsList();
    renderCompletionBanner();
    renderHistory();
    updateMapMarkers();
    updateRoute(); // ルート表示を更新

    // 仕様: 全件回収で自動完了処理を実行
    autoFinishIfAllDone();
}

// ==========================================
// 進捗表示を更新（ヘッダー）
// ==========================================
function renderProgress() {
    const progressText = document.getElementById('progressText');
    const doneCount = state.done.length;
    const totalCount = STOPS.length;
    progressText.textContent = `${doneCount}/${totalCount}`;
}

// ==========================================
// 回収リストを更新
// ==========================================
// 仕様: 回収したらリストから消える（未回収のみ表示）
function renderStopsList() {
    const stopsList = document.getElementById('stopsList');
    stopsList.innerHTML = '';

    // 未回収の地点のみを抽出
    const pendingStops = STOPS.filter(stop => !state.done.includes(stop.id));

    if (pendingStops.length === 0) {
        // 全て回収済みの場合
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-message';
        emptyMsg.textContent = '✅ 全ての地点を回収しました';
        stopsList.appendChild(emptyMsg);
    } else {
        // 未回収の地点をカードで表示
        pendingStops.forEach(stop => {
            const card = document.createElement('div');
            card.className = 'stop-card';

            const info = document.createElement('div');
            info.className = 'stop-info';

            const name = document.createElement('div');
            name.className = 'stop-name';
            name.textContent = stop.name;

            const addr = document.createElement('div');
            addr.className = 'stop-addr';
            addr.textContent = stop.addr;

            info.appendChild(name);
            info.appendChild(addr);

            const collectBtn = document.createElement('button');
            collectBtn.className = 'collect-btn';
            collectBtn.textContent = '✓ 回収した';
            collectBtn.addEventListener('click', () => handleCollect(stop.id));

            card.appendChild(info);
            card.appendChild(collectBtn);
            stopsList.appendChild(card);
        });
    }
}

// ==========================================
// 完了バナーを更新
// ==========================================
function renderCompletionBanner() {
    const banner = document.getElementById('completionBanner');
    // 仕様: 完了状態はhistoryで表現（historyがあれば完了済み）
    if (state.history) {
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

// ==========================================
// 履歴表示を更新
// ==========================================
function renderHistory() {
    const historyDisplay = document.getElementById('historyDisplay');

    if (state.historyList.length > 0) {
        // 履歴リストを日付の新しい順にソート
        const sortedHistory = [...state.historyList].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        // 最新5件のみ表示
        const recentHistory = sortedHistory.slice(0, 5);

        historyDisplay.innerHTML = recentHistory.map(h =>
            `<div style="padding: 8px 0; border-bottom: 1px solid #2d3548;">
                ${h.date}：${h.count}/${h.count} 完了
            </div>`
        ).join('');
    } else {
        // 履歴がない場合
        historyDisplay.textContent = 'まだ完了していません';
    }
}

// ==========================================
// 自動完了処理
// ==========================================
// 仕様: 全件回収で自動完了（最後の地点を回収して未回収が0になった瞬間に実行）
// 仕様: 完了済みなら完了処理が何度も走らないようにする（state.historyをフラグにする）
function autoFinishIfAllDone() {
    const allDone = state.done.length === STOPS.length;
    const notYetFinished = !state.history;

    if (allDone && notYetFinished) {
        // 完了処理を実行
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

        const completionRecord = {
            date: dateStr,
            count: STOPS.length
        };

        state.history = completionRecord;

        // 履歴リストに追加（重複チェック）
        const existingIndex = state.historyList.findIndex(h => h.date === dateStr);
        if (existingIndex >= 0) {
            state.historyList[existingIndex] = completionRecord;
        } else {
            state.historyList.push(completionRecord);
        }

        saveState();
        // 完了バナーと履歴表示を更新（renderは既に呼ばれているのでここでは最小限の更新）
        renderCompletionBanner();
        renderHistory();

        console.log('✅ 自動完了処理が実行されました:', state.history);
    }
}

// ==========================================
// 地図の初期化
// ==========================================
function initMap() {
    // 福岡市中央区を中心に地図を初期化
    map = L.map('map').setView([33.5904, 130.4017], 15);

    // OpenStreetMapタイルレイヤーを追加
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    console.log('✅ 地図を初期化しました');
}

// ==========================================
// 地図マーカーを更新
// ==========================================
function updateMapMarkers() {
    if (!map) return;

    // 既存のマーカーをクリア
    markers.forEach(marker => marker.remove());
    markers = [];

    // 各地点にマーカーを追加
    STOPS.forEach(stop => {
        const isDone = state.done.includes(stop.id);

        // マーカーの色を回収状態で変更
        const iconColor = isDone ? '#10b981' : '#ef4444'; // 緑 or 赤
        const iconHtml = `
            <div style="
                background-color: ${iconColor};
                width: 24px;
                height: 24px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            "></div>
        `;

        const customIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        // マーカーを作成
        const marker = L.marker([stop.lat, stop.lng], { icon: customIcon })
            .addTo(map);

        // ポップアップを追加
        const status = isDone ? '✅ 回収済み' : '⏳ 未回収';
        const buttonHtml = isDone ? '' : `
            <button 
                id="collect-btn-${stop.id}" 
                style="
                    margin-top: 8px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                "
                onmouseover="this.style.background='#2563eb'"
                onmouseout="this.style.background='#3b82f6'"
            >
                ✓ 回収した
            </button>
        `;

        const popupContent = `
            <div style="font-size: 14px; min-width: 160px;">
                <strong>${stop.name}</strong><br>
                ${stop.addr}<br>
                <span style="color: ${iconColor}; font-weight: bold;">${status}</span>
                ${buttonHtml}
            </div>
        `;

        marker.bindPopup(popupContent);

        // ポップアップが開いた時にボタンにイベントリスナーを設定
        if (!isDone) {
            marker.on('popupopen', () => {
                const btn = document.getElementById(`collect-btn-${stop.id}`);
                if (btn) {
                    btn.addEventListener('click', () => {
                        handleCollect(stop.id);
                        marker.closePopup();
                    });
                }
            });
        }

        markers.push(marker);
    });
}

// ==========================================
// 未回収アラート機能
// ==========================================
function checkPendingStopsAlert() {
    const pendingStops = STOPS.filter(stop => !state.done.includes(stop.id));

    if (pendingStops.length > 0) {
        const message = `未回収の地点が ${pendingStops.length} 件あります：\n` +
            pendingStops.map(s => `・${s.name}`).join('\n');

        // 少し遅延させてアラート表示（地図読み込み後）
        setTimeout(() => {
            alert(message);
        }, 500);
    }
}

// ==========================================
// 地図上にルート表示
// ==========================================
function updateRoute() {
    if (!map) return;

    // 既存のルートラインを削除
    if (routeLine) {
        routeLine.remove();
        routeLine = null;
    }

    // 未回収の地点のみを抽出
    const pendingStops = STOPS.filter(stop => !state.done.includes(stop.id));

    if (pendingStops.length >= 2) {
        // 未回収地点の座標配列を作成
        const routeCoords = pendingStops.map(stop => [stop.lat, stop.lng]);

        // ポリライン（線）を作成
        routeLine = L.polyline(routeCoords, {
            color: '#3b82f6',
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 10'
        }).addTo(map);

        console.log(`📍 ルートを表示しました: ${pendingStops.length} 地点`);
    }
}

// ==========================================
// アプリ起動
// ==========================================
document.addEventListener('DOMContentLoaded', init);
