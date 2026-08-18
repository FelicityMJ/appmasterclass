import { apiServiceInfo, apiFieldOptions } from './api-connectors.js';

let registered = false;
let activeContext = { components: [], fields: [], pages: [], pageId:'', capabilityLevel:1, apiService:'weather' };

const colour = { event:38, data:210, screen:285, navigation:165, logic:18, variables:330, api:120 };

function loadScript(src){return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(s=>s.src===src);if(existing){if(window.Blockly&&src.includes('blockly_compressed'))return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error('Could not load Blockly. Check the internet connection or school web filter.'));document.head.appendChild(script)})}
async function ensureBlockly(){if(!window.Blockly)await loadScript('https://unpkg.com/blockly@13.2.1/blockly_compressed.js');if(!window.Blockly)throw new Error('Blockly did not load.');if(!window.__dataAppBlocklyEnglish){await loadScript('https://unpkg.com/blockly@13.2.1/msg/en.js');window.__dataAppBlocklyEnglish=true;}return window.Blockly;}
function BlocklyLib(){if(!window.Blockly)throw new Error('Blockly did not load.');return window.Blockly;}
function componentLabel(c){const page=activeContext.pages.find(p=>p.id===(c.pageId||activeContext.pages[0]?.id));return `${page?.name||'Page'} · ${c.name||c.id}`;}
function optionPairs(items, emptyLabel, labeler=x=>x.name||x.id){if(!items?.length)return [[emptyLabel,'__none__']];return items.map(x=>[labeler(x),x.id]);}
function pageComponents(){return activeContext.components.filter(c=>(c.pageId||activeContext.pages[0]?.id)===activeContext.pageId);}
function buttonOptions(){return optionPairs(pageComponents().filter(c=>c.type==='button'),'Add a button first',componentLabel);}
function listOptions(){return optionPairs(pageComponents().filter(c=>c.type==='list'),'Add a list first',componentLabel);}
function interactiveOptions(){return optionPairs(pageComponents().filter(c=>['textInput','numberInput','dropdown','switch','slider'].includes(c.type)),'Add an input first',componentLabel);}
function componentOptions(){return optionPairs(pageComponents(),'Add a component first',componentLabel);}
function textTargetOptions(){return optionPairs(pageComponents().filter(c=>['label','button','input'].includes(c.type)),'Add a text / label component first',componentLabel);}
function fieldOptions(){return optionPairs(activeContext.fields,'Add a database field first');}
function pageOptions(){return optionPairs(activeContext.pages,'Add a page first');}
function currentPageOptions(){const p=activeContext.pages.find(x=>x.id===activeContext.pageId)||activeContext.pages[0];return p?[[p.name||'Page',p.id]]:[['Add a page first','__none__']];}
function apiResultOptions(){const opts=apiFieldOptions(activeContext.apiService);return opts.length?opts:[['API result','__none__']];}
function apiTargetOptions(){return optionPairs(pageComponents().filter(c=>['label','button','input','image','textInput','numberInput'].includes(c.type)),'Add a label, text box or image first',componentLabel);}
function apiServiceLabel(){return apiServiceInfo(activeContext.apiService).name;}
function variableNameField(){const Blockly=BlocklyLib();return new Blockly.FieldTextInput('score',v=>String(v||'score').replace(/[^A-Za-z0-9_ ]/g,'').slice(0,24)||'score');}

