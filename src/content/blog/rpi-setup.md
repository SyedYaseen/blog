---
title: "Headless Raspberry Pi over SSH"
description: "Preseeding a user onto the SD card, wiring up key-based SSH, and debugging it when the Pi will not let you in"
date: "2025-12-04"
tags: ["raspberry-pi", "linux", "ssh"]
---

Since the Bullseye update in 2022 there is no default `pi` user any more. That
change is the single most common reason a headless setup fails: you drop the
empty `ssh` file onto the boot partition as every guide from before then tells
you to, the Pi boots, SSH is genuinely running — and it rejects you, because
there is no account to log in to.

So you have to create the user yourself, before first boot, by leaving a file
on the SD card for the Pi to find.

## Preseed a user

Hash the password on your own machine. The Pi will not accept a plaintext one:

```sh
echo 'mypassword' | openssl passwd -6 -stdin
```

`-6` selects SHA-512, which is what the Pi's first-boot script expects.

Then, in the **bootfs** partition of the SD card (the small FAT one that mounts
automatically, not the big Linux one), create a file called `userconf.txt`
containing a single line:

```
username:$6$hashedpasswordfromabove
```

Create the empty `ssh` file alongside it to enable the SSH server:

```sh
touch /path/to/bootfs/ssh
```

Both files are consumed and deleted during first boot. If they are still there
afterwards, the Pi never read them — usually because they landed on the wrong
partition.

## Set up your key

```sh
ssh-keygen -t ed25519 -f ~/.ssh/pi/id_ed25519
```

`-f` writes to a path of your choosing instead of overwriting your default key.
Once the Pi is up and you can log in with the password, push the public half
across:

```sh
ssh-copy-id -i ~/.ssh/pi/id_ed25519.pub username@192.168.1.10
```

Then give it a name in `~/.ssh/config` so you never type the address again:

```
Host rpi
    HostName 192.168.1.10
    User pi
    IdentityFile ~/.ssh/pi/id_ed25519
    IdentitiesOnly yes
```

```sh
ssh rpi
```

`IdentitiesOnly yes` stops SSH from offering every key in your agent before the
right one, which otherwise trips the server's failed-attempt limit.

## When it will not let you in

```sh
ssh -vvv rpi
```

The verbose log tells you which of the two failure modes you have. If you see
key exchange completing and then `Permission denied (publickey,password)`, the
network is fine and the problem is the account or the key. If the connection
never establishes at all, the Pi is not on the address you think it is — check
your router's client list, or `ping raspberrypi.local`.

Useful lines to look for: `Offering public key:` tells you which key was
actually tried, and `Authentications that can continue:` tells you what the
server is willing to accept.

Further reading: [the Raspberry Pi announcement about the removed default
user](https://www.raspberrypi.com/news/raspberry-pi-bullseye-update-april-2022/).
