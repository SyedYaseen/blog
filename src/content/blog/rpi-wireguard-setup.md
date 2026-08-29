---
title: "WireGuard on a Pi Zero"
description: "Running a WireGuard server on a Pi Zero, adding a phone as a peer, and the two settings that decide what gets tunnelled"
date: "2025-12-04"
tags: ["raspberry-pi", "wireguard", "vpn", "networking"]
---

A Pi Zero is plenty for this. WireGuard lives in the kernel and the crypto is
cheap; the bottleneck is your home upload speed long before it is the CPU.

The whole configuration is two files that mirror each other. The server lists
the phone as a peer, the phone lists the server as a peer, and each side holds
its own private key and the other's public key. Once that symmetry is clear the
rest is filling in addresses.

## Keys

```sh
sudo apt install wireguard
wg genkey | tee privatekey | wg pubkey > publickey
```

That pipeline generates a private key, writes it to `privatekey`, and derives
the public key from it into `publickey`. The private key never leaves the
machine that generated it. Do this on the Pi; the phone app generates its own
pair.

## Enable forwarding

The Pi has to route traffic between the tunnel and your network, and Linux will
not forward packets between interfaces unless you tell it to:

```sh
echo 'net.ipv4.ip_forward=1' | sudo tee /etc/sysctl.d/99-wireguard.conf
sudo sysctl -p /etc/sysctl.d/99-wireguard.conf
```

Skip this and the tunnel comes up, the handshake succeeds, and no traffic
reaches the internet — which looks like a much harder problem than it is.

## Server config

`/etc/wireguard/wg0.conf`:

```
[Interface]
PrivateKey = <server-private-key>
Address = 10.0.0.1/24
SaveConfig = true
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o wlan0 -j MASQUERADE;
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o wlan0 -j MASQUERADE;

[Peer]
PublicKey = <phone-public-key>
AllowedIPs = 10.0.0.2/32
```

Reading it line by line:

- **`Address = 10.0.0.1/24`** — the Pi's address inside the tunnel. The `/24`
  declares the whole `10.0.0.x` range as the VPN subnet. This is a private
  network that exists only between peers; pick a range you do not already use
  at home.
- **`ListenPort = 51820`** — the WireGuard default. This is the one port you
  forward on your router.
- **`PostUp` / `PostDown`** — the NAT rules that let tunnel traffic reach the
  internet through the Pi. Replace `wlan0` with the Pi's real outbound
  interface (`ip addr` will tell you — `eth0` if it is wired).
- **`AllowedIPs = 10.0.0.2/32`** — on the *server* side this is a routing
  table, not a permission. It says "traffic for this exact address goes to this
  peer". `/32` means one single address, which is what you want: overlapping
  peer ranges make the server route to the wrong phone.

Bring it up:

```sh
sudo wg-quick up wg0
sudo systemctl enable wg-quick@wg0
sudo wg                                # check for a recent handshake
```

## Phone config

In the app, create a tunnel from scratch. It generates the key pair for you;
copy its **public** key into the server's `[Peer]` block above.

```
[Interface]
PrivateKey = <phone-private-key>
Address = 10.0.0.2/24

[Peer]
PublicKey = <server-public-key>
Endpoint = <your-home-public-ip>:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
```

Two addresses that look similar and are not:

- **`Address = 10.0.0.2/24`** must match the `AllowedIPs` the server assigned
  this peer. The `/24` here tells the phone the whole VPN subnet is reachable
  over the tunnel.
- **`AllowedIPs = 0.0.0.0/0`** on the *client* side means "route everything
  through the tunnel" — full VPN. Narrow it to `10.0.0.0/24` if you only want
  to reach your home network and would rather leave everything else on the
  mobile connection.

`Endpoint` is your home public IP. If your ISP rotates it, you want dynamic DNS
here rather than a literal address.

`PersistentKeepalive = 25` sends a small packet every 25 seconds. It exists
because your router's NAT table forgets idle connections, and once it does, the
server can no longer initiate anything toward the phone. On the client side of
a NAT this is effectively required.

## If the handshake never happens

Work outward. `sudo wg` on the Pi shows the last handshake time — if it is
empty, packets are not arriving at all, so the problem is the port forward on
the router or the `Endpoint` address, not the keys. If the handshake succeeds
but nothing loads, the tunnel is fine and it is forwarding: check
`ip_forward`, then that `PostUp` names the right interface.