function registerBlocks(){
  if(registered)return;const Blockly=BlocklyLib();
  Blockly.Blocks['das_event_open']={init(){this.appendDummyInput().appendField('when').appendField(new Blockly.FieldDropdown(currentPageOptions),'PAGE').appendField('opens');this.appendStatementInput('DO').appendField('do');this.setColour(colour.event);}};
  Blockly.Blocks['das_event_click']={init(){this.appendDummyInput().appendField('when').appendField(new Blockly.FieldDropdown(buttonOptions),'COMPONENT').appendField('clicked');this.appendStatementInput('DO').appendField('do');this.setColour(colour.event);}};
  Blockly.Blocks['das_event_list_click']={init(){this.appendDummyInput().appendField('when an item in').appendField(new Blockly.FieldDropdown(listOptions),'COMPONENT').appendField('is tapped');this.appendStatementInput('DO').appendField('do');this.setColour(colour.event);}};
  Blockly.Blocks['das_event_change']={init(){this.appendDummyInput().appendField('when').appendField(new Blockly.FieldDropdown(interactiveOptions),'COMPONENT').appendField('changes');this.appendStatementInput('DO').appendField('do');this.setColour(colour.event);}};
  Blockly.Blocks['das_first_record']={init(){this.appendDummyInput().appendField('🗃 go to first record');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.data);}};
  Blockly.Blocks['das_next_record']={init(){this.appendDummyInput().appendField('🗃 get next record');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.data);}};
  Blockly.Blocks['das_prev_record']={init(){this.appendDummyInput().appendField('🗃 get previous record');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.data);}};
  Blockly.Blocks['das_add_record_form']={init(){this.appendDummyInput().appendField('➕ add new record from form inputs');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.data);this.setTooltip('Creates a record using the Database field chosen in each input component.');}};
  Blockly.Blocks['das_update_record_form']={init(){this.appendDummyInput().appendField('✏ update selected record from form inputs');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.data);}};
  Blockly.Blocks['das_delete_record']={init(){this.appendDummyInput().appendField('🗑 delete selected record');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.data);}};
  Blockly.Blocks['das_set_field']={init(){this.appendDummyInput().appendField('set').appendField(new Blockly.FieldDropdown(componentOptions),'TARGET');this.appendDummyInput().appendField('to').appendField(new Blockly.FieldDropdown(fieldOptions),'FIELD').appendField('from selected record');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.screen);}};
  Blockly.Blocks['das_set_text']={init(){this.appendDummyInput().appendField('set').appendField(new Blockly.FieldDropdown(textTargetOptions),'TARGET');this.appendDummyInput().appendField('text to').appendField(new Blockly.FieldTextInput('Hello'),'TEXT');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.screen);}};
  Blockly.Blocks['das_set_from_component']={init(){this.appendDummyInput().appendField('set').appendField(new Blockly.FieldDropdown(textTargetOptions),'TARGET');this.appendDummyInput().appendField('to value of').appendField(new Blockly.FieldDropdown(interactiveOptions),'SOURCE');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.screen);}};
  Blockly.Blocks['das_show_hide']={init(){this.appendDummyInput().appendField(new Blockly.FieldDropdown([['show','show'],['hide','hide']]),'MODE').appendField(new Blockly.FieldDropdown(componentOptions),'TARGET');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.screen);}};
  Blockly.Blocks['das_message']={init(){this.appendDummyInput().appendField('💬 show message').appendField(new Blockly.FieldTextInput('Well done!'),'TEXT');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.screen);}};
  Blockly.Blocks['das_if_component']={init(){this.appendDummyInput().appendField('if').appendField(new Blockly.FieldDropdown(interactiveOptions),'SOURCE').appendField(new Blockly.FieldDropdown([['=','eq'],['≠','neq'],['>','gt'],['<','lt'],['≥','gte'],['≤','lte'],['contains','contains']]),'OP').appendField(new Blockly.FieldTextInput('value'),'VALUE');this.appendStatementInput('THEN').appendField('then');this.appendStatementInput('ELSE').appendField('else');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.logic);}};
  Blockly.Blocks['das_set_variable']={init(){this.appendDummyInput().appendField('set variable').appendField(variableNameField(),'NAME').appendField('to').appendField(new Blockly.FieldTextInput('0'),'VALUE');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.variables);}};
  Blockly.Blocks['das_change_variable']={init(){this.appendDummyInput().appendField('change variable').appendField(variableNameField(),'NAME').appendField('by').appendField(new Blockly.FieldNumber(1),'AMOUNT');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.variables);}};
  Blockly.Blocks['das_set_from_variable']={init(){this.appendDummyInput().appendField('set').appendField(new Blockly.FieldDropdown(textTargetOptions),'TARGET').appendField('to variable').appendField(variableNameField(),'NAME');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.variables);}};
  Blockly.Blocks['das_api_request']={init(){this.appendDummyInput().appendField('🌐 ask '+apiServiceLabel()).appendField('using').appendField(new Blockly.FieldDropdown(interactiveOptions),'SOURCE');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.api);this.setTooltip('Sends the value of an input to the API selected on the Connect tab.');}};
  Blockly.Blocks['das_set_from_api']={init(){this.appendDummyInput().appendField('set').appendField(new Blockly.FieldDropdown(apiTargetOptions),'TARGET');this.appendDummyInput().appendField('to API result').appendField(new Blockly.FieldDropdown(apiResultOptions),'FIELD');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.api);}};
  Blockly.Blocks['das_if_api_success']={init(){this.appendDummyInput().appendField('if last API request worked');this.appendStatementInput('THEN').appendField('then');this.appendStatementInput('ELSE').appendField('else');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.api);}};
  Blockly.Blocks['das_go_page']={init(){this.appendDummyInput().appendField('➡ go to').appendField(new Blockly.FieldDropdown(pageOptions),'PAGE');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.navigation);}};
  Blockly.Blocks['das_go_back']={init(){this.appendDummyInput().appendField('↩ go back');this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour.navigation);}};
  registered=true;
}

