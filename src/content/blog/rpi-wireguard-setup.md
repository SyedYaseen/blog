## Setup Wireguard on pi zero
1. Install wg: `sudo apt install wireguard`
2. Create server pub and private keys `wg genkey | tee privatekey | wg pubkey > publickey`
3. Create wg interface on server. Each wg interface has a interface and peers. On server:
  1. Addr: Base address for interface
  2. postup/down: wlan0/eth0 on network interface
  3. port: 51820 (default)
  4. Peer - pub key generated on the device, incase of phone app -> create from scratch -> copy the pub key from phone, allowed ips something other than the interface's address e.g. 10.0.0.10/32 (CIDR is /32, to denote exact IP)
```
[Interface]
PrivateKey=server_prov_key
Address=10.0.0.1/24
SaveConfig=true
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o <network_interface> -j MASQUERADE;
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o <network_interface> -j MASQUERADE;
ListenPort = 51820

[Peer]
PublicKey = Ga8nYFvE4D5zxT34ognTwM4F/h/8eQK7tlRuBNcqUxE=
AllowedIPs = 10.0.0.2/32
```

## Setup wireguard on phone
### Interface - current device wg interface
1. Name: any name
2. priv/pub key is auto generated
3. Addr: Same as one created above 10.0.0.10/24 (CIDR is /24 instead of /32)

### Peer - Connect to wg server
1. Srvr pub key
2. Public ip of wifi modem/ Server running wg
3. Keep alive 25s or whatever

### Full client config
```
[Interface]
PrivateKey = <client-private-key>
Address = <client-ip-address>/<subnet>
SaveConfig = true

[Peer]
PublicKey = <server-public-key>
Endpoint = <server-public-ip-address>:51820
AllowedIPs = 0.0.0.0/0
```
