// ========================================
// 未来の里山マップ
// JavaScript 全文
// ========================================


// ========================================
// 地図：OpenStreetMap
// ========================================

const map = L.map("map").setView(
    [34.5265, 132.793645],
    16
);

L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
    }
).addTo(map);

// ========================================
// 里山の道画像を地図に重ねる
// 画像内の入口・道標の丸印を基準に位置合わせ
// ========================================

(function addSatoyamaRoadOverlay() {
    // images フォルダ内の透過PNG画像
    const roadImageUrl = "images/satoyama-roads.png";

    // 元画像の大きさ（横1203px × 縦1307px）
    const imageWidth = 1203;
    const imageHeight = 1307;

    // 画像内の丸印の中心位置（ピクセル）
    // 上側の丸印＝入口、左下の丸印＝道標
    const entrancePixel = L.point(587.5, 276.5);
    const roadSignPixel = L.point(223.5, 1150.5);

    // 実際の地図上の基準座標
    const entranceLatLng = L.latLng(34.528179, 132.794731);
    const roadSignLatLng = L.latLng(34.524580, 132.792678);

    // Leafletの地図座標系に変換
    const entrancePoint = map.options.crs.project(entranceLatLng);
    const roadSignPoint = map.options.crs.project(roadSignLatLng);

    // 入口と道標の2点から画像の横・縦の縮尺を算出
    const scaleX =
        (entrancePoint.x - roadSignPoint.x) /
        (entrancePixel.x - roadSignPixel.x);

    const scaleY =
        (entrancePoint.y - roadSignPoint.y) /
        (entrancePixel.y - roadSignPixel.y);

    // 画像左上の地図座標を算出
    const topLeftPoint = L.point(
        entrancePoint.x - entrancePixel.x * scaleX,
        entrancePoint.y - entrancePixel.y * scaleY
    );

    // 画像右下の地図座標を算出
    const bottomRightPoint = L.point(
        topLeftPoint.x + imageWidth * scaleX,
        topLeftPoint.y + imageHeight * scaleY
    );

    const topLeftLatLng =
        map.options.crs.unproject(topLeftPoint);

    const bottomRightLatLng =
        map.options.crs.unproject(bottomRightPoint);

    const roadImageBounds = L.latLngBounds(
        topLeftLatLng,
        bottomRightLatLng
    );

    // 透明部分は地図を表示し、黒い線だけを重ねる
    L.imageOverlay(
        roadImageUrl,
        roadImageBounds,
        {
            opacity: 1,
            interactive: false,
            className: "satoyama-road-overlay",
            zIndex: 400
        }
    ).addTo(map);
})();



// ========================================
// 保存データ
// ========================================

let markersData = JSON.parse(
    localStorage.getItem("satoyamaMarkers") || "[]"
);

let currentMarker = null;

let distanceMode = false;
let distancePoints = [];
let distanceMarkers = [];
let distanceLine = null;

let panoramaViewer = null;
let current360Type = null;


// ========================================
// HTML要素
// ========================================

const placeModal =
    document.getElementById("placeModal");

const closePlaceModal =
    document.getElementById("closePlaceModal");

const closePlaceButton =
    document.getElementById("closePlaceButton");

const deleteMarkerButton =
    document.getElementById("deleteMarkerButton");

const realityImageArea =
    document.getElementById("realityImageArea");

const futureImageArea =
    document.getElementById("futureImageArea");

const realityImageInput =
    document.getElementById("realityImageInput");

const futureImageInput =
    document.getElementById("futureImageInput");

const reality360Checkbox =
    document.getElementById("reality360Checkbox");

const future360Checkbox =
    document.getElementById("future360Checkbox");

const view360Button =
    document.getElementById("view360Button");

const viewFuture360Button =
    document.getElementById("viewFuture360Button");

const futureComment =
    document.getElementById("futureComment");

const saveCommentButton =
    document.getElementById("saveCommentButton");

const savedCommentArea =
    document.getElementById("savedCommentArea");

const savedCommentText =
    document.getElementById("savedCommentText");

const viewer360Modal =
    document.getElementById("viewer360Modal");

const close360Button =
    document.getElementById("close360Button");

const distanceButton =
    document.getElementById("distanceButton");

const cancelDistanceButton =
    document.getElementById("cancelDistanceButton");

