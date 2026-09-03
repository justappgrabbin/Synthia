import fs from 'node:fs';
const p=process.argv[2]; let s=fs.readFileSync(p,'utf8');
s=s.replace("window.__SYNTHIA_ARTIFACT_FOUNDRY__={version:'1.0.0'};","window.__SYNTHIA_ARTIFACT_FOUNDRY__={version:'1.1.0',open:null};");
s=s.replace("const s=el('style',{text:css()}),btn=el('button',{id:'saf-btn',title:'Artifact Foundry',text:'◇',onclick:()=>q('#saf').classList.add('open')}),root=el('div',{id:'saf'});","const s=el('style',{text:css()}),root=el('div',{id:'saf'});window.__SYNTHIA_ARTIFACT_FOUNDRY__.open=()=>root.classList.add('open');");
s=s.replace('document.head.append(s);document.body.append(btn,root,inp);','document.head.append(s);document.body.append(root,inp);');
if(s.includes("id:'saf-btn'")) throw new Error('Foundry floating button still present');
fs.writeFileSync(p,s);
