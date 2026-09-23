// Run only against a disposable, empty local PostgreSQL database.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import pg from 'pg'
const port = Number(process.env.REVIEW_TEST_PORT || 55457)
const options = { host: '127.0.0.1', port, database: process.env.REVIEW_TEST_DATABASE || 'postgres', user: process.env.REVIEW_TEST_USER || process.env.USER, password: process.env.REVIEW_TEST_PASSWORD }
const db = new pg.Client(options)
await db.connect()
const uuid = (n) => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const call = (client, owner=uuid(1), opportunity=uuid(10), reviewed=null, previous=null) => client.query('select * from public.record_repreneur_opportunity_review($1,$2,$3,$4)',[owner,opportunity,reviewed,previous])
async function denied(sql, params, expected) {
  await assert.rejects(db.query(sql, params), (error) => error.message.includes(expected))
}
try {
  await db.query(`DO $$ BEGIN
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
    END $$;
    CREATE TABLE repreneurs(id uuid primary key,is_demo boolean not null);
    CREATE TABLE opportunities(id uuid primary key,is_demo boolean not null,status text,reference text,public_title text,teaser_summary text,description text,public_description_approved_hash text,public_description_approved_at timestamptz,public_description_approved_by text,sector text,activity text,location text,revenue_meur numeric,ebitda_keur numeric,headcount int,geography_node_id uuid,headcount_range text,date_added date,date_added_precision text,updated_at timestamptz default now());
    CREATE FUNCTION safe_public_opportunity_description(text,text,text,timestamptz,text) RETURNS text LANGUAGE sql AS 'SELECT $1';`)
  // Use the current actual production inventory authorization, not a substitute predicate.
  const source = readFileSync('supabase/migrations/20260914223836_single_public_opportunity_description.sql','utf8')
  const inventory = source.slice(source.indexOf('CREATE OR REPLACE FUNCTION public.w164_repreneur_live_inventory('), source.indexOf('CREATE OR REPLACE FUNCTION public.w175_record_assignment_notification()'))
  await db.query(inventory)
  await db.query(readFileSync('supabase/migrations/20260920140000_repreneur_opportunity_review_state.sql','utf8'))
  await db.query('insert into repreneurs values ($1,false),($2,false),($3,true)',[uuid(1),uuid(2),uuid(3)])
  await db.query("insert into opportunities(id,is_demo,status) values ($1,false,'active'),($2,true,'active'),($3,false,'draft')",[uuid(10),uuid(11),uuid(12)])
  await denied('select * from record_repreneur_opportunity_review($1,$2,true,false)',[uuid(1),uuid(10)],'review_requires_view')
  assert.equal((await db.query('select count(*) from repreneur_opportunity_review_state')).rows[0].count,'0')
  await db.query('set role service_role')
  assert.deepEqual((await call(db)).rows,[{viewed:true,reviewed:false}])
  const first = (await db.query('select first_viewed_at from repreneur_opportunity_review_state')).rows[0].first_viewed_at.toISOString()
  assert.deepEqual((await call(db,uuid(1),uuid(10),true,false)).rows,[{viewed:true,reviewed:true}])
  await call(db)
  assert.equal((await db.query('select first_viewed_at from repreneur_opportunity_review_state')).rows[0].first_viewed_at.toISOString(),first)
  assert.deepEqual((await call(db)).rows,[{viewed:true,reviewed:true}])
  await denied('select * from record_repreneur_opportunity_review($1,$2,true,false)',[uuid(1),uuid(10)],'review_state_changed')
  assert.deepEqual((await call(db,uuid(1),uuid(10),false,true)).rows,[{viewed:true,reviewed:false}])
  await denied('insert into repreneur_opportunity_review_state(repreneur_id,opportunity_id,is_demo) values ($1,$2,false)',[uuid(2),uuid(10)],'permission denied')
  await denied('update repreneur_opportunity_review_state set reviewed=true',[],'permission denied')
  await denied('delete from repreneur_opportunity_review_state',[],'permission denied')
  await db.query('reset role')
  await call(db,uuid(2))
  await call(db,uuid(3),uuid(11))
  for (const [owner,opp] of [[uuid(1),uuid(11)],[uuid(3),uuid(10)],[uuid(1),uuid(12)],[uuid(99),uuid(10)]]) {
    await denied('select * from record_repreneur_opportunity_review($1,$2)',[owner,opp],'review_not_available')
  }
  // Another browser/session and simultaneous openings share the exact persistent row.
  const a = new pg.Client(options); const b = new pg.Client(options)
  await a.connect(); await b.connect()
  await db.query("insert into opportunities(id,is_demo,status) values ($1,false,'active')", [uuid(13)])
  await Promise.all([call(a,uuid(1),uuid(13)),call(b,uuid(1),uuid(13)),call(db,uuid(1),uuid(13))])
  assert.equal((await db.query('select count(*) from repreneur_opportunity_review_state where opportunity_id=$1',[uuid(13)])).rows[0].count,'1')
  await db.query('delete from opportunities where id=$1',[uuid(13)])
  await Promise.all([call(a),call(b),call(db)])
  await call(a,uuid(1),uuid(10),true,false)
  assert.deepEqual((await call(b)).rows,[{viewed:true,reviewed:true}])
  await a.end(); await b.end()
  assert.equal((await db.query('select count(*) from repreneur_opportunity_review_state')).rows[0].count,'3')
  // Mode changes cannot carry personal state across namespaces; returning preserves it.
  await db.query('update repreneurs set is_demo=true where id=$1',[uuid(1)])
  await denied('select * from record_repreneur_opportunity_review($1,$2)',[uuid(1),uuid(10)],'review_not_available')
  await db.query('update repreneurs set is_demo=false where id=$1',[uuid(1)])
  assert.equal((await call(db)).rows[0].reviewed,true)
  await db.query("update opportunities set public_title='Edited title' where id=$1",[uuid(10)])
  assert.equal((await call(db)).rows[0].reviewed,true)
  for (const role of ['anon','authenticated']) {
    await db.query(`set role ${role}`)
    await denied('select * from repreneur_opportunity_review_state',[],'permission denied')
    await denied('select * from record_repreneur_opportunity_review($1,$2)',[uuid(1),uuid(10)],'permission denied')
    await db.query('reset role')
  }
  await db.query('delete from repreneurs where id=$1',[uuid(2)])
  assert.equal((await db.query('select count(*) from repreneur_opportunity_review_state')).rows[0].count,'2')
  await db.query('delete from opportunities where id=$1',[uuid(10)])
  assert.equal((await db.query('select count(*) from repreneur_opportunity_review_state')).rows[0].count,'1')
  console.log('PASS: actual migration, first/repeated view, review/undo/conflict, sessions/concurrency, owner/mode, edits, denied access, role permissions, parent cascades.')
} finally { await db.end() }