const distancePanel =
    document.getElementById("distancePanel");

const distanceResult =
    document.getElementById("distanceResult");

const dataLoading =
    document.getElementById("dataLoading");

const dataCards =
    document.getElementById("dataCards");

const elevationValue =
    document.getElementById("elevationValue");

const slopeValue =
    document.getElementById("slopeValue");

const temperatureValue =
    document.getElementById("temperatureValue");


// ========================================
// 保存
// ========================================

function saveData() {
    try {
        localStorage.setItem(
            "satoyamaMarkers",
            JSON.stringify(markersData)
        );

        return true;

    } catch (error) {
        console.error("保存エラー:", error);

        alert(
            "データを保存できませんでした。写真の容量が大きすぎる可能性があります。"
        );

        return false;
    }
}


// ========================================
// 入力内容があるか確認
// 写真またはコメントがあれば登録対象
// ========================================

function hasUserContent(data) {
    return Boolean(
        (data.realityPhoto &&
            data.realityPhoto.trim() !== "") ||
        (data.futurePhoto &&
            data.futurePhoto.trim() !== "") ||
        (data.futureComment &&
            data.futureComment.trim() !== "")
    );
}


// ========================================
// 新しい場所を正式に保存
// 空の場所は保存しない
// ========================================

function saveMarkerIfHasContent(marker) {
    if (!marker || !marker.data) {
        return false;
    }

    if (!hasUserContent(marker.data)) {
        return false;
    }

    const existingIndex = markersData.findIndex(
        function (data) {
            return data.id === marker.data.id;
        }
    );

    if (existingIndex === -1) {
        markersData.push(marker.data);
    } else {
        markersData[existingIndex] = marker.data;
    }

    marker.isDraft = false;

    return saveData();
}


// ========================================
// 空の仮ピンを削除
// ========================================

function removeEmptyDraft(marker) {
    if (!marker || !marker.isDraft) {
        return;
    }

    if (hasUserContent(marker.data)) {
        saveMarkerIfHasContent(marker);
        return;
    }

    if (map.hasLayer(marker)) {
        map.removeLayer(marker);
    }

    markersData = markersData.filter(
        function (data) {
            return data.id !== marker.data.id;
        }
    );

    saveData();

    marker.isDraft = false;
}


// ========================================
// 画像を圧縮して保存用データに変換
// ========================================

function fileToDataURL(file) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();

        reader.onload = function () {
            const image = new Image();

            image.onload = function () {
                const maxWidth = 2048;

                let width = image.naturalWidth;
                let height = image.naturalHeight;

                if (width > maxWidth) {
                    const ratio = maxWidth / width;

                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                const canvas =
                    document.createElement("canvas");

                canvas.width = width;
                canvas.height = height;

                const context = canvas.getContext("2d");

                if (!context) {
                    reject(
                        new Error(
                            "画像を処理できませんでした。"
                        )
                    );
                    return;
                }

                context.drawImage(
                    image,
                    0,
                    0,
                    width,
                    height
                );

                try {
                    resolve(
                        canvas.toDataURL(
                            "image/jpeg",
                            0.75
                        )
                    );
                } catch (error) {
                    reject(error);
                }
            };

            image.onerror = function () {
                reject(
                    new Error(
                        "画像を読み込めませんでした。"
                    )
                );
            };

            image.src = reader.result;
        };

        reader.onerror = function () {
            reject(
                reader.error ||
                new Error(
                    "画像ファイルを読み込めませんでした。"
                )
            );
        };

        reader.readAsDataURL(file);
    });
}


// ========================================
// 保存済みの通常ピンを復元
// 空のデータは復元しない
// ========================================

markersData = markersData.filter(hasUserContent);

saveData();
markersData.forEach(function (data) {
    createMarker(data, false);
});


// ========================================
// すでに存在する場所
// 既存の場所は登録データとは別管理
// ========================================

