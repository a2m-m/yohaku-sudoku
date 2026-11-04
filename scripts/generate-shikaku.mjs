import {readFile,writeFile,rename} from 'node:fs/promises';
import {countSolutions,rectangleCells} from '../games/shikaku-engine.mjs';

const destination=new URL('../games/shikaku-puzzles.mjs',import.meta.url);
let existing=[];try{await readFile(destination,'utf8');existing=(await import(destination.href)).PUZZLES;}catch(error){if(error.code!=='ENOENT')throw error;}
if(!Array.isArray(existing)||existing.length>200)throw new Error('Refuse to replace or roll back an existing collection; append in a new release.');
let seed=20261104;
function random(){seed+=0x6d2b79f5;let value=seed;value=Math.imul(value^value>>>15,value|1);value^=value+Math.imul(value^value>>>7,value|61);return ((value^value>>>14)>>>0)/4294967296;}
const choose=values=>values[Math.floor(random()*values.length)];
function partition(size){
  const rects=[{x:0,y:0,w:size,h:size}],goal=Math.round(size*size/(3.1+random()*1.1));
  while(rects.length<goal){
    const possible=rects.flatMap((r,index)=>{
      const cuts=[];
      for(let x=1;x<r.w;x++)if(x*r.h>=2&&(r.w-x)*r.h>=2)cuts.push([{...r,w:x},{...r,x:r.x+x,w:r.w-x}]);
      for(let y=1;y<r.h;y++)if(y*r.w>=2&&(r.h-y)*r.w>=2)cuts.push([{...r,h:y},{...r,y:r.y+y,h:r.h-y}]);
      return cuts.length?[{index,cuts,area:r.w*r.h}]:[];
    });
    if(!possible.length)break;
    const total=possible.reduce((sum,r)=>sum+r.area,0);let pick=random()*total,selected=possible.at(-1);for(const candidate of possible){pick-=candidate.area;if(pick<=0){selected=candidate;break;}}
    rects.splice(selected.index,1,...choose(selected.cuts));
  }
  return rects.sort((a,b)=>a.y-b.y||a.x-b.x);
}
const puzzles=[],seen=new Set();let attempts=0;
for(const [size,count]of [[5,60],[7,80],[9,60]]){
  let added=0;
  while(added<count){
    if(++attempts>50000)throw new Error(`Generation stalled at ${puzzles.length} puzzles.`);
    const solution=partition(size),clues=solution.map(rect=>({index:choose(rectangleCells(rect,size)),value:rect.w*rect.h})).sort((a,b)=>a.index-b.index),key=`${size}:${clues.map(c=>`${c.index}=${c.value}`).join(',')}`;
    if(seen.has(key))continue;
    const puzzle={id:`sk${String(puzzles.length+1).padStart(3,'0')}`,size,clues,solution};
    if(countSolutions(puzzle)!==1)continue;
    puzzles.push(puzzle);seen.add(key);added++;
  }
}
const text=`// Original seeded Shikaku puzzles. Published IDs and their clues are immutable.\nexport const PUZZLES=${JSON.stringify(puzzles)};\nexport default PUZZLES;\n`;
for(let i=0;i<existing.length;i++)if(JSON.stringify(existing[i])!==JSON.stringify(puzzles[i]))throw new Error(`Refuse to change published puzzle ${existing[i]?.id}.`);
if(existing.length===puzzles.length){console.log(`Preserved all ${existing.length} published Shikaku puzzles. Existing file is unchanged.`);process.exit(0);}
const temporary=new URL('../games/shikaku-puzzles.mjs.tmp',import.meta.url);
await writeFile(temporary,text);await rename(temporary,destination);
console.log(`Saved ${puzzles.length} independently generated, unique-solution Shikaku puzzles from ${attempts} candidates.`);
