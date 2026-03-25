document.addEventListener('DOMContentLoaded', function() {
    
    // --- 1. View Item Modal Logic ---
    const viewModal = document.getElementById('view-modal');
    const closeViewBtn = document.getElementById('btn-close-view');
    const dynamicFields = document.getElementById('view-dynamic-fields');
    const notesContainer = document.getElementById('view-notes-container');
    const notesField = document.getElementById('view-notes');
    const headerTitle = document.getElementById('view-header-title');

    if (closeViewBtn) closeViewBtn.addEventListener('click', (e) => { e.preventDefault(); viewModal.close(); });

    document.querySelectorAll('.entry-item').forEach(item => {
        item.addEventListener('click', function() {
            const entryId = parseInt(this.getAttribute('data-id'));
            
            // Find the specific entry data
            const entry = window.freezrData.entries.find(e => e.id === entryId);
            if (!entry) return;

            // Set Title
            headerTitle.textContent = entry.desc.charAt(0).toUpperCase() + entry.desc.slice(1);

            // Clear previous fields
            dynamicFields.innerHTML = '';

            // Helper function to create a disabled cs-input row WITH WHITE TEXT OVERRIDES
            const addField = (label, value) => {
                if (!value) return; 
                const wrapper = document.createElement('div');
                wrapper.innerHTML = `
                    <label style="display: block; font-weight: bold; margin-bottom: 5px; font-size: 0.9rem;">${label}</label>
                    <input type="text" class="cs-input" disabled value="${value}" style="width: 100%; padding: 5px; color: white; -webkit-text-fill-color: white; opacity: 1;">
                `;
                dynamicFields.appendChild(wrapper);
            };

            // Build layout dynamically
            addField('Location', entry.location);
            addField('Category', entry.category.charAt(0).toUpperCase() + entry.category.slice(1));
            addField('Sub-Category', entry.subcat);
            addField('Type', entry.subsub);
            addField('Quantity', entry.quantity);
            
            // NEW: Render active boolean traits as disabled checkboxes instead of comma-separated text
            let traits = [];
            if (entry.skin) traits.push('Skin on');
            if (entry.bone) traits.push('Bone in');
            if (entry.minced) traits.push('Minced');
            if (entry.grated) traits.push('Grated');
            if (entry.cooked) traits.push('Cooked');
            
            if (traits.length > 0) {
                const wrapper = document.createElement('div');
                let checkboxesHtml = traits.map(t => `
                    <label style="display: inline-flex; align-items: center; gap: 5px; font-weight: bold; margin-right: 10px;">
                        <input type="checkbox" class="cs-checkbox" checked disabled>
                        ${t}
                    </label>
                `).join('');
                
                wrapper.innerHTML = `
                    <label style="display: block; font-weight: bold; margin-bottom: 5px; font-size: 0.9rem;">Preparation</label>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; padding: 5px 0;">
                        ${checkboxesHtml}
                    </div>
                `;
                dynamicFields.appendChild(wrapper);
            }

            // Handle Notes
            if (entry.notes && entry.notes.trim() !== '') {
                notesField.value = entry.notes;
                notesContainer.style.display = 'block';
            } else {
                notesContainer.style.display = 'none';
            }

            // Inject the entry ID into both hidden forms
            document.getElementById('checkout-entry-id').value = entryId;
            document.getElementById('move-entry-id').value = entryId;

            viewModal.showModal();
        });
    });

    // --- 2. Checkout Confirmation Modal Logic ---
    const btnCheckoutInit = document.getElementById('btn-checkout-init');
    const confirmModal = document.getElementById('confirm-delete-modal');
    const closeConfirmBtn = document.getElementById('btn-close-confirm');
    const cancelConfirmBtn = document.getElementById('btn-cancel-confirm');

    if (btnCheckoutInit) {
        btnCheckoutInit.addEventListener('click', () => {
            viewModal.close();
            confirmModal.showModal();
        });
    }

    if (closeConfirmBtn) closeConfirmBtn.addEventListener('click', (e) => { e.preventDefault(); confirmModal.close(); });
    if (cancelConfirmBtn) cancelConfirmBtn.addEventListener('click', (e) => { e.preventDefault(); confirmModal.close(); });

    // --- 3. Move Modal Logic ---
    const btnMoveInit = document.getElementById('btn-move-init');
    const moveModal = document.getElementById('move-modal');
    const closeMoveBtn = document.getElementById('btn-close-move');
    const cancelMoveBtn = document.getElementById('btn-cancel-move');
    const moveFreezerSelect = document.getElementById('move-freezer');
    const moveDrawerSelect = document.getElementById('move-drawer');

    if (btnMoveInit) {
        btnMoveInit.addEventListener('click', () => {
            viewModal.close();
            moveModal.showModal();
        });
    }

    if (closeMoveBtn) closeMoveBtn.addEventListener('click', (e) => { e.preventDefault(); moveModal.close(); });
    if (cancelMoveBtn) cancelMoveBtn.addEventListener('click', (e) => { e.preventDefault(); moveModal.close(); });

    // Populate drawers dynamically when freezer changes
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


    // --- 4. Global Modal Click-to-Close Logic ---
    document.querySelectorAll('.cs-dialog').forEach(dialog => {
        dialog.addEventListener('mousedown', (event) => {
            if (event.target === dialog) {
                dialog.close();
            }
        });
    });

});
