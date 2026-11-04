import {readFile,writeFile} from 'node:fs/promises';
import {countSolutions,generateSolution} from '../games/binary-engine.mjs';
let state=2026110403;
function random(){state+=0x6d2b79f5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
function shuffled(values){const a=values.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const destination=new URL('../games/binary-puzzles.mjs',import.meta.url),puzzles=[],solutions=new Set(),boards=new Set();
for(const [size,total]of [[6,80],[8,80],[10,40]]){
  let attempts=0;
  while(puzzles.filter(p=>p.size===size).length<total){
    if(++attempts>3000)throw new Error(`Generation stalled at size ${size}`);
    const solution=generateSolution(size,random);if(!solution||solutions.has(solution.join('')))continue;
    const cells=solution.slice();
    for(const index of shuffled(Array.from({length:size*size},(_,i)=>i))){const value=cells[index];cells[index]=0;if(countSolutions(cells,size)!==1)cells[index]=value;}
    const givens=cells.join('');if(boards.has(givens))continue;
    const id=`bn${String(puzzles.length+1).padStart(3,'0')}`;
    puzzles.push({id,size,givens,solution:solution.join('')});solutions.add(solution.join(''));boards.add(givens);
    if(puzzles.length%20===0)console.log(`${puzzles.length} binary puzzles generated`);
  }
}
// Compare every published puzzle before writing; never repurpose a saved ID.
let existing=[];
try{await readFile(destination,'utf8');existing=(await import(destination.href+`?t=${Date.now()}`)).PUZZLES;}catch(error){if(error.code!=='ENOENT')throw error;}
for(let i=0;i<existing.length;i++)if(JSON.stringify(existing[i])!==JSON.stringify(puzzles[i]))throw new Error(`Existing binary puzzle changed at ${i+1}; append only.`);
if(existing.length===puzzles.length)console.log('All 200 binary puzzles already exist; unchanged.');
else{await writeFile(destination,`// Original, seeded binary logic puzzles. Published IDs must stay stable.\nexport const PUZZLES=${JSON.stringify(puzzles,null,2)};\nexport default PUZZLES;\n`);console.log(`Saved ${puzzles.length} binary puzzles.`);}
