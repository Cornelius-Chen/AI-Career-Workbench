import json,urllib.request,urllib.error,http.cookiejar,concurrent.futures
base='http://127.0.0.1:5173'
jar=http.cookiejar.MozillaCookieJar('/tmp/career-preview-cookie');jar.load(ignore_discard=True,ignore_expires=True)
opener=urllib.request.build_opener();cookie='; '.join(c.name+'='+c.value for c in jar)
def request(action=None,**kw):
 data=json.dumps(dict(action=action,**kw)).encode() if action else None
 req=urllib.request.Request(base+'/api/workspace',data=data,headers={'Content-Type':'application/json','Cookie':cookie})
 try:
  with opener.open(req) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def expect_status(req,status):assert req[0]==status,req
s=request()[1];assert len(s['jobs'])>=322
expect_status(request('applications.claim'),200);assert request('applications.claim')[1]['claimed'] is None
expect_status(request('resume.generate',jobId='job-1'),400)
expect_status(request('job.import',url='https://127.0.0.1/private',title='bad',company='bad'),400)
try: urllib.request.urlopen(base+'/api/workspace');raise AssertionError('anonymous API allowed')
except urllib.error.HTTPError as e:assert e.code==401
req=urllib.request.Request(base+'/api/workspace',headers={'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.com'})
try:urllib.request.urlopen(req);raise AssertionError('other owner allowed')
except urllib.error.HTTPError as e:assert e.code in (401,403)
# UI queue idempotency, no submissions. Restore test application after verification.
expect_status(request('applications.queue',ids=['job-1']),200);expect_status(request('applications.queue',ids=['job-1']),200)
a=[a for a in request()[1]['applications'] if a['job_id']=='job-1'];assert len(a)==1
r=request('application.begin',id=a[0]['id'],lease='not-a-lease');expect_status(r,400)
print('PASS: anonymous + other user denied; unconfirmed profile blocks generation/submission; SSRF denied; duplicate queue prevented')