const existingPlaces = [
    {
        id: "existing-entrance",
        name: "入口",
        lat: 34.528179,
        lng: 132.794731
    },
    {
        id: "existing-kuromoji-field",
        name: "クロモジ畑",
        lat: 34.528596,
        lng: 132.794651
    },
    {
        id: "existing-abemaki",
        name: "アベマキ",
        lat: 34.526919,
        lng: 132.793689
    },
    {
        id: "existing-animal-food-plaza",
        name: "動物の食べ物広場",
        lat: 34.526731,
        lng: 132.794010
    },
    {
        id: "existing-footprint-swamp",
        name: "あしあとヌマ",
        lat: 34.526339,
        lng: 132.793549
    },
    {
        id: "existing-history-plaza",
        name: "れきしひろば",
        lat: 34.525447,
        lng: 132.793029
    },
    {
        id: "existing-deep-forest-crossroad",
        name: "山おくの交さ点",
        lat: 34.525921,
        lng: 132.793529
    },
    {
        id: "existing-charcoal-factory",
        name: "炭の工場",
        lat: 34.525472,
        lng: 132.794270
    },
    {
        id: "existing-suberi-zaka",
        name: "すべりざか",
        lat: 34.525112,
        lng: 132.794180
    },
    {
        id: "existing-viewpoint-plaza",
        name: "見はらし広場",
        lat: 34.525594,
        lng: 132.794811
    },
    {
        id: "existing-kofun",
        name: "古墳",
        lat: 34.525251,
        lng: 132.792918
    },
    {
        id: "existing-treehouse",
        name: "ツリーハウス",
        lat: 34.525504,
        lng: 132.793389
    },
    {
        id: "existing-tower",
        name: "鉄塔",
        lat: 34.525504,
        lng: 132.795252
    },
    {
        id: "existing-castle-ruins",
        name: "城址",
        lat: 34.527253,
        lng: 132.797856
    },
    {
        id: "existing-road-sign",
        name: "道標",
        lat: 34.524580,
        lng: 132.792678
    }
];

existingPlaces.forEach(function (place) {
    createExistingPlaceMarker(place);
});


// ========================================
// 既存の場所のピン
// 小さめのくすみピンク
// ========================================

function createExistingPlaceMarker(place) {
    const existingPlaceIcon = L.divIcon({
        className: "existing-place-marker-icon",

        html: `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="36"
                viewBox="0 0 46 56"
                aria-hidden="true"
                style="
                    display: block;
                    filter: drop-shadow(
                        0 2px 2px rgba(0,0,0,0.3)
                    );
                "
            >
                <path
                    d="
                        M23 53
                        C18 44 4 33 4 20
                        A19 19 0 1 1 42 20
                        C42 33 28 44 23 53Z
                    "
                    fill="#C58A9A"
                    stroke="#FFFFFF"
                    stroke-width="3"
                    stroke-linejoin="round"
                />

                <path
                    d="
                        M23 9
                        L14 20
                        H19
                        L12 28
                        H20
                        L20 34
                        H26
                        V28
                        H34
                        L27 20
                        H32
                        Z
                    "
                    fill="#FFFFFF"
                />
            </svg>
        `,

        iconSize: [28, 36],
        iconAnchor: [14, 34],
        popupAnchor: [0, -33]
    });

    const marker = L.marker(
        [place.lat, place.lng],
        {
            icon: existingPlaceIcon,
            title: place.name,
            bubblingMouseEvents: false,
            zIndexOffset: 1000
        }
    ).addTo(map);

    marker.existingPlaceData = place;

    marker.bindPopup(
        `<strong>${escapeHTML(place.name)}</strong>`
    );

    marker.on("click", function () {
        if (distanceMode) {
            map.closePopup();
            addDistancePoint(marker.getLatLng());
            return;
        }

        marker.openPopup();
    });

    return marker;
}


// ========================================
// HTMLエスケープ
// ========================================

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ========================================
// 通常の登録ピンを作成
// ========================================

function createMarker(data, isDraft = false) {
    const marker = L.marker(
        [data.lat, data.lng]
    ).addTo(map);

    marker.data = data;
    marker.isDraft = isDraft;

    marker.on("click", function () {
        if (distanceMode) {
            addDistancePoint(marker.getLatLng());
            return;
        }

        openPlaceModal(marker);
    });

    return marker;
}


// ========================================
// 地図クリック
// 仮ピンを作成するが、まだ保存しない
// ========================================

