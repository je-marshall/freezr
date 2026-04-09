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
            
            // Build details list
            let html = `
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #444; padding:5px 0;">
                    <span>Location:</span><strong>${currentEntry.location}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #444; padding:5px 0;">
                    <span>Quantity:</span><strong>${currentEntry.quantity}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #444; padding:5px 0;">
                    <span>Added:</span><strong>${new Date(currentEntry.created).toLocaleDateString('en-GB')}</strong>
                </div>
            `;
            
            viewFields.innerHTML = html;

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

    // --- 4. Checkout (Delete) Logic ---
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

    // --- 5. Move Item Logic ---
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
                moveDrawerSelect.innerHTML += `<option value="${i}">${i}</option>`;
            }
        });
    }
});
