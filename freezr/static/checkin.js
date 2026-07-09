document.addEventListener('DOMContentLoaded', function() {
    // --- Element references ---
    const checkinBtn  = document.getElementById('btn-checkin');
    const checkinModal = document.getElementById('checkin-modal');
    const closeBtn    = document.getElementById('btn-close-modal');
    const cancelBtn   = document.getElementById('btn-cancel-modal');
    const checkinForm = checkinModal ? checkinModal.querySelector('form') : null;

    const catSelect      = document.getElementById('category');
    const subcatSelect   = document.getElementById('subcat');
    const subsubSelect   = document.getElementById('subsub');
    const subcatContainer = document.getElementById('subcat-container');
    const subsubContainer = document.getElementById('subsub-container');

    const qtyNumber = document.getElementById('qty-number');
    const qtyUnit   = document.getElementById('qty-unit');
    const qtyHidden = document.getElementById('qty-hidden');

    const freezerSelect = document.getElementById('freezer');
    const drawerSelect  = document.getElementById('drawer');

    // Prep checkbox labels (all start hidden in HTML)
    const PREP_NAMES = ['skin', 'bone', 'minced', 'grated', 'cooked'];

    // --- Data ---
    const subcats    = window.freezrData ? window.freezrData.subcats    : [];
    const subsubs    = window.freezrData ? window.freezrData.subsubs    : [];
    const categories = window.freezrData ? window.freezrData.categories : [];

    // Build catRules dynamically from category names so they survive ID changes
    const CAT_RULES_BY_NAME = {
        'meat':           ['skin', 'bone', 'minced', 'cooked'],
        'fish':           ['cooked'],
        'fish & seafood': ['cooked'],
        'dairy':          ['grated'],
        'vegetables':     ['cooked'],
    };
    const catRules = {};
    categories.forEach(cat => {
        const name = (cat.category || '').toLowerCase().trim();
        catRules[cat.id] = CAT_RULES_BY_NAME[name] || [];
    });

    // --- Quantity ---
    let currentQtyType = 'count';
    const WEIGHT_UNITS = [['g','g'],['kg','kg']];
    const VOLUME_UNITS = [['ml','ml'],['L','L']];

    function setUnitOptions(pairs) {
        qtyUnit.innerHTML = pairs.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    }

    function updateQtyHidden() {
        if (!qtyHidden) return;
        const raw  = qtyNumber ? qtyNumber.value.trim() : '';
        const num  = raw || (qtyNumber ? qtyNumber.placeholder || '1' : '1');
        const unit = (qtyUnit && qtyUnit.style.display !== 'none') ? qtyUnit.value : '';
        qtyHidden.value = num + unit;
    }

    function applyQtyType(qtyType) {
        if (!qtyNumber || !qtyUnit || !qtyHidden) return;
        if (qtyType !== currentQtyType) qtyNumber.value = '';
        currentQtyType = qtyType;
        if (qtyType === 'weight') {
            qtyNumber.placeholder = '500';
            setUnitOptions(WEIGHT_UNITS);
            qtyUnit.style.display = '';
        } else if (qtyType === 'volume') {
            qtyNumber.placeholder = '500';
            setUnitOptions(VOLUME_UNITS);
            qtyUnit.style.display = '';
        } else {
            qtyNumber.placeholder = '1';
            qtyUnit.style.display = 'none';
        }
        updateQtyHidden();
    }

    function hideAllPrepLabels() {
        PREP_NAMES.forEach(name => {
            const lbl = document.getElementById('lbl-' + name);
            if (!lbl) return;
            lbl.style.display = 'none';
            const cb = lbl.querySelector('input[type="checkbox"]');
            if (cb) cb.checked = false;
        });
    }

    function resetCheckinForm() {
        if (checkinForm) checkinForm.reset();
        if (subcatContainer) subcatContainer.style.display = 'none';
        if (subsubContainer) subsubContainer.style.display = 'none';
        if (drawerSelect) drawerSelect.innerHTML = '<option value="">-- Select Drawer --</option>';
        hideAllPrepLabels();
        currentQtyType = 'count';
        applyQtyType('count');
    }

    // --- Modal open/close ---
    if (checkinBtn && checkinModal) {
        checkinBtn.addEventListener('click', () => {
            resetCheckinForm();
            checkinModal.showModal();
        });
    }
    if (closeBtn)  closeBtn.addEventListener('click',  (e) => { e.preventDefault(); checkinModal.close(); });
    if (cancelBtn) cancelBtn.addEventListener('click', (e) => { e.preventDefault(); checkinModal.close(); });

    // --- Qty listeners ---
    if (qtyNumber) qtyNumber.addEventListener('input',  updateQtyHidden);
    if (qtyUnit)   qtyUnit.addEventListener('change', updateQtyHidden);

    // --- Category cascade ---
    if (catSelect) {
        catSelect.addEventListener('change', function() {
            const catId = this.value;
            hideAllPrepLabels();

            if (catRules[catId]) {
                catRules[catId].forEach(rule => {
                    const lbl = document.getElementById('lbl-' + rule);
                    if (lbl) lbl.style.display = 'inline-block';
                });
            }

            subcatSelect.innerHTML = '<option value="">-- Select Sub-Category --</option>';
            const filteredSubcats = subcats.filter(sc => sc.category_id == catId);
            if (filteredSubcats.length > 0) {
                filteredSubcats.forEach(sc => {
                    const opt = document.createElement('option');
                    opt.value = sc.id;
                    opt.textContent = sc.subcat.charAt(0).toUpperCase() + sc.subcat.slice(1);
                    subcatSelect.appendChild(opt);
                });
                if (subcatContainer) subcatContainer.style.display = 'block';
            } else {
                if (subcatContainer) subcatContainer.style.display = 'none';
            }

            if (subsubContainer) subsubContainer.style.display = 'none';
            applyQtyType('count');
        });
    }

    // --- Sub-category cascade ---
    if (subcatSelect) {
        subcatSelect.addEventListener('change', function() {
            const subcatId = this.value;
            subsubSelect.innerHTML = '<option value="">-- Select Type --</option>';
            const filteredSubsubs = subsubs.filter(ss => ss.subcat_id == subcatId);
            if (filteredSubsubs.length > 0) {
                filteredSubsubs.forEach(ss => {
                    const opt = document.createElement('option');
                    opt.value = ss.id;
                    opt.textContent = ss.subsub;
                    subsubSelect.appendChild(opt);
                });
                if (subsubContainer) subsubContainer.style.display = 'block';
            } else {
                if (subsubContainer) subsubContainer.style.display = 'none';
            }
            const selectedSubcat = subcats.find(sc => sc.id == subcatId);
            applyQtyType(selectedSubcat ? (selectedSubcat.quantity_type || 'count') : 'count');
        });
    }

    // --- Freezer → drawer cascade ---
    if (freezerSelect) {
        freezerSelect.addEventListener('change', function() {
            drawerSelect.innerHTML = '<option value="">-- Select Drawer --</option>';
            const selectedOption = this.options[this.selectedIndex];
            const drawers = parseInt(selectedOption.getAttribute('data-drawers')) || 0;
            for (let i = 1; i <= drawers; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i;
                drawerSelect.appendChild(opt);
            }
        });
    }

    // --- Form submission ---
    if (checkinForm) {
        checkinForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            updateQtyHidden();

            let itemDescription = 'UNKNOWN ITEM';
            if (subcatSelect && subcatSelect.value) {
                itemDescription = subcatSelect.options[subcatSelect.selectedIndex].text;
                if (subsubSelect && subsubSelect.value) {
                    itemDescription += ' ' + subsubSelect.options[subsubSelect.selectedIndex].text;
                }
            }
            const qty = qtyHidden ? qtyHidden.value.trim() : '1';
            const qtyPrefix = /^\d+$/.test(qty) ? qty + 'x' : qty;
            itemDescription = qtyPrefix + ' ' + itemDescription;

            const formData = new FormData(checkinForm);
            try {
                const response = await fetch(checkinForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });
                const result = await response.json();
                if (result.success) {
                    if (formData.get('print_label') && typeof window.triggerPrint === 'function') {
                        await window.triggerPrint(result.entry_id, itemDescription);
                    }
                    window.location.reload();
                } else {
                    alert('Error saving item: ' + (result.message || 'Unknown error'));
                }
            } catch (err) {
                console.error('Submission failed:', err);
                alert('A server error occurred while saving.');
            }
        });
    }
});
