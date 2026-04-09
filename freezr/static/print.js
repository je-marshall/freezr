/**
 * print.js - Handles printer communication and UI feedback
 */

window.triggerPrint = async function(id, desc) {
    console.log("Printer trigger started for ID:", id, "Desc:", desc);

    // 1. Create and show a "Loading" toast
    const toast = document.createElement('div');
    toast.id = 'print-toast';
    toast.innerText = "⏳ Sending to Printer...";
    
    // Styling the toast via JS to keep CSS clean
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#007bff',
        color: '#fff',
        padding: '16px 32px',
        borderRadius: '8px',
        fontWeight: 'bold',
        zIndex: '10000',
        boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
        fontSize: '1.1rem',
        minWidth: '250px',
        textAlign: 'center',
        transition: 'all 0.3s ease'
    });
    
    // Remove existing toast if user clicks fast
    const existing = document.getElementById('print-toast');
    if (existing) existing.remove();
    
    document.body.appendChild(toast);

    try {
        const response = await fetch(`/api/print/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ desc: desc })
        });
        
        if (!response.ok) {
            throw new Error(`Server Error: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            toast.innerText = '❌ ' + (result.message || 'Printer Error');
            toast.style.backgroundColor = '#dc3545';
        } else {
            toast.innerText = '✅ Label Printed!';
            toast.style.backgroundColor = '#28a745';
        }
    } catch (err) {
        console.error('Network/Print error:', err);
        toast.innerText = '❌ Connection Failed';
        toast.style.backgroundColor = '#dc3545';
    }
    
    // Hide toast after 5 seconds
    setTimeout(() => {
        if (toast && toast.parentNode) {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }
    }, 5000);
};
