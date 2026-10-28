const express = require('express');
const { db } = require('../supabase');
const { optionalAuth, requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();
const CATEGORIES = ['Waste & Recycling','Energy Saving','Water Conservation','Green Spaces','Sustainable Transport','Other'];
const STATUSES = ['submitted','under_review','planned','in_progress','implemented','declined'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = s => typeof s === 'string' ? s.trim() : '';
function validId(id){return UUID.test(id);}
function failDb(res, error){ console.error('Database operation failed:', error.message); return res.status(500).json({error:'The database operation failed. Check the server configuration and database schema.'}); }
async function buildIdea(row, userId) {
  const [{data: profile}, {count: voteCount}, {count: commentCount}, voteResult] = await Promise.all([
    db.from('profiles').select('display_name').eq('id',row.user_id).maybeSingle(),
    db.from('votes').select('*',{count:'exact',head:true}).eq('idea_id',row.id),
    db.from('comments').select('*',{count:'exact',head:true}).eq('idea_id',row.id),
    userId ? db.from('votes').select('id').eq('idea_id',row.id).eq('user_id',userId).maybeSingle() : Promise.resolve({data:null})
  ]);
  return {...row, author_name:profile?.display_name || 'Campus member', vote_count:voteCount||0, comment_count:commentCount||0, voted:!!voteResult.data};
}
router.get('/stats', async (req,res,next)=>{
  try{
    const [{count:total,error:e1},{count:votes,error:e2},{count:implemented,error:e3}] = await Promise.all([
      db.from('ideas').select('*',{count:'exact',head:true}),
      db.from('votes').select('*',{count:'exact',head:true}),
      db.from('ideas').select('*',{count:'exact',head:true}).eq('status','implemented')
    ]);
    if(e1||e2||e3)return failDb(res,e1||e2||e3);
    res.json({total:total||0,votes:votes||0,implemented:implemented||0});
  }catch(e){next(e);}
});
router.get('/', optionalAuth, async (req,res,next)=>{
  try{
    const search=clean(req.query.search).slice(0,100), category=clean(req.query.category), status=clean(req.query.status);
    if(category && !CATEGORIES.includes(category))return res.status(400).json({error:'Invalid category filter.'});
    if(status && !STATUSES.includes(status))return res.status(400).json({error:'Invalid status filter.'});
    let query=db.from('ideas').select('*').order('created_at',{ascending:false}).limit(100);
    if(category)query=query.eq('category',category);
    if(status)query=query.eq('status',status);
    if(req.query.mine==='true'){if(!req.user)return res.status(401).json({error:'Sign in to view your ideas.'});query=query.eq('user_id',req.user.id);}
    if(search)query=query.or(`title.ilike.%${search.replace(/[%_,().]/g,' ')}%,description.ilike.%${search.replace(/[%_,().]/g,' ')}%`);
    const {data,error}=await query;if(error)return failDb(res,error);
    const ideas=await Promise.all((data||[]).map(row=>buildIdea(row,req.user?.id)));
    if(req.query.sort==='votes')ideas.sort((a,b)=>b.vote_count-a.vote_count||new Date(b.created_at)-new Date(a.created_at));
    res.json({ideas});
  }catch(e){next(e);}
});
router.post('/', optionalAuth, requireAuth, async (req,res,next)=>{
  try{
    const title=clean(req.body.title), description=clean(req.body.description), category=clean(req.body.category);
    if(title.length<5||title.length>120)return res.status(400).json({error:'Title must be between 5 and 120 characters.'});
    if(description.length<20||description.length>2000)return res.status(400).json({error:'Description must be between 20 and 2,000 characters.'});
    if(!CATEGORIES.includes(category))return res.status(400).json({error:'Choose a valid category.'});
    const {data,error}=await db.from('ideas').insert({user_id:req.user.id,title,description,category}).select('*').single();
    if(error)return failDb(res,error);
    res.status(201).json({idea:await buildIdea(data,req.user.id)});
  }catch(e){next(e);}
});
router.get('/:id', optionalAuth, async (req,res,next)=>{
  if(!validId(req.params.id))return res.status(400).json({error:'Invalid idea ID.'});
  try{
    const {data:row,error}=await db.from('ideas').select('*').eq('id',req.params.id).maybeSingle();
    if(error)return failDb(res,error);if(!row)return res.status(404).json({error:'Idea not found.'});
    const idea=await buildIdea(row,req.user?.id);
    const {data:comments,error:ce}=await db.from('comments').select('id,idea_id,user_id,body,created_at').eq('idea_id',row.id).order('created_at',{ascending:true}).limit(100);
    if(ce)return failDb(res,ce);
    idea.comments=await Promise.all((comments||[]).map(async c=>{const {data:p}=await db.from('profiles').select('display_name').eq('id',c.user_id).maybeSingle();return {...c,author_name:p?.display_name||'Campus member'};}));
    res.json({idea});
  }catch(e){next(e);}
});
router.post('/:id/vote', optionalAuth, requireAuth, async(req,res,next)=>{
  if(!validId(req.params.id))return res.status(400).json({error:'Invalid idea ID.'});
  try{
    const {data:existing,error:readError}=await db.from('votes').select('id').eq('idea_id',req.params.id).eq('user_id',req.user.id).maybeSingle();
    if(readError)return failDb(res,readError);
    if(existing){const {error}=await db.from('votes').delete().eq('id',existing.id);if(error)return failDb(res,error);return res.json({voted:false});}
    const {error}=await db.from('votes').insert({idea_id:req.params.id,user_id:req.user.id});
    if(error){if(error.code==='23505')return res.json({voted:true});if(error.code==='23503')return res.status(404).json({error:'Idea not found.'});return failDb(res,error);}
    res.status(201).json({voted:true});
  }catch(e){next(e);}
});
router.post('/:id/comments', optionalAuth, requireAuth, async(req,res,next)=>{
  if(!validId(req.params.id))return res.status(400).json({error:'Invalid idea ID.'});
  const body=clean(req.body.body);if(body.length<2||body.length>1000)return res.status(400).json({error:'Comment must be between 2 and 1,000 characters.'});
  try{
    const {data,error}=await db.from('comments').insert({idea_id:req.params.id,user_id:req.user.id,body}).select('*').single();
    if(error){if(error.code==='23503')return res.status(404).json({error:'Idea not found.'});return failDb(res,error);}
    res.status(201).json({comment:{...data,author_name:req.user.display_name}});
  }catch(e){next(e);}
});
router.patch('/:id/status', optionalAuth, requireAuth, requireAdmin, async(req,res,next)=>{
  if(!validId(req.params.id))return res.status(400).json({error:'Invalid idea ID.'});
  const status=clean(req.body.status);if(!STATUSES.includes(status))return res.status(400).json({error:'Choose a valid status.'});
  try{const {data,error}=await db.from('ideas').update({status,updated_at:new Date().toISOString()}).eq('id',req.params.id).select('*').maybeSingle();if(error)return failDb(res,error);if(!data)return res.status(404).json({error:'Idea not found.'});res.json({idea:data});}catch(e){next(e);}
});
router.delete('/:id', optionalAuth, requireAuth, async(req,res,next)=>{
  if(!validId(req.params.id))return res.status(400).json({error:'Invalid idea ID.'});
  try{
    const {data:row,error:re}=await db.from('ideas').select('id,user_id').eq('id',req.params.id).maybeSingle();
    if(re)return failDb(res,re);if(!row)return res.status(404).json({error:'Idea not found.'});
    if(row.user_id!==req.user.id&&req.user.role!=='admin')return res.status(403).json({error:'You can delete only your own ideas.'});
    const {error}=await db.from('ideas').delete().eq('id',req.params.id);if(error)return failDb(res,error);
    res.json({message:'Idea deleted.'});
  }catch(e){next(e);}
});
module.exports=router;