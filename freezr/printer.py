import logging
import os
import textwrap
from datetime import datetime
import qrcode
from PIL import Image, ImageDraw, ImageFont
from brother_ql.conversion import convert
from brother_ql.backends.helpers import send
from brother_ql.raster import BrotherQLRaster

log = logging.getLogger(__name__)

FONT_SEARCH_PATHS = [
    "/usr/share/fonts/truetype/liberation",  # Debian / Pi OS
    "/usr/share/fonts/liberation",           # Fedora / RPM
]

def _find_font(name):
    for d in FONT_SEARCH_PATHS:
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    return None

def create_label_image(entry_id, description, date_str, label_size='62x29'):
    from brother_ql.labels import ALL_LABELS
    label_def = next((l for l in ALL_LABELS if l.identifier == label_size), None)
    if label_def and label_def.dots_total:
        width, height = label_def.dots_total
    else:
        width, height = 696, 271

    log.debug('Creating label image: entry_id=%s description=%r date=%s dims=%dx%d',
              entry_id, description, date_str, width, height)
    img = Image.new('RGB', (width, height), color='white')

    qr_size = height - 48
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=1,
    )
    qr.add_data(str(entry_id))
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    qr_img = qr_img.resize((qr_size, qr_size))
    img.paste(qr_img, (24, (height - qr_size) // 2))
    log.debug('QR code generated and pasted (%dx%d)', qr_size, qr_size)

    draw = ImageDraw.Draw(img)
    bold_path    = _find_font("LiberationSans-Bold.ttf")
    regular_path = _find_font("LiberationSans-Regular.ttf")
    try:
        if not bold_path or not regular_path:
            raise FileNotFoundError
        font_large = ImageFont.truetype(bold_path, 42)
        font_small = ImageFont.truetype(regular_path, 28)
        log.debug('Loaded Liberation fonts from %s', os.path.dirname(bold_path))
    except (IOError, OSError):
        log.warning('Liberation fonts not found — falling back to default')
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()

    text_x = 24 + qr_size + 16
    wrapped_desc = textwrap.fill(description.upper(), width=14)
    draw.text((text_x, height // 6),      wrapped_desc,         font=font_large, fill="black")
    draw.text((text_x, height - 50),      f"Added: {date_str}", font=font_small, fill="black")

    log.debug('Label image created (%dx%d)', width, height)
    return img


def print_label(entry_id, description, date_str, printer_identifier, printer_model='QL-600', label_size='62x29'):
    """
    Generates the image and dispatches it directly to the Brother print backend.
    """
    log.info('print_label called: entry_id=%s model=%s label=%s identifier=%r',
             entry_id, printer_model, label_size, printer_identifier)
    try:
        img = create_label_image(entry_id, description, date_str, label_size)

        log.debug('Initialising BrotherQLRaster for model %s', printer_model)
        qlr = BrotherQLRaster(printer_model)
        qlr.exception_on_warning = True

        log.debug('Converting image to raster instructions (label=%s)', label_size)
        instructions = convert(
            qlr=qlr,
            images=[img],
            label=label_size,
            rotate='0',
            threshold=70.0,
            dither=False,
            compress=False,
        )
        log.debug('Raster conversion complete, %d bytes of instructions', len(instructions))

        if printer_identifier.startswith('tcp'):
            backend = 'network'
        elif printer_identifier.startswith('file'):
            backend = 'linux_kernel'
        else:
            backend = 'pyusb'
        log.info('Sending to printer: backend=%s identifier=%r', backend, printer_identifier)

        send(
            instructions=instructions,
            printer_identifier=printer_identifier,
            backend_identifier=backend,
            blocking=True,
        )

        log.info('Label printed successfully')
        return True, "Label printed successfully."

    except Exception as e:
        log.exception('Print failed for entry_id=%s', entry_id)

        msg = str(e)
        if "No device found" in msg or "ValueError" in msg:
            msg = "Printer not found. Is it turned on and plugged in?"
        elif "Access denied" in msg or "insufficient permissions" in msg.lower():
            msg = "USB access denied — check the pi user is in the lp/plugdev groups."
        elif "No backend available" in msg:
            msg = "USB driver missing on the server."

        return False, msg