map.on("click", function (e) {
    if (distanceMode) {
        addDistancePoint(e.latlng);
        return;
    }

    const data = {
        id:
            Date.now() +
            "_" +
            Math.random().toString(36).substring(2, 8),

        lat: e.latlng.lat,
        lng: e.latlng.lng,

        realityPhoto: "",
        realityIs360: false,

        futurePhoto: "",
        futureIs360: false,

        futureComment: "",

        elevation: null,
        slope: null,
        temperature: null
    };

    // 仮ピンとして表示。ここでは保存しない
    const marker = createMarker(data, true);

    openPlaceModal(marker);
});


// ========================================
// 場所情報を開く
// ========================================

async function openPlaceModal(marker) {
    currentMarker = marker;

    updateReality();
    updateFuture();
    updateComment();

    reality360Checkbox.checked =
        !!marker.data.realityIs360;

    if (future360Checkbox) {
        future360Checkbox.checked =
            !!marker.data.futureIs360;
    }

    placeModal.style.display = "block";

    dataLoading.style.display = "block";
    dataLoading.textContent = "データを取得しています……";

    dataCards.style.display = "none";

    elevationValue.textContent = "---";
    slopeValue.textContent = "---";
    temperatureValue.textContent = "---";

    try {
        const result = await getLocationData(
            marker.data.lat,
            marker.data.lng
        );

        if (currentMarker !== marker) {
            return;
        }

        marker.data.elevation = result.elevation;
        marker.data.slope = result.slope;
        marker.data.temperature = result.temperature;

        // 空の仮ピンは保存しない
        if (!marker.isDraft) {
            saveData();
        }

        elevationValue.textContent =
            result.elevation !== null
                ? `${result.elevation.toFixed(1)} m`
                : "取得できません";

        slopeValue.textContent =
            result.slope !== null
                ? `${result.slope.toFixed(1)}°`
                : "取得できません";

        temperatureValue.textContent =
            result.temperature !== null
                ? `${result.temperature.toFixed(1)} ℃`
                : "取得できません";

        dataLoading.style.display = "none";
        dataCards.style.display = "grid";

    } catch (error) {
        console.error("地域データ取得エラー:", error);

        if (currentMarker !== marker) {
            return;
        }

        dataLoading.textContent =
            "データを取得できませんでした。通信状況を確認してください。";

        dataCards.style.display = "grid";
    }
}


// ========================================
// 現実の写真を表示
// ========================================

function updateReality() {
    const data = currentMarker.data;

    if (!data.realityPhoto) {
        realityImageArea.innerHTML = `
            <div class="no-photo">
                <div class="no-photo-icon">📷</div>
                <p>まだ写真が登録されていません。</p>
            </div>
        `;

        view360Button.style.display = "none";
        return;
    }

    realityImageArea.innerHTML = "";

    const image = document.createElement("img");
    image.src = data.realityPhoto;
    image.alt = "現実の里山";

    realityImageArea.appendChild(image);

    view360Button.style.display =
        data.realityIs360 ? "block" : "none";
}


// ========================================
// 理想の写真を表示
// ========================================

function updateFuture() {
    const data = currentMarker.data;

    if (!data.futurePhoto) {
        futureImageArea.innerHTML = `
            <div class="no-photo">
                <div class="no-photo-icon">🌱</div>
                <p>まだ理想の写真が登録されていません。</p>
            </div>
        `;

        if (viewFuture360Button) {
            viewFuture360Button.style.display = "none";
        }

        return;
    }

    futureImageArea.innerHTML = "";

    const image = document.createElement("img");
    image.src = data.futurePhoto;
    image.alt = "理想の里山";

    futureImageArea.appendChild(image);

    if (viewFuture360Button) {
        viewFuture360Button.style.display =
            data.futureIs360 ? "block" : "none";
    }
}


// ========================================
// コメント表示
// ========================================

function updateComment() {
    const comment =
        currentMarker.data.futureComment || "";

    futureComment.value = comment;

    if (comment) {
        savedCommentArea.style.display = "block";
        savedCommentText.textContent = comment;
    } else {
        savedCommentArea.style.display = "none";
    }
}
// ========================================
// 現実の写真を登録
// 写真が登録された時点でピンを正式保存
// ========================================

