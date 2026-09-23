// Multi-step check-in wizard: the primary check-in flow.
// Opened from the "+ CHECK IN" button (#btn-checkin) and from scanner recovery.
//
// Steps: 1 Item  ->  2 Quantity  ->  3 Location  ->  4 Finish
document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('checkin-wizard-modal');
    if (!modal) return;

    const openBtn = document.getElementById('btn-checkin');
    const form    = document.getElementById('wiz-form');

    // --- Data (copied so inline-adds appear immediately without a reload) ---
    const data       = window.freezrData || {};
    const categories = (data.categories || []).slice();
    let   subcats    = (data.subcats    || []).slice();
    let   subsubs    = (data.subsubs    || []).slice();

    // Which prep flags apply per category name (survives ID changes)
    const CAT_RULES_BY_NAME = {
        'meat':           ['skin', 'bone', 'minced', 'cooked'],
        'fish':           ['cooked'],
        'fish & seafood': ['cooked'],
        'dairy':          ['grated'],
        'vegetables':     ['cooked'],
    };
    const catRules = {};
    categories.forEach(cat => {
        catRules[cat.id] = CAT_RULES_BY_NAME[(cat.category || '').toLowerCase().trim()] || [];
    });

    const WEIGHT_UNITS = ['g', 'kg'];
    const VOLUME_UNITS = ['ml', 'L'];
    const PREP_NAMES   = ['skin', 'bone', 'minced', 'grated', 'cooked'];

    // --- Element refs ---
    const stepper   = document.getElementById('wiz-stepper');
    const steps     = Array.from(modal.querySelectorAll('.wiz-step'));
    const backBtn   = document.getElementById('wiz-back');
    const nextBtn   = document.getElementById('wiz-next');
    const finishBtn = document.getElementById('wiz-finish');
    const cancelBtn = document.getElementById('wiz-cancel');
    const closeBtn  = document.getElementById('btn-wiz-close');

    // Step 1 — item
    const catSelect    = document.getElementById('wiz-cat-select');
    const subcatBlock  = document.getElementById('wiz-subcat-block');
    const subcatSelect = document.getElementById('wiz-subcat-select');
    const subsubBlock  = document.getElementById('wiz-subsub-block');
    const subsubSelect = document.getElementById('wiz-subsub-select');
    const prepBlock    = document.getElementById('wiz-prep-block');

    const addSubcatToggle = document.getElementById('wiz-add-subcat-toggle');
    const addSubcatForm   = document.getElementById('wiz-add-subcat-form');
    const newSubcatName   = document.getElementById('wiz-new-subcat-name');
    const newSubcatQty    = document.getElementById('wiz-new-subcat-qty');
    const addSubcatSave   = document.getElementById('wiz-add-subcat-save');
    const addSubcatCancel = document.getElementById('wiz-add-subcat-cancel');

    const addSubsubToggle = document.getElementById('wiz-add-subsub-toggle');
    const addSubsubForm   = document.getElementById('wiz-add-subsub-form');
    const newSubsubName   = document.getElementById('wiz-new-subsub-name');
    const addSubsubSave   = document.getElementById('wiz-add-subsub-save');
    const addSubsubCancel = document.getElementById('wiz-add-subsub-cancel');

    // Step 2 — quantity
    const qtyToggle = document.getElementById('wiz-qty-type-toggle');
    const qtyOpts   = Array.from(qtyToggle.querySelectorAll('.wiz-qty-opt'));
    const qtyInput  = document.getElementById('wiz-qty-input');
    const unitSelect = document.getElementById('wiz-qty-unit-select');

    // Step 3 — location
    const freezerSelect = document.getElementById('wiz-freezer-select');
    const drawerSelect  = document.getElementById('wiz-drawer-select');

    // Step 4 — finish
    const summaryEl = document.getElementById('wiz-summary');
    const notesEl   = document.getElementById('wiz-notes');
    const dateEl    = document.getElementById('wiz-date');
    const printEl   = document.getElementById('wiz-print');

    // Hidden fields (the actual submitted values)
    const h = {
        category:      document.getElementById('wiz-category'),
        subcat:        document.getElementById('wiz-subcat'),
        subsub:        document.getElementById('wiz-subsub'),
        freezer:       document.getElementById('wiz-freezer'),
        drawer:        document.getElementById('wiz-drawer'),
        quantity:      document.getElementById('wiz-quantity'),
        quantityType:  document.getElementById('wiz-quantity-type'),
        quantityValue: document.getElementById('wiz-quantity-value'),
        quantityUnit:  document.getElementById('wiz-quantity-unit'),
        notes:         null, // notes/date submitted via named textarea/date below
    };
    const prepHidden = {};
    PREP_NAMES.forEach(n => { prepHidden[n] = document.getElementById('wiz-' + n); });

    let step = 1;
    let qtyType = 'count';

    // ---------------- Step navigation ----------------
    function showStep(n) {
        step = n;
        steps.forEach(s => { s.style.display = (parseInt(s.dataset.step, 10) === n) ? '' : 'none'; });
        stepper.querySelectorAll('.wiz-dot').forEach(d => {
            const ds = parseInt(d.dataset.step, 10);
            d.classList.toggle('active', ds === n);
            d.classList.toggle('done', ds < n);
        });
        backBtn.style.visibility = (n === 1) ? 'hidden' : 'visible';
        const last = (n === 4);
        nextBtn.style.display   = last ? 'none' : '';
        finishBtn.style.display = last ? '' : 'none';
        if (n === 4) buildSummary();
        updateNextEnabled();
    }

    function updateNextEnabled() {
        let ok = true;
        if (step === 1)      ok = !!h.subcat.value;
        else if (step === 2) ok = validQty();
        else if (step === 3) ok = !!h.drawer.value;
        nextBtn.disabled = !ok;
    }

    function validQty() {
        const v = parseFloat(qtyInput.value);
        return !isNaN(v) && v > 0;
    }

    backBtn.addEventListener('click', () => { if (step > 1) showStep(step - 1); });
    nextBtn.addEventListener('click', () => { if (!nextBtn.disabled && step < 4) showStep(step + 1); });

    // ---------------- Reset / open / close ----------------
    function reset() {
        form.reset();
        catSelect.value = '';
        subcatBlock.style.display = 'none';
        subsubBlock.style.display = 'none';
        addSubcatForm.style.display = 'none';
        addSubsubForm.style.display = 'none';
        Object.values(h).forEach(el => { if (el) el.value = ''; });
        h.quantity.value = '1';
        h.quantityType.value = 'count';
        PREP_NAMES.forEach(n => { prepHidden[n].value = ''; });
        hideAllPrepLabels();
        qtyInput.value = '';
        applyQtyType('count');
        showStep(1);
    }

    if (openBtn) openBtn.addEventListener('click', () => { reset(); modal.showModal(); });
    if (cancelBtn) cancelBtn.addEventListener('click', () => modal.close());
    if (closeBtn)  closeBtn.addEventListener('click',  () => modal.close());

    // ---------------- Step 1: category cascade ----------------
    function hideAllPrepLabels() {
        PREP_NAMES.forEach(name => {
            const lbl = document.getElementById('wiz-lbl-' + name);
            if (!lbl) return;
            lbl.style.display = 'none';
            const cb = lbl.querySelector('input[type="checkbox"]');
            if (cb) cb.checked = false;
        });
    }

    function showPrepLabels(catId) {
        hideAllPrepLabels();
        (catRules[catId] || []).forEach(rule => {
            const lbl = document.getElementById('wiz-lbl-' + rule);
            if (lbl) lbl.style.display = 'inline-block';
        });
    }

    function populateSubcats(catId) {
        subcatSelect.innerHTML = '<option value="">-- Select Sub-Category --</option>';
        subcats.filter(sc => sc.category_id == catId).forEach(sc => {
            const opt = document.createElement('option');
            opt.value = sc.id;
            opt.textContent = sc.subcat.charAt(0).toUpperCase() + sc.subcat.slice(1);
            subcatSelect.appendChild(opt);
        });
    }

    function populateSubsubs(subcatId) {
        subsubSelect.innerHTML = '<option value="">-- None / Select Type --</option>';
        const list = subsubs.filter(ss => ss.subcat_id == subcatId);
        list.forEach(ss => {
            const opt = document.createElement('option');
            opt.value = ss.id;
            opt.textContent = ss.subsub;
            subsubSelect.appendChild(opt);
        });
        return list.length;
    }

    catSelect.addEventListener('change', function () {
        const catId = this.value;
        h.category.value = catId;
        h.subcat.value = '';
        h.subsub.value = '';
        showPrepLabels(catId);
        if (catId) {
            populateSubcats(catId);
            subcatBlock.style.display = 'block';
        } else {
            subcatBlock.style.display = 'none';
        }
        subsubBlock.style.display = 'none';
        addSubcatForm.style.display = 'none';
        updateNextEnabled();
    });

    subcatSelect.addEventListener('change', function () {
        const subcatId = this.value;
        h.subcat.value = subcatId;
        h.subsub.value = '';
        if (subcatId) {
            populateSubsubs(subcatId);
            subsubBlock.style.display = 'block';
            addSubsubForm.style.display = 'none';
            const sc = subcats.find(s => s.id == subcatId);
            applyQtyType(sc && sc.quantity_type ? sc.quantity_type : 'count');
        } else {
            subsubBlock.style.display = 'none';
        }
        updateNextEnabled();
    });

    subsubSelect.addEventListener('change', function () {
        h.subsub.value = this.value;
    });

    prepBlock.addEventListener('change', function (e) {
        const cb = e.target;
        const name = cb.getAttribute('data-prep');
        if (name && prepHidden[name]) prepHidden[name].value = cb.checked ? '1' : '';
    });

    // ---------------- Step 1: inline add ----------------
    addSubcatToggle.addEventListener('click', () => {
        addSubcatForm.style.display = (addSubcatForm.style.display === 'none') ? 'block' : 'none';
        if (addSubcatForm.style.display === 'block') newSubcatName.focus();
    });
    addSubcatCancel.addEventListener('click', () => { addSubcatForm.style.display = 'none'; });

    addSubcatSave.addEventListener('click', async () => {
        const name = newSubcatName.value.trim();
        if (!name || !catSelect.value) return;
        addSubcatSave.disabled = true;
        try {
            const res = await fetch('/api/subcat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, category_id: catSelect.value, quantity_type: newSubcatQty.value })
            });
            const result = await res.json();
            if (result.success) {
                subcats.push({ id: result.id, category_id: parseInt(catSelect.value, 10),
                               subcat: result.subcat, quantity_type: result.quantity_type });
                populateSubcats(catSelect.value);
                subcatSelect.value = result.id;
                subcatSelect.dispatchEvent(new Event('change'));
                addSubcatForm.style.display = 'none';
                newSubcatName.value = '';
            } else {
                alert(result.message || 'Could not add sub-category.');
            }
        } catch (err) {
            alert('Server error while adding sub-category.');
        } finally {
            addSubcatSave.disabled = false;
        }
    });

    addSubsubToggle.addEventListener('click', () => {
        addSubsubForm.style.display = (addSubsubForm.style.display === 'none') ? 'block' : 'none';
        if (addSubsubForm.style.display === 'block') newSubsubName.focus();
    });
    addSubsubCancel.addEventListener('click', () => { addSubsubForm.style.display = 'none'; });

    addSubsubSave.addEventListener('click', async () => {
        const name = newSubsubName.value.trim();
        if (!name || !h.subcat.value) return;
        addSubsubSave.disabled = true;
        try {
            const res = await fetch('/api/subsub', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, subcat_id: h.subcat.value })
            });
            const result = await res.json();
            if (result.success) {
                subsubs.push({ id: result.id, subcat_id: parseInt(h.subcat.value, 10), subsub: result.subsub });
                populateSubsubs(h.subcat.value);
                subsubSelect.value = result.id;
                h.subsub.value = result.id;
                addSubsubForm.style.display = 'none';
                newSubsubName.value = '';
            } else {
                alert(result.message || 'Could not add type.');
            }
        } catch (err) {
            alert('Server error while adding type.');
        } finally {
            addSubsubSave.disabled = false;
        }
    });

    // ---------------- Step 2: quantity ----------------
    function applyQtyType(type) {
        qtyType = type;
        qtyOpts.forEach(b => b.classList.toggle('active', b.dataset.qty === type));
        if (type === 'weight') {
            setUnits(WEIGHT_UNITS);
            unitSelect.style.display = '';
            qtyInput.placeholder = '500';
        } else if (type === 'volume') {
            setUnits(VOLUME_UNITS);
            unitSelect.style.display = '';
            qtyInput.placeholder = '500';
        } else {
            unitSelect.style.display = 'none';
            qtyInput.placeholder = '1';
        }
        h.quantityType.value = type;
        updateQtyHidden();
    }

    function setUnits(units) {
        unitSelect.innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join('');
    }

    function updateQtyHidden() {
        const raw = qtyInput.value.trim();
        h.quantityValue.value = raw;
        if (qtyType === 'count') {
            h.quantityUnit.value = '';
            h.quantity.value = raw || '1';
        } else {
            const unit = unitSelect.value || '';
            h.quantityUnit.value = unit;
            h.quantity.value = (raw || '') + unit;
        }
        updateNextEnabled();
    }

    qtyOpts.forEach(btn => btn.addEventListener('click', () => {
        if (btn.dataset.qty !== qtyType) qtyInput.value = '';
        applyQtyType(btn.dataset.qty);
    }));
    qtyInput.addEventListener('input', updateQtyHidden);
    unitSelect.addEventListener('change', updateQtyHidden);

    // ---------------- Step 3: freezer -> drawer ----------------
    freezerSelect.addEventListener('change', function () {
        h.freezer.value = this.value;
        h.drawer.value = '';
        drawerSelect.innerHTML = '<option value="">-- Select Drawer --</option>';
        const n = parseInt(this.options[this.selectedIndex].getAttribute('data-drawers'), 10) || 0;
        for (let i = 1; i <= n; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i;
            drawerSelect.appendChild(opt);
        }
        updateNextEnabled();
    });

    drawerSelect.addEventListener('change', function () {
        h.drawer.value = this.value;
        updateNextEnabled();
    });

    // ---------------- Step 4: summary + submit ----------------
    function itemNames() {
        const subcatName = (subcatSelect.value && subcatSelect.selectedOptions[0])
            ? subcatSelect.selectedOptions[0].textContent : '';
        const subsubName = (subsubBlock.style.display !== 'none' && subsubSelect.value && subsubSelect.selectedOptions[0])
            ? subsubSelect.selectedOptions[0].textContent : '';
        return { subcatName, subsubName };
    }

    function buildSummary() {
        const { subcatName, subsubName } = itemNames();
        const freezerName = (freezerSelect.value && freezerSelect.selectedOptions[0])
            ? freezerSelect.selectedOptions[0].textContent : '';
        summaryEl.innerHTML =
            '<strong>' + (h.quantity.value || '1') + '</strong> · ' +
            subcatName + (subsubName ? ' ' + subsubName : '') +
            '<br><span style="opacity:.8;">' + freezerName + ' — drawer ' + (h.drawer.value || '') + '</span>';
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        updateQtyHidden();

        const { subcatName, subsubName } = itemNames();
        let desc = subcatName + (subsubName ? ' ' + subsubName : '');
        const qty = (h.quantity.value || '1').trim();
        const qtyPrefix = /^\d+$/.test(qty) ? qty + 'x' : qty;
        desc = qtyPrefix + ' ' + desc;

        // Notes and date aren't hidden inputs — attach them to the payload.
        const formData = new FormData(form);
        formData.set('notes', notesEl.value || '');
        if (dateEl.value) formData.set('date_added', dateEl.value);

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' }
            });
            const result = await response.json();
            if (result.success) {
                if (printEl.checked && typeof window.triggerPrint === 'function') {
                    await window.triggerPrint(result.entry_id, desc);
                }
                window.location.reload();
            } else {
                alert('Error saving item: ' + (result.message || 'Unknown error'));
            }
        } catch (err) {
            console.error('Wizard submission failed:', err);
            alert('A server error occurred while saving.');
        }
    });
});
