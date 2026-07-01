# Future Ideas

## ~~Pre-baked SD card images via QEMU chroot~~ (implemented — `--bake` flag)

Pass `--bake` to `make-sd.sh` to run the full install via QEMU ARM chroot
during flashing. First boot goes straight to a running Freezr service with
no wait. Requires `qemu-user-static` on the host machine.