realityImageInput.addEventListener(
    "change",
    async function (event) {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        if (!currentMarker) {
            alert("先に地図上の場所を選択してください。");
            return;
        }

        const targetMarker = currentMarker;

        try {
            const imageData = await fileToDataURL(file);

            targetMarker.data.realityPhoto = imageData;
            targetMarker.data.realityIs360 =
                reality360Checkbox.checked;

            if (!saveMarkerIfHasContent(targetMarker)) {
                return;
            }

            if (currentMarker === targetMarker) {
                updateReality();
            }

            alert("現実の写真を登録しました！");

        } catch (error) {
            console.error("現実写真登録エラー:", error);

            alert(
                "写真の登録に失敗しました。\n原因：" +
                (error.message || "不明なエラー")
            );

        } finally {
            realityImageInput.value = "";
        }
    }
);


// ========================================
// 現実写真の360度設定
// ========================================

reality360Checkbox.addEventListener(
    "change",
    function () {
        if (!currentMarker) {
            return;
        }

        currentMarker.data.realityIs360 =
            reality360Checkbox.checked;

        // 360度設定だけでは空のピンを保存しない
        if (hasUserContent(currentMarker.data)) {
            saveMarkerIfHasContent(currentMarker);
        }

        updateReality();
    }
);


// ========================================
// 理想の写真を登録
// ========================================

futureImageInput.addEventListener(
    "change",
    async function (event) {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        if (!currentMarker) {
            alert("先に地図上の場所を選択してください。");
            return;
        }

        const targetMarker = currentMarker;

        try {
            const imageData = await fileToDataURL(file);

            targetMarker.data.futurePhoto = imageData;

            if (future360Checkbox) {
                targetMarker.data.futureIs360 =
                    future360Checkbox.checked;
            }

            if (!saveMarkerIfHasContent(targetMarker)) {
                return;
            }

            if (currentMarker === targetMarker) {
                updateFuture();
            }

            alert("理想の写真を登録しました！");

        } catch (error) {
            console.error("理想写真登録エラー:", error);

            alert(
                "理想の写真の登録に失敗しました。\n原因：" +
                (error.message || "不明なエラー")
            );

        } finally {
            futureImageInput.value = "";
        }
    }
);


// ========================================
// 理想写真の360度設定
// ========================================

if (future360Checkbox) {
    future360Checkbox.addEventListener(
        "change",
        function () {
            if (!currentMarker) {
                return;
            }

            currentMarker.data.futureIs360 =
                future360Checkbox.checked;

            if (hasUserContent(currentMarker.data)) {
                saveMarkerIfHasContent(currentMarker);
            }

            updateFuture();
        }
    );
}


// ========================================
// コメント保存
// コメントが入力されていればピンを正式保存
// 空欄なら空のピンを保存しない
// ========================================

saveCommentButton.addEventListener(
    "click",
    function () {
        if (!currentMarker) {
            return;
        }

        currentMarker.data.futureComment =
            futureComment.value.trim();

        if (hasUserContent(currentMarker.data)) {
            if (!saveMarkerIfHasContent(currentMarker)) {
                return;
            }
        } else if (currentMarker.isDraft) {
            alert(
                "写真またはコメントを登録すると、ピンが保存されます。"
            );
            updateComment();
            return;
        } else {
            if (!saveData()) {
                return;
            }
        }

        updateComment();

        alert("解説を保存しました！");
    }
);


// ========================================
// ピン削除
// ========================================

if (deleteMarkerButton) {
    deleteMarkerButton.addEventListener(
        "click",
        function (event) {
            event.preventDefault();
            event.stopPropagation();

            if (!currentMarker) {
                alert("削除するピンが選択されていません。");
                return;
            }

            const confirmed = confirm(
                "このピンを削除しますか？\n登録した写真やコメントも削除されます。"
            );

            if (!confirmed) {
                return;
            }

            const markerToDelete = currentMarker;
            const markerId = markerToDelete.data.id;

            markersData = markersData.filter(
                function (data) {
                    return data.id !== markerId;
                }
            );

            if (!saveData()) {
                return;
            }

            if (map.hasLayer(markerToDelete)) {
                map.removeLayer(markerToDelete);
            }

            currentMarker = null;
            placeModal.style.display = "none";
        }
    );
}


// ========================================
// モーダルを閉じる
// 空の仮ピンは削除する
// ========================================

function closePlaceModalSafely() {
    if (currentMarker) {
        removeEmptyDraft(currentMarker);
    }

    placeModal.style.display = "none";
    currentMarker = null;
}

