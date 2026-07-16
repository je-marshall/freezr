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
    function onScanSuccess(decodedText, decodedResult) {
        let entryId = null;

        // New format: full URL like http://host/item/123
        try {
            const url = new URL(decodedText);
            const match = url.pathname.match(/\/item\/(\d+)/);
            if (match) entryId = parseInt(match[1]);
        } catch (e) {
            // Not a URL — try legacy plain-integer format
            const n = parseInt(decodedText);
            if (!isNaN(n)) entryId = n;
        }

        if (entryId !== null) {
            scannerModal.close();
            const listItem = document.querySelector(`.entry-item[data-id="${entryId}"]`);
            if (listItem) {
                listItem.click();
            } else {
                alert("Item ID " + entryId + " not found in current inventory.");
            }
        } else {
            alert("Invalid QR Code scanned. Please scan a Freezr label.");
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
