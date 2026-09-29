// Obsidian-flavoured Markdown, built as DOM nodes (never innerHTML) so note text can't inject markup.
// MarkdownView.render(body,{properties,resolve,open,openMissing,openLink,onTag}) returns an <article class="md">.
(() => {
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const CALLOUTS={note:'note',info:'info',todo:'info',abstract:'abstract',summary:'abstract',tldr:'abstract',tip:'tip',hint:'tip',important:'tip',success:'success',check:'success',done:'success',question:'question',help:'question',faq:'question',warning:'warning',caution:'warning',attention:'warning',failure:'danger',fail:'danger',missing:'danger',danger:'danger',error:'danger',bug:'danger',example:'example',quote:'quote',cite:'quote'};
 const QUERY_LANGS=new Set(['dataview','dataviewjs','tasks','query']);
 const listRe=/^( *)([-*+]|\d{1,9}[.)])(?: +(.*)|$)/,fenceRe=/^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/,headingRe=/^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/,hrRe=/^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/,quoteRe=/^ {0,3}>/,footRe=/^\[\^([^\]\s]+)\]:[ \t]*(.*)$/,rowRe=/^ *\|?(?: *:?-+:? *\|)+ *(?::?-+:?)? *\|? *$|^ *:?-+:? *(?:\| *:?-+:? *)+\|? *$/;
 const indentOf=line=>line.match(/^ */)[0].length,blank=line=>!line.trim();
 const slug=text=>text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu,'').replace(/\s+/g,'-');

 function render(body,options={}){
  const ctx={...options,footnotes:new Map(),footnoteOrder:[]};
  const root=make('article','md');
  if(options.properties&&Object.keys(options.properties).length)root.append(properties(options.properties,ctx));
  // Comments are hidden in reading view; code fences keep theirs.
  const text=String(body??'').replace(/\r\n?/g,'\n').replace(/^\t+/gm,t=>'    '.repeat(t.length)).replace(/(^|\n)( {0,3}(`{3,}|~{3,})[^\n]*\n[^]*?\n {0,3}\3[^\n]*)|<!--[^]*?-->|%%[^]*?%%/g,(m,lead,fence)=>fence?m:'');
  blocks(text.split('\n'),root,ctx);
  if(ctx.footnoteOrder.length){const section=make('section','md-footnotes'),list=make('ol');section.append(make('hr'));for(const id of ctx.footnoteOrder){const li=make('li');li.id='fn-'+id;inline(ctx.footnotes.get(id)||'',li,ctx);list.append(li);}section.append(list);root.append(section);}
  return root;
 }

 function blocks(lines,parent,ctx){
  let i=0;
  const startsBlock=line=>fenceRe.test(line)||headingRe.test(line)||hrRe.test(line)||quoteRe.test(line)||listRe.test(line)||/^ {0,3}\$\$/.test(line);
  while(i<lines.length){
   const line=lines[i];
   if(blank(line)){i++;continue;}
   let m;
   if((m=fenceRe.exec(line))){
    const mark=m[1],lang=m[2].toLowerCase(),code=[];i++;
    while(i<lines.length&&!new RegExp(`^ {0,3}${mark[0]}{${mark.length},}\\s*$`).test(lines[i]))code.push(lines[i++]);i++;
    parent.append(QUERY_LANGS.has(lang)?query(lang,code.join('\n')):codeBlock(lang,code.join('\n')));continue;
   }
   if(/^ {0,3}\$\$/.test(line)){
    const math=[line.replace(/^ *\$\$/,'')];let closed=/\$\$\s*$/.test(math[0])&&math[0].trim()!=='';if(closed)math[0]=math[0].replace(/\$\$\s*$/,'');i++;
    while(!closed&&i<lines.length){const l=lines[i++];if(/\$\$\s*$/.test(l)){math.push(l.replace(/\$\$\s*$/,''));closed=true;}else math.push(l);}
    parent.append(make('pre','md-math',math.join('\n').trim()));continue;
   }
   if((m=headingRe.exec(line))){const h=make('h'+m[1].length);const title=m[2].replace(/\s+\^[\w-]+$/,'');h.id=slug(title);inline(title,h,ctx);parent.append(h);i++;continue;}
   if(hrRe.test(line)){parent.append(make('hr'));i++;continue;}
   if(quoteRe.test(line)){
    const inner=[];while(i<lines.length&&quoteRe.test(lines[i]))inner.push(lines[i++].replace(/^ {0,3}> ?/,''));
    parent.append(quote(inner,ctx));continue;
   }
   if((m=footRe.exec(line))){
    const text=[m[2]];i++;while(i<lines.length&&/^ {2,}\S/.test(lines[i]))text.push(lines[i++].trim());
    ctx.footnotes.set(m[1],text.join(' '));continue;
   }
   if(line.includes('|')&&i+1<lines.length&&rowRe.test(lines[i+1])){i=table(lines,i,parent,ctx);continue;}
   if(listRe.test(line)){i=list(lines,i,parent,ctx);continue;}
   const para=[];
   while(i<lines.length&&!blank(lines[i])&&!(para.length&&(startsBlock(lines[i])||(lines[i].includes('|')&&rowRe.test(lines[i+1]||'')))))para.push(lines[i++]);
   paragraph(para,parent,ctx);
  }
 }

 function paragraph(lines,parent,ctx){
  // A line holding only an embed becomes a block-level embed card.
  if(lines.length===1){const m=/^\s*!\[\[([^\]\n]+)\]\]\s*$/.exec(lines[0]);if(m){parent.append(embed(m[1],ctx,'md-embed-block'));return;}}
  const p=make('p');lines.forEach((line,n)=>{if(n)p.append(make('br'));inline(line.trim().replace(/\s+\^[\w-]+$/,''),p,ctx);});parent.append(p);
 }

 function codeBlock(lang,code){
  const wrap=make('div','md-code');if(lang)wrap.append(make('span','md-code-lang',lang));
  const pre=make('pre'),c=make('code',null,code);if(lang)c.dataset.lang=lang;pre.append(c);wrap.append(pre);return wrap;
 }
 function query(lang,code){
  const box=make('details','md-query'),summary=make('summary');
  summary.append(make('strong',null,lang==='tasks'?'Tasks query':lang==='query'?'Search query':'Dataview query'),make('span',null,'Live results show in Obsidian'));
  box.append(summary,codeBlock(lang,code));return box;
 }

 function quote(lines,ctx){
  const head=/^\[!([\w-]+)\]([+-]?)[ \t]*(.*)$/.exec(lines[0]||'');
  if(!head){const q=make('blockquote');blocks(lines,q,ctx);return q;}
  const type=head[1].toLowerCase(),fold=head[2],foldable=!!fold;
  const box=make(foldable?'details':'div','md-callout');box.dataset.callout=CALLOUTS[type]||'note';box.dataset.type=type;if(foldable&&fold==='+')box.open=true;
  const title=make(foldable?'summary':'div','md-callout-title');title.append(make('span','md-callout-icon'));const label=make('span','md-callout-label');
  if(head[3])inline(head[3],label,ctx);else label.textContent=type.charAt(0).toUpperCase()+type.slice(1);title.append(label);
  box.append(title);
  if(lines.slice(1).some(l=>!blank(l))){const content=make('div','md-callout-content');blocks(lines.slice(1),content,ctx);box.append(content);}
  return box;
 }

 function splitRow(line){
  let s=line.trim();if(s.startsWith('|'))s=s.slice(1);if(s.endsWith('|')&&!s.endsWith('\\|'))s=s.slice(0,-1);
  const cells=[];let cell='',code=false,link=0;
  for(let n=0;n<s.length;n++){const ch=s[n];
   if(ch==='\\'&&s[n+1]==='|'){cell+='|';n++;continue;}
   if(ch==='`')code=!code;if(!code&&s.startsWith('[[',n))link++;if(!code&&link&&s.startsWith(']]',n))link--;
   if(ch==='|'&&!code&&!link){cells.push(cell.trim());cell='';continue;}cell+=ch;}
  cells.push(cell.trim());return cells;
 }
 function table(lines,i,parent,ctx){
  const header=splitRow(lines[i]),align=splitRow(lines[i+1]).map(c=>/^:-+:$/.test(c)?'center':/-+:$/.test(c)?'right':/^:-+/.test(c)?'left':'');
  const wrap=make('div','md-table'),t=make('table'),thead=make('thead'),tr=make('tr'),tbody=make('tbody');
  header.forEach((c,n)=>{const th=make('th');if(align[n])th.style.textAlign=align[n];inline(c,th,ctx);tr.append(th);});thead.append(tr);t.append(thead,tbody);
  i+=2;
  while(i<lines.length&&!blank(lines[i])&&lines[i].includes('|')){const row=make('tr'),cells=splitRow(lines[i++]);
   for(let n=0;n<header.length;n++){const td=make('td');if(align[n])td.style.textAlign=align[n];inline(cells[n]||'',td,ctx);row.append(td);}tbody.append(row);}
  wrap.append(t);parent.append(wrap);return i;
 }

 function list(lines,i,parent,ctx){
  const first=listRe.exec(lines[i]),base=first[1].length,ordered=/\d/.test(first[2]);
  const el=make(ordered?'ol':'ul');if(ordered&&parseInt(first[2],10)!==1)el.start=parseInt(first[2],10);
  while(i<lines.length){
   // A blank gap between sibling items keeps them in one list.
   if(blank(lines[i])){let j=i+1;while(j<lines.length&&blank(lines[j]))j++;const next=listRe.exec(lines[j]||'');if(next&&next[1].length===base&&/\d/.test(next[2])===ordered){i=j;continue;}break;}
   const m=listRe.exec(lines[i]);
   if(!m||m[1].length<base||m[1].length>base+3||/\d/.test(m[2])!==ordered)break;
   const contentIndent=m[1].length+m[2].length+1,text=[m[3]||''],rest=[];i++;
   // Gather everything belonging to this item: indented lines, lazy continuations and blank gaps inside it.
   while(i<lines.length){
    const l=lines[i];
    if(blank(l)){let j=i+1;while(j<lines.length&&blank(lines[j]))j++;if(j<lines.length&&indentOf(lines[j])>base&&indentOf(lines[j])>=Math.min(contentIndent,base+2)){while(i<j)rest.push(lines[i++]);continue;}break;}
    const sub=listRe.exec(l);
    if(sub&&sub[1].length<=base+1)break;
    if(indentOf(l)>base){rest.push(l);i++;continue;}
    if(!rest.length&&!sub&&!fenceRe.test(l)&&!headingRe.test(l)&&!quoteRe.test(l)&&!hrRe.test(l)){text.push(l);i++;continue;}
    break;
   }
   const li=make('li'),task=/^\[(.)\][ \t]+/.exec(text[0]);
   if(task){const box=make('input');box.type='checkbox';box.disabled=true;box.checked=task[1]!==' ';li.className='md-task';li.dataset.task=task[1];if(task[1]!==' ')li.classList.add('is-done');box.setAttribute('aria-label',task[1]===' '?'Open task':'Completed task');li.append(box);text[0]=text[0].slice(task[0].length);}
   const lead=make('span','md-li-text');text.forEach((t,n)=>{if(n)lead.append(make('br'));inline(t.trim().replace(/\s+\^[\w-]+$/,''),lead,ctx);});li.append(lead);
   while(rest.length&&blank(rest.at(-1)))rest.pop();
   if(rest.length){const shift=Math.min(...rest.filter(l=>!blank(l)).map(indentOf));blocks(rest.map(l=>l.slice(Math.min(shift,indentOf(l)))),li,ctx);}
   el.append(li);
  }
  parent.append(el);return i;
 }

 function properties(props,ctx){
  const box=make('details','md-properties');box.open=true;const summary=make('summary',null,'Properties');box.append(summary);
  const grid=make('dl');
  for(const [key,value] of Object.entries(props)){
   if(value===null||value===undefined||value===''||(Array.isArray(value)&&!value.length))continue;
   const dt=make('dt',null,key),dd=make('dd');dt.dataset.key=key.toLowerCase();
   const values=Array.isArray(value)?value:[value];
   if(['tags','tag'].includes(key.toLowerCase())){for(const tag of values.flatMap(v=>String(v).split(/[\s,]+/)).filter(Boolean))dd.append(tagPill(tag.replace(/^#/,''),ctx));}
   else if(typeof value==='boolean'){const b=make('input');b.type='checkbox';b.checked=value;b.disabled=true;b.setAttribute('aria-label',key);dd.append(b);}
   else if(Array.isArray(value)){for(const v of values){const chip=make('span','md-prop-chip');propValue(v,chip,ctx);dd.append(chip);}}
   else propValue(value,dd,ctx);
   grid.append(dt,dd);
  }
  if(!grid.children.length)return document.createComment('no properties');
  box.append(grid);return box;
 }
 function propValue(v,parent,ctx){
  if(v instanceof Date)v=v.toISOString().slice(0,10);
  if(v&&typeof v==='object'){parent.append(make('code',null,JSON.stringify(v)));return;}
  inline(String(v),parent,ctx);
 }

 function tagPill(tag,ctx){if(!ctx.onTag)return make('span','md-tag','#'+tag);const a=make('a','md-tag','#'+tag);a.href='#';a.title='Tag #'+tag;a.onclick=e=>{e.preventDefault();ctx.onTag(tag);};return a;}

 function wiki(raw,ctx){
  const [target,alias]=raw.split(/\\?\|/),[name,section]=target.split('#'),label=(alias||'').trim()||(section&&!name?section.replace(/^\^/,''):target.replace(/#\^?/,' › ').trim());
  const path=name.trim()?ctx.resolve?.(name.trim()):null;
  const a=make('a',path?'md-link md-internal':name.trim()?'md-link md-internal is-unresolved':'md-link md-internal',label);a.href='#';a.title=path||name.trim()||section||'';
  a.onclick=e=>{e.preventDefault();if(!name.trim()&&section){document.getElementById(slug(section))?.scrollIntoView({behavior:'smooth',block:'start'});return;}if(path)ctx.open?.(path,section);else ctx.openMissing?.(name.trim());};
  return a;
 }
 function embed(raw,ctx,cls='md-embed'){
  const [target,alias]=raw.split(/\\?\|/),name=target.split('#')[0].trim(),image=/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(name),pdf=/\.pdf$/i.test(name);
  const path=!image&&!pdf?ctx.resolve?.(name):null;
  const a=make('a',cls);a.href='#';a.dataset.kind=image?'image':pdf?'pdf':'note';a.title=path||name;
  a.append(make('span','md-embed-icon'),make('span','md-embed-name',(alias&&!/^\d+(x\d+)?$/.test(alias.trim())?alias.trim():target.trim())),make('small',null,image?'Image · open in Obsidian':pdf?'PDF · open in Obsidian':path?'Embedded note':'Embed · open in Obsidian'));
  a.onclick=e=>{e.preventDefault();if(path)ctx.open?.(path);else ctx.openMissing?.(name);};
  return a;
 }
 function external(href,label,ctx){
  const a=make('a','md-link md-external',label);a.href=href;a.title=href;a.rel='noopener noreferrer';a.onclick=e=>{e.preventDefault();ctx.openLink?.(href);};return a;
 }

 // Inline tokens: each rule is tried only when the scanner reaches one of its trigger characters.
 const rules=[
  ['\\',/\\([!-\/:-@\[-`{-~])/y,(m,p)=>p.append(m[1])],
  ['`',/(`+)(?!`)([^]*?[^`])\1(?!`)/y,(m,p)=>p.append(make('code',null,m[2].replace(/^ (.+) $/,'$1')))],
  ['!',/!\[\[([^\]\n]+?)\]\]/y,(m,p,ctx)=>p.append(embed(m[1],ctx))],
  ['!',/!\[([^\]\n]*)\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/y,(m,p,ctx)=>{const src=m[2].replace(/^<|>$/g,'');p.append(/^https?:/i.test(src)?external(src,m[1]||src,ctx):embed(decode(src)+(m[1]?'|'+m[1]:''),ctx));}],
  ['[',/\[\[([^\]\n]+?)\]\]/y,(m,p,ctx)=>p.append(wiki(m[1],ctx))],
  ['[',/\[\^([^\]\s]+)\]/y,(m,p,ctx)=>{if(!ctx.footnoteOrder.includes(m[1]))ctx.footnoteOrder.push(m[1]);const sup=make('sup','md-footnote-ref'),a=make('a',null,String(ctx.footnoteOrder.indexOf(m[1])+1));a.href='#';a.onclick=e=>{e.preventDefault();document.getElementById('fn-'+m[1])?.scrollIntoView({behavior:'smooth',block:'center'});};sup.append(a);p.append(sup);}],
  ['[',/\[((?:\[[^\]\n]*\]|[^\]\n])+)\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/y,(m,p,ctx)=>{const href=m[2].replace(/^<|>$/g,'');
   if(/^(https?|mailto):/i.test(href)){const a=external(href,'',ctx);inline(m[1],a,ctx);p.append(a);return;}
   if(/^obsidian:/i.test(href)||/^[a-z][a-z\d+.-]*:/i.test(href)){const s=make('span','md-link is-unresolved');inline(m[1],s,ctx);s.title=href;p.append(s);return;}
   const target=decode(href),a=wiki(target.replace(/\.md(?=#|$)/i,'')+'|x',ctx);a.replaceChildren();inline(m[1],a,ctx);p.append(a);}],
  ['<',/<((?:https?|mailto):[^>\s]+)>/y,(m,p,ctx)=>p.append(external(m[1],m[1].replace(/^mailto:/,''),ctx))],
  ['h',/https?:\/\/[^\s<>\[\]]*[^\s<>\[\].,;:!?)'"*_~]/y,(m,p,ctx)=>p.append(external(m[0],m[0],ctx)),prev=>!prev||/[\s(]/.test(prev)],
  ['*',/\*\*\*(?=\S)([^]*?\S)\*\*\*/y,(m,p,ctx)=>{const s=make('strong'),e=make('em');inline(m[1],e,ctx);s.append(e);p.append(s);}],
  ['*',/\*\*(?=\S)((?:\*(?!\*)[^*\n]+\*|[^*])+?)\*\*/y,(m,p,ctx)=>{if(/\s$/.test(m[1]))return false;const s=make('strong');inline(m[1],s,ctx);p.append(s);}],
  ['*',/\*(?![\s*])((?:\*\*[^*]+\*\*|[^*])+?)\*(?!\*)/y,(m,p,ctx)=>{if(/\s$/.test(m[1]))return false;const e=make('em');inline(m[1],e,ctx);p.append(e);}],
  ['_',/__(?=\S)([^]*?\S)__(?![\p{L}\p{N}])/uy,(m,p,ctx)=>{const s=make('strong');inline(m[1],s,ctx);p.append(s);},prev=>!prev||!/[\p{L}\p{N}]/u.test(prev)],
  ['_',/_(?![\s_])([^_]*?[^\s_])_(?![\p{L}\p{N}])/uy,(m,p,ctx)=>{const e=make('em');inline(m[1],e,ctx);p.append(e);},prev=>!prev||!/[\p{L}\p{N}]/u.test(prev)],
  ['~',/~~(?=\S)([^]*?\S)~~/y,(m,p,ctx)=>{const d=make('del');inline(m[1],d,ctx);p.append(d);}],
  ['=',/==(?=\S)([^]*?\S)==/y,(m,p,ctx)=>{const d=make('mark');inline(m[1],d,ctx);p.append(d);}],
  ['#',/#([\p{L}\p{N}_\-/]*[\p{L}_\-/][\p{L}\p{N}_\-/]*)/uy,(m,p,ctx)=>p.append(tagPill(m[1],ctx)),prev=>!prev||/[\s(,]/.test(prev)],
 ];
 const triggers=new Map();for(const r of rules){if(!triggers.has(r[0]))triggers.set(r[0],[]);triggers.get(r[0]).push(r);}
 function decode(s){try{return decodeURIComponent(s);}catch{return s;}}
 function inline(text,parent,ctx){
  let plain='',pos=0;const flush=()=>{if(plain){parent.append(plain);plain='';}};
  outer:while(pos<text.length){
   const list=triggers.get(text[pos]);
   if(list)for(const [,re,fn,guard] of list){
    if(guard&&!guard(text[pos-1]))continue;
    re.lastIndex=pos;const m=re.exec(text);if(!m)continue;
    const holder=document.createDocumentFragment();if(fn(m,holder,ctx)===false)continue;
    flush();parent.append(holder);pos+=m[0].length;continue outer;
   }
   plain+=text[pos++];
  }
  flush();
 }

 window.MarkdownView={render,slug};
})();