closePlaceModal.addEventListener(
    "click",
    closePlaceModalSafely
);

closePlaceButton.addEventListener(
    "click",
    closePlaceModalSafely
);

placeModal.addEventListener(
    "click",
    function (event) {
        if (event.target === placeModal) {
            closePlaceModalSafely();
        }
    }
);


// ========================================
// 現実の360度写真を開く
// ========================================

view360Button.addEventListener(
    "click",
    function () {
        if (!currentMarker) {
            return;
        }

        if (
            !currentMarker.data.realityPhoto ||
            !currentMarker.data.realityIs360
        ) {
            return;
        }

        current360Type = "reality";

        open360Viewer(
            currentMarker.data.realityPhoto,
            "🌐 現実の里山・360度写真"
        );
    }
);


// ========================================
// 理想の360度写真を開く
// ========================================

if (viewFuture360Button) {
    viewFuture360Button.addEventListener(
        "click",
        function () {
            if (!currentMarker) {
                return;
            }

            if (
                !currentMarker.data.futurePhoto ||
                !currentMarker.data.futureIs360
            ) {
                return;
            }

            current360Type = "future";

            open360Viewer(
                currentMarker.data.futurePhoto,
                "🌱 理想の里山・360度写真"
            );
        }
    );
}


// ========================================
// 360度ビューアを開く
// ========================================

function open360Viewer(imageData, title) {
    if (!imageData) {
        return;
    }

    const viewerHeader =
        viewer360Modal.querySelector(
            ".viewer-header strong"
        );

    if (viewerHeader) {
        viewerHeader.textContent = title;
    }

    viewer360Modal.style.display = "block";

    setTimeout(function () {
        if (panoramaViewer) {
            panoramaViewer.destroy();
            panoramaViewer = null;
        }

        panoramaViewer = pannellum.viewer(
            "panorama",
            {
                type: "equirectangular",
                panorama: imageData,
                autoLoad: true,
                compass: true,
                showControls: true,
                hfov: 100
            }
        );
    }, 100);
}


// ========================================
// 360度ビューアを閉じる
// ========================================

function close360Viewer() {
    viewer360Modal.style.display = "none";

    if (panoramaViewer) {
        panoramaViewer.destroy();
        panoramaViewer = null;
    }

    current360Type = null;
}

close360Button.addEventListener(
    "click",
    close360Viewer
);

viewer360Modal.addEventListener(
    "click",
    function (event) {
        if (event.target === viewer360Modal) {
            close360Viewer();
        }
    }
);
// ========================================
// 距離測定開始
// ========================================

distanceButton.addEventListener(
    "click",
    function () {
        distanceMode = true;

        clearDistanceMap();

        distancePanel.style.display = "block";
        cancelDistanceButton.style.display = "block";
        distanceButton.style.display = "none";

        distanceResult.textContent = "0 m";

        map.getContainer().style.cursor = "crosshair";
    }
);


// ========================================
// 距離測定終了
// ========================================

cancelDistanceButton.addEventListener(
    "click",
    stopDistanceMode
);


// ========================================
// 距離測定地点を追加
// ========================================

function addDistancePoint(latlng) {
    distancePoints.push(latlng);

    const pointMarker = L.circleMarker(
        latlng,
        {
            radius: 7,
            color: "#315d3c",
            fillColor: "#ffffff",
            fillOpacity: 1,
            weight: 3
        }
    ).addTo(map);

    distanceMarkers.push(pointMarker);

    updateDistanceLine();
    updateDistanceResult();
}


// ========================================
// 距離測定線
// ========================================

function updateDistanceLine() {
    if (distanceLine) {
        map.removeLayer(distanceLine);
        distanceLine = null;
    }

    if (distancePoints.length < 2) {
        return;
    }

    distanceLine = L.polyline(
        distancePoints,
        {
            color: "#315d3c",
            weight: 4,
            dashArray: "8 8"
        }
    ).addTo(map);
}


// ========================================
// 距離計算結果
// ========================================

function updateDistanceResult() {
    let totalDistance = 0;

    for (
        let i = 1;
        i < distancePoints.length;
        i++
    ) {
        totalDistance += calculateDistance(
            distancePoints[i - 1],
            distancePoints[i]
        );
    }

    if (totalDistance < 1000) {
        distanceResult.textContent =
            `${totalDistance.toFixed(1)} m`;
    } else {
        distanceResult.textContent =
            `${(totalDistance / 1000).toFixed(3)} km`;
    }
}


