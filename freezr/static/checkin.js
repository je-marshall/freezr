document.addEventListener('DOMContentLoaded', function() {
    // --- 1. Check In Modal Open/Close Logic ---
    const checkinBtn = document.getElementById('btn-checkin');
    const checkinModal = document.getElementById('checkin-modal');
    const closeBtn = document.getElementById('btn-close-modal');
    const cancelBtn = document.getElementById('btn-cancel-modal');
    const checkinForm = checkinModal ? checkinModal.querySelector('form') : null;

    if (checkinBtn && checkinModal) {
        checkinBtn.addEventListener('click', () => checkinModal.showModal());
    }
    
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); checkinModal.close(); });
    if (cancelBtn) cancelBtn.addEventListener('click', (e) => { e.preventDefault(); checkinModal.close(); });

    // --- 2. Dynamic Category Dropdown Logic ---
    const subcats = window.freezrData ? window.freezrData.subcats : [];
    const subsubs = window.freezrData ? window.freezrData.subsubs : [];

    const catRules = {
        1: ['skin', 'bone', 'minced', 'cooked'], 
        2: ['grated'],
        3: ['cooked'], 
        4: ['skin', 'bone', 'minced', 'cooked'],
        5: []
    };

    const catSelect = document.getElementById('category');
    const subcatSelect = document.getElementById('subcat');
    const subsubSelect = document.getElementById('subsub');

    if (catSelect) {
        catSelect.addEventListener('change', function() {
            const catId = parseInt(this.value);
            document.getElementById('subcat-container').style.display = 'none';
            subcatSelect.required = false;
            subcatSelect.innerHTML = '<option value="">-- Select Sub-Category --</option>';
            document.getElementById('subsub-container').style.display = 'none';
            subsubSelect.required = false;
            subsubSelect.innerHTML = '<option value="">-- Select Type --</option>';

            ['skin', 'bone', 'minced', 'grated', 'cooked'].forEach(flag => {
                const label = document.getElementById('lbl-' + flag);
                const checkbox = document.getElementById('chk-' + flag);
                if (catId && catRules[catId] && catRules[catId].includes(flag)) {
                    label.style.display = 'inline-block';
                } else {
                    label.style.display = 'none';
                    if (checkbox) checkbox.checked = false;
                }
            });

            if (!catId) return;
            const filteredSubcats = subcats.filter(s => s.category_id === catId);
            if (filteredSubcats.length > 0) {
                filteredSubcats.forEach(s => {
                    subcatSelect.innerHTML += `<option value="${s.id}">${s.subcat}</option>`;
                });
                document.getElementById('subcat-container').style.display = 'block';
                subcatSelect.required = true;
            }
        });
    }

    if (subcatSelect) {
        subcatSelect.addEventListener('change', function() {
            const subcatId = parseInt(this.value);
            document.getElementById('subsub-container').style.display = 'none';
            subsubSelect.required = false;
            subsubSelect.innerHTML = '<option value="">-- Select Type --</option>';

            if (!subcatId) return;
            const filteredSubsubs = subsubs.filter(s => s.subcat_id === subcatId);
            if (filteredSubsubs.length > 0) {
                filteredSubsubs.forEach(s => {
                    subsubSelect.innerHTML += `<option value="${s.id}">${s.subsub}</option>`;
                });
                document.getElementById('subsub-container').style.display = 'block';
                subsubSelect.required = true;
            }
        });
    }

    // --- 3. Dynamic Drawer Logic ---
    const freezerSelect = document.getElementById('freezer');
    const drawerSelect = document.getElementById('drawer');

    if (freezerSelect && drawerSelect) {
        freezerSelect.addEventListener('change', function() {
            drawerSelect.innerHTML = '<option value="">-- Select Drawer --</option>';
            drawerSelect.required = false;
            if (!this.value) return;
            const selectedOption = this.options[this.selectedIndex];
            const numDrawers = parseInt(selectedOption.getAttribute('data-drawers')) || 4;
            for (let i = 1; i <= numDrawers; i++) {
                drawerSelect.innerHTML += `<option value="${i}">${i}</option>`;
            }
            drawerSelect.required = true;
        });
    }

    // --- 4. AJAX Submission & Printing ---
    if (checkinForm) {
        checkinForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Build the description for the label BEFORE we submit
            let itemDescription = 'Freezer Item';
            if (subsubSelect && subsubSelect.value) {
                itemDescription = subsubSelect.options[subsubSelect.selectedIndex].text;
            } else if (subcatSelect && subcatSelect.value) {
                itemDescription = subcatSelect.options[subcatSelect.selectedIndex].text;
            }

            const formData = new FormData(checkinForm);
            
            try {
                const response = await fetch(checkinForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });
                
                const result = await response.json();

                if (result.success) {
                    if (formData.get('print_label') && typeof window.triggerPrint === "function") {
                        // Trigger the print dialog
                        window.triggerPrint(result.entry_id, itemDescription);
                        
                        // Wait for the print dialog to open/close before reloading
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    } else {
                        // No print requested, reload instantly
                        window.location.reload();
                    }
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
