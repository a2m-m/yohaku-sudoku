import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PUZZLES} from '../games/nonogram-puzzles.mjs';
import {cluesFor,countSolutions} from '../games/nonogram-engine.mjs';
import {additions} from './nonogram-art.mjs';

// This release appends to the first published collection. It never renumbers it.
const original=PUZZLES.slice(0,24);
const digest=createHash('sha256').update(JSON.stringify(original)).digest('hex');
if(digest!=='620c8752242a4e3bc3733ca7b4947a1df3c60e3e6e9fa7773caffcc9efc77a0f')throw new Error('Original 24 pictures changed; refuse to overwrite saved-progress IDs.');
const seen=new Set(original.map(p=>p.rows.join('')));
const quotas={5:32,10:64,15:80};
const selected={5:[],10:[],15:[]};
const omitted=new Set(['さかなの骨','歯ブラシ','くし','エプロン','つくし','せっけん','傘立て']);
for(const[title,rows]of additions){
  if(title.startsWith('数字の')||omitted.has(title))continue;
  const size=rows.length,key=rows.join('');
  if(selected[size].length>=quotas[size]||seen.has(key))continue;
  const clues=cluesFor(rows);
  if(countSolutions(clues.rows,clues.cols)!==1)continue;
  selected[size].push({title,rows});seen.add(key);
}
for(const size of Object.keys(quotas))if(selected[size].length!==quotas[size])throw new Error(`Only ${selected[size].length}/${quotas[size]} suitable pictures at ${size}×${size}.`);
const result=[...original,...Object.values(selected).flat().map(({title,rows},index)=>({id:`ng${String(index+25).padStart(3,'0')}`,size:rows.length,title,rows}))];
if(result.length!==200)throw new Error('Expected 200 puzzles.');
for(let i=0;i<PUZZLES.length;i++)if(JSON.stringify(PUZZLES[i])!==JSON.stringify(result[i]))throw new Error(`Refuse to replace an existing picture: ${PUZZLES[i].id}. Add future pictures in a new append-only release.`);
if(result.length===PUZZLES.length){
  console.log(`Already have all ${result.length} pictures. Existing data is unchanged.`);
}else{
  const lines=result.map(p=>`  [${JSON.stringify(p.title)}, ${JSON.stringify(p.rows)}],`);
  await writeFile(new URL('../games/nonogram-puzzles.mjs',import.meta.url),`// Original pixel pictures. IDs belong to saved progress; append new pictures only.\n// First 24 published pictures remain unchanged. Artwork sources: scripts/nonogram-art.mjs.\nconst pictures = [\n${lines.join('\n')}\n];\n\nexport const PUZZLES = pictures.map(([title,rows],index)=>({id:\`ng\${String(index+1).padStart(3,'0')}\`,size:rows.length,title,rows}));\nexport default PUZZLES;\n`);
  console.log(`Saved ${result.length} unique pictures (40 small, 80 medium, 80 large); original 24 unchanged.`);
}
