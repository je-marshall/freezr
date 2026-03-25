document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('btn-search');
    const entryItems = document.querySelectorAll('.entry-item');
    
    // Grab the database info we passed securely from Flask
    const entries = window.freezrData ? window.freezrData.entries : [];

    function performSearch() {
        if (!searchInput) return;
        
        const query = searchInput.value.toLowerCase().trim();

        entryItems.forEach(item => {
            // If the search bar is empty, show everything (restore flexbox layout)
            if (!query) {
                item.style.display = 'flex';
                return;
            }

            const id = parseInt(item.getAttribute('data-id'));
            const entry = entries.find(e => e.id === id);

            if (!entry) return;

            // Combine all useful text into one giant string to easily fuzzy match against
            const searchableText = [
                entry.desc || '',
                entry.location || '',
                entry.category || '',
                entry.subcat || '',
                entry.subsub || '',
                entry.notes || '',
                entry.skin ? 'skin on' : '',
                entry.bone ? 'bone in' : '',
                entry.minced ? 'minced' : '',
                entry.grated ? 'grated' : '',
                entry.cooked ? 'cooked' : ''
            ].join(' ').toLowerCase();

            // Simple fuzzy match: does our giant string contain what they typed?
            if (searchableText.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // Trigger search when clicking the magnifying glass button
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }

    // Trigger search LIVE as the user types (this feels amazing to use)
    if (searchInput) {
        searchInput.addEventListener('input', performSearch);
    }
});
