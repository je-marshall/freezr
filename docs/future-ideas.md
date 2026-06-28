# Future Ideas

## Pre-baked SD card images via QEMU chroot

**Problem:** First boot on a Pi Zero W takes 20-30 minutes because Python
packages (mainly Pillow) have to compile from source — no pre-built ARMv6
wheels exist.

**Idea:** Run the full install on the laptop inside an emulated ARM chroot
during `make-sd.sh`, so the SD card is fully pre-installed and first boot
goes straight to a running service (~2 minutes).

**How it works:**
1. Install `qemu-user-static` on the host (`sudo dnf install qemu-user-static`)
2. After flashing and mounting the rootfs, copy `qemu-arm-static` into it
3. Bind-mount `/proc`, `/sys`, `/dev` and `chroot` in — ARM binaries now run
   emulated on x86
4. Run `apt-get` and `pip install` inside the chroot as normal
5. Tear down mounts, remove the qemu binary — compiled packages are baked in

**Effort:** ~40 extra lines in `make-sd.sh`. The chroot install takes a few
minutes on a fast laptop vs 25+ minutes on the Zero W.

**Do we still need Pi OS?** Yes — the Zero W WiFi chip (CYW43438) needs
proprietary firmware that Pi OS ships by default. Not worth fighting.
