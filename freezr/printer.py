import os
import textwrap
import traceback
from datetime import datetime
import qrcode
from PIL import Image, ImageDraw, ImageFont
from brother_ql.conversion import convert
from brother_ql.backends.helpers import send
from brother_ql.raster import BrotherQLRaster

def create_label_image(entry_id, description, date_str):
    """
    Creates a PIL Image formatted precisely for a 62x29mm Brother Label.
    At 300 DPI, 62x29mm is exactly 696 x 348 pixels.
    """
    width, height = 696, 348
    
    # Create a pure white canvas
    img = Image.new('RGB', (width, height), color='white')
    
    # 1. Generate the QR Code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=1,
    )
    qr.add_data(str(entry_id))
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    # Resize QR to fit nicely on the left side
    qr_img = qr_img.resize((300, 300))
    img.paste(qr_img, (24, 24)) # 24px padding from the top/left edge
    
    # 2. Setup Fonts for the Text
    draw = ImageDraw.Draw(img)
    try:
        # Try to load standard Linux fonts for nice rendering
        font_large = ImageFont.truetype("/usr/share/fonts/liberation/LiberationSans-Bold.ttf", 42)
        font_small = ImageFont.truetype("/usr/share/fonts/liberation/LiberationSans-Regular.ttf", 28)
    except IOError:
        # Fallback if fonts are missing
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()
        
    # 3. Draw the Description
    # Wrap text so it doesn't run off the edge of the label
    wrapped_desc = textwrap.fill(description.upper(), width=14)
    draw.text((340, 40), wrapped_desc, font=font_large, fill="black")
    
    # 4. Draw the Date near the bottom right
    draw.text((340, 260), f"Added: {date_str}", font=font_small, fill="black")
    
    return img

def print_label(entry_id, description, date_str, printer_identifier, printer_model='QL-600', label_size='62x29'):
    """
    Generates the image and dispatches it directly to the Brother print server.
    """
    try:
        img = create_label_image(entry_id, description, date_str)
        
        qlr = BrotherQLRaster(printer_model)
        qlr.exception_on_warning = True
        
        instructions = convert(
            qlr=qlr, 
            images=[img], 
            label=label_size, 
            rotate='0',     
            threshold=70.0, 
            dither=False, 
            compress=False
        )
        
        backend = 'network' if printer_identifier.startswith('tcp') else 'pyusb'
        if printer_identifier.startswith('file'):
            backend = 'linux_kernel'
            
        send(instructions=instructions, printer_identifier=printer_identifier, backend_identifier=backend, blocking=True)
        
        return True, "Label printed successfully."
        
    except Exception as e:
        # Log the full error to the systemd journal so we can debug it if needed
        print(f"Raw Print Error:\n{traceback.format_exc()}")
        
        # Format a clean message for the UI
        msg = str(e)
        if "No device found" in msg or "ValueError" in msg:
            msg = "Printer not found. Is it turned on and plugged in?"
        elif "Access denied" in msg or "insufficient permissions" in msg.lower():
            msg = "USB Access Denied. Check Proxmox udev rules."
        elif "No backend available" in msg:
            msg = "USB driver missing on the server."
            
        return False, msg
