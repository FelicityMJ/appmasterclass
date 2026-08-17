let registered = false;
let activeContext = { components: [], fields: [] };

const colour = { event: 38, data: 210, screen: 285, value: 120 };

function loadScript(src){return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(s=>s.src===src);if(existing){if(window.Blockly&&src.includes('blockly_compressed'))return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error('Could not load Blockly. Check the internet connection or school web filter.'));document.head.appendChild(script)})}
async function ensureBlockly(){
  if(!window.Blockly){await loadScript('https://unpkg.com/blockly@13.2.1/blockly_compressed.js');}
  if(!window.Blockly)throw new Error('Blockly did not load.');
  if(!window.__dataAppBlocklyEnglish){await loadScript('https://unpkg.com/blockly@13.2.1/msg/en.js');window.__dataAppBlocklyEnglish=true;}
  return window.Blockly;
}
function BlocklyLib(){if(!window.Blockly)throw new Error('Blockly did not load.');return window.Blockly;}

function optionPairs(items, emptyLabel){
  if(!items?.length) return [[emptyLabel, '__none__']];
  return items.map(x=>[x.name || x.id, x.id]);
}
function buttonOptions(){ return optionPairs(activeContext.components.filter(c=>c.type==='button'),'Add a button first'); }
function componentOptions(){ return optionPairs(activeContext.components,'Add a component first'); }
function fieldOptions(){ return optionPairs(activeContext.fields,'Add a database field first'); }

function registerBlocks(){
  if(registered) return;
  const Blockly = BlocklyLib();

  Blockly.Blocks['das_event_open'] = {
    init(){
      this.appendDummyInput().appendField('when Screen1 opens');
      this.appendStatementInput('DO').appendField('do');
      this.setColour(colour.event); this.setTooltip('Runs when the app opens.');
      this.setDeletable(true); this.setMovable(true);
    }
  };
  Blockly.Blocks['das_event_click'] = {
    init(){
      this.appendDummyInput().appendField('when').appendField(new Blockly.FieldDropdown(buttonOptions),'COMPONENT').appendField('clicked');
      this.appendStatementInput('DO').appendField('do');
      this.setColour(colour.event); this.setTooltip('Runs when the chosen button is clicked.');
    }
  };
  Blockly.Blocks['das_first_record'] = {
    init(){ this.appendDummyInput().appendField('🗃 go to first record'); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(colour.data); this.setTooltip('Moves the database pointer to record 1.'); }
  };
  Blockly.Blocks['das_next_record'] = {
    init(){ this.appendDummyInput().appendField('🗃 get next record'); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(colour.data); this.setTooltip('Moves to the next record, wrapping back to the first.'); }
  };
  Blockly.Blocks['das_prev_record'] = {
    init(){ this.appendDummyInput().appendField('🗃 get previous record'); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(colour.data); this.setTooltip('Moves to the previous record.'); }
  };
  Blockly.Blocks['das_set_field'] = {
    init(){
      this.appendDummyInput().appendField('set').appendField(new Blockly.FieldDropdown(componentOptions),'TARGET');
      this.appendDummyInput().appendField('to').appendField(new Blockly.FieldDropdown(fieldOptions),'FIELD').appendField('from current record');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(colour.screen); this.setTooltip('Shows a database field in a screen component.');
    }
  };
  Blockly.Blocks['das_set_text'] = {
    init(){
      this.appendDummyInput().appendField('set').appendField(new Blockly.FieldDropdown(componentOptions),'TARGET');
      this.appendDummyInput().appendField('text to').appendField(new Blockly.FieldTextInput('Hello'),'TEXT');
      this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(colour.screen); this.setTooltip('Sets text directly instead of reading it from the database.');
    }
  };
  registered = true;
}

const toolbox = {
  kind:'categoryToolbox',
  contents:[
    {kind:'category',name:'Events',colour:String(colour.event),contents:[
      {kind:'block',type:'das_event_open'}, {kind:'block',type:'das_event_click'}
    ]},
    {kind:'category',name:'Database',colour:String(colour.data),contents:[
      {kind:'block',type:'das_first_record'}, {kind:'block',type:'das_next_record'}, {kind:'block',type:'das_prev_record'}
    ]},
    {kind:'category',name:'Screen',colour:String(colour.screen),contents:[
      {kind:'block',type:'das_set_field'}, {kind:'block',type:'das_set_text'}
    ]}
  ]
};

