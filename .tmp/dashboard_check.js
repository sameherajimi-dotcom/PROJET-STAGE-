





    // ============================================================
    // VARIABLES
    // ============================================================

    let readings = [];
    let chartInstance = null;
    let trpMap = {};

    let cameraActive = false;
    let detectionInProgress = false;

    let mediaStream = null;
    let selectedCameraId = '';

    let lastFrameSize = {
        width: 0,
        height: 0
    };

    let scanCounter = 0;

    window.productTotals = {};


    // ============================================================
    // CLOCK
    // ============================================================

    function updateClock() {

        const now = new Date();

        document.getElementById('current-date').textContent =
            now.toLocaleDateString('fr-FR');

        document.getElementById('current-time').textContent =
            now.toLocaleTimeString('fr-FR');

    }

    setInterval(updateClock, 1000);

    updateClock();


    // ============================================================
    // USER INFO
    // ============================================================

    document.addEventListener('DOMContentLoaded', function() {

        // The dashboard is available only after a successful login.
        if (!sessionStorage.getItem('valeo_userId')) {
            window.location.replace('login.html');
            return;
        }

        const userName =
            sessionStorage.getItem('valeo_userName') ||
            'Utilisateur';

        const userCode =
            sessionStorage.getItem('valeo_userCode') ||
            '';

        const userEmail =
            sessionStorage.getItem('valeo_userEmail') ||
            '';

        const userRole =
            sessionStorage.getItem('valeo_userRole') ||
            '';


        document.getElementById('userDisplay').textContent =
            userCode || userName;


        document.getElementById('dropdownName').textContent =
            userName;

        document.getElementById('dropdownRole').textContent =
            userRole || '—';

        document.getElementById('dropdownEmail').textContent =
            userEmail || '—';


        const isAdmin =
            sessionStorage.getItem('valeo_isAdmin') === 'true';

        const navAdmin =
            document.getElementById('navAdmin');

        if (navAdmin && isAdmin) {
            navAdmin.style.display = 'inline-flex';
        }


        // Account dropdown

        const accountBtn =
            document.getElementById('accountBtn');

        const dropdown =
            document.getElementById('accountDropdown');


        if (accountBtn) {

            accountBtn.addEventListener('click', function(e) {

                e.stopPropagation();

                dropdown.classList.toggle('visible');

            });


            document.addEventListener('click', function() {

                dropdown.classList.remove('visible');

            });


            dropdown.addEventListener('click', function(e) {

                e.stopPropagation();

            });

        }


        initChart();

        updateCameraStatus(false);
        refreshCameraDevices();

    });


    // ============================================================
    // LOGOUT
    // ============================================================

    function logout() {

        sessionStorage.removeItem('valeo_userName');
        sessionStorage.removeItem('valeo_userEmail');
        sessionStorage.removeItem('valeo_userRole');
        sessionStorage.removeItem('valeo_userId');
        sessionStorage.removeItem('valeo_userCode');
        sessionStorage.removeItem('valeo_isAdmin');

        window.location.href = 'login.html';

    }


    // ============================================================
    // CAMERA STATUS
    // ============================================================

    function updateCameraStatus(active) {

        cameraActive = active;

        const noSignal =
            document.getElementById('no-signal-overlay');

        const badge =
            document.getElementById('cam-simulation-badge');


        if (active) {

            noSignal.style.display = 'none';

            badge.textContent = 'IA active';

            badge.className = 'badge badge-green';

        } else {

            noSignal.style.display = 'flex';

            badge.textContent = 'Caméra inactive';

            badge.className = 'badge badge-amber';

        }

    }


    // ============================================================
    // CHART
    // ============================================================

    function initChart() {

        const ctx =
            document.getElementById('volumeChart').getContext('2d');


        chartInstance = new Chart(ctx, {

            type: 'line',

            data: {

                labels: [],

                datasets: [{

                    label: 'Pièces Détectées',

                    data: [],

                    borderColor: '#B9FF00',

                    backgroundColor:
                        'rgba(185, 255, 0, 0.08)',

                    borderWidth: 2,

                    fill: true,

                    tension: 0.3

                }]

            },


            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: false
                    }

                },

                scales: {

                    x: {

                        grid: {
                            color: 'rgba(255, 255, 255, 0.04)'
                        },

                        ticks: {

                            color: '#8C9498',

                            font: {
                                size: 10
                            }

                        }

                    },


                    y: {

                        grid: {
                            color: 'rgba(255, 255, 255, 0.04)'
                        },

                        ticks: {
                            color: '#8C9498'
                        },

                        min: 0,

                        max: 50

                    }

                }

            }

        });

    }


    // ============================================================
    // STATS
    // ============================================================

    function calculateStats() {

        if (readings.length === 0) {
            return;
        }


        const productTotals = {};


        readings.forEach(r => {

            if (
                !productTotals[r.produit] ||
                productTotals[r.produit] < r.quantite_totale
            ) {

                productTotals[r.produit] =
                    r.quantite_totale;

            }

        });


        const totalParts =
            Object.values(productTotals)
                .reduce((sum, val) => sum + val, 0);


        document.getElementById('val-total-parts').textContent =
            totalParts || 0;


        const latest = readings[0];


        document.getElementById('val-active-product').textContent =
            latest.produit;


        const totalQuantity =
            readings.reduce((sum, r) => {
                const qty = Number(r.quantite ?? 0);
                return sum + (Number.isFinite(qty) ? qty : 0);
            }, 0);

        const avgQuantity =
            readings.length
                ? Math.round(totalQuantity / readings.length)
                : 0;

        document.getElementById('val-avg-fill').textContent =
            `${avgQuantity}`;

        const trpProductCard = document.getElementById('val-trp-product');
        if (trpProductCard) {
            const trpVal = trpMap[latest.produit];
            trpProductCard.textContent =
                trpVal !== undefined
                    ? `${window.productTotals[latest.produit] || 0}`
                    : '0';
        }

    }


    // ============================================================
    // CAPTURED QUANTITY HELPERS
    // ============================================================

    function getCapturedQuantityFromCountMap(countMap) {

        return Object.values(countMap || {})
            .reduce(
                (sum, value) =>
                    sum + (Number(value) || 0),
                0
            );

    }


    // ============================================================
    // RENDER DETECTIONS
    // ============================================================

    function renderDetections(detections) {

        const overlay =
            document.getElementById('detection-overlay');


        overlay.innerHTML = '';


        const display =
            overlay.getBoundingClientRect();


        const scaleX =
            lastFrameSize.width
                ? display.width / lastFrameSize.width
                : 1;


        const scaleY =
            lastFrameSize.height
                ? display.height / lastFrameSize.height
                : 1;


        detections.forEach(detection => {

            if (
                ![
                    detection.x,
                    detection.y,
                    detection.width,
                    detection.height
                ].every(Number.isFinite)
            ) {
                return;
            }


            const box =
                document.createElement('div');


            box.className =
                'detection-box';


            box.style.left =
                `${(detection.x - detection.width / 2) * scaleX}px`;


            box.style.top =
                `${(detection.y - detection.height / 2) * scaleY}px`;


            box.style.width =
                `${detection.width * scaleX}px`;


            box.style.height =
                `${detection.height * scaleY}px`;


            const label =
                document.createElement('span');


            label.className =
                'detection-box-label';


            label.textContent =
                `${detection.product}`;


            box.appendChild(label);

            overlay.appendChild(box);

        });

    }


    // ============================================================
    // CAPTURE ONE FRAME
    // ============================================================

    function captureFrame() {

        const video =
            document.getElementById('camera-video');


        if (
            !video.videoWidth ||
            !video.videoHeight
        ) {
            return null;
        }


        const canvas =
            document.createElement('canvas');


        canvas.width =
            video.videoWidth;


        canvas.height =
            video.videoHeight;


        lastFrameSize = {

            width: canvas.width,

            height: canvas.height

        };


        canvas
            .getContext('2d')
            .drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
            );


        return canvas.toDataURL(
            'image/jpeg',
            0.82
        );

    }

    function freezeCapturedFrame() {

        const video =
            document.getElementById('camera-video');

        video.pause();

        document.getElementById('cam-rec-indicator').innerHTML =
            '<i class="fa-solid fa-camera" style="color: var(--valeo-lime); font-size: 8px;"></i> CAPTURÉE';

    }

    // Leave the detection result visible briefly, then return to the live feed
    // ready for the next manual capture.
    async function resumeCameraPreview() {

        if (!cameraActive || !mediaStream) {
            return;
        }

        const video = document.getElementById('camera-video');

        try {
            await video.play();
            document.getElementById('cam-rec-indicator').innerHTML =
                '<i class="fa-solid fa-circle" style="color: var(--accent-red); font-size: 8px;"></i> LIVE';
        } catch (error) {
            console.error('Impossible de reprendre le flux cam\u00e9ra:', error);
        }

    }


    // ============================================================
    // RECORD DETECTIONS
    // ============================================================

    function normalizeQuantityValue(value) {
        if (value === null || value === undefined || value === '') {
            return 0;
        }

        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : 0;
        }

        const sanitized = String(value).replace(/[^0-9.,-]/g, '').replace(',', '.');
        const parsed = Number(sanitized);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function normalizeHeader(label) {
        return String(label || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getCellByAliases(row, aliases) {
        const keys = Object.keys(row || {});

        for (const key of keys) {
            const normalized = normalizeHeader(key);
            const match = aliases.some(alias => normalized.includes(alias));
            if (match) {
                return row[key];
            }
        }

        return undefined;
    }

    function loadExcelData(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const workbook = XLSX.read(event.target.result, { type: 'array' });
                const allSheetRows = workbook.SheetNames.flatMap(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    if (!sheet) return [];
                    return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
                });

                if (!allSheetRows.length) {
                    alert('Le fichier Excel ne contient aucune donnée exploitable.');
                    return;
                }

                const normalized = [];

                allSheetRows.forEach((row, index) => {
                    const produit =
                        getCellByAliases(row, ['produit', 'product', 'designation', 'ref', 'reference', 'nom', 'famille']) ||
                        getCellByAliases(row, ['produit', 'product', 'designation', 'ref', 'reference', 'nom', 'famille']);

                    const quantite =
                        normalizeQuantityValue(
                            getCellByAliases(row, ['qte annuel', 'quantite annuelle', 'quantite', 'quantité', 'qty', 'quantity', 'quantite kits', 'quantite kits', 'qte kits', 'total']) ||
                            getCellByAliases(row, ['qte', 'quantite', 'quantité', 'qty', 'quantity'])
                        );

                    const date = getCellByAliases(row, ['date']) || new Date().toLocaleDateString('fr-FR');
                    const heure = getCellByAliases(row, ['heure', 'time']) || new Date().toLocaleTimeString('fr-FR');

                    if (!produit || !quantite) {
                        return;
                    }

                    normalized.push({
                        id: getCellByAliases(row, ['id']) || `EXCEL-${String(readings.length + index + 1).padStart(4, '0')}`,
                        date,
                        heure,
                        produit: String(produit).trim(),
                        quantite: Number(quantite),
                        quantite_totale: Number(quantite),
                        taux: `${Math.min(100, Math.max(0, Number(quantite)))}%`
                    });
                });

                if (!normalized.length) {
                    alert('Aucune ligne valide n’a été trouvée dans le fichier Excel.');
                    return;
                }

                const deduped = normalized.filter((row, index, arr) => {
                    const key = `${row.produit}|${row.quantite}|${row.date}|${row.heure}`;
                    return arr.findIndex(item => `${item.produit}|${item.quantite}|${item.date}|${item.heure}` === key) === index;
                });

                readings = deduped.concat(readings).slice(0, 50);
                trpMap = computeLocalTRP();
                rebuildTableTRP();
                calculateStats();
                updateChart();

                const excelInput = document.getElementById('excel-file-input');
                if (excelInput) excelInput.value = '';

                alert(`${deduped.length} ligne(s) importée(s) depuis Excel.`);
            } catch (error) {
                console.error('Erreur import Excel:', error);
                alert('Le fichier Excel n’a pas pu être lu. Vérifiez le format ou les colonnes.');
            }
        };

        reader.readAsArrayBuffer(file);
    }

    document.getElementById('excel-file-input')?.addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        if (file) {
            loadExcelData(file);
        }
    });

    function recordDetections(counts, detections) {

        const now = new Date();


        Object.entries(counts).forEach(
            ([product, quantity]) => {

                window.productTotals[product] =
                    (window.productTotals[product] || 0)
                    + quantity;


                const productDetections =
                    detections.filter(
                        d => d.product === product
                    );


                scanCounter++;


                const reading = {

                    id:
                        `VAL-${String(scanCounter).padStart(4, '0')}`,

                    date:
                        now.toLocaleDateString('fr-FR'),

                    heure:
                        now.toLocaleTimeString('fr-FR'),

                    produit:
                        product,

                    quantite:
                        quantity,

                    quantite_totale:
                        window.productTotals[product],

                    taux:
                        `${quantity}`

                };


                readings.unshift(reading);


                insertRow(
                    reading,
                    true
                );

            }
        );


        readings =
            readings.slice(0, 50);


        trpMap =
            computeLocalTRP();

        rebuildTableTRP();

        calculateStats();

        updateChart();

    }


    // ============================================================
    // SENSOR TRIGGER
    // ONE CLICK = ONE PHOTO
    // ============================================================

    async function triggerSensor() {

        if (!cameraActive) {

            alert(
                'Veuillez d’abord activer la caméra.'
            );

            return;

        }


        if (detectionInProgress) {
            return;
        }


        const frame =
            captureFrame();


        if (!frame) {

            alert(
                'Impossible de capturer l’image. La caméra n’est pas prête.'
            );

            return;

        }

        // Freeze the preview on the exact frame submitted to the AI.
        freezeCapturedFrame();


        const button =
            document.getElementById(
                'sensor-trigger-btn'
            );


        // Button loading state

        button.disabled = true;

        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Capture...';


        try {

            detectionInProgress = true;


            // Send captured image to backend

            const response =
                await fetch(
                    '/api/detect',
                    {

                        method: 'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body: JSON.stringify({
                            image: frame
                        })

                    }
                );


            const data =
                await response.json();


            if (!data.success) {

                throw new Error(
                    data.message ||
                    'Détection indisponible'
                );

            }


            const detections =
                data.detections || [];
            const jigDetections =
                data.jig_detections || [];


            // Display detection boxes

            renderDetections(
                [...detections, ...jigDetections]
            );


            // Display detected products

            const countText =
                Object.entries(
                    data.counts || {}
                )
                .map(
                    ([name, count]) =>
                        `${name}: ${count}`
                )
                .join(' | ');
            const jigText = detections.length
                ? `Jigs: ${data.jig_count || 0}`
                : '';


            document.getElementById(
                'cam-stats-overlay'
            ).textContent =
                [countText, jigText].filter(Boolean).join(' | ') ||
                'Aucun produit >= 40%';


            // Record results

            if (detections.length) {

                recordDetections(
                    data.counts,
                    detections
                );

            }


            // Scan ID

            document.getElementById(
                'info-scan-id'
            ).textContent =

                detections.length
                    ? `#VAL-${String(scanCounter).padStart(4, '0')}`
                    : '-';


            // Quantity

            const capturedQuantity =
                getCapturedQuantityFromCountMap(
                    data.counts || {}
                );

            document.getElementById(
                'info-qty'
            ).textContent =
                capturedQuantity
                    ? `${capturedQuantity} pièce(s)`
                    : '0 pièce';


            // Captured quantity in the photo

            document.getElementById(
                'info-rate'
            ).textContent =
                capturedQuantity
                    ? `${capturedQuantity}`
                    : '-';


            // Status

            document.getElementById(
                'info-status'
            ).innerHTML =

                detections.length

                    ? '<span class="badge badge-green">DÉTECTÉ</span>'

                    : '<span class="badge badge-amber">AUCUN PRODUIT</span>';


        } catch (error) {

            console.error(
                'Erreur détection:',
                error
            );


            document.getElementById(
                'cam-stats-overlay'
            ).textContent =
                `ERREUR IA: ${error.message}`;


            document.getElementById(
                'info-status'
            ).innerHTML =
                '<span class="badge badge-red">ERREUR</span>';


        } finally {

            // Keep the captured image and analysis visible for a moment before
            // automatically reactivating the camera for the next detection.
            await new Promise(resolve => setTimeout(resolve, 5000));
            await resumeCameraPreview();

            detectionInProgress = false;


            // Restore button

            button.disabled = false;

            button.innerHTML =
                '<i class="fa-solid fa-radar"></i> Déclencher la détection';

        }

    }


    // ============================================================
    // CHART UPDATE
    // ============================================================

    function updateChart() {

        if (!chartInstance) {
            return;
        }


        const recent =
            [...readings]
                .slice(0, 15)
                .reverse();


        chartInstance.data.labels =
            recent.map(
                r => r.heure
            );


        chartInstance.data.datasets[0].data =
            recent.map(
                r => r.quantite
            );


        chartInstance.update();

    }


    // ============================================================
    // TRP
    // ============================================================

    function computeLocalTRP() {

        const productRates = {};


        readings.forEach(r => {

            const rate =
                parseFloat(
                    r.taux.replace('%', '')
                );


            if (!productRates[r.produit]) {

                productRates[r.produit] = [];

            }


            if (!isNaN(rate)) {

                productRates[r.produit].push(
                    rate
                );

            }

        });


        const result = {};


        for (
            const [prod, rates]
            of Object.entries(productRates)
        ) {

            result[prod] =
                rates.length

                    ? parseFloat(
                        (
                            rates.reduce(
                                (a, b) =>
                                    a + b,
                                0
                            )
                            /
                            rates.length
                        ).toFixed(1)
                    )

                    : 0;

        }


        return result;

    }


    // ============================================================
    // TABLE
    // ============================================================

    function insertRow(
        r,
        isNew = false
    ) {

        const tbody =
            document.getElementById(
                'readings-table-body'
            );


        const tr =
            document.createElement('tr');


        if (isNew) {
            tr.className = 'tr-new';
        }


        const rateVal =
            parseFloat(
                r.taux.replace('%', '')
            );


        let badgeClass =
            'badge-lime';


        if (rateVal >= 100) {

            badgeClass =
                'badge-green';

        } else if (rateVal > 0) {

            badgeClass =
                'badge-amber';

        }


        const localTRP =
            computeLocalTRP();


        const trpVal =
            r.trp ||

            (
                localTRP[r.produit] !== undefined
                    ? `${localTRP[r.produit]}%`
                    : '-'
            );


        const fillClass =
            rateVal >= 100
                ? 'green'
                : rateVal > 50
                    ? 'amber'
                    : 'lime';


        tr.innerHTML = `

            <td>
                <strong>#${r.id}</strong>
            </td>

            <td>
                ${r.date} ${r.heure}
            </td>

            <td>

                <span
                    class="badge badge-lime"
                    style="
                        max-width:160px;
                        white-space:nowrap;
                        overflow:hidden;
                        text-overflow:ellipsis;
                    "
                    title="${r.produit}"
                >
                    ${r.produit}
                </span>

            </td>

            <td>

                ${r.quantite}

                <small style="color:var(--muted)">
                    (Total: ${r.quantite_totale})
                </small>

            </td>

            <td>

                <div class="progress-bar-container">

                    <div
                        class="progress-bar-fill ${fillClass}"
                        style="width:${Math.min(rateVal,100)}%"
                    ></div>

                </div>

                <span class="badge ${badgeClass}">
                    ${r.taux}
                </span>

            </td>

            <td>

                <span class="trp-badge">
                    ${trpVal}
                </span>

            </td>

        `;


        if (tbody.children.length === 0) {

            tbody.appendChild(tr);

        } else {

            tbody.insertBefore(
                tr,
                tbody.firstChild
            );

        }


        if (tbody.children.length > 50) {

            tbody.removeChild(
                tbody.lastChild
            );

        }

    }


    function rebuildTableTRP() {

        const localTRP =
            computeLocalTRP();


        const tbody =
            document.getElementById(
                'readings-table-body'
            );


        const rows =
            tbody.querySelectorAll('tr');


        rows.forEach(
            (tr, idx) => {

                const trpCell =
                    tr.querySelector(
                        '.trp-badge'
                    );


                if (
                    trpCell &&
                    readings[idx]
                ) {

                    const prod =
                        readings[idx].produit;


                    trpCell.textContent =
                        localTRP[prod] !== undefined
                            ? `${localTRP[prod]}%`
                            : '-';

                }

            }
        );


        trpMap =
            localTRP;

    }


    // ============================================================
    // CAMERA
    // ============================================================

    async function refreshCameraDevices() {

        const select = document.getElementById('camera-device-select');
        if (!select || !navigator.mediaDevices?.enumerateDevices) return;

        const currentValue = selectedCameraId || select.value;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');

        select.innerHTML = '<option value="">Caméra par défaut</option>';
        cameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = camera.deviceId;
            option.textContent = camera.label || `Caméra ${index + 1}`;
            select.appendChild(option);
        });

        if (currentValue && cameras.some(camera => camera.deviceId === currentValue)) {
            select.value = currentValue;
        }

    }

    async function changeCameraDevice() {

        selectedCameraId = document.getElementById('camera-device-select').value;

        if (cameraActive) {
            await toggleCamera(false);
            await toggleCamera(true);
        }

    }

    async function toggleCamera(state) {

        const video =
            document.getElementById(
                'camera-video'
            );


        if (
            state &&
            !mediaStream
        ) {

            try {

                const selectedDeviceId = document.getElementById('camera-device-select').value;
                selectedCameraId = selectedDeviceId;

                mediaStream =
                    await navigator.mediaDevices.getUserMedia({

                        video: {
                            ...(selectedDeviceId ? {
                                deviceId: { exact: selectedDeviceId }
                            } : {}),
                            width: {
                                ideal: 1280
                            },

                            height: {
                                ideal: 720
                            }

                        },

                        audio: false

                    });


                video.srcObject =
                    mediaStream;


                video.style.display =
                    'block';

                // Device names are available after the browser has camera permission.
                await refreshCameraDevices();


            } catch (error) {

                alert(
                    'Impossible d’accéder à la caméra. Autorisez son utilisation puis réessayez.'
                );

                console.error(error);

                return;

            }

        }


        if (
            !state &&
            mediaStream
        ) {

            mediaStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );


            mediaStream = null;

            video.srcObject = null;

            video.style.display =
                'none';

        }

        if (
            state &&
            mediaStream
        ) {

            await video.play();

            document.getElementById('cam-rec-indicator').innerHTML =
                '<i class="fa-solid fa-circle" style="color: var(--accent-red); font-size: 8px;"></i> LIVE';

        }


        updateCameraStatus(
            state
        );


        if (!state) {

            document.getElementById(
                'detection-overlay'
            ).innerHTML = '';


            document.getElementById(
                'cam-stats-overlay'
            ).textContent =
                'NO SIGNAL';


            document.getElementById(
                'info-scan-id'
            ).textContent =
                '-';


            document.getElementById(
                'info-qty'
            ).textContent =
                '-';


            document.getElementById(
                'info-rate'
            ).textContent =
                '-';


            document.getElementById(
                'info-trp'
            ).textContent =
                '-';


            document.getElementById(
                'info-status'
            ).textContent =
                '-';

        }

    }

