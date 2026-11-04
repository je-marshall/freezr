document.addEventListener('DOMContentLoaded', function() {
    
    // --- 1. Human Readable Date Formatter ---
    function timeAgo(dateString) {
        if (!dateString) return "Unknown date";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;

        const today = new Date();
        date.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        
        const diffTime = today - date; 
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return diffDays + " days ago";
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return weeks + (weeks === 1 ? " week ago" : " weeks ago");
        }
        const months = Math.floor(diffDays / 30);
        return months + (months === 1 ? " month ago" : " months ago");
    }

    // Format all dates in the list on load
    document.querySelectorAll('.entry-date-display').forEach(span => {
        span.innerText = timeAgo(span.getAttribute('data-date'));
    });

    // --- 2. View Item Logic ---
    const entries = window.freezrData ? window.freezrData.entries : [];
    const viewModal = document.getElementById('view-modal');
    const viewTitle = document.getElementById('view-header-title');
    const viewFields = document.getElementById('view-dynamic-fields');
    const viewNotesCont = document.getElementById('view-notes-container');
    const viewNotes = document.getElementById('view-notes');
    
    let currentEntry = null; // Track what is currently being viewed

    document.querySelectorAll('.entry-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.getAttribute('data-id'));
            currentEntry = entries.find(e => e.id === id);
            if (!currentEntry) return;

            viewTitle.innerText = currentEntry.desc.toUpperCase();

            // Counted items get a −/+ stepper; weights/volumes stay static.
            const isCount = currentEntry.quantity_type === 'count'
                && /^\d+$/.test(String(currentEntry.quantity).trim());
            const qtyCell = isCount
                ? `<div style="display:flex; align-items:center; gap:12px;">
                       <button type="button" id="view-qty-minus" class="cs-btn" style="width:30px; height:30px; font-weight:bold; font-size:1.1rem; line-height:1; padding:0;">−</button>
                       <strong id="view-qty-value" style="min-width:20px; text-align:center;">${currentEntry.quantity}</strong>
                       <button type="button" id="view-qty-plus" class="cs-btn" style="width:30px; height:30px; font-weight:bold; font-size:1.1rem; line-height:1; padding:0;">+</button>
                   </div>`
                : `<strong>${currentEntry.quantity}</strong>`;

            // Build details list
            let html = `
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #444; padding:5px 0;">
                    <span>Location:</span><strong>${currentEntry.location}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #444; padding:5px 0;">
                    <span>Quantity:</span>${qtyCell}
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #444; padding:5px 0;">
                    <span>Added:</span><strong>${new Date(currentEntry.created).toLocaleDateString('en-GB')}</strong>
                </div>
            `;

            viewFields.innerHTML = html;

            if (isCount) {
                const minus = document.getElementById('view-qty-minus');
                const plus  = document.getElementById('view-qty-plus');
                const valEl = document.getElementById('view-qty-value');
                const step = async (delta) => {
                    minus.disabled = plus.disabled = true;
                    try {
                        const res = await fetch(`/api/adjust/${currentEntry.id}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ delta })
                        });
                        const data = await res.json();
                        if (!data.success) { alert(data.message || 'Could not update quantity.'); return; }
                        if (data.checked_out) { window.location.reload(); return; }
                        currentEntry.quantity = data.quantity;
                        valEl.textContent = data.quantity;
                    } catch (err) {
                        alert('A server error occurred while updating quantity.');
                    } finally {
                        minus.disabled = plus.disabled = false;
                    }
                };
                minus.addEventListener('click', () => step(-1));
                plus.addEventListener('click',  () => step(1));
            }

            if (currentEntry.notes) {
                viewNotesCont.style.display = 'block';
                viewNotes.value = currentEntry.notes;
            } else {
                viewNotesCont.style.display = 'none';
            }

            // Prep the other modals with this ID
            document.getElementById('checkout-entry-id').value = id;
            document.getElementById('move-entry-id').value = id;

            viewModal.showModal();
        });
    });

    // Close buttons
    document.getElementById('btn-close-view')?.addEventListener('click', () => viewModal.close());

    // --- 3. Printer Integration ---
    const btnPrintInit = document.getElementById('btn-print-init');
    if (btnPrintInit) {
        btnPrintInit.addEventListener('click', () => {
            if (currentEntry && typeof window.triggerPrint === 'function') {
                // Call the function defined in print.js
                window.triggerPrint(currentEntry.id, currentEntry.desc);
            } else {
                console.error("Printer function not found or no entry selected");
            }
        });
    }

    // --- 4. Copy / Checkout / Move Logic ---
    // --- Checkout (Delete) ---
    const btnCheckoutInit = document.getElementById('btn-checkout-init');
    const confirmModal = document.getElementById('confirm-delete-modal');
    if (btnCheckoutInit) {
        btnCheckoutInit.addEventListener('click', () => {
            viewModal.close();
            confirmModal.showModal();
        });
    }
    const closeConfirm = (e) => { e.preventDefault(); confirmModal.close(); };
    document.getElementById('btn-close-confirm')?.addEventListener('click', closeConfirm);
    document.getElementById('btn-cancel-confirm')?.addEventListener('click', closeConfirm);

    // --- 5. Copy Item Logic ---
    const btnCopyInit  = document.getElementById('btn-copy-init');
    const copyModal    = document.getElementById('copy-modal');
    const copyForm     = document.getElementById('copy-form');
    const copyFreezer  = document.getElementById('copy-freezer');
    const copyDrawer   = document.getElementById('copy-drawer');

    if (btnCopyInit) {
        btnCopyInit.addEventListener('click', () => {
            if (!currentEntry) return;
            document.getElementById('copy-header-title').innerText = currentEntry.desc.toUpperCase();
            document.getElementById('copy-category').value = currentEntry.category_id;
            document.getElementById('copy-subcat').value   = currentEntry.subcat_id;
            document.getElementById('copy-subsub').value   = currentEntry.subsub_id || '';
            document.getElementById('copy-skin').value     = currentEntry.skin   ? '1' : '';
            document.getElementById('copy-bone').value     = currentEntry.bone   ? '1' : '';
            document.getElementById('copy-minced').value   = currentEntry.minced ? '1' : '';
            document.getElementById('copy-grated').value   = currentEntry.grated ? '1' : '';
            document.getElementById('copy-cooked').value   = currentEntry.cooked ? '1' : '';
            document.getElementById('copy-notes').value    = currentEntry.notes  || '';
            document.getElementById('copy-quantity').value = currentEntry.quantity;
            // Pre-populate location from source entry (user can override)
            if (copyFreezer) {
                copyFreezer.value = currentEntry.freezer_id;
                copyFreezer.dispatchEvent(new Event('change')); // populates drawer options
            }
            if (copyDrawer) copyDrawer.value = currentEntry.drawer;
            viewModal.close();
            copyModal.showModal();
        });
    }

    const closeCopy = (e) => { e.preventDefault(); copyModal.close(); };
    document.getElementById('btn-close-copy')?.addEventListener('click', closeCopy);
    document.getElementById('btn-cancel-copy')?.addEventListener('click', closeCopy);

    if (copyFreezer && copyDrawer) {
        copyFreezer.addEventListener('change', function() {
            copyDrawer.innerHTML = '<option value="">-- Select Drawer --</option>';
            if (!this.value) return;
            const numDrawers = parseInt(this.options[this.selectedIndex].getAttribute('data-drawers')) || 4;
            for (let i = 1; i <= numDrawers; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i;
                copyDrawer.appendChild(opt);
            }
        });
    }

    if (copyForm) {
        copyForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(copyForm);
            try {
                const response = await fetch(copyForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });
                const result = await response.json();
                if (result.success) {
                    if (formData.get('print_label') && typeof window.triggerPrint === 'function') {
                        await window.triggerPrint(result.entry_id, result.desc);
                    }
                    window.location.reload();
                } else {
                    alert('Error saving copy: ' + (result.message || 'Unknown error'));
                }
            } catch (err) {
                console.error('Copy failed:', err);
                alert('A server error occurred.');
            }
        });
    }

    // --- 6. Move Item Logic ---
    const btnMoveInit = document.getElementById('btn-move-init');
    const moveModal = document.getElementById('move-modal');
    if (btnMoveInit) {
        btnMoveInit.addEventListener('click', () => {
            viewModal.close();
            moveModal.showModal();
        });
    }
    const closeMove = (e) => { e.preventDefault(); moveModal.close(); };
    document.getElementById('btn-close-move')?.addEventListener('click', closeMove);
    document.getElementById('btn-cancel-move')?.addEventListener('click', closeMove);

    const moveFreezerSelect = document.getElementById('move-freezer');
    const moveDrawerSelect = document.getElementById('move-drawer');
    
    if (moveFreezerSelect && moveDrawerSelect) {
        moveFreezerSelect.addEventListener('change', function() {
            moveDrawerSelect.innerHTML = '<option value="">-- Select Drawer --</option>';
            if (!this.value) return;
            const numDrawers = parseInt(this.options[this.selectedIndex].getAttribute('data-drawers')) || 4;
            for (let i = 1; i <= numDrawers; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i;
                moveDrawerSelect.appendChild(opt);
            }
        });
    }
});