function toolboxForLevel(level=1){
  const contents=[
    {kind:'category',name:'Events',colour:String(colour.event),contents:[{kind:'block',type:'das_event_open'},{kind:'block',type:'das_event_click'},{kind:'block',type:'das_event_list_click'}]},
    {kind:'category',name:'Database',colour:String(colour.data),contents:[{kind:'block',type:'das_first_record'},{kind:'block',type:'das_next_record'},{kind:'block',type:'das_prev_record'}]},
    {kind:'category',name:'Screen',colour:String(colour.screen),contents:[{kind:'block',type:'das_set_field'},{kind:'block',type:'das_set_text'}]},
    {kind:'category',name:'Navigation',colour:String(colour.navigation),contents:[{kind:'block',type:'das_go_page'},{kind:'block',type:'das_go_back'}]}
  ];
  if(level>=2){
    contents[0].contents.push({kind:'block',type:'das_event_change'});
    contents[2].contents.push({kind:'block',type:'das_set_from_component'},{kind:'block',type:'das_show_hide'},{kind:'block',type:'das_message'});
    contents.splice(3,0,{kind:'category',name:'Logic',colour:String(colour.logic),contents:[{kind:'block',type:'das_if_component'}]});
  }
  if(level>=3){contents[1].contents.push({kind:'block',type:'das_add_record_form'},{kind:'block',type:'das_update_record_form'},{kind:'block',type:'das_delete_record'});}
  if(level>=4){contents.splice(contents.length-1,0,{kind:'category',name:'Variables',colour:String(colour.variables),contents:[{kind:'block',type:'das_set_variable'},{kind:'block',type:'das_change_variable'},{kind:'block',type:'das_set_from_variable'}]});}
  if(level>=5){contents.splice(contents.length-1,0,{kind:'category',name:'Web / API',colour:String(colour.api),contents:[{kind:'block',type:'das_api_request'},{kind:'block',type:'das_set_from_api'},{kind:'block',type:'das_if_api_success'}]});}
  return {kind:'categoryToolbox',contents};
}

