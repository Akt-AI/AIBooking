#!/usr/bin/env python3
"""Remove only TXT values the completed ACME run attempted to remove.
Work around the upstream Hostinger hook's TXT cleanup parsing failure.
"""
import json, re, subprocess, sys
from pathlib import Path

def remaining_records(zone, values):
    group=next((r for r in zone if r.get('name')=='_acme-challenge' and r.get('type')=='TXT'),None)
    if group is None: return None,None
    records=[]
    for record in group['records']:
        content=record.get('content','')
        normalized=content[1:-1] if content.startswith('"') and content.endswith('"') else content
        if normalized not in values: records.append({'content':content})
    return group, records

if __name__=='__main__':
    log=Path(sys.argv[1]).read_text()
    values=set(re.findall(r'Removing txt: ([A-Za-z0-9_-]+) for domain: _acme-challenge\.aibooking\.store',log))
    if not values: sys.exit(0)
    lines=Path('/home/pi/aibooking/.env').read_text().splitlines()
    key=next(l.split('=',1)[1].strip().strip('\"\x27') for l in lines if l.startswith('HOSTINGER_API_KEY='))
    def api(method,data=None):
        config='header = "Authorization: Bearer '+key+'"\nheader = "Content-Type: application/json"\n'
        args=['curl','-fsS','--max-time','30','--config','-','-X',method]
        if data is not None: args+=['--data-binary',json.dumps(data)]
        result=subprocess.run(args+['https://developers.hostinger.com/api/dns/v1/zones/aibooking.store'],input=config,text=True,capture_output=True)
        if result.returncode: sys.exit('Hostinger TXT cleanup failed; inspect DNS. Credential and response withheld.')
        return json.loads(result.stdout)
    group,records=remaining_records(api('GET'),values)
    if group is None or len(records)==len(group['records']): sys.exit(0)
    if records:
        api('PUT',{'overwrite':True,'zone':[{'name':'_acme-challenge','type':'TXT','ttl':group.get('ttl',120),'records':records}]})
    else:
        api('DELETE',{'filters':[{'name':'_acme-challenge','type':'TXT'}]})
    print('Removed completed ACME validation TXT values; preserved unrelated records.')
