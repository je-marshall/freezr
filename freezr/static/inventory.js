document.addEventListener('DOMContentLoaded', function() {
    
    // --- NEW: Human Readable Date Formatter ---
    function timeAgo(dateString) {
        if (!dateString) return "Unknown date";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString; // Fallback if parse fails

        const today = new Date();
        date.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        
        const diffTime = today - date; 
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 0) return "In the future";
        if (diffDays < 7) return diffDays + " days ago";
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return weeks + (weeks === 1 ? " week ago" : " weeks ago");
        }
        if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return months + (months === 1 ? " month ago" : " months ago");
        }
        const years = Math.floor(diffDays / 365);
        return years + (years === 1 ? " year ago" : " years ago");
    }

    // Format all dates in the list automatically on load!
    document.querySelectorAll('.entry-date-display').forEach(el => {
        const rawDate = el.getAttribute('data-date');
        if (rawDate) {
            el.textContent = timeAgo(rawDate);
        }
    });

    // --- 0. Global Print Function ---
    window.printLabel = function(id, desc, rawDate) {
        const qrContainer = document.getElementById('qrcode-container');
        const descEl = document.getElementById('print-desc');
        const dateEl = document.getElementById('print-date');

        qrContainer.innerHTML = '';
        descEl.textContent = desc.toUpperCase();
        
        // Pass the raw date directly to the printed label!
        dateEl.textContent = "ADDED: " + (rawDate || new Date().toLocaleDateString());

        new QRCode(qrContainer, {
            text: id.toString(),
            width: 120,
            height: 120,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });

        setTimeout(() => {
            window.print();
        }, 500);
    };

    // --- 1. View Item Modal Logic ---
    const viewModal = document.getElementById('view-modal');
    const closeViewBtn = document.getElementById('btn-close-view');
    const dynamicFields = document.getElementById('view-dynamic-fields');
    const notesContainer = document.getElementById('view-notes-container');
    const notesField = document.getElementById('view-notes');
    const headerTitle = document.getElementById('view-header-title');

    let currentEntry = null;

    if (closeViewBtn) closeViewBtn.addEventListener('click', (e) => { e.preventDefault(); viewModal.close(); });

    document.querySelectorAll('.entry-item').forEach(item => {
        item.addEventListener('click', function() {
            const entryId = parseInt(this.getAttribute('data-id'));
            
            currentEntry = window.freezrData.entries.find(e => e.id === entryId);
            if (!currentEntry) return;

            headerTitle.textContent = currentEntry.desc.charAt(0).toUpperCase() + currentEntry.desc.slice(1);
            dynamicFields.innerHTML = '';

            const addField = (label, value) => {
                if (!value) return; 
                const wrapper = document.createElement('div');
                wrapper.innerHTML = `
                    <label style="display: block; font-weight: bold; margin-bottom: 5px; font-size: 0.9rem;">${label}</label>
                    <input type="text" class="cs-input" disabled value="${value}" 
                           style="width: 100%; padding: 5px; color: white !important; -webkit-text-fill-color: white; opacity: 1;">
                `;
                dynamicFields.appendChild(wrapper);
            };

            addField('Location', currentEntry.location);
            addField('Category', currentEntry.category.charAt(0).toUpperCase() + currentEntry.category.slice(1));
            addField('Sub-Category', currentEntry.subcat);
            addField('Type', currentEntry.subsub);
            addField('Quantity', currentEntry.quantity);
            
            let traits = [];
            if (currentEntry.skin) traits.push('Skin on');
            if (currentEntry.bone) traits.push('Bone in');
            if (currentEntry.minced) traits.push('Minced');
            if (currentEntry.grated) traits.push('Grated');
            if (currentEntry.cooked) traits.push('Cooked');
            
            if (traits.length > 0) {
                const wrapper = document.createElement('div');
                let checkboxesHtml = traits.map(t => `
                    <label style="display: inline-flex; align-items: center; gap: 8px; font-weight: bold; margin-right: 15px; color: white;">
                        <input type="checkbox" class="cs-checkbox" checked disabled style="cursor: default;">
                        ${t}
                    </label>
                `).join('');
                
                wrapper.innerHTML = `
                    <label style="display: block; font-weight: bold; margin-bottom: 5px; font-size: 0.9rem;">Preparation</label>
                    <div style="display: flex; flex-wrap: wrap; gap: 5px; padding: 5px 0;">
                        ${checkboxesHtml}
                    </div>
                `;
                dynamicFields.appendChild(wrapper);
            }

            if (currentEntry.notes && currentEntry.notes.trim() !== '') {
                notesField.value = currentEntry.notes;
                notesContainer.style.display = 'block';
            } else {
                notesContainer.style.display = 'none';
            }

            document.getElementById('checkout-entry-id').value = entryId;
            document.getElementById('move-entry-id').value = entryId;

            viewModal.showModal();
        });
    });

    // --- 2. Modal Utility (Close on backdrop click) ---
    document.querySelectorAll('.cs-dialog').forEach(dialog => {
        dialog.addEventListener('mousedown', (event) => {
            if (event.target === dialog) dialog.close();
        });
    });

    // --- 3. Action Button Logic ---
    const btnPrintInit = document.getElementById('btn-print-init');
    if (btnPrintInit) {
        btnPrintInit.addEventListener('click', () => {
            if (currentEntry) {
                // Now passing the raw backend date right through!
                window.printLabel(currentEntry.id, currentEntry.desc, currentEntry.date);
            }
        });
    }

    // --- RESTORED: Confirm Delete Modal Handlers ---
    const btnCheckoutInit = document.getElementById('btn-checkout-init');
    const confirmModal = document.getElementById('confirm-delete-modal');
    const btnCloseConfirm = document.getElementById('btn-close-confirm');
    const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
    
    if (btnCheckoutInit) {
        btnCheckoutInit.addEventListener('click', () => {
            viewModal.close();
            confirmModal.showModal();
        });
    }
    const closeConfirm = (e) => { e.preventDefault(); confirmModal.close(); };
    if (btnCloseConfirm) btnCloseConfirm.addEventListener('click', closeConfirm);
    if (btnCancelConfirm) btnCancelConfirm.addEventListener('click', closeConfirm);


    // --- RESTORED: Move Modal Handlers ---
    const btnMoveInit = document.getElementById('btn-move-init');
    const moveModal = document.getElementById('move-modal');
    const btnCloseMove = document.getElementById('btn-close-move');
    const btnCancelMove = document.getElementById('btn-cancel-move');
    
    if (btnMoveInit) {
        btnMoveInit.addEventListener('click', () => {
            viewModal.close();
            moveModal.showModal();
        });
    }
    const closeMove = (e) => { e.preventDefault(); moveModal.close(); };
    if (btnCloseMove) btnCloseMove.addEventListener('click', closeMove);
    if (btnCancelMove) btnCancelMove.addEventListener('click', closeMove);


    // --- RESTORED: Move Modal Dynamic Drawers ---
    const moveFreezerSelect = document.getElementById('move-freezer');
    const moveDrawerSelect = document.getElementById('move-drawer');
    
    if (moveFreezerSelect && moveDrawerSelect) {
        moveFreezerSelect.addEventListener('change', function() {
            moveDrawerSelect.innerHTML = '<option value="">-- Select Drawer --</option>';
            moveDrawerSelect.required = false;

            if (!this.value) return;

            const selectedOption = this.options[this.selectedIndex];
            const numDrawers = parseInt(selectedOption.getAttribute('data-drawers')) || 4;

            for (let i = 1; i <= numDrawers; i++) {
                moveDrawerSelect.innerHTML += `<option value="${i}">${i}</option>`;
            }
            moveDrawerSelect.required = true;
        });
    }
});
