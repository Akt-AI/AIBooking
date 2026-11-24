#!/usr/bin/env python3
"""Plan or apply only apex/wildcard A groups; preserve unrelated DNS records."""
import argparse, ipaddress, json, os, sys, urllib.request, urllib.error

def request(method, data=None):
    token=os.environ.get('HOSTINGER_Token')
    if not token:
        sys.exit('HOSTINGER_Token must be set in the environment; do not pass it as an argument.')
    req=urllib.request.Request('https://developers.hostinger.com/api/dns/v1/zones/aibooking.store',
        data=None if data is None else json.dumps(data).encode(), method=method,
        headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        sys.exit(f'Hostinger HTTP {exc.code}; no provider response or credential printed.')
    except (OSError,ValueError):
        sys.exit('Hostinger request failed. Check network and account configuration.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ipv4',required=True)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    try:
        address=ipaddress.IPv4Address(args.ipv4)
        if not address.is_global: raise ValueError()
    except ValueError:
        sys.exit('Supply the verified public ingress IPv4 address of the Pi.')
    zone=request('GET')
    if not isinstance(zone,list): sys.exit('Unexpected DNS zone shape; nothing changed.')
    affected=[r for r in zone if r.get('name') in ('@','*','aibooking.store','*.aibooking.store')]
    for record in affected:
        if record.get('type') in ('CNAME','AAAA'):
            sys.exit('Apex/wildcard CNAME or AAAA exists. Inspect routing before applying; nothing changed.')
    records=[{'name':name,'type':'A','ttl':300,'records':[{'content':str(address)}]} for name in ('@','*')]
    print(json.dumps({'existing_apex_and_wildcard':affected,'proposed_A_groups':records},indent=2))
    if args.apply:
        request('PUT',{'overwrite':True,'zone':records})
        print('Hostinger accepted the DNS update. Verify authoritative propagation separately.')
    else:
        print('Plan only. Add --apply to submit these two A groups.')
