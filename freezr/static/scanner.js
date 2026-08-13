document.addEventListener('DOMContentLoaded', function() {
    const btnScanInit = document.getElementById('btn-scan-init');
    const scannerModal = document.getElementById('scanner-modal');
    const btnCloseScanner = document.getElementById('btn-close-scanner');
    const btnCancelScanner = document.getElementById('btn-cancel-scanner');
    
    let html5QrcodeScanner = null;

    // Helper to safely shut down the camera
    function stopScanner() {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear().catch(error => {
                console.error("Failed to clear html5QrcodeScanner. ", error);
            });
            html5QrcodeScanner = null;
        }
    }

    // --- NEW: Bulletproof Camera Shutoff ---
    // Listen to the native 'close' event of the dialog. This guarantees the camera 
    // turns off even if the user hits the Escape key or clicks outside the modal!
    if (scannerModal) {
        scannerModal.addEventListener('close', stopScanner);
    }

    // This fires the instant a QR code is successfully read
    function onScanSuccess(decodedText) {
        let entryId = null;

        // New format: full URL like http://host/item/123
        try {
            const url = new URL(decodedText);
            const match = url.pathname.match(/\/item\/(\d+)/);
            if (match) entryId = parseInt(match[1]);
        } catch (e) {
            // Legacy plain-integer format
            const n = parseInt(decodedText);
            if (!isNaN(n)) entryId = n;
        }

        if (entryId === null) {
            alert("Invalid QR Code. Please scan a Freezr label.");
            return;
        }

        scannerModal.close();

        // Is this entry in the current data at all?
        const entries = window.freezrData ? window.freezrData.entries : [];
        const inData  = entries.some(e => e.id === entryId);

        let listItem = document.querySelector(`.entry-item[data-id="${entryId}"]`);

        if (!listItem && inData) {
            // Item exists but is hidden by a tab or search filter — reset to All
            const allTab = document.querySelector('.inv-tab[data-cat="all"]');
            if (allTab) allTab.click();
            listItem = document.querySelector(`.entry-item[data-id="${entryId}"]`);
        }

        if (listItem) {
            listItem.click();
        } else {
            // Item not in inventory — likely already checked out
            const notFoundModal = document.getElementById('not-found-modal');
            if (notFoundModal) notFoundModal.showModal();
        }
    }

    // Open Modal and Start Camera
    if (btnScanInit) {
        btnScanInit.addEventListener('click', () => {
            scannerModal.showModal();
            
            // Initialize the scanner
            html5QrcodeScanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: {width: 250, height: 250} },
                false 
            );
            
            html5QrcodeScanner.render(onScanSuccess);
        });
    }

    // Close Button Handlers (Just trigger the modal close, the event listener handles the camera)
    const closeHandler = (e) => {
        e.preventDefault();
        scannerModal.close();
    };

    if (btnCloseScanner) btnCloseScanner.addEventListener('click', closeHandler);
    if (btnCancelScanner) btnCancelScanner.addEventListener('click', closeHandler);
});
