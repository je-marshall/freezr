import logging
import os
from PIL import Image, ImageDraw, ImageFont
import qrcode
from brother_ql.conversion import convert
from brother_ql.backends.helpers import send
from brother_ql.raster import BrotherQLRaster

log = logging.getLogger(__name__)

BORDER = 5
PAD    = 14

FONT_SEARCH_PATHS = [
    "/usr/share/fonts/truetype/liberation",  # Debian / Pi OS
    "/usr/share/fonts/liberation",           # Fedora / RPM
    "/usr/share/fonts/liberation-sans-fonts",# Fedora alt path
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
    if label_def and label_def.dots_printable:
        width, height = label_def.dots_printable
        if height == 0:
            height = 271
    else:
        width, height = 696, 271

    log.debug('Creating label image: entry_id=%s description=%r date=%s dims=%dx%d',
              entry_id, description, date_str, width, height)

    img  = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)

    # Border
    draw.rectangle([0, 0, width - 1, height - 1], outline='black', width=BORDER)

    # QR code — right-aligned, padded inside border
    qr_size = height - (BORDER + PAD) * 2
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H,
                       box_size=10, border=1)
    qr.add_data(str(entry_id))
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color='black', back_color='white').resize((qr_size, qr_size))
    qr_x = width - PAD - qr_size
    qr_y = (height - qr_size) // 2
    img.paste(qr_img, (qr_x, qr_y))
    log.debug('QR code pasted at (%d,%d) size %d', qr_x, qr_y, qr_size)

    # Vertical divider
    div_x = qr_x - PAD
    draw.line([(div_x, BORDER + PAD), (div_x, height - BORDER - PAD)], fill='#cccccc', width=2)

    # Fonts
    bold_path    = _find_font('LiberationSans-Bold.ttf')
    regular_path = _find_font('LiberationSans-Regular.ttf')
    try:
        if not bold_path or not regular_path:
            raise FileNotFoundError
        f_desc = ImageFont.truetype(bold_path,    38)
        f_date = ImageFont.truetype(regular_path, 30)
        log.debug('Loaded Liberation fonts from %s', os.path.dirname(bold_path))
    except (IOError, OSError):
        log.warning('Liberation fonts not found — falling back to default')
        f_desc = ImageFont.load_default()
        f_date = ImageFont.load_default()

    # Text area
    text_x = BORDER + PAD
    text_w = div_x - PAD - text_x

    # Word-wrap description to fit text area width, capped at 3 lines
    words = description.upper().split()
    lines, line = [], []
    for word in words:
        test = ' '.join(line + [word])
        if draw.textlength(test, font=f_desc) <= text_w:
            line.append(word)
        else:
            if line:
                lines.append(' '.join(line))
            line = [word]
            if len(lines) == 2:
                last = ' '.join(line)
                while draw.textlength(last + '…', font=f_desc) > text_w and last:
                    last = last[:-1]
                lines.append(last + '…')
                line = []
                break
    if line:
        lines.append(' '.join(line))

    line_h = 44
    total_h = len(lines) * line_h
    desc_y = (height * 2 // 3 - total_h) // 2
    for l in lines:
        draw.text((text_x, desc_y), l, font=f_desc, fill='black')
        desc_y += line_h

    # Horizontal rule then date
    rule_y = height * 2 // 3
    draw.line([(text_x, rule_y), (div_x - PAD, rule_y)], fill='#aaaaaa', width=1)
    draw.text((text_x, rule_y + 8), date_str, font=f_date, fill='#444444')

    log.debug('Label image created (%dx%d)', width, height)
    return img


def print_label(entry_id, description, date_str, printer_identifier, printer_model='QL-700', label_size='62'):
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

        result = send(
            instructions=instructions,
            printer_identifier=printer_identifier,
            backend_identifier=backend,
            blocking=True,
        )

        if result.get('errors'):
            log.warning('Printer reported errors: %s', result['errors'])
            return False, f"Printer error: {', '.join(result['errors'])}"

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
