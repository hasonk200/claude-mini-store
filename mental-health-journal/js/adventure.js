/* Deterministic grid adventure. Rendering/input/storage live in app.js. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IslandAdventure=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const LEVELS=[
 {name:'林間第一步',hint:'收集三點星光，再帶伙伴行去發光出口。',rows:[
 '###########','#P..*.....#','#.#.###.#.#','#.#...#...#','#...#.*.#.#','###.#.#.#.#','#*..#...E.#','#.........#','###########']},
 {name:'湖畔的鎖匙',hint:'搵到金鎖匙之後，就可以打開木門。',rows:[
 '###########','#P..#..*..#','#.#.#.###.#','#.#K..#...#','#.#####.###','#..*......#','###.###.#D#','#*......#E#','###########']},
 {name:'搬開小木箱',hint:'向木箱行一步就會推動佢。推唔啱，可以撤銷。',rows:[
 '###########','#P....#..E#','#.##B.#.#.#','#.*...#*..#','###.###.###','#...B...*.#','#.###.#.#.#','#.........#','###########']},
 {name:'溫室的機關',hint:'將木箱推到圓形機關上，出口前嘅藤門先會打開。',rows:[
 '###########','#P...####E#','#..B.####G#','#..O.#..*.#','#.*..###.##','#....#....#','####.#.##.#','#....K.D.*#','###########']}
];
const dirs={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
function board(level){const l=LEVELS[level];if(!l)throw new Error('Unknown level');const width=l.rows[0].length;if(l.rows.some(r=>r.length!==width))throw new Error('Unequal map rows');const tiles=l.rows.join('').split('');return {width,height:l.rows.length,tiles,stars:tiles.flatMap((v,i)=>v==='*'?[i]:[]),plates:tiles.flatMap((v,i)=>v==='O'?[i]:[]),exit:tiles.indexOf('E'),key:tiles.indexOf('K')};}
function create(level=0){const b=board(level);return {level,player:b.tiles.indexOf('P'),crates:b.tiles.flatMap((v,i)=>v==='B'?[i]:[]),collected:[],key:false,moves:0,won:false};}
const platesOpen=(b,s)=>b.plates.length>0&&b.plates.every(i=>s.crates.includes(i));
function blocked(b,s,i){return i<0||i>=b.tiles.length||['#','~'].includes(b.tiles[i])||(b.tiles[i]==='D'&&!s.key)||(b.tiles[i]==='G'&&!platesOpen(b,s));}
function step(s,direction){if(!s||s.won||!dirs[direction])return {state:s,event:'ignored'};const b=board(s.level),[dx,dy]=dirs[direction],x=s.player%b.width,y=Math.floor(s.player/b.width),nx=x+dx,ny=y+dy;
 if(nx<0||nx>=b.width||ny<0||ny>=b.height)return {state:s,event:'wall'};
 const target=ny*b.width+nx;if(blocked(b,s,target))return {state:s,event:b.tiles[target]==='D'?'locked':b.tiles[target]==='G'?'plate':'wall'};
 const next={...s,crates:[...s.crates],collected:[...s.collected]},box=s.crates.indexOf(target);let event='walk';
 if(box>=0){const bx=nx+dx,by=ny+dy,dest=by*b.width+bx;if(bx<0||bx>=b.width||by<0||by>=b.height||blocked(b,s,dest)||s.crates.includes(dest))return {state:s,event:'crate-blocked'};next.crates[box]=dest;event='push';}
 next.player=target;next.moves++;
 if(b.tiles[target]==='K'&&!next.key){next.key=true;event='key';}
 if(b.stars.includes(target)&&!next.collected.includes(target)){next.collected.push(target);event='star';}
 if(target===b.exit){if(next.collected.length===b.stars.length){next.won=true;event='win';}else event='need-stars';}
 return {state:next,event};
}
function restore(raw){if(!raw||!Number.isInteger(raw.level)||!LEVELS[raw.level])return null;const b=board(raw.level);if(!Number.isInteger(raw.player)||raw.player<0||raw.player>=b.tiles.length||['#','~'].includes(b.tiles[raw.player])||!Array.isArray(raw.crates)||!Array.isArray(raw.collected)||!Number.isInteger(raw.moves)||raw.moves<0)return null;
 const initial=create(raw.level);if(raw.crates.length!==initial.crates.length||new Set(raw.crates).size!==raw.crates.length||raw.crates.some(i=>!Number.isInteger(i)||i<0||i>=b.tiles.length||['#','~'].includes(b.tiles[i])||i===raw.player)||raw.collected.some(i=>!b.stars.includes(i))||new Set(raw.collected).size!==raw.collected.length)return null;
 return {level:raw.level,player:raw.player,crates:[...raw.crates],collected:[...raw.collected],key:raw.key===true,moves:raw.moves,won:raw.won===true&&raw.player===b.exit&&raw.collected.length===b.stars.length};}
function campaign(raw){const r=raw&&typeof raw==='object'?raw:{},best={};for(let i=0;i<LEVELS.length;i++)if(Number.isInteger(r.best?.[i])&&r.best[i]>0&&r.best[i]<1e6)best[i]=r.best[i];const unlocked=Math.max(1,Math.min(LEVELS.length,Math.floor(Number(r.unlocked)||1))),run=restore(r.run);return {unlocked,best,run:run&&run.level<unlocked?run:null};}
function finish(c,s){if(!s.won)return 0;const id=String(s.level),first=!Number.isFinite(c.best[id]);c.best[id]=Math.min(Number(c.best[id])||Infinity,s.moves);c.unlocked=Math.max(c.unlocked,Math.min(LEVELS.length,s.level+2));c.run=null;return first?12:0;}
return {LEVELS,dirs,board,create,step,restore,campaign,finish,platesOpen};
});
