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

def create_label_image(entry_id, description, date_str):
    """
    Creates a PIL Image formatted precisely for a 62x29mm Brother Label.
    At 300 DPI, 62x29mm is exactly 696 x 348 pixels.
    """
    log.debug('Creating label image: entry_id=%s description=%r date=%s', entry_id, description, date_str)
    width, height = 696, 348
    img = Image.new('RGB', (width, height), color='white')

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=1,
    )
    qr.add_data(str(entry_id))
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    qr_img = qr_img.resize((300, 300))
    img.paste(qr_img, (24, 24))
    log.debug('QR code generated and pasted')

    draw = ImageDraw.Draw(img)
    font_path_bold    = "/usr/share/fonts/liberation/LiberationSans-Bold.ttf"
    font_path_regular = "/usr/share/fonts/liberation/LiberationSans-Regular.ttf"
    try:
        font_large = ImageFont.truetype(font_path_bold, 42)
        font_small = ImageFont.truetype(font_path_regular, 28)
        log.debug('Loaded Liberation fonts')
    except IOError:
        log.warning('Liberation fonts not found at %s / %s — falling back to default',
                    font_path_bold, font_path_regular)
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()

    wrapped_desc = textwrap.fill(description.upper(), width=14)
    draw.text((340, 40),  wrapped_desc,          font=font_large, fill="black")
    draw.text((340, 260), f"Added: {date_str}",  font=font_small, fill="black")

    log.debug('Label image created (%dx%d)', width, height)
    return img


def print_label(entry_id, description, date_str, printer_identifier, printer_model='QL-600', label_size='62x29'):
    """
    Generates the image and dispatches it directly to the Brother print backend.
    """
    log.info('print_label called: entry_id=%s model=%s label=%s identifier=%r',
             entry_id, printer_model, label_size, printer_identifier)
    try:
        img = create_label_image(entry_id, description, date_str)

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