function actionFromBlock(block){
  if(!block) return null;
  if(block.type==='das_first_record') return {id:block.id,type:'first_record'};
  if(block.type==='das_next_record') return {id:block.id,type:'next_record'};
  if(block.type==='das_prev_record') return {id:block.id,type:'prev_record'};
  if(block.type==='das_set_field') return {id:block.id,type:'set_field',target:(block.getFieldValue('TARGET')==='__none__'?'':block.getFieldValue('TARGET')||''),field:(block.getFieldValue('FIELD')==='__none__'?'':block.getFieldValue('FIELD')||'')};
  if(block.type==='das_set_text') return {id:block.id,type:'set_text',target:(block.getFieldValue('TARGET')==='__none__'?'':block.getFieldValue('TARGET')||''),text:block.getFieldValue('TEXT')||''};
  return null;
}

export function compileBlocklyProgram(workspace){
  const program=[];
  for(const top of workspace.getTopBlocks(true)){
    if(top.type!=='das_event_open' && top.type!=='das_event_click') continue;
    if(top.type==='das_event_open') program.push({id:top.id,type:'event_open'});
    else program.push({id:top.id,type:'event_click',component:(top.getFieldValue('COMPONENT')==='__none__'?'':top.getFieldValue('COMPONENT')||'')});
    let child=top.getInputTargetBlock('DO');
    while(child){
      const action=actionFromBlock(child); if(action) program.push(action);
      child=child.getNextBlock();
    }
  }
  return program;
}

function makeBlock(workspace,type,fields={}){
  const b=workspace.newBlock(type);
  Object.entries(fields).forEach(([key,val])=>{ try{ b.setFieldValue(String(val??''),key); }catch{} });
  b.initSvg(); b.render();
  return b;
}

function seedFromLegacy(workspace,program=[]){
  const groups=[]; let current=null;
  for(const item of program){
    if(item.type==='event_open' || item.type==='event_click'){
      current={event:item,actions:[]}; groups.push(current);
    }else if(current){ current.actions.push(item); }
  }
  let y=32;
  for(const group of groups){
    const event=group.event.type==='event_open'
      ? makeBlock(workspace,'das_event_open')
      : makeBlock(workspace,'das_event_click',{COMPONENT:group.event.component});
    event.moveBy(38,y); y+=180;
    let connection=event.getInput('DO')?.connection || null;
    for(const item of group.actions){
      let action=null;
      if(item.type==='first_record') action=makeBlock(workspace,'das_first_record');
      if(item.type==='next_record') action=makeBlock(workspace,'das_next_record');
      if(item.type==='prev_record') action=makeBlock(workspace,'das_prev_record');
      if(item.type==='set_field') action=makeBlock(workspace,'das_set_field',{TARGET:item.target,FIELD:item.field});
      if(item.type==='set_text') action=makeBlock(workspace,'das_set_text',{TARGET:item.target,TEXT:item.text});
      if(!action) continue;
      if(connection && action.previousConnection){ connection.connect(action.previousConnection); connection=action.nextConnection; }
    }
  }
}

export async function initBlocklyEditor({element,project,components,fields,onChange}){
  const Blockly=await ensureBlockly(); registerBlocks();
  activeContext={components:components||[],fields:fields||[]};
  const workspace=Blockly.inject(element,{
    toolbox,
    renderer:'zelos',
    trashcan:true,
    move:{scrollbars:true,drag:true,wheel:true},
    zoom:{controls:true,wheel:true,startScale:.9,maxScale:1.4,minScale:.55,scaleSpeed:1.1},
    grid:{spacing:20,length:3,colour:'#d9dceb',snap:true}
  });

  if(project.blocklyState){
    try{ Blockly.serialization.workspaces.load(project.blocklyState,workspace,{recordUndo:false}); }
    catch(err){ console.warn('Could not load Blockly state; rebuilding from saved program.',err); seedFromLegacy(workspace,project.program||[]); }
  }else if(project.program?.length){
    seedFromLegacy(workspace,project.program);
  }

  const emit=()=>{
    const state=Blockly.serialization.workspaces.save(workspace);
    const program=compileBlocklyProgram(workspace);
    onChange({blocklyState:state,program});
  };
  workspace.addChangeListener(event=>{
    if(event.isUiEvent || event.type===Blockly.Events.FINISHED_LOADING) return;
    window.clearTimeout(workspace.__dataAppSaveTimer);
    workspace.__dataAppSaveTimer=window.setTimeout(emit,120);
  });
  window.setTimeout(()=>Blockly.svgResize(workspace),0);
  return workspace;
}
