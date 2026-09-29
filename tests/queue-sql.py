import sqlite3,tempfile,pathlib,concurrent.futures,re
schema=pathlib.Path('drizzle/0000_polite_next_avengers.sql').read_text().replace('--> statement-breakpoint','')
source=pathlib.Path('app/api/workspace/route.ts').read_text()
query=re.search(r'"(INSERT INTO attempts\(id,application_id,day,company_group,created\) SELECT .*?RETURNING id)"',source).group(1)
with tempfile.TemporaryDirectory() as td:
 path=td+'/test.sqlite';c=sqlite3.connect(path);c.executescript(schema);c.commit();c.close()
 def reserve(i,group='example',cap=1000000):
  c=sqlite3.connect(path,timeout=20);row=c.execute(query,(str(i),str(i),'2026-09-11',group,'2026-09-11T12:00:00Z','2026-09-11',20,group,cap)).fetchone();c.commit();c.close();return row
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:r=list(pool.map(reserve,range(30)))
 assert sum(v is not None for v in r)==20
 assert reserve(0) is None
 c=sqlite3.connect(path);c.execute('DELETE FROM attempts');c.commit();c.close()
 assert reserve(101,'bytedance',2);assert reserve(102,'bytedance',2);assert reserve(103,'bytedance',2) is None
 print('PASS: actual reservation SQL enforces daily cap under concurrency, replay prevention and affiliate cap')
 claim_query=re.search(r'"(SELECT \* FROM applications WHERE .*?updated DESC[^"]*)"',source).group(1)
 c=sqlite3.connect(path)
 c.executemany('INSERT INTO applications(id,job_id,company_group,status,updated,data) VALUES(?,?,?,?,?,?)',[(str(i),f'job-{i}','example','queued',f'2026-09-11T12:{i:03d}:00Z','{}') for i in range(101)])
 rows=c.execute(claim_query,(None,'2026-09-12T00:00:00Z',None,None,None)).fetchall()
 assert len(rows)==101
 assert any(row[0]=='0' for row in rows)
 c.close()
 print('PASS: claim queue reaches eligible applications beyond the first 100 records')