// ========================================
// 2地点間の距離
// ========================================

function calculateDistance(point1, point2) {
    const R = 6371000;

    const lat1 = point1.lat * Math.PI / 180;
    const lat2 = point2.lat * Math.PI / 180;

    const dLat =
        (point2.lat - point1.lat) * Math.PI / 180;

    const dLng =
        (point2.lng - point1.lng) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}


// ========================================
// 距離測定終了処理
// ========================================

function stopDistanceMode() {
    distanceMode = false;

    clearDistanceMap();

    distancePanel.style.display = "none";
    cancelDistanceButton.style.display = "none";
    distanceButton.style.display = "inline-block";

    map.getContainer().style.cursor = "";
}


// ========================================
// 距離測定の線と点を消す
// ========================================

function clearDistanceMap() {
    distanceMarkers.forEach(function (marker) {
        map.removeLayer(marker);
    });

    distanceMarkers = [];
    distancePoints = [];

    if (distanceLine) {
        map.removeLayer(distanceLine);
        distanceLine = null;
    }
}


// ========================================
// 標高・傾斜・気温を取得
// ========================================

async function getLocationData(lat, lng) {
    const elevation = await getElevation(lat, lng);

    const north = await getElevation(lat + 0.0005, lng);
    const south = await getElevation(lat - 0.0005, lng);
    const east = await getElevation(lat, lng + 0.0005);
    const west = await getElevation(lat, lng - 0.0005);

    let slope = null;

    if (
        north !== null &&
        south !== null &&
        east !== null &&
        west !== null
    ) {
        const northSouthDistance = calculateDistance(
            {
                lat: lat - 0.0005,
                lng: lng
            },
            {
                lat: lat + 0.0005,
                lng: lng
            }
        );

        const eastWestDistance = calculateDistance(
            {
                lat: lat,
                lng: lng - 0.0005
            },
            {
                lat: lat,
                lng: lng + 0.0005
            }
        );

        const slopeNorthSouth =
            (north - south) / northSouthDistance;

        const slopeEastWest =
            (east - west) / eastWestDistance;

        const slopeRatio = Math.sqrt(
            slopeNorthSouth * slopeNorthSouth +
            slopeEastWest * slopeEastWest
        );

        slope =
            Math.atan(slopeRatio) * 180 / Math.PI;
    }

    const temperature = await getTemperature(lat, lng);

    return {
        elevation: elevation,
        slope: slope,
        temperature: temperature
    };
}


// ========================================
// 国土地理院から標高を取得
// ========================================

async function getElevation(lat, lng) {
    const url =
        "https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php" +
        `?lon=${encodeURIComponent(lng)}` +
        `&lat=${encodeURIComponent(lat)}` +
        "&outtype=JSON";

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("標高APIに接続できませんでした");
    }

    const data = await response.json();

    if (
        data.elevation === undefined ||
        data.elevation === null ||
        data.elevation === "-----"
    ) {
        return null;
    }

    const value = Number(data.elevation);

    return Number.isFinite(value) ? value : null;
}


// ========================================
// 気温を取得
// ========================================

async function getTemperature(lat, lng) {
    const url =
        "https://api.open-meteo.com/v1/jma" +
        `?latitude=${encodeURIComponent(lat)}` +
        `&longitude=${encodeURIComponent(lng)}` +
        "&current=temperature_2m" +
        "&temperature_unit=celsius" +
        "&timezone=Asia%2FTokyo";

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("気象APIに接続できませんでした");
    }

    const data = await response.json();

    if (
        !data.current ||
        data.current.temperature_2m === undefined
    ) {
        return null;
    }

    const value = Number(data.current.temperature_2m);

    return Number.isFinite(value) ? value : null;
}


// ========================================
// ESCキーで閉じる
// ========================================

document.addEventListener(
    "keydown",
    function (event) {
        if (event.key !== "Escape") {
            return;
        }

        if (viewer360Modal.style.display === "block") {
            close360Viewer();

        } else if (placeModal.style.display === "block") {
            closePlaceModalSafely();

        } else if (distanceMode) {
            stopDistanceMode();
        }
    }
);