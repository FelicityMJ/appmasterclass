let registered = false;
let activeContext = { components: [], fields: [], pages: [], pageId:'' };

const colour = { event: 38, data: 210, screen: 285, navigation: 165 };

function loadScript(src){return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(s=>s.src===src);if(existing){if(window.Blockly&&src.includes('blockly_compressed'))return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error('Could not load Blockly. Check the internet connection or school web filter.'));document.head.appendChild(script)})}
async function ensureBlockly(){
  if(!window.Blockly){await loadScript('https://unpkg.com/blockly@13.2.1/blockly_compressed.js');}
  if(!window.Blockly)throw new Error('Blockly did not load.');
  if(!window.__dataAppBlocklyEnglish){await loadScript('https://unpkg.com/blockly@13.2.1/msg/en.js');window.__dataAppBlocklyEnglish=true;}
  return window.Blockly;
}
function BlocklyLib(){if(!window.Blockly)throw new Error('Blockly did not load.');return window.Blockly;}
function pageName(id){return activeContext.pages.find(p=>p.id===id)?.name||id||'Page';}
function componentLabel(c){const page=activeContext.pages.find(p=>p.id===(c.pageId||activeContext.pages[0]?.id));return `${page?.name||'Page'} · ${c.name||c.id}`;}
function optionPairs(items, emptyLabel, labeler=x=>x.name||x.id){if(!items?.length)return [[emptyLabel,'__none__']];return items.map(x=>[labeler(x),x.id]);}
function pageComponents(){return activeContext.components.filter(c=>(c.pageId||activeContext.pages[0]?.id)===activeContext.pageId);}
function buttonOptions(){return optionPairs(pageComponents().filter(c=>c.type==='button'),'Add a button first',componentLabel);}
function listOptions(){return optionPairs(pageComponents().filter(c=>c.type==='list'),'Add a list first',componentLabel);}
function componentOptions(){return optionPairs(pageComponents(),'Add a component first',componentLabel);}
function fieldOptions(){return optionPairs(activeContext.fields,'Add a database field first');}
function pageOptions(){return optionPairs(activeContext.pages,'Add a page first');}
function currentPageOptions(){const p=activeContext.pages.find(x=>x.id===activeContext.pageId)||activeContext.pages[0];return p?[[p.name||'Page',p.id]]:[['Add a page first','__none__']];}

function registerBlocks(){
  if(registered)return;
  const Blockly=BlocklyLib();
  Blockly.Blocks['das_event_open']={init(){this.appendDummyInput().appendField('when').appendField(new Blockly.FieldDropdown(currentPageOptions),'PAGE').appendField('opens');this.appendStatementInput('DO').appendField('do');this.setColour(colour.event);this.setTooltip('Runs whenever the chosen page opens.');}};
  Blockly.Blocks['das_event_click']={init(){this.appendDummyInput().appendField('when').appendField(new Blockly.FieldDropdown(buttonOptions),'COMPONENT').appendField('clicked');this.appendStatementInput('DO').appendField('do');this.setColour(colour.event);this.setTooltip('Runs when the chosen button is clicked.');}};
  Blockly.Blocks['das_event_list_click']={init(){this.appendDummyInput().appendField('when an item in').appendField(new Blockly.FieldDropdown(listOptions),'COMPONENT').appendField('is tapped');this.appendStatementInput('DO').appendField('do');this.setColour(colour.event);this.setTooltip('The tapped row automatically becomes the selected database record.');}};
  Blockly.Blocks['das_first_record']={init(){this.appendDummyInput().appendField('🗃 go to first record');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.data);this.setTooltip('Moves the database pointer to record 1.');}};
  Blockly.Blocks['das_next_record']={init(){this.appendDummyInput().appendField('🗃 get next record');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.data);this.setTooltip('Moves to the next record, wrapping back to the first.');}};
  Blockly.Blocks['das_prev_record']={init(){this.appendDummyInput().appendField('🗃 get previous record');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.data);this.setTooltip('Moves to the previous record.');}};
  Blockly.Blocks['das_set_field']={init(){this.appendDummyInput().appendField('set').appendField(new Blockly.FieldDropdown(componentOptions),'TARGET');this.appendDummyInput().appendField('to').appendField(new Blockly.FieldDropdown(fieldOptions),'FIELD').appendField('from selected record');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.screen);this.setTooltip('Shows a database field in a screen component.');}};
  Blockly.Blocks['das_set_text']={init(){this.appendDummyInput().appendField('set').appendField(new Blockly.FieldDropdown(componentOptions),'TARGET');this.appendDummyInput().appendField('text to').appendField(new Blockly.FieldTextInput('Hello'),'TEXT');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.screen);this.setTooltip('Sets text directly instead of reading it from the database.');}};
  Blockly.Blocks['das_go_page']={init(){this.appendDummyInput().appendField('➡ go to').appendField(new Blockly.FieldDropdown(pageOptions),'PAGE');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.navigation);this.setTooltip('Opens another page and keeps the selected database record.');}};
  Blockly.Blocks['das_go_back']={init(){this.appendDummyInput().appendField('↩ go back');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.navigation);this.setTooltip('Returns to the previous page.');}};
  registered=true;
}

