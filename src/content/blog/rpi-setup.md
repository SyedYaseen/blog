## Setup rpi
1. Get encrypted password: echo 'mypassword' | openssl passwd -6 -stdin
2. Create new file in bootfs of rpi sd.
3. Paste this one line username:encryptedpwd
4. ssh-keygen -t ed25519 is not already, this creates in default .ssh location, mv or specify file location during creation.
5. Pub key config (based on moved keys)
```
Host rpi
    HostName 192.168.1.10
    User pi
    IdentityFile ~/.ssh/pi/id_ed25519
    IdentitiesOnly yes
```
5. Login with `ssh rpi`
6. Creating empty ssh file doesnt solve ssh login issues unless a user is present.
7. More [here](https://www.raspberrypi.com/news/raspberry-pi-bullseye-update-april-2022/')

## Debug ssh
Display verbose logs with `ssh -vvv rpi`