function clean(v){return v==='__none__'?'':v||'';}
function actionsFromChain(block){const out=[];let b=block;while(b){const action=actionFromBlock(b);if(action)out.push(action);b=b.getNextBlock();}return out;}
function actionFromBlock(block){
  if(!block)return null;
  if(block.type==='das_first_record')return{id:block.id,type:'first_record'};
  if(block.type==='das_next_record')return{id:block.id,type:'next_record'};
  if(block.type==='das_prev_record')return{id:block.id,type:'prev_record'};
  if(block.type==='das_add_record_form')return{id:block.id,type:'add_record_form'};
  if(block.type==='das_update_record_form')return{id:block.id,type:'update_record_form'};
  if(block.type==='das_delete_record')return{id:block.id,type:'delete_record'};
  if(block.type==='das_set_field')return{id:block.id,type:'set_field',target:clean(block.getFieldValue('TARGET')),field:clean(block.getFieldValue('FIELD'))};
  if(block.type==='das_set_text')return{id:block.id,type:'set_text',target:clean(block.getFieldValue('TARGET')),text:block.getFieldValue('TEXT')||''};
  if(block.type==='das_set_from_component')return{id:block.id,type:'set_from_component',target:clean(block.getFieldValue('TARGET')),source:clean(block.getFieldValue('SOURCE'))};
  if(block.type==='das_show_hide')return{id:block.id,type:'set_visible',target:clean(block.getFieldValue('TARGET')),visible:block.getFieldValue('MODE')!=='hide'};
  if(block.type==='das_message')return{id:block.id,type:'show_message',text:block.getFieldValue('TEXT')||''};
  if(block.type==='das_if_component')return{id:block.id,type:'if_component',source:clean(block.getFieldValue('SOURCE')),operator:block.getFieldValue('OP')||'eq',value:block.getFieldValue('VALUE')||'',then:actionsFromChain(block.getInputTargetBlock('THEN')),else:actionsFromChain(block.getInputTargetBlock('ELSE'))};
  if(block.type==='das_set_variable')return{id:block.id,type:'set_variable',name:block.getFieldValue('NAME')||'score',value:block.getFieldValue('VALUE')||'0'};
  if(block.type==='das_change_variable')return{id:block.id,type:'change_variable',name:block.getFieldValue('NAME')||'score',amount:Number(block.getFieldValue('AMOUNT'))||0};
  if(block.type==='das_set_from_variable')return{id:block.id,type:'set_from_variable',target:clean(block.getFieldValue('TARGET')),name:block.getFieldValue('NAME')||'score'};
  if(block.type==='das_api_request')return{id:block.id,type:'api_request',source:clean(block.getFieldValue('SOURCE'))};
  if(block.type==='das_set_from_api')return{id:block.id,type:'set_from_api',target:clean(block.getFieldValue('TARGET')),field:clean(block.getFieldValue('FIELD'))};
  if(block.type==='das_if_api_success')return{id:block.id,type:'if_api_success',then:actionsFromChain(block.getInputTargetBlock('THEN')),else:actionsFromChain(block.getInputTargetBlock('ELSE'))};
  if(block.type==='das_go_page')return{id:block.id,type:'navigate_page',page:clean(block.getFieldValue('PAGE'))};
  if(block.type==='das_go_back')return{id:block.id,type:'go_back'};
  return null;
}
export function compileBlocklyProgram(workspace){
  const program=[];
  for(const top of workspace.getTopBlocks(true)){
    if(!['das_event_open','das_event_click','das_event_list_click','das_event_change'].includes(top.type))continue;
    if(top.type==='das_event_open')program.push({id:top.id,type:'event_open',page:clean(top.getFieldValue('PAGE'))});
    if(top.type==='das_event_click')program.push({id:top.id,type:'event_click',component:clean(top.getFieldValue('COMPONENT'))});
    if(top.type==='das_event_list_click')program.push({id:top.id,type:'event_list_click',component:clean(top.getFieldValue('COMPONENT'))});
    if(top.type==='das_event_change')program.push({id:top.id,type:'event_change',component:clean(top.getFieldValue('COMPONENT'))});
    program.push(...actionsFromChain(top.getInputTargetBlock('DO')));
  }
  return program;
}
function makeBlock(workspace,type,fields={}){const b=workspace.newBlock(type);Object.entries(fields).forEach(([k,v])=>{try{b.setFieldValue(String(v??''),k)}catch{}});b.initSvg();b.render();return b;}
function eventTypes(t){return ['event_open','event_click','event_list_click','event_change'].includes(t);}
function programForPage(program=[],pageId){const out=[];let include=false;const componentPage=id=>activeContext.components.find(c=>c.id===id)?.pageId||activeContext.pageId;for(const item of program){if(eventTypes(item.type)){const eventPage=item.type==='event_open'?(item.page||activeContext.pages[0]?.id):componentPage(item.component);include=eventPage===pageId;}if(include)out.push(item);}return out;}
function actionBlock(workspace,item){
  let b=null;
  if(item.type==='first_record')b=makeBlock(workspace,'das_first_record');
  if(item.type==='next_record')b=makeBlock(workspace,'das_next_record');
  if(item.type==='prev_record')b=makeBlock(workspace,'das_prev_record');
  if(item.type==='add_record_form')b=makeBlock(workspace,'das_add_record_form');
  if(item.type==='update_record_form')b=makeBlock(workspace,'das_update_record_form');
  if(item.type==='delete_record')b=makeBlock(workspace,'das_delete_record');
  if(item.type==='set_field')b=makeBlock(workspace,'das_set_field',{TARGET:item.target,FIELD:item.field});
  if(item.type==='set_text')b=makeBlock(workspace,'das_set_text',{TARGET:item.target,TEXT:item.text});
  if(item.type==='set_from_component')b=makeBlock(workspace,'das_set_from_component',{TARGET:item.target,SOURCE:item.source});
  if(item.type==='set_visible')b=makeBlock(workspace,'das_show_hide',{TARGET:item.target,MODE:item.visible===false?'hide':'show'});
  if(item.type==='show_message')b=makeBlock(workspace,'das_message',{TEXT:item.text});
  if(item.type==='set_variable')b=makeBlock(workspace,'das_set_variable',{NAME:item.name,VALUE:item.value});
  if(item.type==='change_variable')b=makeBlock(workspace,'das_change_variable',{NAME:item.name,AMOUNT:item.amount});
  if(item.type==='set_from_variable')b=makeBlock(workspace,'das_set_from_variable',{TARGET:item.target,NAME:item.name});
  if(item.type==='api_request')b=makeBlock(workspace,'das_api_request',{SOURCE:item.source});
  if(item.type==='set_from_api')b=makeBlock(workspace,'das_set_from_api',{TARGET:item.target,FIELD:item.field});
  if(item.type==='navigate_page')b=makeBlock(workspace,'das_go_page',{PAGE:item.page});
  if(item.type==='go_back')b=makeBlock(workspace,'das_go_back');
  if(item.type==='if_component'){
    b=makeBlock(workspace,'das_if_component',{SOURCE:item.source,OP:item.operator||'eq',VALUE:item.value||''});
    const attach=(inputName,actions)=>{let conn=b.getInput(inputName)?.connection||null;for(const childItem of actions||[]){const child=actionBlock(workspace,childItem);if(child&&conn&&child.previousConnection){conn.connect(child.previousConnection);conn=child.nextConnection;}}};
    attach('THEN',item.then);attach('ELSE',item.else);
  }
  if(item.type==='if_api_success'){
    b=makeBlock(workspace,'das_if_api_success');
    const attach=(inputName,actions)=>{let conn=b.getInput(inputName)?.connection||null;for(const childItem of actions||[]){const child=actionBlock(workspace,childItem);if(child&&conn&&child.previousConnection){conn.connect(child.previousConnection);conn=child.nextConnection;}}};
    attach('THEN',item.then);attach('ELSE',item.else);
  }
  return b;
}
function seedFromLegacy(workspace,program=[]){
  const firstPage=activeContext.pages[0]?.id||'screen1';const groups=[];let current=null;
  for(const item of program){if(eventTypes(item.type)){current={event:item,actions:[]};groups.push(current)}else if(current)current.actions.push(item);}
  let y=32;
  for(const group of groups){const e=group.event;let event=null;if(e.type==='event_open')event=makeBlock(workspace,'das_event_open',{PAGE:e.page||firstPage});if(e.type==='event_click')event=makeBlock(workspace,'das_event_click',{COMPONENT:e.component});if(e.type==='event_list_click')event=makeBlock(workspace,'das_event_list_click',{COMPONENT:e.component});if(e.type==='event_change')event=makeBlock(workspace,'das_event_change',{COMPONENT:e.component});if(!event)continue;event.moveBy(38,y);y+=210;let connection=event.getInput('DO')?.connection||null;for(const item of group.actions){const action=actionBlock(workspace,item);if(action&&connection&&action.previousConnection){connection.connect(action.previousConnection);connection=action.nextConnection;}}}
}
export async function initBlocklyEditor({element,project,pageId,components,fields,pages,onChange,readOnly=false,capabilityLevel=1}){
  const Blockly=await ensureBlockly();activeContext={components:components||[],fields:fields||[],pages:pages||[],pageId:pageId||pages?.[0]?.id||'',capabilityLevel:Number(capabilityLevel)||1,apiService:project?.apiService||'weather'};registerBlocks();
  const workspace=Blockly.inject(element,{toolbox:readOnly?null:toolboxForLevel(activeContext.capabilityLevel),readOnly,renderer:'zelos',trashcan:!readOnly,move:{scrollbars:true,drag:!readOnly,wheel:true},zoom:{controls:true,wheel:true,startScale:.9,maxScale:1.4,minScale:.55,scaleSpeed:1.1},grid:{spacing:20,length:3,colour:'#d9dceb',snap:!readOnly}});
  const pageState=project.blocklyPages?.[activeContext.pageId];
  if(pageState){try{Blockly.serialization.workspaces.load(pageState,workspace,{recordUndo:false})}catch(err){console.warn('Could not load this page Blockly state; rebuilding from saved program.',err);seedFromLegacy(workspace,programForPage(project.program||[],activeContext.pageId));}}
  else if(project.program?.length)seedFromLegacy(workspace,programForPage(project.program,activeContext.pageId));
  if(!readOnly){const emit=()=>{const state=Blockly.serialization.workspaces.save(workspace);const program=compileBlocklyProgram(workspace);onChange?.({blocklyState:state,program,pageId:activeContext.pageId});};workspace.addChangeListener(event=>{if(event.isUiEvent||event.type===Blockly.Events.FINISHED_LOADING)return;window.clearTimeout(workspace.__dataAppSaveTimer);workspace.__dataAppSaveTimer=window.setTimeout(emit,120);});}
  window.setTimeout(()=>Blockly.svgResize(workspace),0);return workspace;
}
