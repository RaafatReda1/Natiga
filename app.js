/**
 * Student Results Explorer - Application Logic
 * High-performance search, filtering, sorting, pagination & stats engine for 900,000+ records.
 */

(function () {
    'use strict';

    // Application State
    const state = {
        allData: [],
        filteredData: [],
        currentPage: 1,
        pageSize: 25,
        sortColumn: 'seating_no',
        sortDirection: 'asc',
        searchQuery: '',
        searchNormalized: '',
        caseFilter: 'ALL',
        minDegree: null,
        maxDegree: null,
        preset: 'all',
        stats: {
            total: 0,
            passed: 0,
            second: 0,
            failed: 0,
            avgDegree: 0,
            maxDegree: 0
        }
    };

    // DOM Element References
    const elements = {
        loaderBanner: document.getElementById('loader-banner'),
        loaderDetails: document.getElementById('loader-details'),
        progressBarFill: document.getElementById('progress-bar-fill'),
        dataStatusBadge: document.getElementById('data-status-badge'),
        dataStatusText: document.getElementById('data-status-text'),
        jsonFileInput: document.getElementById('json-file-input'),
        themeToggleBtn: document.getElementById('theme-toggle-btn'),

        // Stats Elements
        statTotal: document.getElementById('stat-total-students'),
        statPassed: document.getElementById('stat-passed-count'),
        statPassedPct: document.getElementById('stat-passed-percent'),
        statSecond: document.getElementById('stat-second-round'),
        statSecondPct: document.getElementById('stat-second-percent'),
        statFailed: document.getElementById('stat-failed-count'),
        statFailedPct: document.getElementById('stat-failed-percent'),
        statAvgDegree: document.getElementById('stat-avg-degree'),

        // Form & Filter Controls
        globalSearchInput: document.getElementById('global-search-input'),
        clearSearchBtn: document.getElementById('clear-search-btn'),
        filterCase: document.getElementById('filter-case'),
        filterMinDegree: document.getElementById('filter-min-degree'),
        filterMaxDegree: document.getElementById('filter-max-degree'),
        filterSortCol: document.getElementById('filter-sort-col'),
        toggleSortDirBtn: document.getElementById('toggle-sort-dir-btn'),
        sortDirIcon: document.getElementById('sort-dir-icon'),
        resetFiltersBtn: document.getElementById('reset-filters-btn'),
        presetButtons: document.querySelectorAll('.preset-btn'),

        // Summary & Actions
        matchingCount: document.getElementById('matching-records-count'),
        totalRecordsCount: document.getElementById('total-records-count'),

        // Table
        tableBody: document.getElementById('table-body'),
        resultsTable: document.getElementById('results-table'),
        tableHeaders: document.querySelectorAll('.data-table th.sortable'),
        emptyState: document.getElementById('empty-state'),

        // Pagination
        pageSizeSelect: document.getElementById('page-size-select'),
        firstPageBtn: document.getElementById('first-page-btn'),
        prevPageBtn: document.getElementById('prev-page-btn'),
        nextPageBtn: document.getElementById('next-page-btn'),
        lastPageBtn: document.getElementById('last-page-btn'),
        currentPageInput: document.getElementById('current-page-input'),
        totalPagesSpan: document.getElementById('total-pages-span'),

        // Certificate Modal
        studentModal: document.getElementById('student-modal'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        closeModalSecondaryBtn: document.getElementById('close-modal-secondary-btn'),
        printCertBtn: document.getElementById('print-cert-btn'),
        modalStudentName: document.getElementById('modal-student-name'),
        modalSeatingNo: document.getElementById('modal-seating-no'),
        modalTotalDegree: document.getElementById('modal-total-degree'),
        modalPercentage: document.getElementById('modal-percentage'),
        modalStudentCase: document.getElementById('modal-student-case')
    };

    // Arabic Normalization Helper
    function normalizeArabic(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/[\u064B-\u0652]/g, '')
            .toLowerCase();
    }

    // Format Numbers (e.g., 919396 -> 919,396)
    function formatNum(num) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        return Number(num).toLocaleString('ar-EG');
    }

    // Initialize App
    function init() {
        bindEvents();
        setupTheme();
        loadInitialData();
    }

    // Setup Event Listeners
    function bindEvents() {
        // Theme Toggle
        elements.themeToggleBtn.addEventListener('click', toggleTheme);

        // Custom File Import
        elements.jsonFileInput.addEventListener('change', handleCustomFileLoad);

        // Global Search Input with Debounce
        let searchTimeout;
        elements.globalSearchInput.addEventListener('input', (e) => {
            const val = e.target.value;
            elements.clearSearchBtn.style.display = val.length > 0 ? 'block' : 'none';
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                state.searchQuery = val.trim();
                state.searchNormalized = normalizeArabic(state.searchQuery);
                state.currentPage = 1;
                applyFiltersAndRender();
            }, 180);
        });

        // Clear Search Button
        elements.clearSearchBtn.addEventListener('click', () => {
            elements.globalSearchInput.value = '';
            elements.clearSearchBtn.style.display = 'none';
            state.searchQuery = '';
            state.searchNormalized = '';
            state.currentPage = 1;
            applyFiltersAndRender();
        });

        // Case Filter Dropdown
        elements.filterCase.addEventListener('change', (e) => {
            state.caseFilter = e.target.value;
            state.currentPage = 1;
            applyFiltersAndRender();
        });

        // Min / Max Degree Filter
        elements.filterMinDegree.addEventListener('input', (e) => {
            state.minDegree = e.target.value !== '' ? parseFloat(e.target.value) : null;
            state.currentPage = 1;
            applyFiltersAndRender();
        });

        elements.filterMaxDegree.addEventListener('input', (e) => {
            state.maxDegree = e.target.value !== '' ? parseFloat(e.target.value) : null;
            state.currentPage = 1;
            applyFiltersAndRender();
        });

        // Mobile & Desktop Sort Controls
        if (elements.filterSortCol) {
            elements.filterSortCol.addEventListener('change', (e) => {
                state.sortColumn = e.target.value;
                updateSortHeaderIcons();
                applyFiltersAndRender();
            });
        }

        if (elements.toggleSortDirBtn) {
            elements.toggleSortDirBtn.addEventListener('click', () => {
                state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
                updateSortHeaderIcons();
                applyFiltersAndRender();
            });
        }

        // Reset Filters Button
        elements.resetFiltersBtn.addEventListener('click', resetAllFilters);

        // Quick Preset Buttons
        elements.presetButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                elements.presetButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.preset = btn.dataset.preset;
                applyPresetFilter(state.preset);
            });
        });

        // Table Header Sorting
        elements.tableHeaders.forEach((th) => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (state.sortColumn === col) {
                    state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sortColumn = col;
                    state.sortDirection = 'asc';
                }
                updateSortHeaderIcons();
                applyFiltersAndRender();
            });
        });

        // Pagination Events
        elements.pageSizeSelect.addEventListener('change', (e) => {
            state.pageSize = parseInt(e.target.value, 10);
            state.currentPage = 1;
            renderTablePage();
        });

        elements.firstPageBtn.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage = 1;
                renderTablePage();
            }
        });

        elements.prevPageBtn.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                renderTablePage();
            }
        });

        elements.nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(state.filteredData.length / state.pageSize) || 1;
            if (state.currentPage < totalPages) {
                state.currentPage++;
                renderTablePage();
            }
        });

        elements.lastPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(state.filteredData.length / state.pageSize) || 1;
            if (state.currentPage < totalPages) {
                state.currentPage = totalPages;
                renderTablePage();
            }
        });

        elements.currentPageInput.addEventListener('change', (e) => {
            const totalPages = Math.ceil(state.filteredData.length / state.pageSize) || 1;
            let val = parseInt(e.target.value, 10);
            if (isNaN(val) || val < 1) val = 1;
            if (val > totalPages) val = totalPages;
            state.currentPage = val;
            renderTablePage();
        });

        // Modal Controls
        elements.closeModalBtn.addEventListener('click', closeModal);
        elements.closeModalSecondaryBtn.addEventListener('click', closeModal);
        elements.printCertBtn.addEventListener('click', () => window.print());
        elements.studentModal.addEventListener('click', (e) => {
            if (e.target === elements.studentModal) closeModal();
        });
    }

    // Theme Management
    function setupTheme() {
        const savedTheme = localStorage.getItem('app-theme') || 'dark';
        if (savedTheme === 'light') {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            elements.themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
    }

    function toggleTheme() {
        if (document.body.classList.contains('light-theme')) {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            elements.themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
            localStorage.setItem('app-theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            elements.themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
            localStorage.setItem('app-theme', 'light');
        }
    }

    // Load Initial JSON File (output.json.gz)
    async function loadInitialData() {
        try {
            updateLoaderProgress(15, 'تنزيل ملف البيانات المضغوط...');
            const response = await fetch('output.json.gz');
            if (!response.ok) throw new Error('تعذر تحميل ملف output.json.gz');

            updateLoaderProgress(45, 'فك الضغط عن البيانات في الذاكرة...');
            const ds = new DecompressionStream('gzip');
            const decompressedStream = response.body.pipeThrough(ds);
            const decompressedResponse = new Response(decompressedStream);
            const data = await decompressedResponse.json();

            updateLoaderProgress(85, 'بناء محرك البحث وتجهيز الإحصائيات...');
            processRawData(data);

            updateLoaderProgress(100, 'اكتمل التحميل بنجاح!');
            setTimeout(() => {
                elements.loaderBanner.classList.add('hidden');
                elements.dataStatusBadge.className = 'status-pill success';
                elements.dataStatusText.textContent = `جاهز (${formatNum(state.allData.length)} طالب)`;
            }, 300);

        } catch (err) {
            console.error(err);
            elements.loaderDetails.textContent = `تنبيه: ${err.message}. يرجى اختيار ملف .gz يدويًا.`;
            elements.progressBarFill.style.backgroundColor = '#ef4444';
            elements.dataStatusBadge.className = 'status-pill loading';
            elements.dataStatusText.textContent = 'بانتظار تحميل الملف...';
        }
    }

    // Handle Custom File Picker (.gz or .json)
    async function handleCustomFileLoad(e) {
        const file = e.target.files[0];
        if (!file) return;

        elements.loaderBanner.classList.remove('hidden');
        updateLoaderProgress(20, `قراءة الملف: ${file.name}...`);

        try {
            let data;
            if (file.name.endsWith('.gz')) {
                updateLoaderProgress(50, 'فك ضغط الملف في الذاكرة...');
                const arrayBuffer = await file.arrayBuffer();
                const ds = new DecompressionStream('gzip');
                const writer = ds.writable.getWriter();
                writer.write(arrayBuffer);
                writer.close();
                const decompressedResponse = new Response(ds.readable);
                data = await decompressedResponse.json();
            } else {
                updateLoaderProgress(50, 'قراءة ملف JSON...');
                const text = await file.text();
                data = JSON.parse(text);
            }

            updateLoaderProgress(85, 'بناء محرك البحث...');
            processRawData(data);

            updateLoaderProgress(100, 'تم التحميل بنجاح!');
            setTimeout(() => {
                elements.loaderBanner.classList.add('hidden');
                elements.dataStatusBadge.className = 'status-pill success';
                elements.dataStatusText.textContent = `جاهز (${formatNum(state.allData.length)} طالب)`;
            }, 300);
        } catch (err) {
            console.error(err);
            alert('عفوًا! حدث خطأ أثناء قراءة الملف.');
            elements.loaderBanner.classList.add('hidden');
        }
    }

    function updateLoaderProgress(pct, msg) {
        elements.progressBarFill.style.width = `${pct}%`;
        elements.loaderDetails.textContent = msg;
    }

    // Process & Compute Stats for Entire Dataset
    function processRawData(data) {
        let rawRecords = [];
        let casesList = [];

        if (Array.isArray(data)) {
            rawRecords = data;
        } else if (data && typeof data === 'object' && Array.isArray(data.records)) {
            rawRecords = data.records;
            casesList = data.cases || [];
        } else {
            console.error('Unrecognized data structure');
            return;
        }

        // Attach pre-calculated normalized name for instant Arabic search
        state.allData = rawRecords.map((item, idx) => {
            const isArr = Array.isArray(item);
            const seating_no = isArr ? item[0] : (item.seating_no || 0);
            const arabic_name = isArr ? item[1] : (item.arabic_name || '');
            const total_degree = isArr ? (item[2] ?? 0) : (item.total_degree ?? 0);
            
            let student_case_desc = 'غير محدد';
            if (isArr) {
                if (typeof item[3] === 'number' && casesList[item[3]] !== undefined) {
                    student_case_desc = casesList[item[3]];
                } else if (typeof item[3] === 'string') {
                    student_case_desc = item[3];
                }
            } else if (item.student_case_desc) {
                student_case_desc = item.student_case_desc;
            }

            return {
                id: idx + 1,
                seating_no: seating_no,
                arabic_name: arabic_name,
                arabic_name_norm: normalizeArabic(arabic_name),
                total_degree: parseFloat(total_degree),
                student_case_desc: String(student_case_desc).trim()
            };
        });

        // Extract Unique Cases for Filter Dropdown
        const caseSet = new Set();
        let total = state.allData.length;
        let passed = 0;
        let second = 0;
        let failed = 0;
        let degreeSum = 0;
        let maxDeg = 0;

        for (let i = 0; i < total; i++) {
            const item = state.allData[i];
            const cCase = item.student_case_desc;
            caseSet.add(cCase);

            degreeSum += item.total_degree;
            if (item.total_degree > maxDeg) maxDeg = item.total_degree;

            if (cCase.includes('ناجح')) {
                passed++;
            } else if (cCase.includes('ثان')) {
                second++;
            } else {
                failed++;
            }
        }

        // Populate Dropdown Options
        elements.filterCase.innerHTML = '<option value="ALL">جميع الحالات</option>';
        caseSet.forEach((c) => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            elements.filterCase.appendChild(opt);
        });

        // Compute Stats
        state.stats.total = total;
        state.stats.passed = passed;
        state.stats.second = second;
        state.stats.failed = failed;
        state.stats.avgDegree = total > 0 ? (degreeSum / total).toFixed(1) : 0;
        state.stats.maxDegree = maxDeg;

        // Render Dashboard Stats
        elements.statTotal.textContent = formatNum(total);
        elements.statPassed.textContent = formatNum(passed);
        elements.statPassedPct.textContent = total > 0 ? `${((passed / total) * 100).toFixed(1)}%` : '0%';
        elements.statSecond.textContent = formatNum(second);
        elements.statSecondPct.textContent = total > 0 ? `${((second / total) * 100).toFixed(1)}%` : '0%';
        elements.statFailed.textContent = formatNum(failed);
        elements.statFailedPct.textContent = total > 0 ? `${((failed / total) * 100).toFixed(1)}%` : '0%';
        elements.statAvgDegree.textContent = state.stats.avgDegree;
        elements.totalRecordsCount.textContent = formatNum(total);

        // Run Initial Filter
        applyFiltersAndRender();
    }

    // Preset Filter Rules
    function applyPresetFilter(preset) {
        resetAllFilters(false); // don't re-render yet
        if (preset === 'top100') {
            state.sortColumn = 'total_degree';
            state.sortDirection = 'desc';
            updateSortHeaderIcons();
        } else if (preset === 'passed') {
            state.caseFilter = 'ناجح دور أول';
            elements.filterCase.value = 'ناجح دور أول';
        } else if (preset === 'second') {
            state.caseFilter = 'دور ثان';
            elements.filterCase.value = 'دور ثان';
        } else if (preset === 'failed') {
            state.caseFilter = 'راسب دور أول';
            elements.filterCase.value = 'راسب دور أول';
        }
        state.currentPage = 1;
        applyFiltersAndRender();
    }

    // Reset All Filters
    function resetAllFilters(shouldRender = true) {
        state.searchQuery = '';
        state.searchNormalized = '';
        state.caseFilter = 'ALL';
        state.minDegree = null;
        state.maxDegree = null;
        state.preset = 'all';

        elements.globalSearchInput.value = '';
        elements.clearSearchBtn.style.display = 'none';
        elements.filterCase.value = 'ALL';
        elements.filterMinDegree.value = '';
        elements.filterMaxDegree.value = '';
        elements.presetButtons.forEach(b => b.classList.remove('active'));
        elements.presetButtons[0].classList.add('active');

        if (shouldRender) {
            state.currentPage = 1;
            applyFiltersAndRender();
        }
    }

    // Apply Active Filters & Sorting Engine
    function applyFiltersAndRender() {
        const queryNorm = state.searchNormalized;
        const queryRaw = state.searchQuery;
        const cFilter = state.caseFilter;
        const minDeg = state.minDegree;
        const maxDeg = state.maxDegree;
        const isNumericQuery = /^\d+$/.test(queryRaw);

        // Filter Loop
        let result = state.allData.filter((item) => {
            // 1. Text / Seating Search
            if (queryRaw.length > 0) {
                if (isNumericQuery) {
                    if (!String(item.seating_no).includes(queryRaw)) return false;
                } else {
                    if (!item.arabic_name_norm.includes(queryNorm)) return false;
                }
            }

            // 2. Case Filter
            if (cFilter !== 'ALL' && item.student_case_desc !== cFilter) {
                return false;
            }

            // 3. Min Degree Filter
            if (minDeg !== null && item.total_degree < minDeg) {
                return false;
            }

            // 4. Max Degree Filter
            if (maxDeg !== null && item.total_degree > maxDeg) {
                return false;
            }

            return true;
        });

        // Sorting Engine
        const col = state.sortColumn;
        const dir = state.sortDirection === 'asc' ? 1 : -1;

        result.sort((a, b) => {
            let valA = a[col];
            let valB = b[col];

            if (typeof valA === 'string') {
                return valA.localeCompare(valB, 'ar') * dir;
            }
            return (valA - valB) * dir;
        });

        // Top 100 Preset Restriction
        if (state.preset === 'top100') {
            result = result.slice(0, 100);
        }

        state.filteredData = result;
        elements.matchingCount.textContent = formatNum(result.length);

        renderTablePage();
    }

    // Update Th Icon Headers & Sort Controls
    function updateSortHeaderIcons() {
        elements.tableHeaders.forEach((th) => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.sort === state.sortColumn) {
                th.classList.add(state.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
            }
        });

        if (elements.filterSortCol) {
            elements.filterSortCol.value = state.sortColumn;
        }

        if (elements.sortDirIcon) {
            if (state.sortDirection === 'asc') {
                elements.sortDirIcon.className = 'fa-solid fa-arrow-up-1-9';
            } else {
                elements.sortDirIcon.className = 'fa-solid fa-arrow-down-9-1';
            }
        }
    }

    // Render Table Page Chunk
    function renderTablePage() {
        const total = state.filteredData.length;
        const totalPages = Math.ceil(total / state.pageSize) || 1;

        if (state.currentPage > totalPages) state.currentPage = totalPages;

        elements.totalPagesSpan.textContent = formatNum(totalPages);
        elements.currentPageInput.value = state.currentPage;

        if (total === 0) {
            elements.tableBody.innerHTML = '';
            elements.emptyState.classList.remove('hidden');
            return;
        }

        elements.emptyState.classList.add('hidden');

        const startIndex = (state.currentPage - 1) * state.pageSize;
        const endIndex = Math.min(startIndex + state.pageSize, total);
        const pageItems = state.filteredData.slice(startIndex, endIndex);

        const fragment = document.createDocumentFragment();

        pageItems.forEach((item, index) => {
            const tr = document.createElement('tr');

            // Calculate Percentage (Assuming max 320)
            const percentage = ((item.total_degree / 320) * 100).toFixed(1);

            // Badge Class
            let badgeClass = 'passed';
            if (item.student_case_desc.includes('ثان')) badgeClass = 'second';
            else if (item.student_case_desc.includes('راسب')) badgeClass = 'failed';

            // Highlight Search Term
            const highlightedName = highlightMatch(item.arabic_name, state.searchQuery);
            const highlightedSeating = highlightMatch(String(item.seating_no), state.searchQuery);

            tr.innerHTML = `
                <td>${startIndex + index + 1}</td>
                <td><strong>${highlightedSeating}</strong></td>
                <td style="font-weight: 600;">${highlightedName}</td>
                <td style="font-weight: 700; color: var(--color-blue);">${item.total_degree}</td>
                <td><span style="font-size: 0.85rem; color: var(--text-secondary);">${percentage}%</span></td>
                <td><span class="status-badge ${badgeClass}">${item.student_case_desc}</span></td>
                <td style="text-align: center;">
                    <button class="btn btn-sm btn-outline view-btn" data-id="${item.id}" title="عرض نتيجة الطالب">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </td>
            `;

            fragment.appendChild(tr);
        });

        elements.tableBody.innerHTML = '';
        elements.tableBody.appendChild(fragment);

        // Bind View Buttons
        elements.tableBody.querySelectorAll('.view-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id, 10);
                const student = state.allData.find(s => s.id === id);
                if (student) openStudentModal(student);
            });
        });
    }

    // Search Highlight Helper
    function highlightMatch(text, query) {
        if (!query || query.length === 0) return text;
        const regex = new RegExp(`(${query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark class="highlight">$1</mark>');
    }

    // Open Student Certificate Modal
    function openStudentModal(student) {
        elements.modalStudentName.textContent = student.arabic_name;
        elements.modalSeatingNo.textContent = student.seating_no;
        elements.modalTotalDegree.textContent = `${student.total_degree} / 320`;

        const pct = ((student.total_degree / 320) * 100).toFixed(2);
        elements.modalPercentage.textContent = `${pct}%`;

        let badgeClass = 'passed';
        if (student.student_case_desc.includes('ثان')) badgeClass = 'second';
        else if (student.student_case_desc.includes('راسب')) badgeClass = 'failed';

        elements.modalStudentCase.className = `status-badge ${badgeClass}`;
        elements.modalStudentCase.textContent = student.student_case_desc;

        elements.studentModal.classList.remove('hidden');
    }

    function closeModal() {
        elements.studentModal.classList.add('hidden');
    }

    // Export to CSV
    function exportToCsv() {
        if (state.filteredData.length === 0) {
            alert('لا توجد بيانات مطابقة للتصدير.');
            return;
        }

        const headers = ['رقم الجلوس', 'اسم الطالب', 'المجموع الكلي', 'حالة الطالب'];
        const rows = state.filteredData.map(item => [
            item.seating_no,
            `"${item.arabic_name.replace(/"/g, '""')}"`,
            item.total_degree,
            `"${item.student_case_desc}"`
        ]);

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `نتائج_الطلاب_تصدير_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Export to JSON
    function exportToJson() {
        if (state.filteredData.length === 0) {
            alert('لا توجد بيانات مطابقة للتصدير.');
            return;
        }

        const exportData = state.filteredData.map(item => ({
            seating_no: item.seating_no,
            arabic_name: item.arabic_name,
            total_degree: item.total_degree,
            student_case_desc: item.student_case_desc
        }));

        const jsonStr = JSON.stringify(exportData, null, 4);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `نتائج_الطلاب_تصدير_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Start App
    document.addEventListener('DOMContentLoaded', init);

})();