const toolbox={kind:'categoryToolbox',contents:[
  {kind:'category',name:'Events',colour:String(colour.event),contents:[{kind:'block',type:'das_event_open'},{kind:'block',type:'das_event_click'},{kind:'block',type:'das_event_list_click'}]},
  {kind:'category',name:'Database',colour:String(colour.data),contents:[{kind:'block',type:'das_first_record'},{kind:'block',type:'das_next_record'},{kind:'block',type:'das_prev_record'}]},
  {kind:'category',name:'Screen',colour:String(colour.screen),contents:[{kind:'block',type:'das_set_field'},{kind:'block',type:'das_set_text'}]},
  {kind:'category',name:'Navigation',colour:String(colour.navigation),contents:[{kind:'block',type:'das_go_page'},{kind:'block',type:'das_go_back'}]}
]};

function clean(v){return v==='__none__'?'':v||'';}
function actionFromBlock(block){
  if(!block)return null;
  if(block.type==='das_first_record')return{id:block.id,type:'first_record'};
  if(block.type==='das_next_record')return{id:block.id,type:'next_record'};
  if(block.type==='das_prev_record')return{id:block.id,type:'prev_record'};
  if(block.type==='das_set_field')return{id:block.id,type:'set_field',target:clean(block.getFieldValue('TARGET')),field:clean(block.getFieldValue('FIELD'))};
  if(block.type==='das_set_text')return{id:block.id,type:'set_text',target:clean(block.getFieldValue('TARGET')),text:block.getFieldValue('TEXT')||''};
  if(block.type==='das_go_page')return{id:block.id,type:'navigate_page',page:clean(block.getFieldValue('PAGE'))};
  if(block.type==='das_go_back')return{id:block.id,type:'go_back'};
  return null;
}
export function compileBlocklyProgram(workspace){
  const program=[];
  for(const top of workspace.getTopBlocks(true)){
    if(!['das_event_open','das_event_click','das_event_list_click'].includes(top.type))continue;
    if(top.type==='das_event_open')program.push({id:top.id,type:'event_open',page:clean(top.getFieldValue('PAGE'))});
    if(top.type==='das_event_click')program.push({id:top.id,type:'event_click',component:clean(top.getFieldValue('COMPONENT'))});
    if(top.type==='das_event_list_click')program.push({id:top.id,type:'event_list_click',component:clean(top.getFieldValue('COMPONENT'))});
    let child=top.getInputTargetBlock('DO');
    while(child){const action=actionFromBlock(child);if(action)program.push(action);child=child.getNextBlock();}
  }
  return program;
}
function makeBlock(workspace,type,fields={}){const b=workspace.newBlock(type);Object.entries(fields).forEach(([k,v])=>{try{b.setFieldValue(String(v??''),k)}catch{}});b.initSvg();b.render();return b;}
function programForPage(program=[],pageId){
  const out=[];let include=false;
  const componentPage=id=>activeContext.components.find(c=>c.id===id)?.pageId||activeContext.pageId;
  for(const item of program){
    if(['event_open','event_click','event_list_click'].includes(item.type)){
      const eventPage=item.type==='event_open'?(item.page||activeContext.pages[0]?.id):componentPage(item.component);
      include=eventPage===pageId;
    }
    if(include)out.push(item);
  }
  return out;
}
function seedFromLegacy(workspace,program=[]){
  const firstPage=activeContext.pages[0]?.id||'screen1';const groups=[];let current=null;
  for(const item of program){
    if(['event_open','event_click','event_list_click'].includes(item.type)){current={event:item,actions:[]};groups.push(current)}else if(current)current.actions.push(item);
  }
  let y=32;
  for(const group of groups){
    const e=group.event;let event;
    if(e.type==='event_open')event=makeBlock(workspace,'das_event_open',{PAGE:e.page||firstPage});
    if(e.type==='event_click')event=makeBlock(workspace,'das_event_click',{COMPONENT:e.component});
    if(e.type==='event_list_click')event=makeBlock(workspace,'das_event_list_click',{COMPONENT:e.component});
    event.moveBy(38,y);y+=190;let connection=event.getInput('DO')?.connection||null;
    for(const item of group.actions){
      let action=null;
      if(item.type==='first_record')action=makeBlock(workspace,'das_first_record');
      if(item.type==='next_record')action=makeBlock(workspace,'das_next_record');
      if(item.type==='prev_record')action=makeBlock(workspace,'das_prev_record');
      if(item.type==='set_field')action=makeBlock(workspace,'das_set_field',{TARGET:item.target,FIELD:item.field});
      if(item.type==='set_text')action=makeBlock(workspace,'das_set_text',{TARGET:item.target,TEXT:item.text});
      if(item.type==='navigate_page')action=makeBlock(workspace,'das_go_page',{PAGE:item.page});
      if(item.type==='go_back')action=makeBlock(workspace,'das_go_back');
      if(action&&connection&&action.previousConnection){connection.connect(action.previousConnection);connection=action.nextConnection;}
    }
  }
}
export async function initBlocklyEditor({element,project,pageId,components,fields,pages,onChange,readOnly=false}){
  const Blockly=await ensureBlockly();registerBlocks();activeContext={components:components||[],fields:fields||[],pages:pages||[],pageId:pageId||pages?.[0]?.id||''};
  const workspace=Blockly.inject(element,{toolbox:readOnly?null:toolbox,readOnly,renderer:'zelos',trashcan:!readOnly,move:{scrollbars:true,drag:!readOnly,wheel:true},zoom:{controls:true,wheel:true,startScale:.9,maxScale:1.4,minScale:.55,scaleSpeed:1.1},grid:{spacing:20,length:3,colour:'#d9dceb',snap:!readOnly}});
  const pageState=project.blocklyPages?.[activeContext.pageId];
  if(pageState){try{Blockly.serialization.workspaces.load(pageState,workspace,{recordUndo:false})}catch(err){console.warn('Could not load this page Blockly state; rebuilding from saved program.',err);seedFromLegacy(workspace,programForPage(project.program||[],activeContext.pageId))}}
  else if(project.program?.length)seedFromLegacy(workspace,programForPage(project.program,activeContext.pageId));
  if(!readOnly){const emit=()=>{const state=Blockly.serialization.workspaces.save(workspace);const program=compileBlocklyProgram(workspace);onChange?.({blocklyState:state,program,pageId:activeContext.pageId})};
  workspace.addChangeListener(event=>{if(event.isUiEvent||event.type===Blockly.Events.FINISHED_LOADING)return;window.clearTimeout(workspace.__dataAppSaveTimer);workspace.__dataAppSaveTimer=window.setTimeout(emit,120)});}
  window.setTimeout(()=>Blockly.svgResize(workspace),0);return workspace;
}
