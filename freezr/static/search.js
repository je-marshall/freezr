document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');
    const searchBtn   = document.getElementById('btn-search');
    const entryItems  = document.querySelectorAll('.entry-item');
    const entries     = window.freezrData ? window.freezrData.entries : [];
    const emptyMsg    = document.getElementById('empty-inventory-msg');

    // Restore last active tab from localStorage, default to 'all'
    let activeCatId = localStorage.getItem('invActiveTab') || 'all';

    function applyFilters() {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        let anyVisible = false;

        entryItems.forEach(item => {
            const catId  = item.getAttribute('data-category-id');
            const tabOk  = activeCatId === 'all' || catId === activeCatId;

            let searchOk = true;
            if (query) {
                const id    = parseInt(item.getAttribute('data-id'));
                const entry = entries.find(e => e.id === id);
                if (entry) {
                    const text = [
                        entry.desc, entry.location, entry.category,
                        entry.subcat, entry.subsub, entry.notes,
                        entry.skin   ? 'skin on' : '',
                        entry.bone   ? 'bone in' : '',
                        entry.minced ? 'minced'  : '',
                        entry.grated ? 'grated'  : '',
                        entry.cooked ? 'cooked'  : ''
                    ].join(' ').toLowerCase();
                    searchOk = text.includes(query);
                }
            }

            const show = tabOk && searchOk;
            item.style.display = show ? 'flex' : 'none';
            if (show) anyVisible = true;
        });

        // Show "no items" message only when there are entries but none visible
        if (emptyMsg) {
            emptyMsg.style.display = (entryItems.length > 0 && !anyVisible) ? 'block' : 'none';
        }
    }

    // Set up tab buttons
    document.querySelectorAll('.inv-tab').forEach(btn => {
        // Restore active state on page load
        const catVal = btn.getAttribute('data-cat');
        btn.classList.toggle('active', catVal === activeCatId);

        btn.addEventListener('click', function() {
            document.querySelectorAll('.inv-tab').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            activeCatId = this.getAttribute('data-cat');
            localStorage.setItem('invActiveTab', activeCatId);
            applyFilters();
        });
    });

    if (searchBtn)   searchBtn.addEventListener('click', applyFilters);
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    // Apply on load to restore tab state
    applyFilters();
});
