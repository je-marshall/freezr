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
    const subcatContainer = document.getElementById('subcat-container');
    const subsubContainer = document.getElementById('subsub-container');

    if (catSelect) {
        catSelect.addEventListener('change', function() {
            const catId = this.value;
            
            document.querySelectorAll('.cs-checkbox').forEach(cb => {
                cb.checked = false;
                cb.parentElement.style.display = 'none';
            });

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
                if(subcatContainer) subcatContainer.style.display = 'block';
            } else {
                if(subcatContainer) subcatContainer.style.display = 'none';
            }
            
            if(subsubContainer) subsubContainer.style.display = 'none';
        });
    }

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
                if(subsubContainer) subsubContainer.style.display = 'block';
            } else {
                if(subsubContainer) subsubContainer.style.display = 'none';
            }
        });
    }

    const freezerSelect = document.getElementById('freezer');
    const drawerSelect = document.getElementById('drawer');

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

    // --- 3. Form Submission with BACKEND Print Support ---
    if (checkinForm) {
        checkinForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Determine item description for the physical label
            let itemDescription = 'UNKNOWN ITEM';
            if (subsubSelect && subsubSelect.value) {
                itemDescription = subsubSelect.options[subsubSelect.selectedIndex].text;
            } else if (subcatSelect && subcatSelect.value) {
                itemDescription = subcatSelect.options[subcatSelect.selectedIndex].text;
            }

            const formData = new FormData(checkinForm);
            
            try {
                // 1. Send the database check-in command
                const response = await fetch(checkinForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });
                
                const result = await response.json();

                if (result.success) {
                    // 2. If the user checked "Print Label", securely AWAIT the backend printer API
                    if (formData.get('print_label') && typeof window.triggerPrint === "function") {
                        await window.triggerPrint(result.entry_id, itemDescription);
                    }
                    
                    // 3. Reload instantly AFTER the print command has successfully cleared the network
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
